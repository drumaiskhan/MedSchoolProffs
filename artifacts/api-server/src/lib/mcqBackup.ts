import { z } from "zod";
import { eq, inArray, or, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  db, pool, mcqsTable, blocksTable, modulesTable, subjectsTable, topicsTable,
  pastPapersTable, examsTable, examQuestionsTable, type Mcq,
} from "@workspace/db";
import { buildScopeWhere, resolveModuleIdsForScope, targetingMatchesScope, BACKUP_SCOPE_LEVELS, BACKUP_PROGRAMS, type BackupScope } from "./backupScope";
import { deleteMcqsEverywhere } from "./mcqCascade";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// Whole-question-bank backup — distinct from mcq-import.ts's file parser.
// mcq-import.ts turns loosely-formatted text/CSV/PDF into new draft
// candidates for one module/subject/topic at a time. This is the opposite
// direction: a full, exact snapshot of every MCQ row (every field, every
// section of the bank — main tree, past papers, and exams alike) that can
// later be restored verbatim, e.g. before a risky bulk edit, or to move the
// whole bank between environments.
// ---------------------------------------------------------------------------

// Bumped only if the shape of a backup file changes in a way old files
// can't be read as. Restoring never trusts a mismatched version silently —
// see importMcqBackup's check below.
//   v1: flat list of MCQ rows (ids point at whatever database made the file).
//   v2: adds `structure` — the Block > Module > Subject > Topic tree (plus past
//       papers, exams and exam-question links) the questions live in, so a
//       backup can rebuild its own curriculum on a database that doesn't have
//       it yet. v1 files are still accepted and restored the old way.
export const MCQ_BACKUP_FORMAT_VERSION = 2;

type BlockRow = typeof blocksTable.$inferSelect;
type ModuleRow = typeof modulesTable.$inferSelect;
type SubjectRow = typeof subjectsTable.$inferSelect;
type TopicRow = typeof topicsTable.$inferSelect;
type PastPaperRow = typeof pastPapersTable.$inferSelect;
type ExamRow = typeof examsTable.$inferSelect;
type ExamQuestionRow = typeof examQuestionsTable.$inferSelect;

export interface McqBackupStructure {
  blocks: BlockRow[];
  modules: ModuleRow[];
  subjects: SubjectRow[];
  topics: TopicRow[];
  pastPapers: PastPaperRow[];
  exams: ExamRow[];
  examQuestions: ExamQuestionRow[];
}

export interface McqBackupFile {
  formatVersion: number;
  exportedAt: string;
  count: number;
  // Present only for a scoped backup (one Program/Year/Block/Module/Subject/
  // Topic branch rather than the whole bank) — absent means "whole bank",
  // same as every backup made before this field existed. Carried through to
  // the file itself (not just the download filename) so a "replace" restore
  // later can tell it's only meant to wipe that branch, not the entire bank.
  scope?: BackupScope;
  // v2+: the curriculum the questions belong to. Row ids are the SOURCE
  // database's ids; restore remaps them (see restoreMcqBackupWithStructure).
  structure?: McqBackupStructure;
  // v2+, program/year/block scopes only: exactly which source-database nodes
  // the scope itself covers. `structure` also carries ancestors and anything a
  // question merely points at, and a "replace" restore must only wipe what the
  // scope covers — never those extras (e.g. a past paper tagged to Year 2 can
  // sit on a module that belongs to Year 3).
  coverage?: { moduleIds: number[]; pastPaperIds: number[]; examIds: number[] };
  mcqs: Mcq[];
}

