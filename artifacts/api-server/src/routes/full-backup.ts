import { Router, type IRouter } from "express";
import multer from "multer";
import { z } from "zod";
import { auditLogsTable, db } from "@workspace/db";
import { requireAdmin } from "../middlewares/auth";
import { dbErrorMessage } from "../lib/dbErrors";
import { logger } from "../lib/logger";
import {
  buildFullBackup,
  validateFullBackup,
  restoreFullBackup,
  APPLICATION_NAME,
  type BackupScopeName,
  type FullBackupFile,
} from "../lib/fullBackup";

const router: IRouter = Router();

// Whole-database backup files are plain JSON, same reasoning as
// mcq-backup.ts's own multer instance. A full content-or-user export can
// run well into the tens of thousands of rows, hence the larger ceiling.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: (_req, file, cb) => {
    const ok = file.originalname.toLowerCase().endsWith(".json") || file.mimetype === "application/json";
    if (!ok) { cb(new Error("Backup files are .json")); return; }
    cb(null, true);
  },
});

const ScopeQuery = z.object({ scope: z.enum(["content", "users"]) });

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

router.get("/admin/full-backup/export", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ScopeQuery.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: 'scope must be "content" or "users"' }); return; }
  try {
    const backup = await buildFullBackup(parsed.data.scope);
    const stamp = backup.exportedAt.replace(/[:.]/g, "-").slice(0, 19);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="medschoolproffs-${parsed.data.scope}-backup-${stamp}.json"`);
    res.status(200).send(JSON.stringify(backup, null, 2));
  } catch (err) {
    logger.error({ err }, "[full-backup] export failed");
    res.status(500).json({ error: `Could not build the backup: ${dbErrorMessage(err, "unknown error")}` });
  }
});

// ---------------------------------------------------------------------------
// Validate — dry run. Parses and checks a file without writing anything, so
// the admin UI can show the confirmation screen (counts + validation
// results) before anyone commits to a restore.
// ---------------------------------------------------------------------------

router.post("/admin/full-backup/validate", requireAdmin, upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "No backup file uploaded" }); return; }
  let raw: unknown;
  try {
    raw = JSON.parse(req.file.buffer.toString("utf-8"));
  } catch {
    res.status(422).json({ error: "That file isn't valid JSON." });
    return;
  }
  try {
    const result = await validateFullBackup(raw);
    res.status(200).json(result);
  } catch (err) {
    logger.error({ err }, "[full-backup] validate failed");
    res.status(500).json({ error: `Could not validate this backup: ${dbErrorMessage(err, "unknown error")}` });
  }
});

// ---------------------------------------------------------------------------
// Import — actually restores. Always re-validates server-side first (the
// validate endpoint above is for the confirmation screen; this route never
// trusts that the client already called it, or that nothing changed since).
// ---------------------------------------------------------------------------

const ImportQuery = z.object({
  // "restore-empty" (default) refuses to run if the target tables already
  // hold data — the primary migration path (empty DB → restore). "wipe-and-
  // restore" is the explicit override: it deletes existing rows for this
  // scope's tables (in reverse dependency order) before restoring, inside
  // the same transaction as the restore itself, so a failure rolls back to
  // exactly the pre-import state rather than leaving the database wiped
  // and half-restored.
  mode: z.enum(["restore-empty", "wipe-and-restore"]).default("restore-empty"),
});

router.post("/admin/full-backup/import", requireAdmin, upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "No backup file uploaded" }); return; }

  const queryParsed = ImportQuery.safeParse(req.query);
  if (!queryParsed.success) { res.status(400).json({ error: "Invalid mode" }); return; }
  const { mode } = queryParsed.data;

  let raw: unknown;
  try {
    raw = JSON.parse(req.file.buffer.toString("utf-8"));
  } catch {
    res.status(422).json({ error: "That file isn't valid JSON." });
    return;
  }

  const validation = await validateFullBackup(raw);
  if (!validation.valid || !validation.scope) {
    res.status(422).json({ error: "This backup failed validation and cannot be restored.", validation });
    return;
  }
  if (validation.targetHasExistingData && mode === "restore-empty") {
    res.status(409).json({
      error: `This server already has ${validation.scope} data. Restoring here would create duplicates. Re-run with mode=wipe-and-restore to replace it, or restore into a fresh database instead.`,
      validation,
    });
    return;
  }

  try {
    const file = raw as FullBackupFile;
    const result = await restoreFullBackup(file, mode);

    await db.insert(auditLogsTable).values({
      actorId: req.user!.id,
      action: "FULL_DATABASE_RESTORED",
      entity: file.scope === "content" ? "platform_content" : "student_data",
      metadata: JSON.stringify({ scope: file.scope, mode, restored: result.restored, wipedFirst: result.wipedFirst, sourceExportedAt: file.exportedAt }),
    });

    res.status(201).json({ ...result, application: APPLICATION_NAME });
  } catch (err) {
    logger.error({ err }, "[full-backup] restore failed");
    res.status(422).json({ error: `Could not restore this backup: ${dbErrorMessage(err, "unknown database error")}` });
  }
});

export default router;

export type { BackupScopeName };
