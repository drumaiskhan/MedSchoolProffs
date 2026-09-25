import { Router, type IRouter } from "express";
import multer from "multer";
import { z } from "zod";
import { requireAdmin } from "../middlewares/auth";
import { logger } from "../lib/logger";
import {
  testMysqlConnection,
  validateForMysql,
  restoreToMysql,
  MysqlTargetHasDataError,
} from "@workspace/scripts/mysql-restore/restore";

// ---------------------------------------------------------------------------
// Admin -> Database Backup & Restore, MySQL target. Wires the CLI-only
// importer under scripts/src/mysql-restore/ into the same admin page that
// already exports/restores PostgreSQL. This is strictly an alternate
// *destination* for the same portable JSON backup produced by
// full-backup.ts's export route — it never touches Postgres, `@workspace/db`,
// DATABASE_URL, or the Drizzle dialect. PostgreSQL/Supabase remains the
// live, production database regardless of what an admin does here.
//
// The MySQL connection string is supplied per-request from the browser and
// is never persisted (no DB write, no logging) — treat it like a password
// field the admin re-enters each time.
// ---------------------------------------------------------------------------

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB, same ceiling as the Postgres full-backup routes
  fileFilter: (_req, file, cb) => {
    const ok = file.originalname.toLowerCase().endsWith(".json") || file.mimetype === "application/json";
    if (!ok) { cb(new Error("Backup files are .json")); return; }
    cb(null, true);
  },
});

function redactUrl(err: unknown): string {
  // mysql2 error messages can echo back the connection string on some
  // failure paths (e.g. DNS errors including the host). Strip anything
  // that looks like a mysql:// URI before it reaches a log line or the
  // client, out of caution — credentials should never round-trip.
  const message = err instanceof Error ? err.message : String(err);
  return message.replace(/mysql:\/\/[^\s"']+/gi, "mysql://[redacted]");
}

// ---------------------------------------------------------------------------
// Test connection — lets the admin confirm the connection string works
// before uploading a file or attempting anything destructive.
// ---------------------------------------------------------------------------

const ConnectionBody = z.object({ url: z.string().min(1, "MySQL connection string is required") });

router.post("/admin/full-backup/mysql/test-connection", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ConnectionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }); return; }
  try {
    const result = await testMysqlConnection(parsed.data.url);
    if (!result.ok) { res.status(200).json({ ok: false, error: redactUrl(result.error) }); return; }
    res.status(200).json({ ok: true });
  } catch (err) {
    logger.error({ err: redactUrl(err) }, "[full-backup-mysql] test-connection failed");
    res.status(500).json({ ok: false, error: "Could not test this connection." });
  }
});

// ---------------------------------------------------------------------------
// Validate — dry run, same shape/semantics as the Postgres
// /admin/full-backup/validate route, so the frontend can reuse its existing
// confirmation-screen rendering. Also checks whether the MySQL target
// already has rows for this scope, since (unlike Postgres) that target is a
// database the API server doesn't otherwise know about.
// ---------------------------------------------------------------------------

router.post("/admin/full-backup/mysql/validate", requireAdmin, upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "No backup file uploaded" }); return; }
  const parsed = ConnectionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? "MySQL connection string is required" }); return; }

  let raw: unknown;
  try {
    raw = JSON.parse(req.file.buffer.toString("utf-8"));
  } catch {
    res.status(422).json({ error: "That file isn't valid JSON." });
    return;
  }

  try {
    const result = await validateForMysql(raw, parsed.data.url);
    res.status(200).json(result);
  } catch (err) {
    logger.error({ err: redactUrl(err) }, "[full-backup-mysql] validate failed");
    res.status(500).json({ error: `Could not validate this backup against MySQL: ${redactUrl(err)}` });
  }
});

// ---------------------------------------------------------------------------
// Import — actually restores into MySQL. Always re-validates server-side
// first, same reasoning as the Postgres import route: never trust that the
// client already called /validate or that nothing changed since.
// ---------------------------------------------------------------------------

const ImportBody = z.object({
  url: z.string().min(1, "MySQL connection string is required"),
  mode: z.enum(["restore-empty", "wipe-and-restore"]).default("restore-empty"),
});

router.post("/admin/full-backup/mysql/import", requireAdmin, upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "No backup file uploaded" }); return; }
  const parsed = ImportBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }); return; }
  const { url, mode } = parsed.data;

  let raw: unknown;
  try {
    raw = JSON.parse(req.file.buffer.toString("utf-8"));
  } catch {
    res.status(422).json({ error: "That file isn't valid JSON." });
    return;
  }

  const validation = await validateForMysql(raw, url);
  if (!validation.valid || !validation.scope) {
    res.status(422).json({ error: "This backup failed validation and cannot be restored.", validation });
    return;
  }
  if (validation.targetHasExistingData && mode === "restore-empty") {
    res.status(409).json({
      error: `This MySQL database already has ${validation.scope} data. Restoring here would create duplicates. Re-run with mode=wipe-and-restore to replace it, or restore into a fresh database instead.`,
      validation,
    });
    return;
  }

  try {
    const result = await restoreToMysql(raw, url, mode);

    // Deliberately not written to auditLogsTable (that table lives in the
    // Postgres app database, `@workspace/db`) — logging a MySQL-target
    // restore into the Postgres audit log would blur what actually
    // happened to which database. Server logs capture it instead.
    logger.info({ scope: result.scope, mode: result.mode, restored: result.restored }, "[full-backup-mysql] restore completed");

    res.status(201).json(result);
  } catch (err) {
    if (err instanceof MysqlTargetHasDataError) {
      res.status(409).json({ error: `${err.message} Re-run with mode=wipe-and-restore to replace it.` });
      return;
    }
    logger.error({ err: redactUrl(err) }, "[full-backup-mysql] restore failed");
    res.status(422).json({ error: `Could not restore this backup into MySQL: ${redactUrl(err)}` });
  }
});

export default router;