const idSet = (ids: Array<number | null | undefined>) => new Set(ids.filter((v): v is number => v != null));
// One statement can bind at most 65,535 parameters; slice big id lists.
async function selectMcqsWhere(where: SQL | undefined): Promise<Mcq[]> {
  return db.select().from(mcqsTable).where(where);
}
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Builds the backup payload — the whole bank when `scope` is omitted, or just
// the questions (and the curriculum branch around them) under one
// Program/Year/Block/Module/Subject/Topic when given. Intentionally exports
// every MCQ column (including id, timestamps, moduleId/subjectId/topicId/
// pastPaperId/examId, explanationStatus, tags, imagePath, source) so a restore
// can reproduce the rows exactly rather than a lossy re-import.
//
// For a scope, "the curriculum around them" means: the scope's whole subtree
// (empty topics included — the structure is part of the backup, not just
// whatever happens to hold a question today) plus every ancestor up to the
// block; and, for program/year scopes, the past papers and exams targeted at
// that program/year with all of their questions. Anything a question points
// at (a past paper, an exam) is always included so no reference dangles.
export async function buildMcqBackup(scope?: BackupScope): Promise<McqBackupFile> {
  const [allBlocks, allModules, allSubjects, allTopics, allPapers, allExams] = await Promise.all([
    db.select().from(blocksTable), db.select().from(modulesTable), db.select().from(subjectsTable),
    db.select().from(topicsTable), db.select().from(pastPapersTable), db.select().from(examsTable),
  ]);

  if (!scope) {
    const [mcqs, examQuestions] = await Promise.all([db.select().from(mcqsTable), db.select().from(examQuestionsTable)]);
    return {
      formatVersion: MCQ_BACKUP_FORMAT_VERSION, exportedAt: new Date().toISOString(), count: mcqs.length,
      structure: { blocks: allBlocks, modules: allModules, subjects: allSubjects, topics: allTopics, pastPapers: allPapers, exams: allExams, examQuestions },
      mcqs,
    };
  }

  let mcqs = await db.select().from(mcqsTable).where(await buildScopeWhere(scope, { moduleId: mcqsTable.moduleId, subjectId: mcqsTable.subjectId, topicId: mcqsTable.topicId }));

  // --- which curriculum nodes does the scope cover? -------------------------
  const topicSel = new Set<number>();
  const subjectSel = new Set<number>();
  const moduleSel = new Set<number>();
  if (scope.level === "topic") {
    topicSel.add(scope.id);
  } else if (scope.level === "subject") {
    subjectSel.add(scope.id);
  } else {
    for (const id of scope.level === "module" ? [scope.id] : await resolveModuleIdsForScope(scope)) moduleSel.add(id);
  }
  const coveredModuleIds = [...moduleSel];
  // Downward: module -> its subjects -> their topics.
  for (const sub of allSubjects) if (moduleSel.has(sub.moduleId)) subjectSel.add(sub.id);
  for (const t of allTopics) if (subjectSel.has(t.subjectId)) topicSel.add(t.id);
  // Anything an exported question itself points at is part of the picture too.
  for (const m of mcqs) { if (m.moduleId != null) moduleSel.add(m.moduleId); if (m.subjectId != null) subjectSel.add(m.subjectId); if (m.topicId != null) topicSel.add(m.topicId); }
  // Upward: topic -> subject -> module -> block.
  for (const t of allTopics) if (topicSel.has(t.id)) subjectSel.add(t.subjectId);
  for (const sub of allSubjects) if (subjectSel.has(sub.id)) moduleSel.add(sub.moduleId);
  const blockSel = idSet(allModules.filter((m) => moduleSel.has(m.id)).map((m) => m.blockId));

  // --- past papers & exams ---------------------------------------------------
  const paperIds = idSet(mcqs.map((m) => m.pastPaperId));
  const examIds = idSet(mcqs.map((m) => m.examId));
  const coveredPaperIds: number[] = [];
  const coveredExamIds: number[] = [];
  for (const p of allPapers) if (targetingMatchesScope(scope, p)) { paperIds.add(p.id); coveredPaperIds.push(p.id); }
  for (const e of allExams) if (targetingMatchesScope(scope, e)) { examIds.add(e.id); coveredExamIds.push(e.id); }

  // Pull in the questions that belong to those papers/exams (they're tagged by
  // pastPaperId / examId / an exam_questions row rather than by module, so the
  // module-based scope above never sees them). A newly pulled-in question can
  // itself point at another paper/exam, hence the small fixpoint loop.
  const have = new Set(mcqs.map((m) => m.id));
  for (let round = 0; round < 3; round++) {
    const examLinkIds = examIds.size
      ? (await db.select({ mcqId: examQuestionsTable.mcqId }).from(examQuestionsTable).where(inArray(examQuestionsTable.examId, [...examIds]))).map((r) => r.mcqId)
      : [];
    const conds = [
      paperIds.size ? inArray(mcqsTable.pastPaperId, [...paperIds]) : undefined,
      examIds.size ? inArray(mcqsTable.examId, [...examIds]) : undefined,
      examLinkIds.length ? inArray(mcqsTable.id, examLinkIds) : undefined,
    ].filter((c): c is NonNullable<typeof c> => c !== undefined);
    if (!conds.length) break;
    const extra = (await selectMcqsWhere(or(...conds))).filter((m) => !have.has(m.id));
    if (!extra.length) break;
    for (const m of extra) {
      have.add(m.id); mcqs.push(m);
      if (m.pastPaperId != null) paperIds.add(m.pastPaperId);
      if (m.examId != null) examIds.add(m.examId);
      if (m.moduleId != null) moduleSel.add(m.moduleId);
      if (m.subjectId != null) subjectSel.add(m.subjectId);
      if (m.topicId != null) topicSel.add(m.topicId);
    }
  }
  // (a pulled-in question may sit under a node the first pass didn't select)
  for (const t of allTopics) if (topicSel.has(t.id)) subjectSel.add(t.subjectId);
  for (const sub of allSubjects) if (subjectSel.has(sub.id)) moduleSel.add(sub.moduleId);
  for (const m of allModules) if (moduleSel.has(m.id) && m.blockId != null) blockSel.add(m.blockId);

  const mcqIdSet = new Set(mcqs.map((m) => m.id));
  const examQuestions = examIds.size
    ? (await db.select().from(examQuestionsTable).where(inArray(examQuestionsTable.examId, [...examIds]))).filter((q) => mcqIdSet.has(q.mcqId))
    : [];

  return {
    formatVersion: MCQ_BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    count: mcqs.length,
    scope,
    ...(scope.level === "program" || scope.level === "year" || scope.level === "block"
      ? { coverage: { moduleIds: coveredModuleIds, pastPaperIds: coveredPaperIds, examIds: coveredExamIds } }
      : {}),
    structure: {
      blocks: allBlocks.filter((b) => blockSel.has(b.id)),
      modules: allModules.filter((m) => moduleSel.has(m.id)),
      subjects: allSubjects.filter((s) => subjectSel.has(s.id)),
      topics: allTopics.filter((t) => topicSel.has(t.id)),
      pastPapers: allPapers.filter((p) => paperIds.has(p.id)),
      exams: allExams.filter((e) => examIds.has(e.id)),
      examQuestions,
    },
    mcqs,
  };
}

