import { Router, type IRouter } from "express";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, pastPapersTable, mcqsTable, subjectsTable, auditLogsTable, usersTable } from "@workspace/db";
import { requireAdmin, requireAuth, requireMembershipFor, isAdminRole } from "../middlewares/auth";
import { deleteMcqsEverywhere } from "../lib/mcqCascade";
import { getStudentTargeting, isTargetVisible, notifyTargetedStudents } from "../lib/contentVisibility";
import { CLASSIFY_VERSION, candidateSubjects, resolvePaperBlock, classifyPaperChunk, classifyPaperInBackground, countPending, isClassifying, papersWithPending } from "../lib/paperTopics";
import { AiNotConfiguredError } from "../lib/aiExplain";

const router: IRouter = Router();

// Mirrors DEGREE_YEAR_OPTIONS in frontend-admin/src/lib/shared.tsx — position
// within the array is the year number (index + 1), same convention the
// Degree + Year picker's studyYearToNumber() uses. Duplicated here rather
// than imported since this is server code and that lives in a frontend
// package; keep the two in sync if a degree/year label ever changes.
const DEGREE_YEAR_OPTIONS: Record<string, string[]> = {
  MBBS: ["1st Year", "2nd Year", "3rd Year", "4th Year", "Final Year"],
  BDS: ["1st Year", "2nd Year", "3rd Year", "Final Year"],
};

async function paperView(paper: typeof pastPapersTable.$inferSelect) {
  const [mcqCount] = await db.select({ count: sql<number>`count(*)` }).from(mcqsTable).where(eq(mcqsTable.pastPaperId, paper.id));
  return { ...paper, mcqCount: Number(mcqCount?.count ?? 0) };
}

// Batch version of paperView for the list endpoint: ONE grouped COUNT for all
// papers instead of one COUNT per paper. The per-paper version fired ~55
// concurrent queries against a 5-connection pool, so requests queued past the
// 5s connectionTimeoutMillis and surfaced as a 500. Same output shape, same
// order as the input.
async function paperViews(papers: Array<typeof pastPapersTable.$inferSelect>) {
  if (papers.length === 0) return [];
  const countRows = await db
    .select({ pastPaperId: mcqsTable.pastPaperId, count: sql<number>`count(*)::int` })
    .from(mcqsTable)
    .where(inArray(mcqsTable.pastPaperId, papers.map((p) => p.id)))
    .groupBy(mcqsTable.pastPaperId);
  const counts = new Map<number, number>();
  for (const r of countRows) if (r.pastPaperId != null) counts.set(r.pastPaperId, Number(r.count));
  return papers.map((paper) => ({ ...paper, mcqCount: counts.get(paper.id) ?? 0 }));
}

router.get("/past-papers", async (req, res): Promise<void> => {
  const isAdmin = req.user && (isAdminRole(req.user.role));
  const level = typeof req.query.level === "string" ? req.query.level : undefined;

  // Scope students to their own program + academic year. Two targeting
  // mechanisms exist side by side here: the older institutionId/programId/
  // academicYearId FK trio (which requires "Colleges & courses" to be set
  // up first — see AdminPastPapers' "No programs set up yet" notice, which
  // most admins never do), and programTargetKind/yearTargetNumber, which
  // is derived automatically from the paper's own Degree + Year picker at
  // save time — same simple convention Modules/Blocks already use, no
  // separate setup needed. A paper is visible to a student only if it
  // passes BOTH: left untouched on an axis (null) always passes that axis;
  // set on either axis means the student's own value has to match it.
  let studentProgramId: number | null = null;
  let studentAcademicYearId: number | null = null;
  let targeting = { programKind: null as string | null, yearNumber: null as number | null };
  if (req.user && !isAdmin) {
    const [student] = await db.select({ programId: usersTable.programId, academicYearId: usersTable.academicYearId }).from(usersTable).where(eq(usersTable.id, req.user.id));
    studentProgramId = student?.programId ?? null;
    studentAcademicYearId = student?.academicYearId ?? null;
    targeting = await getStudentTargeting(req.user.id);
  }

  const rows = await db.select().from(pastPapersTable).where(and(
    isAdmin ? undefined : eq(pastPapersTable.active, true),
    level ? eq(pastPapersTable.level, level) : undefined,
    isAdmin || !req.user ? undefined : or(isNull(pastPapersTable.programId), eq(pastPapersTable.programId, studentProgramId ?? -1)),
    isAdmin || !req.user ? undefined : or(isNull(pastPapersTable.academicYearId), eq(pastPapersTable.academicYearId, studentAcademicYearId ?? -1)),
  )).orderBy(pastPapersTable.displayOrder);
  const scoped = isAdmin || !req.user ? rows : rows.filter((row) => isTargetVisible(row.programTargetKind, row.yearTargetNumber, targeting));
  res.json(await paperViews(scoped));
});

