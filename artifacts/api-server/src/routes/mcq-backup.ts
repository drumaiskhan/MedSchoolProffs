import { Router, type IRouter } from "express";
import multer from "multer";
import { z } from "zod";
import { auditLogsTable, db } from "@workspace/db";
import { requireAdmin } from "../middlewares/auth";
import { dbErrorMessage } from "../lib/dbErrors";
import {
  buildMcqBackup,
  restoreMcqBackup,
  restoreMcqBackupWithStructure,
  selectMcqIdsInScope,
  McqBackupFileSchema,
  MCQ_BACKUP_FORMAT_VERSION,
} from "../lib/mcqBackup";
import { deleteMcqsEverywhere } from "../lib/mcqCascade";
import { mcqsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { BACKUP_SCOPE_LEVELS, BACKUP_PROGRAMS, describeScope, sanitizeScopeLabel, scopeFilenamePart, type BackupScope } from "../lib/backupScope";

const router: IRouter = Router();

// Backup files are plain JSON, not one of mcq-import.ts's parsed formats —
// its own upload() only accepts .txt/.csv/.xlsx/.xls/.pdf/.docx, so this
// gets its own multer instance rather than reusing that one. A full bank
// backup can run large (thousands of questions with explanations), hence
// the bigger ceiling than the 20MB file-import limit.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (_req, file, cb) => {
    const ok = file.originalname.toLowerCase().endsWith(".json") || file.mimetype === "application/json";
    if (!ok) { cb(new Error("Backup files are .json")); return; }
    cb(null, true);
  },
});

// ---------------------------------------------------------------------------
// Export — download the whole MCQ bank, or (given ?scopeLevel & ?scopeId)
// just the questions under one Year/Block/Module/Subject/Topic branch, as
// one JSON backup file.
// ---------------------------------------------------------------------------

const ExportQuery = z.object({
  scopeLevel: z.enum(BACKUP_SCOPE_LEVELS).optional(),
  // The row id for block/module/subject/topic scopes, or the year number
  // (1-5) itself for a "year" scope — see backupScope.ts.
  scopeId: z.coerce.number().int().optional(),
  // Optional, admin-supplied label straight from whatever the picker showed
  // them (e.g. "Anatomy") — used as-is for the filename/embedded scope so
  // it always matches what they picked, with describeScope as a fallback
  // when it's missing.
  scopeLabel: z.string().optional(),
  // MBBS / BDS / SHARED (no program targeting) — only used with scopeLevel
  // "program" (required there) or "year" (optional: omit for every program).
  scopeProgram: z.enum(BACKUP_PROGRAMS).optional(),
});

router.get("/admin/mcq-backup/export", requireAdmin, async (req, res): Promise<void> => {
  const queryParsed = ExportQuery.safeParse(req.query);
  if (!queryParsed.success) { res.status(400).json({ error: "Invalid scope" }); return; }
  const { scopeLevel, scopeId: rawScopeId, scopeLabel, scopeProgram } = queryParsed.data;
  // A whole-program scope has no row id of its own.
  const scopeId = scopeLevel === "program" ? 0 : rawScopeId;
  if (scopeLevel === "program" && !scopeProgram) { res.status(400).json({ error: "Choose MBBS, BDS or Shared for a program backup" }); return; }
  if (scopeLevel && scopeId === undefined) { res.status(400).json({ error: "scopeId is required alongside scopeLevel" }); return; }

  try {
    const scope: BackupScope | undefined = scopeLevel && scopeId !== undefined
      ? { level: scopeLevel, id: scopeId, label: sanitizeScopeLabel(scopeLabel || (await describeScope(scopeLevel, scopeId))), ...(scopeProgram ? { program: scopeProgram } : {}) }
      : undefined;

    const backup = await buildMcqBackup(scope);
    const s = backup.structure;
    const structureNodes = s ? s.blocks.length + s.modules.length + s.subjects.length + s.topics.length + s.pastPapers.length + s.exams.length : 0;
    if (scope && backup.mcqs.length === 0 && structureNodes === 0) {
      res.status(404).json({ error: `Nothing found under ${scope.label} — no questions and no structure to back up.` });
      return;
    }
    const stamp = backup.exportedAt.slice(0, 10);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("X-Backup-Counts", JSON.stringify({ questions: backup.mcqs.length, blocks: s?.blocks.length ?? 0, modules: s?.modules.length ?? 0, subjects: s?.subjects.length ?? 0, topics: s?.topics.length ?? 0, pastPapers: s?.pastPapers.length ?? 0, exams: s?.exams.length ?? 0 }));
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, X-Backup-Counts");
    res.setHeader("Content-Disposition", `attachment; filename="mcq-bank-backup-${scopeFilenamePart(scope ?? null)}-${stamp}.json"`);
    res.status(200).send(JSON.stringify(backup, null, 2));
  } catch (err) {
    res.status(500).json({ error: `Could not build the backup: ${dbErrorMessage(err, "unknown error")}` });
  }
});

// ---------------------------------------------------------------------------
// Import — restore a whole backed-up MCQs file.
// ---------------------------------------------------------------------------

const ImportQuery = z.object({
  // "merge" (default for v2 backups): rebuild whatever curriculum is missing
  // and add only the questions that aren't already in the bank.
  // "append": rebuild missing curriculum and add every question again.
  // "replace": hard-deletes the questions the backup's scope covers (and their
  // practice/exam history, via the same cascade the past-paper/exam
  // permanent-delete routes use) before restoring, for a true "go back to
  // exactly this backup" restore.
  mode: z.enum(["merge", "append", "replace"]).default("merge"),
});

