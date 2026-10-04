import { z } from "zod";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import {
  db, pastPapersTable, mcqsTable, institutionsTable, programsTable, academicYearsTable, modulesTable, subjectsTable, topicsTable,
  practiceAnswersTable, examAnswersTable, examQuestionsTable, notebookEntriesTable, flaggedMcqsTable,
} from "@workspace/db";
import { APPLICATION_NAME, CONTENT_TABLES, ensureSchemaIfMissing } from "./fullBackup";
import { BackupMcqSchema } from "./mcqBackup";

// ---------------------------------------------------------------------------
// Past papers backup — its own backup/restore, separate from the MCQ bank
// (lib/mcqBackup.ts leaves past paper questions out) and from the whole
// database backup (lib/fullBackup.ts). A file holds the past papers and the
// questions that belong to them, nothing else, so papers can be saved,
// moved between environments and replaced without touching the question
// bank, students or settings.
// ---------------------------------------------------------------------------

export const PAST_PAPER_BACKUP_VERSION = 1;
export const PAST_PAPER_BACKUP_KIND = "past-papers";

export interface PastPaperBackupFile {
  application: string;
  kind: typeof PAST_PAPER_BACKUP_KIND;
  formatVersion: number;
  exportedAt: string;
  // Present only for a single-paper backup; absent = every past paper.
  scope?: { paperId: number; title: string };
  counts: { pastPapers: number; mcqs: number };
  pastPapers: Array<typeof pastPapersTable.$inferSelect>;
  mcqs: Array<typeof mcqsTable.$inferSelect>;
}

export async function buildPastPaperBackup(paperId?: number): Promise<PastPaperBackupFile> {
  const papers = paperId
    ? await db.select().from(pastPapersTable).where(eq(pastPapersTable.id, paperId))
    : await db.select().from(pastPapersTable);
  const ids = papers.map((p) => p.id);
  const mcqs = ids.length
    ? await db.select().from(mcqsTable).where(inArray(mcqsTable.pastPaperId, ids))
    : [];
  return {
    application: APPLICATION_NAME,
    kind: PAST_PAPER_BACKUP_KIND,
    formatVersion: PAST_PAPER_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    ...(paperId && papers[0] ? { scope: { paperId, title: papers[0].title } } : {}),
    counts: { pastPapers: papers.length, mcqs: mcqs.length },
    pastPapers: papers,
    mcqs,
  };
}

const PaperSchema = z.object({
  id: z.number().int(),
  title: z.string().min(1),
  examBoard: z.string().optional(),
  year: z.string().optional(),
  level: z.string().optional(),
  institutionId: z.number().nullable().optional(),
  programId: z.number().nullable().optional(),
  academicYearId: z.number().nullable().optional(),
  programTargetKind: z.string().nullable().optional(),
  yearTargetNumber: z.number().nullable().optional(),
  active: z.boolean().optional(),
  archived: z.boolean().optional(),
  displayOrder: z.number().optional(),
});

const PastPaperFileSchema = z.object({
  scope: z.object({ paperId: z.number().int(), title: z.string() }).optional(),
  pastPapers: z.array(PaperSchema).min(1).max(5_000),
  mcqs: z.array(BackupMcqSchema).max(100_000),
});

export type ParsedPastPaperBackup = z.infer<typeof PastPaperFileSchema>;