// Selects just the ids of MCQs that fall under a scope — used by the import
// route's scoped "replace" mode, which (unlike a whole-bank replace) must
// only wipe the branch the backup itself covers before restoring it, not
// every question in the bank.
export async function selectMcqIdsInScope(scope: BackupScope): Promise<number[]> {
  const rows = await db
    .select({ id: mcqsTable.id })
    .from(mcqsTable)
    .where(await buildScopeWhere(scope, { moduleId: mcqsTable.moduleId, subjectId: mcqsTable.subjectId, topicId: mcqsTable.topicId }));
  return rows.map((r) => r.id);
}

// Validates the shape of one backed-up MCQ row. Deliberately permissive on
// nullable/optional fields (older backups, or ones hand-edited by an admin,
// may be missing a field that a newer schema added) but strict on the
// handful of columns nothing can sensibly default: question + options.
export const BackupMcqSchema = z.object({
  id: z.number().int().positive().optional(), // dropped on restore — see importMcqBackup
  question: z.string().min(1),
  options: z.array(z.string()).min(2),
  correctAnswer: z.string().nullable().optional(),
  explanation: z.string().nullable().optional(),
  optionExplanations: z.array(z.string().nullable()).nullable().optional(),
  hint: z.string().nullable().optional(),
  explanationStatus: z.string().optional(),
  reference: z.string().nullable().optional(),
  difficulty: z.string().optional(),
  tags: z.array(z.string()).optional(),
  imagePath: z.string().nullable().optional(),
  status: z.string().optional(),
  source: z.string().optional(),
  moduleId: z.number().nullable().optional(),
  subjectId: z.number().nullable().optional(),
  topicId: z.number().nullable().optional(),
  pastPaperId: z.number().nullable().optional(),
  examId: z.number().nullable().optional(),
});

// Matches BackupScope (backupScope.ts) loosely enough to accept a backup
// hand-edited or produced by a slightly different app version — restoring
// only ever reads `scope` to decide what a scoped "replace" should wipe, it
// never trusts `label` for anything beyond display.
const BackupScopeSchema = z.object({
  level: z.enum(BACKUP_SCOPE_LEVELS),
  id: z.number().int(),
  label: z.string(),
  program: z.enum(BACKUP_PROGRAMS).optional(),
});

// --- v2 structure rows. Only the columns a restore actually writes are listed;
// everything is optional-with-default except the id (needed to wire parents to
// children) and the name/title, so a file with a few columns missing still
// restores instead of failing on a detail.
const nullableInt = z.number().int().nullable().optional();
const NodeBase = {
  active: z.boolean().optional(),
  archived: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
};
const BackupBlockSchema = z.object({ id: z.number().int(), name: z.string().min(1), subtitle: z.string().optional(), programTargetKind: z.string().nullable().optional(), yearTargetNumber: nullableInt, iconPath: z.string().nullable().optional(), ...NodeBase });
const BackupModuleSchema = z.object({ id: z.number().int(), name: z.string().min(1), subtitle: z.string().optional(), blockId: nullableInt, iconPath: z.string().nullable().optional(), programTargetKind: z.string().nullable().optional(), yearTargetNumber: nullableInt, ...NodeBase });
const BackupSubjectSchema = z.object({ id: z.number().int(), moduleId: z.number().int(), name: z.string().min(1), iconPath: z.string().nullable().optional(), ...NodeBase });
const BackupTopicSchema = z.object({ id: z.number().int(), subjectId: z.number().int(), name: z.string().min(1), ...NodeBase });
const BackupPastPaperSchema = z.object({ id: z.number().int(), title: z.string().min(1), examBoard: z.string().optional(), year: z.string().optional(), level: z.string().optional(), programTargetKind: z.string().nullable().optional(), yearTargetNumber: nullableInt, ...NodeBase });
const BackupExamSchema = z.object({
  id: z.number().int(), title: z.string().min(1), description: z.string().optional(),
  programTargetKind: z.string().nullable().optional(), yearTargetNumber: nullableInt,
  durationMinutes: z.number().int().optional(), startAt: z.string(), endAt: z.string(), maxAttempts: z.number().int().optional(),
  negativeMarkingEnabled: z.boolean().optional(), negativeMarkPerWrong: z.union([z.string(), z.number()]).optional(),
  passingPercent: z.union([z.string(), z.number()]).nullable().optional(), resultReleaseMode: z.string().optional(),
  showMarks: z.boolean().optional(), showPercentage: z.boolean().optional(), showCorrectAnswers: z.boolean().optional(), status: z.string().optional(),
});
const BackupExamQuestionSchema = z.object({ examId: z.number().int(), mcqId: z.number().int(), displayOrder: z.number().int().optional() });