// Shared by /preview and /import: read the upload, parse + validate it, and
// reject files this server can't safely restore. Returns null after having
// already sent the error response.
async function readBackupUpload(req: import("express").Request, res: import("express").Response) {
  if (!req.file) { res.status(400).json({ error: "No backup file uploaded" }); return null; }

  const queryParsed = ImportQuery.safeParse(req.query);
  if (!queryParsed.success) { res.status(400).json({ error: "Invalid mode" }); return null; }

  let raw: unknown;
  try {
    raw = JSON.parse(req.file.buffer.toString("utf-8"));
  } catch {
    res.status(422).json({ error: "That file isn't valid JSON — is this an MCQ bank backup?" });
    return null;
  }

  const parsed = McqBackupFileSchema.safeParse(raw);
  if (!parsed.success) {
    res.status(422).json({ error: `This doesn't look like an MCQ backup file: ${parsed.error.issues[0]?.message ?? "invalid shape"}` });
    return null;
  }
  // A backup from a newer format than this server understands is rejected
  // rather than guessed at — silently dropping fields it doesn't recognize
  // could restore an incomplete/wrong bank with no warning.
  if (parsed.data.formatVersion && parsed.data.formatVersion > MCQ_BACKUP_FORMAT_VERSION) {
    res.status(422).json({ error: `This backup was made by a newer version of the app (format v${parsed.data.formatVersion}) and can't be safely restored here (this server supports up to v${MCQ_BACKUP_FORMAT_VERSION}).` });
    return null;
  }
  const s = parsed.data.structure;
  const hasStructure = !!s && (s.blocks.length + s.modules.length + s.subjects.length + s.topics.length + s.pastPapers.length + s.exams.length) > 0;
  if (parsed.data.mcqs.length === 0 && !hasStructure) {
    res.status(422).json({ error: "This backup file is empty — it has no questions and no structure." });
    return null;
  }
  return { file: parsed.data, mode: queryParsed.data.mode };
}

// Dry run — same matching logic as the real restore, nothing written. Feeds
// the confirmation dialog ("will create 3 modules, 412 questions; 38 already
// exist") so nobody commits to a restore blind.
router.post("/admin/mcq-backup/preview", requireAdmin, upload.single("file"), async (req, res): Promise<void> => {
  const read = await readBackupUpload(req, res);
  if (!read) return;
  const { file, mode } = read;
  try {
    if (!file.structure) {
      // v1 file: no tree to match, questions go back by their raw ids.
      let deleting = 0;
      if (mode === "replace") deleting = file.scope ? (await selectMcqIdsInScope(file.scope)).length : (await db.select({ id: mcqsTable.id }).from(mcqsTable)).length;
      res.json({ legacy: true, mode, scope: file.scope ?? null, questions: { inBackup: file.mcqs.length, restored: file.mcqs.length }, deletedFirst: deleting, warnings: ["This is an older backup without curriculum structure — questions go back to their original module/subject/topic ids, so the structure must already exist here."] });
      return;
    }
    res.json({ legacy: false, ...(await restoreMcqBackupWithStructure(file, mode, { dryRun: true })) });
  } catch (err) {
    logger.error({ err }, "[mcq-backup] preview failed");
    res.status(422).json({ error: `Could not check this backup: ${dbErrorMessage(err, err instanceof Error ? err.message : "unknown error")}` });
  }
});

router.post("/admin/mcq-backup/import", requireAdmin, upload.single("file"), async (req, res): Promise<void> => {
  const read = await readBackupUpload(req, res);
  if (!read) return;
  const { file, mode } = read;
  const scope = file.scope;

  try {
    // ---- v2: structure-aware restore, one transaction ----------------------
    if (file.structure) {
      const summary = await restoreMcqBackupWithStructure(file, mode);
      await auditRestore(req.user!.id, { mode, restored: summary.questions.restored, deletedFirst: summary.deletedFirst, scope: scope ?? null, structure: summary.structure });
      res.status(201).json({ ...summary, restored: summary.questions.restored, deletedFirst: summary.deletedFirst, legacy: false });
      return;
    }

    // ---- v1: flat file, raw ids (the original behavior) ----------------------
    let deletedCount = 0;
    if (mode === "replace") {
      // A scoped backup (one Year/Block/Module/Subject/Topic branch) only
      // wipes that same branch before restoring — replacing the *entire*
      // bank because the admin restored, say, one subject's backup would
      // silently destroy everything outside it. A whole-bank backup (no
      // embedded scope) keeps the original full wipe.
      const idsToDelete = scope ? await selectMcqIdsInScope(scope) : (await db.select({ id: mcqsTable.id }).from(mcqsTable)).map((r) => r.id);
      await deleteMcqsEverywhere(idsToDelete);
      deletedCount = idsToDelete.length;
    }
    const created = await restoreMcqBackup(file.mcqs);
    await auditRestore(req.user!.id, { mode, restored: created, deletedFirst: deletedCount, scope: scope ?? null });
    res.status(201).json({ legacy: true, restored: created, mode, deletedFirst: deletedCount, scope: scope ?? null });
  } catch (err) {
    logger.error({ err }, "[mcq-backup] restore failed");
    res.status(422).json({ error: `Could not restore this backup: ${dbErrorMessage(err, err instanceof Error ? err.message : "unknown database error")}` });
  }
});

// The restore has already committed by the time this runs, so a failed audit
// entry must never turn a successful restore into a reported failure.
async function auditRestore(actorId: number, metadata: Record<string, unknown>): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({ actorId, action: "MCQS_BACKUP_RESTORED", entity: "mcq", metadata: JSON.stringify(metadata) });
  } catch (err) {
    logger.error({ err }, "[mcq-backup] restore succeeded but writing the audit log entry failed");
  }
}

export default router;
