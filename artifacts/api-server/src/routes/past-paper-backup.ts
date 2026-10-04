import { Router, type IRouter } from "express";
import multer from "multer";
import { z } from "zod";
import { auditLogsTable, db } from "@workspace/db";
import { requireAdmin } from "../middlewares/auth";
import { dbErrorMessage } from "../lib/dbErrors";
import { logger } from "../lib/logger";
import { buildPastPaperBackup, parsePastPaperBackup, restorePastPaperBackup } from "../lib/pastPaperBackup";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB — same ceiling as the whole-database backup
  fileFilter: (_req, file, cb) => {
    const ok = file.originalname.toLowerCase().endsWith(".json") || file.mimetype === "application/json";
    if (!ok) { cb(new Error("Backup files are .json")); return; }
    cb(null, true);
  },
});

// Export — every past paper with its questions, or just one (?paperId=).
router.get("/admin/past-paper-backup/export", requireAdmin, async (req, res): Promise<void> => {
  const parsed = z.object({ paperId: z.coerce.number().int().positive().optional() }).safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "paperId must be a number" }); return; }
  try {
    const backup = await buildPastPaperBackup(parsed.data.paperId);
    if (parsed.data.paperId && backup.counts.pastPapers === 0) { res.status(404).json({ error: "Past paper not found" }); return; }
    const stamp = backup.exportedAt.slice(0, 10);
    const slug = backup.scope ? `-${backup.scope.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || backup.scope.paperId}` : "";
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="past-papers-backup${slug}-${stamp}.json"`);
    res.status(200).send(JSON.stringify(backup, null, 2));
  } catch (err) {
    logger.error({ err }, "[past-paper-backup] export failed");
    res.status(500).json({ error: `Could not build the backup: ${dbErrorMessage(err, "unknown error")}` });
  }
});

// Import — append (add alongside what's there) or replace (swap what the
// file covers). One transaction, so a failure leaves everything untouched.
router.post("/admin/past-paper-backup/import", requireAdmin, upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "No backup file uploaded" }); return; }
  const mode = z.enum(["append", "replace"]).default("append").safeParse(req.query.mode);
  if (!mode.success) { res.status(400).json({ error: "mode must be append or replace" }); return; }

  let raw: unknown;
  try { raw = JSON.parse(req.file.buffer.toString("utf-8")); } catch { res.status(422).json({ error: "That file isn't valid JSON." }); return; }
  const parsed = parsePastPaperBackup(raw);
  if (!parsed.ok) { res.status(422).json({ error: parsed.error }); return; }

  try {
    const result = await restorePastPaperBackup(parsed.data, mode.data);
    await db.insert(auditLogsTable).values({
      actorId: req.user!.id,
      action: "PAST_PAPERS_BACKUP_RESTORED",
      entity: "past_paper",
      metadata: JSON.stringify({ ...result, source: parsed.source }),
    }).catch((err: unknown) => logger.error({ err }, "[past-paper-backup] restored, but the audit log entry failed"));
    res.status(201).json({ ...result, source: parsed.source });
  } catch (err) {
    logger.error({ err }, "[past-paper-backup] restore failed");
    res.status(422).json({ error: `Could not restore this backup: ${dbErrorMessage(err, "unknown database error")}` });
  }
});

export default router;