const BackupStructureSchema = z.object({
  blocks: z.array(BackupBlockSchema).default([]),
  modules: z.array(BackupModuleSchema).default([]),
  subjects: z.array(BackupSubjectSchema).default([]),
  topics: z.array(BackupTopicSchema).default([]),
  pastPapers: z.array(BackupPastPaperSchema).default([]),
  exams: z.array(BackupExamSchema).default([]),
  examQuestions: z.array(BackupExamQuestionSchema).default([]),
});

export const McqBackupFileSchema = z.object({
  formatVersion: z.number().int().optional(), // missing entirely = pre-versioning export, still accepted
  exportedAt: z.string().optional(),
  count: z.number().optional(),
  scope: BackupScopeSchema.optional(), // absent = whole-bank backup, same as every pre-scope export
  structure: BackupStructureSchema.optional(), // absent = v1 file: restore by raw ids, the old way
  coverage: z.object({ moduleIds: z.array(z.number().int()), pastPaperIds: z.array(z.number().int()), examIds: z.array(z.number().int()) }).optional(),
  // A structure-only backup (a year whose questions haven't been written yet)
  // is legitimate, so an empty list is allowed — the route still insists on
  // there being *something* to restore.
  mcqs: z.array(BackupMcqSchema).max(50_000),
});

export type ParsedMcqBackupFile = z.infer<typeof McqBackupFileSchema>;
export type ParsedBackupMcq = z.infer<typeof BackupMcqSchema>;

// Postgres has a hard 65535-bound-parameter-per-query ceiling. Each MCQ row
// here binds ~17 columns, so batching keeps every single insert well clear
// of that regardless of how large the backup is.
const INSERT_BATCH_SIZE = 500;

// Re-inserts every row from a validated backup as brand-new MCQs (ids are
// always dropped — see the call site's comment on why reusing old ids would
// be unsafe) and returns how many were created. Caller decides whether to
// wipe the existing bank first (mode: "replace") or add alongside it
// (mode: "append") — this function only ever inserts.
export async function restoreMcqBackup(mcqs: ParsedBackupMcq[]): Promise<number> {
  let created = 0;
  for (let i = 0; i < mcqs.length; i += INSERT_BATCH_SIZE) {
    const batch = mcqs.slice(i, i + INSERT_BATCH_SIZE);
    const rows = await db.insert(mcqsTable).values(
      batch.map((m) => ({
        question: m.question,
        options: m.options,
        correctAnswer: m.correctAnswer ?? null,
        explanation: m.explanation ?? null,
        optionExplanations: m.optionExplanations ? m.optionExplanations.map((explanation) => explanation ?? "") : null,
        hint: m.hint ?? null,
        explanationStatus: (m.explanationStatus as "PENDING" | "AI_GENERATED" | "REVIEWED" | "APPROVED" | undefined) ?? "PENDING",
        reference: m.reference ?? null,
        difficulty: (m.difficulty as "easy" | "moderate" | "hard" | undefined) ?? "moderate",
        tags: m.tags ?? [],
        imagePath: m.imagePath ?? null,
        status: (m.status as "draft" | "published" | undefined) ?? "draft",
        source: "import" as const,
        moduleId: m.moduleId ?? null,
        subjectId: m.subjectId ?? null,
        topicId: m.topicId ?? null,
        pastPaperId: m.pastPaperId ?? null,
        examId: m.examId ?? null,
      })),
    ).returning({ id: mcqsTable.id });
    created += rows.length;
  }
  return created;
}

// ---------------------------------------------------------------------------
// Structure-aware restore (v2 files)
//
// Mirrors what the whole-database importer does for curriculum tables, but for
// one program/year/branch: rebuild the Block > Module > Subject > Topic tree
// (and past papers / exams) the backup came from, then put the questions back
// into it. Source ids are never trusted — they belong to whatever database
// wrote the file — so every parent/child link is remapped through an id map.
//
// Nodes are MATCHED before they are created, so restoring a backup into the
// database it came from (or one that already has the same year) re-attaches
// to the existing tree instead of cloning it:
//   block   — same name + program + year
//   module  — same name under the same (mapped) block
//   subject — same name under the same (mapped) module
//   topic   — same name under the same (mapped) subject
//   paper   — same title + board + year + level
//   exam    — same title + start time
//
// Modes:
//   merge   (default) — build missing structure, add only questions that are
//                       not already there (same text in the same place).
//   append            — build missing structure, add every question again.
//   replace           — build missing structure, delete the questions the
//                       backup's scope covers, then restore the backup's.
// All of it runs in ONE transaction: a failure leaves the database untouched.
// ---------------------------------------------------------------------------

export type McqRestoreMode = "merge" | "append" | "replace";

interface NodeStat { created: number; reused: number }
export interface McqRestoreSummary {
  mode: McqRestoreMode;
  dryRun: boolean;
  scope: BackupScope | null;
  structure: { blocks: NodeStat; modules: NodeStat; subjects: NodeStat; topics: NodeStat; pastPapers: NodeStat; exams: NodeStat };
  questions: {
    inBackup: number;
    restored: number;
    skippedExisting: number;
    // Question pointed at a past paper / exam the file doesn't describe.
    skippedMissingLink: number;
    // Question's module/subject/topic wasn't in the file's structure, so it was
    // restored without that placement rather than with a wrong one.
    detachedLinks: number;
  };
  examLinks: number;
  deletedFirst: number;
  warnings: string[];
}

