import { inArray, sql } from "drizzle-orm";
import { db, mcqsTable, pastPapersTable, savedMcqsTable, usersTable } from "@workspace/db";

// Students' "Saved MCQs" point at question ids. A backup restore in "replace" mode (or a re-import) deletes the old
// questions and inserts the same questions again with NEW ids - which used to wipe every student's saved list
// (deleteMcqsEverywhere removes the saved rows with the questions). These helpers keep the saves across such a swap:
// remember each save by the question's text + placement BEFORE the delete, and re-attach it to the re-inserted
// question AFTER. The same matcher also rebuilds lost saves from an older backup file (see restoreSavedMcqsFromBackup).

type Exec = Pick<typeof db, "select" | "insert">;
export const normQuestion = (v: string | null | undefined): string => (v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const SQL_NORM = sql<string>`lower(regexp_replace(btrim(${mcqsTable.question}), '\\s+', ' ', 'g'))`;

export interface Placement { topicId: number | null; subjectId: number | null; moduleId: number | null; pastPaperId: number | null; examId: number | null }
export interface SavedMark { userId: number; question: string; createdAt: Date | null; placement: Placement | null }

const chunk = <T,>(a: T[], n: number): T[][] => { const out: T[][] = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; };
const samePlace = (a: Placement, b: Placement) => a.topicId === b.topicId && a.subjectId === b.subjectId && a.moduleId === b.moduleId && a.pastPaperId === b.pastPaperId && a.examId === b.examId;

/** Remembers who saved which of these questions (call BEFORE deleting them). */
export async function snapshotSavedMarks(mcqIds: number[], exec: Exec = db): Promise<SavedMark[]> {
  const out: SavedMark[] = [];
  for (const ids of chunk(mcqIds, 20_000)) {
    const rows = await exec.select({
      userId: savedMcqsTable.userId, createdAt: savedMcqsTable.createdAt, question: mcqsTable.question,
      topicId: mcqsTable.topicId, subjectId: mcqsTable.subjectId, moduleId: mcqsTable.moduleId, pastPaperId: mcqsTable.pastPaperId, examId: mcqsTable.examId,
    }).from(savedMcqsTable).innerJoin(mcqsTable, sql`${savedMcqsTable.mcqId} = ${mcqsTable.id}`).where(inArray(savedMcqsTable.mcqId, ids));
    for (const r of rows) out.push({ userId: r.userId, createdAt: r.createdAt ?? null, question: r.question, placement: { topicId: r.topicId, subjectId: r.subjectId, moduleId: r.moduleId, pastPaperId: r.pastPaperId, examId: r.examId } });
  }
  return out;
}

export interface MarkResult { total: number; restored: number; alreadySaved: number; noMatch: number; approximate: number }

/** Finds each remembered question in the current bank (same text, preferably the same place) and saves it for the student again. */
export async function restoreSavedMarks(marks: SavedMark[], exec: Exec = db, opts: { dryRun?: boolean } = {}): Promise<MarkResult> {
  const result: MarkResult = { total: marks.length, restored: 0, alreadySaved: 0, noMatch: 0, approximate: 0 };
  if (!marks.length) return result;
  const texts = [...new Set(marks.map((m) => normQuestion(m.question)).filter(Boolean))];
  const byText = new Map<string, Array<{ id: number } & Placement>>();
  for (const part of chunk(texts, 500)) {
    const rows = await exec.select({ id: mcqsTable.id, n: SQL_NORM, topicId: mcqsTable.topicId, subjectId: mcqsTable.subjectId, moduleId: mcqsTable.moduleId, pastPaperId: mcqsTable.pastPaperId, examId: mcqsTable.examId })
      .from(mcqsTable).where(inArray(SQL_NORM, part));
    for (const r of rows) { const list = byText.get(r.n) ?? []; list.push(r); byText.set(r.n, list); }
  }
  const have = new Set<string>();
  const userIds = [...new Set(marks.map((m) => m.userId))];
  for (const part of chunk(userIds, 5_000)) {
    for (const r of await exec.select({ u: savedMcqsTable.userId, m: savedMcqsTable.mcqId }).from(savedMcqsTable).where(inArray(savedMcqsTable.userId, part))) have.add(`${r.u}:${r.m}`);
  }
  const toInsert: Array<{ userId: number; mcqId: number; createdAt?: Date }> = [];
  const queued = new Set<string>();
  for (const m of marks) {
    const cands = byText.get(normQuestion(m.question));
    if (!cands?.length) { result.noMatch++; continue; }
    let pick = m.placement ? cands.find((c) => samePlace(c, m.placement!)) : undefined;
    if (!pick) { pick = cands[0]; if (cands.length > 1) result.approximate++; }
    const key = `${m.userId}:${pick.id}`;
    if (have.has(key) || queued.has(key)) { result.alreadySaved++; continue; }
    queued.add(key);
    toInsert.push({ userId: m.userId, mcqId: pick.id, ...(m.createdAt ? { createdAt: m.createdAt } : {}) });
  }
  if (opts.dryRun) { result.restored = toInsert.length; return result; }
  for (const part of chunk(toInsert, 1_000)) {
    const rows = await exec.insert(savedMcqsTable).values(part).onConflictDoNothing().returning({ id: savedMcqsTable.id });
    result.restored += rows.length;
  }
  return result;
}

export interface SavedBackupResult extends MarkResult { savedInBackup: number; missingStudents: number; dryRun: boolean }

/** Rebuilds students' saved MCQs from an older full backup file (needs its `savedMcqs` and `mcqs` tables). */
export async function restoreSavedMcqsFromBackup(data: Record<string, Array<Record<string, unknown>>>, opts: { dryRun?: boolean } = {}): Promise<SavedBackupResult> {
  const saved = (data.savedMcqs ?? []).filter((r) => typeof r.userId === "number" && typeof r.mcqId === "number");
  const questionById = new Map<number, Record<string, unknown>>();
  for (const m of data.mcqs ?? []) if (typeof m.id === "number" && typeof m.question === "string") questionById.set(m.id, m);
  const existingUsers = new Set<number>();
  const wanted = [...new Set(saved.map((r) => r.userId as number))];
  for (const part of chunk(wanted, 5_000)) for (const u of await db.select({ id: usersTable.id }).from(usersTable).where(inArray(usersTable.id, part))) existingUsers.add(u.id);
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  const marks: SavedMark[] = [];
  let missingStudents = 0;
  for (const r of saved) {
    if (!existingUsers.has(r.userId as number)) { missingStudents++; continue; }
    const q = questionById.get(r.mcqId as number);
    if (!q) continue;
    const created = typeof r.createdAt === "string" || typeof r.createdAt === "number" ? new Date(r.createdAt as string | number) : null;
    marks.push({ userId: r.userId as number, question: q.question as string, createdAt: created && !Number.isNaN(created.getTime()) ? created : null,
      placement: { topicId: num(q.topicId), subjectId: num(q.subjectId), moduleId: num(q.moduleId), pastPaperId: num(q.pastPaperId), examId: num(q.examId) } });
  }
  const result = await restoreSavedMarks(marks, db, opts);
  return { ...result, savedInBackup: saved.length, missingStudents, dryRun: !!opts.dryRun, noMatch: result.noMatch + (saved.length - missingStudents - marks.length) };
}

// ---- Past-paper restore (replace) -----------------------------------------------------------------------------
// There the papers are re-created too (new paper ids), so a question is recognised by its text + its paper's
// title/board/year instead of by placement ids.
export interface PaperSavedMark { userId: number; createdAt: Date | null; key: string }
export const paperQuestionKey = (question: string, title: string, board: string | null | undefined, year: string | null | undefined): string =>
  `${normQuestion(question)}|${normQuestion(title)}|${normQuestion(board)}|${normQuestion(year)}`;

export async function snapshotSavedByPaper(mcqIds: number[], exec: Exec = db): Promise<PaperSavedMark[]> {
  const out: PaperSavedMark[] = [];
  for (const ids of chunk(mcqIds, 5_000)) {
    const rows = await exec.select({ userId: savedMcqsTable.userId, createdAt: savedMcqsTable.createdAt, question: mcqsTable.question, title: pastPapersTable.title, board: pastPapersTable.examBoard, year: pastPapersTable.year })
      .from(savedMcqsTable)
      .innerJoin(mcqsTable, sql`${savedMcqsTable.mcqId} = ${mcqsTable.id}`)
      .innerJoin(pastPapersTable, sql`${mcqsTable.pastPaperId} = ${pastPapersTable.id}`)
      .where(inArray(savedMcqsTable.mcqId, ids));
    for (const r of rows) out.push({ userId: r.userId, createdAt: r.createdAt ?? null, key: paperQuestionKey(r.question, r.title, r.board, r.year) });
  }
  return out;
}

/** `newIdByKey`: paperQuestionKey -> id of the re-inserted question. Returns how many saves were put back. */
export async function restoreSavedByPaper(marks: PaperSavedMark[], newIdByKey: Map<string, number>, exec: Exec = db): Promise<number> {
  const rows: Array<{ userId: number; mcqId: number; createdAt?: Date }> = [];
  const seen = new Set<string>();
  for (const m of marks) {
    const id = newIdByKey.get(m.key);
    if (id === undefined || seen.has(`${m.userId}:${id}`)) continue;
    seen.add(`${m.userId}:${id}`);
    rows.push({ userId: m.userId, mcqId: id, ...(m.createdAt ? { createdAt: m.createdAt } : {}) });
  }
  let restored = 0;
  for (const part of chunk(rows, 1_000)) restored += (await exec.insert(savedMcqsTable).values(part).onConflictDoNothing().returning({ id: savedMcqsTable.id })).length;
  return restored;
}