// Accepts this section's own file, and also a Full / Platform-content
// database backup (which already contains past papers + their questions), so
// the papers can be restored on their own from an older whole-database file.
export function parsePastPaperBackup(raw: unknown): { ok: true; data: ParsedPastPaperBackup; source: "past-papers" | "database-backup" } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "That file isn't a backup." };
  const obj = raw as Record<string, unknown>;
  let candidate: unknown;
  let source: "past-papers" | "database-backup";
  if (obj.kind === PAST_PAPER_BACKUP_KIND) {
    candidate = obj;
    source = "past-papers";
  } else if (obj.application === APPLICATION_NAME && obj.data && typeof obj.data === "object") {
    const data = obj.data as Record<string, unknown>;
    const papers = Array.isArray(data.pastPapers) ? data.pastPapers : [];
    const mcqs = (Array.isArray(data.mcqs) ? data.mcqs : []).filter((m) => m && typeof m === "object" && (m as Record<string, unknown>).pastPaperId != null);
    candidate = { pastPapers: papers, mcqs };
    source = "database-backup";
  } else {
    return { ok: false, error: "This doesn't look like a past papers backup (or a full database backup that contains past papers)." };
  }
  const parsed = PastPaperFileSchema.safeParse(candidate);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? ` (${issue.path.join(".")})` : "";
    return { ok: false, error: `This backup has no usable past papers: ${issue?.message ?? "invalid shape"}${where}` };
  }
  return { ok: true, data: parsed.data, source };
}

export interface PastPaperRestoreResult {
  mode: "append" | "replace";
  pastPapersRestored: number;
  mcqsRestored: number;
  pastPapersReplaced: number;
  mcqsDeleted: number;
  mcqsSkippedNoPaper: number;
  tablesPrepared: boolean;
}

const INSERT_BATCH_SIZE = 500;