type Exec = Pick<typeof db, "select" | "insert" | "delete">;
const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const BATCH = 300;

export async function restoreMcqBackupWithStructure(
  file: ParsedMcqBackupFile,
  mode: McqRestoreMode,
  opts: { dryRun?: boolean } = {},
): Promise<McqRestoreSummary> {
  const dryRun = opts.dryRun ?? false;
  if (!file.structure) throw new Error("restoreMcqBackupWithStructure called with a v1 file");

  if (dryRun) return runStructureRestore(db, file, mode, true);

  // Manually managed client + transaction, same reasoning as fullBackup.ts's
  // restore: a broken connection must be released with its error so the pool
  // discards it instead of recycling a dead socket.
  const client = await pool.connect();
  let released = false;
  const release = (err?: unknown) => {
    if (released) return;
    released = true;
    client.release(err ? (err instanceof Error ? err : true) : undefined);
  };
  try {
    const tx = drizzle(client as any);
    await client.query("BEGIN");
    const timeoutMs = Number(process.env.RESTORE_STATEMENT_TIMEOUT_MS) || 600_000;
    await client.query(`SET LOCAL statement_timeout = ${timeoutMs}`);
    const summary = await runStructureRestore(tx as unknown as Exec, file, mode, false);
    await client.query("COMMIT");
    release();
    return summary;
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch (rollbackErr) { logger.error({ err: rollbackErr }, "[mcq-backup] rollback failed"); }
    release(err);
    throw err;
  }
}