// Topic-wise breakdown of one paper (published questions only) — feeds the
// "Comprehensive Assessment (All Topics)" dropdown. A question's topic is, in order:
// the subject an admin tagged it with (mcqs.subjectId), else the label the AI gave it
// (mcqs.paperSubject), else a single "General" bucket. Same-named topics merge. Each
// bucket lists its mcq ids so the practice screen can attempt just those questions.
// Questions still waiting for a label are sorted by the AI in the background (existing
// papers sort themselves the first time anyone opens them); `classifying` tells the
// client to re-fetch shortly.
router.get("/past-papers/:id/subjects", requireAuth, requireMembershipFor("past_papers"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid past paper id" }); return; }
  const rows = await db
    .select({ id: mcqsTable.id, subjectId: mcqsTable.subjectId, paperSubject: mcqsTable.paperSubject, paperSubjectVer: mcqsTable.paperSubjectVer, sortOrder: mcqsTable.sortOrder })
    .from(mcqsTable)
    .where(and(eq(mcqsTable.pastPaperId, id), eq(mcqsTable.status, "published")))
    .orderBy(sql`${mcqsTable.sortOrder} ASC NULLS LAST`, mcqsTable.id);
  const subjectIds = Array.from(new Set(rows.map((r) => r.subjectId).filter((v): v is number => v != null)));
  const nameById = new Map<number, string>();
  if (subjectIds.length) {
    const subs = await db.select({ id: subjectsTable.id, name: subjectsTable.name }).from(subjectsTable).where(inArray(subjectsTable.id, subjectIds));
    for (const s of subs) nameById.set(s.id, s.name.trim());
  }
  const GENERAL = "__general";
  const buckets = new Map<string, { key: string; name: string; mcqIds: number[] }>();
  let pending = 0;
  for (const r of rows) {
    const tagged = r.subjectId != null ? nameById.get(r.subjectId) : undefined;
    const ai = r.paperSubject?.trim();
    const name = tagged || (ai && ai.toLowerCase() !== "general" ? ai : undefined);
    if (!tagged && (!ai || r.paperSubjectVer !== CLASSIFY_VERSION)) pending++;
    const key = name ? name.toLowerCase() : GENERAL;
    let b = buckets.get(key);
    if (!b) { b = { key, name: name ?? "General", mcqIds: [] }; buckets.set(key, b); }
    b.mcqIds.push(r.id);
  }
  if (pending > 0) classifyPaperInBackground(id);
  const subjects = Array.from(buckets.values())
    .map((b) => ({ ...b, count: b.mcqIds.length }))
    // "General" always last; otherwise biggest topic first, then A–Z.
    .sort((a, b) => (a.key === GENERAL ? 1 : 0) - (b.key === GENERAL ? 1 : 0) || b.count - a.count || a.name.localeCompare(b.name));
  res.json({ total: rows.length, subjects, pending, classifying: pending > 0 && isClassifying(id) });
});

// ---- Admin: AI topic sorting -------------------------------------------------
// Which papers still have unsorted questions (drives the "Sort all with AI" button).
router.get("/admin/past-papers/topic-sorting", requireAdmin, async (_req, res): Promise<void> => {
  const papers = await papersWithPending();
  res.json({ papers, pending: papers.reduce((n, p) => n + p.pending, 0) });
});