export async function restorePastPaperBackup(data: ParsedPastPaperBackup, mode: "append" | "replace"): Promise<PastPaperRestoreResult> {
  // The restore creates what it needs: if this database has no past papers
  // table yet (a brand-new project), the schema is prepared first, exactly
  // like the whole-database restore does.
  const anchor = CONTENT_TABLES.find((t) => t.key === "pastPapers")!;
  const mcqAnchor = CONTENT_TABLES.find((t) => t.key === "mcqs")!;
  const before = await db.execute(sql`select (to_regclass('med_past_papers') is not null) as a, (to_regclass('med_mcqs') is not null) as b`);
  const row = before.rows[0] as { a: boolean; b: boolean };
  const tablesPrepared = !row.a || !row.b;
  await ensureSchemaIfMissing(anchor);
  await ensureSchemaIfMissing(mcqAnchor);

  return db.transaction(async (tx) => {
    const ids = async (query: Promise<Array<{ id: number }>>) => new Set((await query).map((r) => r.id));
    const known = {
      institutions: await ids(tx.select({ id: institutionsTable.id }).from(institutionsTable)),
      programs: await ids(tx.select({ id: programsTable.id }).from(programsTable)),
      academicYears: await ids(tx.select({ id: academicYearsTable.id }).from(academicYearsTable)),
      modules: await ids(tx.select({ id: modulesTable.id }).from(modulesTable)),
      subjects: await ids(tx.select({ id: subjectsTable.id }).from(subjectsTable)),
      topics: await ids(tx.select({ id: topicsTable.id }).from(topicsTable)),
    };
    const keep = (value: number | null | undefined, set: Set<number>) => (value != null && set.has(value) ? value : null);

    // --- replace: wipe what this file covers first (same transaction) ---
    let pastPapersReplaced = 0;
    let mcqsDeleted = 0;
    if (mode === "replace") {
      let victims: number[];
      if (data.scope) {
        // Single-paper file: replace the existing copy of that same paper
        // (same title, board and year), leave every other paper alone.
        const p = data.pastPapers.find((x) => x.id === data.scope!.paperId) ?? data.pastPapers[0];
        const existing = await tx.select({ id: pastPapersTable.id, title: pastPapersTable.title, examBoard: pastPapersTable.examBoard, year: pastPapersTable.year }).from(pastPapersTable);
        victims = existing
          .filter((e) => e.title.trim().toLowerCase() === p.title.trim().toLowerCase() && (e.examBoard ?? "") === (p.examBoard ?? "") && (e.year ?? "") === (p.year ?? ""))
          .map((e) => e.id);
      } else {
        victims = (await tx.select({ id: pastPapersTable.id }).from(pastPapersTable)).map((r) => r.id);
      }
      if (victims.length) {
        const mcqIds = (await tx.select({ id: mcqsTable.id }).from(mcqsTable).where(and(isNotNull(mcqsTable.pastPaperId), inArray(mcqsTable.pastPaperId, victims)))).map((r) => r.id);
        for (let i = 0; i < mcqIds.length; i += 1000) {
          const chunk = mcqIds.slice(i, i + 1000);
          await tx.delete(practiceAnswersTable).where(inArray(practiceAnswersTable.mcqId, chunk));
          await tx.delete(examAnswersTable).where(inArray(examAnswersTable.mcqId, chunk));
          await tx.delete(examQuestionsTable).where(inArray(examQuestionsTable.mcqId, chunk));
          await tx.delete(notebookEntriesTable).where(inArray(notebookEntriesTable.mcqId, chunk));
          await tx.delete(flaggedMcqsTable).where(inArray(flaggedMcqsTable.mcqId, chunk));
          await tx.delete(mcqsTable).where(inArray(mcqsTable.id, chunk));
        }
        await tx.delete(pastPapersTable).where(inArray(pastPapersTable.id, victims));
        pastPapersReplaced = victims.length;
        mcqsDeleted = mcqIds.length;
      }
    }

    // --- papers first (new ids), remembering old id -> new id ---
    const paperIdMap = new Map<number, number>();
    for (const p of [...data.pastPapers].sort((a, b) => a.id - b.id)) {
      const [created] = await tx.insert(pastPapersTable).values({
        title: p.title,
        examBoard: p.examBoard ?? "",
        year: p.year ?? "",
        level: p.level ?? "",
        institutionId: keep(p.institutionId, known.institutions),
        programId: keep(p.programId, known.programs),
        academicYearId: keep(p.academicYearId, known.academicYears),
        programTargetKind: p.programTargetKind ?? null,
        yearTargetNumber: p.yearTargetNumber ?? null,
        active: p.active ?? true,
        archived: p.archived ?? false,
        displayOrder: p.displayOrder ?? 0,
      }).returning({ id: pastPapersTable.id });
      paperIdMap.set(p.id, created.id);
    }

    // --- then their questions, pointing at the new paper ids ---
    const usable = data.mcqs.filter((m) => m.pastPaperId != null && paperIdMap.has(m.pastPaperId));
    for (let i = 0; i < usable.length; i += INSERT_BATCH_SIZE) {
      await tx.insert(mcqsTable).values(usable.slice(i, i + INSERT_BATCH_SIZE).map((m) => ({
        question: m.question,
        options: m.options,
        correctAnswer: m.correctAnswer ?? null,
        explanation: m.explanation ?? null,
        optionExplanations: m.optionExplanations ? m.optionExplanations.map((e) => e ?? "") : null,
        hint: m.hint ?? null,
        explanationStatus: (m.explanationStatus as "PENDING" | "AI_GENERATED" | "REVIEWED" | "APPROVED" | undefined) ?? "PENDING",
        reference: m.reference ?? null,
        difficulty: (m.difficulty as "easy" | "moderate" | "hard" | undefined) ?? "moderate",
        tags: m.tags ?? [],
        imagePath: m.imagePath ?? null,
        status: (m.status as "draft" | "published" | undefined) ?? "draft",
        source: "import" as const,
        moduleId: keep(m.moduleId, known.modules),
        subjectId: keep(m.subjectId, known.subjects),
        topicId: keep(m.topicId, known.topics),
        pastPaperId: paperIdMap.get(m.pastPaperId as number)!,
        examId: null,
      })));
    }

    return {
      mode,
      pastPapersRestored: paperIdMap.size,
      mcqsRestored: usable.length,
      pastPapersReplaced,
      mcqsDeleted,
      mcqsSkippedNoPaper: data.mcqs.length - usable.length,
      tablesPrepared,
    };
  });
}