async function runStructureRestore(exec: Exec, file: ParsedMcqBackupFile, mode: McqRestoreMode, dryRun: boolean): Promise<McqRestoreSummary> {
  const st = file.structure!;
  const scope = file.scope ?? null;
  const warnings: string[] = [];
  const stat = (): NodeStat => ({ created: 0, reused: 0 });
  const summary: McqRestoreSummary = {
    mode, dryRun, scope,
    structure: { blocks: stat(), modules: stat(), subjects: stat(), topics: stat(), pastPapers: stat(), exams: stat() },
    questions: { inBackup: file.mcqs.length, restored: 0, skippedExisting: 0, skippedMissingLink: 0, detachedLinks: 0 },
    examLinks: 0, deletedFirst: 0, warnings,
  };

  // Placeholder ids for rows a dry run "would create" — negative so they can
  // never collide with (or match) a real row when children look their parent up.
  let tempId = 0;

  // Generic "match existing, else create" for one level of the tree. Rows are
  // processed in file order; two rows in the file that resolve to the same key
  // collapse into one node (a backup never legitimately has twin siblings).
  async function mapLevel<R extends { id: number }, E extends { id: number }>(args: {
    rows: R[]; existing: E[]; keyOfRow: (r: R) => string; keyOfExisting: (e: E) => string;
    stat: NodeStat; insert: (batch: R[]) => Promise<number[]>;
  }): Promise<Map<number, number>> {
    const existingByKey = new Map<string, number>();
    for (const e of [...args.existing].sort((x, y) => x.id - y.id)) {
      const k = args.keyOfExisting(e);
      if (!existingByKey.has(k)) existingByKey.set(k, e.id);
    }
    const result = new Map<number, number>();
    const pending: R[] = [];
    const pendingIdxByKey = new Map<string, number>();
    const waiting: Array<{ rowId: number; idx: number }> = [];
    for (const r of args.rows) {
      const key = args.keyOfRow(r);
      const hit = existingByKey.get(key);
      if (hit !== undefined) { result.set(r.id, hit); args.stat.reused++; continue; }
      let idx = pendingIdxByKey.get(key);
      if (idx === undefined) { idx = pending.length; pending.push(r); pendingIdxByKey.set(key, idx); args.stat.created++; }
      waiting.push({ rowId: r.id, idx });
    }
    const newIds: number[] = [];
    for (let i = 0; i < pending.length; i += BATCH) {
      const batch = pending.slice(i, i + BATCH);
      if (dryRun) newIds.push(...batch.map(() => --tempId));
      else {
        const ids = await args.insert(batch);
        if (ids.length !== batch.length) throw new Error("Database returned an unexpected number of ids while rebuilding the structure");
        newIds.push(...ids);
      }
    }
    for (const w of waiting) result.set(w.rowId, newIds[w.idx]!);
    return result;
  }

  // --- blocks ---------------------------------------------------------------
  const blockMap = await mapLevel({
    rows: st.blocks,
    existing: await exec.select({ id: blocksTable.id, name: blocksTable.name, p: blocksTable.programTargetKind, y: blocksTable.yearTargetNumber }).from(blocksTable),
    keyOfRow: (b) => `${norm(b.name)}|${norm(b.programTargetKind)}|${b.yearTargetNumber ?? ""}`,
    keyOfExisting: (e) => `${norm(e.name)}|${norm(e.p)}|${e.y ?? ""}`,
    stat: summary.structure.blocks,
    insert: async (batch) => (await exec.insert(blocksTable).values(batch.map((b) => ({
      name: b.name, subtitle: b.subtitle ?? "", programTargetKind: b.programTargetKind ?? null, yearTargetNumber: b.yearTargetNumber ?? null,
      iconPath: b.iconPath ?? null, active: b.active ?? true, archived: b.archived ?? false, displayOrder: b.displayOrder ?? 0,
    }))).returning({ id: blocksTable.id })).map((r) => r.id),
  });

  // --- modules ----------------------------------------------------------------
  const moduleBlock = (m: { blockId?: number | null }) => (m.blockId == null ? null : blockMap.get(m.blockId) ?? null);
  const moduleMap = await mapLevel({
    rows: st.modules,
    existing: await exec.select({ id: modulesTable.id, name: modulesTable.name, blockId: modulesTable.blockId, p: modulesTable.programTargetKind, y: modulesTable.yearTargetNumber }).from(modulesTable),
    // A module with no block is matched on its own program/year instead, since
    // "Anatomy" can exist once per program when nothing groups it.
    keyOfRow: (m) => { const b = moduleBlock(m); return b != null ? `b${b}|${norm(m.name)}` : `-|${norm(m.name)}|${norm(m.programTargetKind)}|${m.yearTargetNumber ?? ""}`; },
    keyOfExisting: (e) => (e.blockId != null ? `b${e.blockId}|${norm(e.name)}` : `-|${norm(e.name)}|${norm(e.p)}|${e.y ?? ""}`),
    stat: summary.structure.modules,
    insert: async (batch) => (await exec.insert(modulesTable).values(batch.map((m) => ({
      name: m.name, subtitle: m.subtitle ?? "", blockId: moduleBlock(m), iconPath: m.iconPath ?? null,
      programTargetKind: m.programTargetKind ?? null, yearTargetNumber: m.yearTargetNumber ?? null,
      active: m.active ?? true, archived: m.archived ?? false, displayOrder: m.displayOrder ?? 0,
    }))).returning({ id: modulesTable.id })).map((r) => r.id),
  });
  for (const m of st.modules) if (m.blockId != null && !blockMap.has(m.blockId)) { warnings.push(`Module "${m.name}" pointed at a block that isn't in the file — restored without a block.`); }

  // --- subjects ---------------------------------------------------------------
  const orphanSubjects = st.subjects.filter((s) => !moduleMap.has(s.moduleId));
  if (orphanSubjects.length) warnings.push(`${orphanSubjects.length} subject(s) belong to a module that isn't in the file and were skipped.`);
  const subjectMap = await mapLevel({
    rows: st.subjects.filter((s) => moduleMap.has(s.moduleId)),
    existing: await exec.select({ id: subjectsTable.id, name: subjectsTable.name, moduleId: subjectsTable.moduleId }).from(subjectsTable),
    keyOfRow: (s) => `${moduleMap.get(s.moduleId)}|${norm(s.name)}`,
    keyOfExisting: (e) => `${e.moduleId}|${norm(e.name)}`,
    stat: summary.structure.subjects,
    insert: async (batch) => (await exec.insert(subjectsTable).values(batch.map((s) => ({
      moduleId: moduleMap.get(s.moduleId)!, name: s.name, iconPath: s.iconPath ?? null,
      active: s.active ?? true, archived: s.archived ?? false, displayOrder: s.displayOrder ?? 0,
    }))).returning({ id: subjectsTable.id })).map((r) => r.id),
  });

  // --- topics -----------------------------------------------------------------
  const orphanTopics = st.topics.filter((t) => !subjectMap.has(t.subjectId));
  if (orphanTopics.length) warnings.push(`${orphanTopics.length} topic(s) belong to a subject that isn't in the file and were skipped.`);
  const topicMap = await mapLevel({
    rows: st.topics.filter((t) => subjectMap.has(t.subjectId)),
    existing: await exec.select({ id: topicsTable.id, name: topicsTable.name, subjectId: topicsTable.subjectId }).from(topicsTable),
    keyOfRow: (t) => `${subjectMap.get(t.subjectId)}|${norm(t.name)}`,
    keyOfExisting: (e) => `${e.subjectId}|${norm(e.name)}`,
    stat: summary.structure.topics,
    insert: async (batch) => (await exec.insert(topicsTable).values(batch.map((t) => ({
      subjectId: subjectMap.get(t.subjectId)!, name: t.name,
      active: t.active ?? true, archived: t.archived ?? false, displayOrder: t.displayOrder ?? 0,
    }))).returning({ id: topicsTable.id })).map((r) => r.id),
  });

  // --- past papers --------------------------------------------------------------
  const paperMap = await mapLevel({
    rows: st.pastPapers,
    existing: await exec.select({ id: pastPapersTable.id, title: pastPapersTable.title, board: pastPapersTable.examBoard, year: pastPapersTable.year, level: pastPapersTable.level }).from(pastPapersTable),
    keyOfRow: (p) => `${norm(p.title)}|${norm(p.examBoard)}|${norm(p.year)}|${norm(p.level)}`,
    keyOfExisting: (e) => `${norm(e.title)}|${norm(e.board)}|${norm(e.year)}|${norm(e.level)}`,
    stat: summary.structure.pastPapers,
    insert: async (batch) => (await exec.insert(pastPapersTable).values(batch.map((p) => ({
      title: p.title, examBoard: p.examBoard ?? "", year: p.year ?? "", level: p.level ?? "",
      // Environment-specific foreign keys (institution / program / academic
      // year rows) are deliberately not carried over — the program/year
      // targeting columns below are the portable part.
      programTargetKind: p.programTargetKind ?? null, yearTargetNumber: p.yearTargetNumber ?? null,
      active: p.active ?? true, archived: p.archived ?? false, displayOrder: p.displayOrder ?? 0,
    }))).returning({ id: pastPapersTable.id })).map((r) => r.id),
  });

  // --- exams ----------------------------------------------------------------------
  const examMap = await mapLevel({
    rows: st.exams,
    existing: await exec.select({ id: examsTable.id, title: examsTable.title, startAt: examsTable.startAt }).from(examsTable),
    keyOfRow: (e) => `${norm(e.title)}|${new Date(e.startAt).getTime()}`,
    keyOfExisting: (e) => `${norm(e.title)}|${e.startAt.getTime()}`,
    stat: summary.structure.exams,
    insert: async (batch) => (await exec.insert(examsTable).values(batch.map((e) => ({
      title: e.title, description: e.description ?? "", programTargetKind: e.programTargetKind ?? null, yearTargetNumber: e.yearTargetNumber ?? null,
      durationMinutes: e.durationMinutes ?? 60, startAt: new Date(e.startAt), endAt: new Date(e.endAt), maxAttempts: e.maxAttempts ?? 1,
      negativeMarkingEnabled: e.negativeMarkingEnabled ?? false, negativeMarkPerWrong: String(e.negativeMarkPerWrong ?? "0"),
      passingPercent: e.passingPercent == null ? null : String(e.passingPercent), resultReleaseMode: e.resultReleaseMode ?? "immediate",
      showMarks: e.showMarks ?? true, showPercentage: e.showPercentage ?? true, showCorrectAnswers: e.showCorrectAnswers ?? true,
      // Never auto-publish a restored exam: a student could start it before
      // anyone has looked at it. Re-publishing is one click for the admin.
      status: e.status === "archived" ? "archived" : "draft",
    }))).returning({ id: examsTable.id })).map((r) => r.id),
  });

  // --- replace: wipe what the backup's scope covers ------------------------------
  let idsToDelete: number[] = [];
  if (mode === "replace") {
    idsToDelete = await collectIdsToReplace(exec, file, { blockMap, moduleMap, subjectMap, topicMap, paperMap, examMap });
    summary.deletedFirst = idsToDelete.length;
    if (!dryRun) await deleteMcqsEverywhere(idsToDelete, exec);
  }
  const deleting = new Set(idsToDelete);

  // --- questions -----------------------------------------------------------------
  // For merge mode: what is already in the target, keyed by text + placement.
  const placementKey = (q: string, topic: number | null, subject: number | null, module: number | null, paper: number | null, exam: number | null) =>
    `${norm(q)}|${topic ?? 0}|${subject ?? 0}|${module ?? 0}|${paper ?? 0}|${exam ?? 0}`;
  const existingByKey = new Map<string, number>();
  if (mode === "merge") {
    const rows = await exec.select({
      id: mcqsTable.id, question: mcqsTable.question, topicId: mcqsTable.topicId, subjectId: mcqsTable.subjectId,
      moduleId: mcqsTable.moduleId, pastPaperId: mcqsTable.pastPaperId, examId: mcqsTable.examId,
    }).from(mcqsTable);
    for (const r of rows) {
      if (deleting.has(r.id)) continue;
      const k = placementKey(r.question, r.topicId, r.subjectId, r.moduleId, r.pastPaperId, r.examId);
      if (!existingByKey.has(k)) existingByKey.set(k, r.id);
    }
  }

  const toInsert: Array<{ old: number | undefined; values: typeof mcqsTable.$inferInsert; key: string }> = [];
  const oldToNew = new Map<number, number>();
  const seenInFile = new Map<string, number | undefined>();
  const link = (old: number | null | undefined, map: Map<number, number>): number | null => {
    if (old == null) return null;
    const hit = map.get(old);
    if (hit === undefined) { summary.questions.detachedLinks++; return null; }
    return hit;
  };
  for (const m of file.mcqs) {
    // A question tagged to a past paper / exam the file doesn't describe can't
    // be placed anywhere sensible — restoring it untagged would dump a
    // past-paper question into the main bank, so skip it and say so.
    if ((m.pastPaperId != null && !paperMap.has(m.pastPaperId)) || (m.examId != null && !examMap.has(m.examId))) { summary.questions.skippedMissingLink++; continue; }
    const topicId = link(m.topicId, topicMap), subjectId = link(m.subjectId, subjectMap), moduleId = link(m.moduleId, moduleMap);
    const pastPaperId = m.pastPaperId != null ? paperMap.get(m.pastPaperId)! : null;
    const examId = m.examId != null ? examMap.get(m.examId)! : null;
    const key = placementKey(m.question, topicId, subjectId, moduleId, pastPaperId, examId);
    if (mode === "merge") {
      const hit = existingByKey.get(key);
      if (hit !== undefined) { summary.questions.skippedExisting++; if (m.id != null) oldToNew.set(m.id, hit); continue; }
      if (seenInFile.has(key)) { summary.questions.skippedExisting++; continue; }
      seenInFile.set(key, undefined);
    }
    toInsert.push({
      old: m.id, key,
      values: {
        question: m.question, options: m.options, correctAnswer: m.correctAnswer ?? null, explanation: m.explanation ?? null,
        optionExplanations: m.optionExplanations ? m.optionExplanations.map((e) => e ?? "") : null,
        hint: m.hint ?? null,
        explanationStatus: (m.explanationStatus as "PENDING" | "AI_GENERATED" | "REVIEWED" | "APPROVED" | undefined) ?? "PENDING",
        reference: m.reference ?? null,
        difficulty: (m.difficulty as "easy" | "moderate" | "hard" | undefined) ?? "moderate",
        tags: m.tags ?? [], imagePath: m.imagePath ?? null,
        status: (m.status as "draft" | "published" | undefined) ?? "draft",
        source: "import" as const,
        moduleId, subjectId, topicId, pastPaperId, examId,
      },
    });
  }
  summary.questions.restored = toInsert.length;
  if (!dryRun) {
    for (let i = 0; i < toInsert.length; i += INSERT_BATCH_SIZE) {
      const batch = toInsert.slice(i, i + INSERT_BATCH_SIZE);
      const rows = await exec.insert(mcqsTable).values(batch.map((b) => b.values)).returning({ id: mcqsTable.id });
      if (rows.length !== batch.length) throw new Error("Database returned an unexpected number of ids while restoring questions");
      batch.forEach((b, j) => { if (b.old != null) oldToNew.set(b.old, rows[j]!.id); });
    }
  }

  // --- exam <-> question links ---------------------------------------------------
  const idsInFile = new Set(file.mcqs.map((m) => m.id));
  const links = st.examQuestions
    .map((q) => ({ examId: examMap.get(q.examId), mcqId: dryRun ? (idsInFile.has(q.mcqId) ? 1 : undefined) : oldToNew.get(q.mcqId), displayOrder: q.displayOrder ?? 0 }))
    .filter((q): q is { examId: number; mcqId: number; displayOrder: number } => q.examId !== undefined && q.mcqId !== undefined);
  summary.examLinks = links.length;
  if (!dryRun) {
    for (let i = 0; i < links.length; i += INSERT_BATCH_SIZE) {
      // (exam, question) is unique — a reused exam may already have the link.
      await exec.insert(examQuestionsTable).values(links.slice(i, i + INSERT_BATCH_SIZE)).onConflictDoNothing();
    }
  }

  return summary;
}