// Per-paper view for the admin: which Block the AI will sort this paper within (and why), the subjects it may
// use, and how the questions are currently labelled.
router.get("/admin/past-papers/:id/topic-info", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid past paper id" }); return; }
  const [paper] = await db.select({ blockId: pastPapersTable.blockId }).from(pastPapersTable).where(eq(pastPapersTable.id, id));
  if (!paper) { res.status(404).json({ error: "Past paper not found" }); return; }
  const [block, candidates, pending, rows] = await Promise.all([
    resolvePaperBlock(id),
    candidateSubjects(id),
    countPending(id),
    db.select({ tagged: sql<boolean>`${mcqsTable.subjectId} is not null`, label: mcqsTable.paperSubject, n: sql<number>`count(*)::int` })
      .from(mcqsTable).where(eq(mcqsTable.pastPaperId, id)).groupBy(sql`${mcqsTable.subjectId} is not null`, mcqsTable.paperSubject),
  ]);
  const total = rows.reduce((n, r) => n + Number(r.n), 0);
  const labels = new Map<string, number>();
  let adminTagged = 0;
  for (const r of rows) {
    if (r.tagged) { adminTagged += Number(r.n); continue; }
    const k = r.label?.trim() || "Not sorted yet";
    labels.set(k, (labels.get(k) ?? 0) + Number(r.n));
  }
  res.json({
    total, pending, adminTagged, classifying: isClassifying(id),
    blockId: paper.blockId ?? null,
    block: block ? { id: block.id, name: block.name, source: block.source } : null,
    subjects: candidates.map((c) => c.name),
    labels: [...labels.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n),
  });
});

// Sorts one chunk (~45 questions) of ONE paper and reports what is left; the admin
// screen calls it repeatedly, so no single request runs long enough to hit a gateway
// timeout. { redo: true } re-sorts questions that already have an AI label.
router.post("/admin/past-papers/:id/classify", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid past paper id" }); return; }
  const redo = req.body?.redo === true;
  try {
    if (redo) await db.update(mcqsTable).set({ paperSubject: null, paperSubjectVer: null }).where(and(eq(mcqsTable.pastPaperId, id), isNull(mcqsTable.subjectId)));
    const r = await classifyPaperChunk(id, { limit: 45 });
    if (r.subjects.length === 0) { res.status(400).json({ error: "No subjects exist yet to sort into — add modules/subjects first." }); return; }
    res.json({ classified: r.classified, remaining: r.remaining, topics: r.subjects.length });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) { res.status(400).json({ error: err.message }); return; }
    res.status(502).json({ error: err instanceof Error ? err.message : "AI sorting failed" });
  }
});

router.get("/past-papers/:id/mcqs", requireAuth, requireMembershipFor("past_papers"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const rows = await db.select().from(mcqsTable).where(and(eq(mcqsTable.pastPaperId, id), eq(mcqsTable.status, "published")));
  res.json(rows.map((row) => ({ ...row, module: "", subject: "", topic: "" })));
});