// Which existing question ids does a "replace" restore delete first? Decided
// by what the backup's SCOPE covers, translated into this database's ids — not
// by everything the file happens to mention.
async function collectIdsToReplace(
  exec: Exec,
  file: ParsedMcqBackupFile,
  maps: { blockMap: Map<number, number>; moduleMap: Map<number, number>; subjectMap: Map<number, number>; topicMap: Map<number, number>; paperMap: Map<number, number>; examMap: Map<number, number> },
): Promise<number[]> {
  const scope = file.scope;
  const mapAll = (ids: number[], map: Map<number, number>) => ids.map((i) => map.get(i)).filter((v): v is number => v !== undefined);
  const ids = new Set<number>();
  const collect = async (where: SQL | undefined) => {
    if (!where) return;
    for (const r of await exec.select({ id: mcqsTable.id }).from(mcqsTable).where(where)) ids.add(r.id);
  };

  if (!scope) {
    for (const r of await exec.select({ id: mcqsTable.id }).from(mcqsTable)) ids.add(r.id);
    return [...ids];
  }
  if (scope.level === "topic") {
    const t = maps.topicMap.get(scope.id);
    if (t !== undefined) await collect(eq(mcqsTable.topicId, t));
  } else if (scope.level === "subject") {
    const s = maps.subjectMap.get(scope.id);
    if (s !== undefined) await collect(eq(mcqsTable.subjectId, s));
  } else if (scope.level === "module") {
    const m = maps.moduleMap.get(scope.id);
    if (m !== undefined) await collect(eq(mcqsTable.moduleId, m));
  } else {
    // block / year / program: the file says exactly which nodes it covers.
    if (!file.coverage) throw new Error("This backup has no coverage information, so a scoped replace can't tell what to wipe. Use \"merge\" instead, or re-export the backup.");
    const modules = mapAll(file.coverage.moduleIds, maps.moduleMap);
    const papers = mapAll(file.coverage.pastPaperIds, maps.paperMap);
    const exams = mapAll(file.coverage.examIds, maps.examMap);
    for (const part of chunk(modules, 20_000)) await collect(inArray(mcqsTable.moduleId, part));
    for (const part of chunk(papers, 20_000)) await collect(inArray(mcqsTable.pastPaperId, part));
    for (const part of chunk(exams, 20_000)) await collect(inArray(mcqsTable.examId, part));
    if (exams.length) {
      const linked = await exec.select({ mcqId: examQuestionsTable.mcqId }).from(examQuestionsTable).where(inArray(examQuestionsTable.examId, exams));
      for (const part of chunk(linked.map((r) => r.mcqId), 20_000)) await collect(inArray(mcqsTable.id, part));
    }
  }
  return [...ids];
}