const PaperBody = z.object({
  title: z.string().min(1).max(160),
  examBoard: z.string().max(80).optional(),
  year: z.string().max(20).optional(),
  level: z.string().max(80).optional(),
  // Nullable, not just optional: PastPaperEditForm (the edit form, unlike
  // the create form) always sends these three keys explicitly — a real id
  // when set, or `null` when the admin leaves/clears the field — rather
  // than omitting the key. With `.optional()` alone, zod rejected `null`
  // outright (a type mismatch, not a "missing field"), so safeParse
  // failed on every single edit save and PATCH returned 400 before
  // touching the DB. The update mutation on the frontend has no onError
  // toast either, so that 400 was invisible — "Save changes" just did
  // nothing. `.nullable()` lets an edit both set AND clear these fields.
  institutionId: z.number().int().positive().nullable().optional(),
  programId: z.number().int().positive().nullable().optional(),
  academicYearId: z.number().int().positive().nullable().optional(),
  // Derived from the Degree + Year picker (see the paperView/GET comment
  // above) — null/omitted means "every program" / "every year" on that
  // axis, same convention as Modules/Blocks.
  programTargetKind: z.string().max(40).nullable().optional(),
  yearTargetNumber: z.number().int().min(1).max(6).nullable().optional(),
  blockId: z.number().int().positive().nullable().optional(), // which Block the AI sorts this paper's questions within (null = auto-detect)
  active: z.boolean().optional(),
  archived: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

router.post("/past-papers", requireAdmin, async (req, res): Promise<void> => {
  const parsed = PaperBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message }); return; }
  const { programTargetKind, yearTargetNumber, ...rest } = parsed.data;
  const active = parsed.data.active ?? true;
  const normalizedKind = programTargetKind ? programTargetKind.trim().toUpperCase() : null;
  const [row] = await db.insert(pastPapersTable).values({
    ...rest,
    active,
    programTargetKind: normalizedKind,
    yearTargetNumber: yearTargetNumber ?? null,
  }).returning();
  await db.insert(auditLogsTable).values({ actorId: req.user!.id, action: "PAST_PAPER_CREATED", entity: "past_paper", entityId: row.id });

  // Auto-notify the same audience this paper is actually visible to (see
  // notifyTargetedStudents in contentVisibility.ts) — same
  // programTargetKind/yearTargetNumber rule GET /past-papers uses, so a
  // paper scoped to e.g. MBBS Year 3 only pings MBBS Year 3 students, and
  // an untargeted paper reaches everyone. Skipped for a paper saved
  // inactive (admin still working on it) — nothing to notify anyone about
  // yet since students can't see it either.
  if (active) {
    const scopeLabel = `${normalizedKind || "All programs"} · ${yearTargetNumber ? `Year ${yearTargetNumber}` : "All years"}`;
    const notified = await notifyTargetedStudents(
      normalizedKind,
      yearTargetNumber ?? null,
      "New past paper available",
      `"${row.title}" has just been added — check it out under Past papers.`,
      "info",
    );
    await db.insert(auditLogsTable).values({ actorId: req.user!.id, action: "NOTIFICATION_AUTO_PAST_PAPER", entity: "past_paper", entityId: row.id, metadata: JSON.stringify({ scope: scopeLabel, notified }) });
  }

  res.status(201).json(await paperView(row));
});

router.patch("/past-papers/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = PaperBody.partial().safeParse(req.body);
  if (!parsed.success || Number.isNaN(id)) { res.status(400).json({ error: "Invalid request" }); return; }
  const [before] = await db.select().from(pastPapersTable).where(eq(pastPapersTable.id, id));
  const { programTargetKind, yearTargetNumber, ...rest } = parsed.data;
  const [row] = await db.update(pastPapersTable).set({
    ...rest,
    ...(programTargetKind !== undefined ? { programTargetKind: programTargetKind ? programTargetKind.trim().toUpperCase() : null } : {}),
    ...(yearTargetNumber !== undefined ? { yearTargetNumber } : {}),
  }).where(eq(pastPapersTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Past paper not found" }); return; }
  // Moving a paper to another Block (or retitling it) changes which subjects its questions may use: re-check the AI labels.
  if (parsed.data.blockId !== undefined || parsed.data.title !== undefined) {
    await db.update(mcqsTable).set({ paperSubjectVer: null }).where(and(eq(mcqsTable.pastPaperId, row.id), isNull(mcqsTable.subjectId)));
    classifyPaperInBackground(row.id);
  }
  await db.insert(auditLogsTable).values({ actorId: req.user!.id, action: "PAST_PAPER_UPDATED", entity: "past_paper", entityId: row.id });

  // Only fires the auto-notification on the false → true transition (a
  // paper made visible for the first time after being saved inactive) —
  // never on every edit, or every title tweak to an already-active paper
  // would re-spam the same students.
  if (before && !before.active && row.active) {
    const scopeLabel = `${row.programTargetKind || "All programs"} · ${row.yearTargetNumber ? `Year ${row.yearTargetNumber}` : "All years"}`;
    const notified = await notifyTargetedStudents(
      row.programTargetKind,
      row.yearTargetNumber,
      "New past paper available",
      `"${row.title}" has just been added — check it out under Past papers.`,
      "info",
    );
    await db.insert(auditLogsTable).values({ actorId: req.user!.id, action: "NOTIFICATION_AUTO_PAST_PAPER", entity: "past_paper", entityId: row.id, metadata: JSON.stringify({ scope: scopeLabel, notified }) });
  }

  res.json(await paperView(row));
});

router.delete("/past-papers/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.update(pastPapersTable).set({ active: false, archived: true }).where(eq(pastPapersTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Past paper not found" }); return; }
  await db.insert(auditLogsTable).values({ actorId: req.user!.id, action: "PAST_PAPER_ARCHIVED", entity: "past_paper", entityId: row.id });
  res.json({ ok: true });
});

// Hard delete — only for a paper already archived (the DELETE above).
// Deletes every MCQ that belongs to this paper — and everything else in
// the app that references those MCQs (practice history, exam
// attachments, notebook entries, flags) — instead of just un-tagging
// them, so nothing is left behind in the question bank or anywhere else.
router.delete("/past-papers/:id/permanent", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid past paper id" }); return; }
  const [paper] = await db.select().from(pastPapersTable).where(eq(pastPapersTable.id, id));
  if (!paper) { res.status(404).json({ error: "Past paper not found" }); return; }

  const mcqRows = await db.select({ id: mcqsTable.id }).from(mcqsTable).where(eq(mcqsTable.pastPaperId, id));
  await deleteMcqsEverywhere(mcqRows.map((r) => r.id));
  await db.delete(pastPapersTable).where(eq(pastPapersTable.id, id));

  await db.insert(auditLogsTable).values({ actorId: req.user!.id, action: "PAST_PAPER_PERMANENTLY_DELETED", entity: "past_paper", entityId: id, metadata: JSON.stringify({ mcqsDeleted: mcqRows.length }) });
  res.json({ ok: true, mcqsDeleted: mcqRows.length });
});

// Attach/detach MCQs to a paper (admin only) — lets admins build a paper from
// existing MCQs or ones they add fresh via the MCQ bank with pastPaperId set.
router.post("/past-papers/:id/mcqs", requireAdmin, async (req, res): Promise<void> => {
  const paperId = Number(req.params.id);
  const parsed = z.object({ mcqIds: z.array(z.number().int().positive()) }).safeParse(req.body);
  if (!parsed.success || Number.isNaN(paperId)) { res.status(400).json({ error: "mcqIds is required" }); return; }
  for (const mcqId of parsed.data.mcqIds) {
    await db.update(mcqsTable).set({ pastPaperId: paperId }).where(eq(mcqsTable.id, mcqId));
  }
  // New questions in this paper → let the AI sort them into topics (background).
  if ((await countPending(paperId)) > 0) classifyPaperInBackground(paperId);
  res.json({ ok: true });
});

router.delete("/past-papers/:id/mcqs/:mcqId", requireAdmin, async (req, res): Promise<void> => {
  await db.update(mcqsTable).set({ pastPaperId: null }).where(eq(mcqsTable.id, Number(req.params.mcqId)));
  res.json({ ok: true });
});

// One-time backward-compat fix (same pattern as
// POST /admin/books/backfill-links) for papers uploaded before the Degree +
// Year picker existed. Those rows only ever got the free-text `level`
// field (e.g. "MBBS - 1st Year") typed or composed at creation, with
// programTargetKind/yearTargetNumber left null — and null on either axis
// means "visible to every program/year" (see contentVisibility.ts), which
// is exactly why an old First Year paper still shows up in a Third Year
// student's account: it was never actually tagged as First-Year-only, it
// was just labeled that way in text nobody parsed back into the real
// targeting fields. This walks every paper missing that targeting, splits
// its `level` on " - " into a degree and a study-year label, and — only
// when both halves match a real DEGREE_YEAR_OPTIONS entry — fills in
// programTargetKind/yearTargetNumber from it. Safe to re-run: a paper
// already tagged (by this or the create/edit form) is left untouched, and
// a paper whose `level` doesn't parse cleanly is skipped rather than
// guessed at.
router.post("/past-papers/backfill-year-targeting", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(pastPapersTable).where(and(isNull(pastPapersTable.programTargetKind), isNull(pastPapersTable.yearTargetNumber)));
  let fixed = 0;
  let skipped = 0;
  for (const row of rows) {
    const [degree, studyYear] = (row.level || "").split(" - ").map((s) => s.trim());
    const yearIndex = degree && studyYear ? (DEGREE_YEAR_OPTIONS[degree] || []).indexOf(studyYear) : -1;
    if (yearIndex < 0) { skipped++; continue; }
    await db.update(pastPapersTable).set({ programTargetKind: degree, yearTargetNumber: yearIndex + 1 }).where(eq(pastPapersTable.id, row.id));
    fixed++;
  }
  res.json({ fixed, skipped });
});

export default router;
