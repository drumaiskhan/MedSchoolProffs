import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, notebookEntriesTable, savedSessionsTable, flaggedMcqsTable, savedMcqsTable, feedbackTable, feedbackRepliesTable, notificationsTable, usersTable, mcqsTable, topicsTable, subjectsTable, modulesTable, blocksTable } from "@workspace/db";
import { requireAuth, requireAdmin, isAdminRole } from "../middlewares/auth";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Notebook
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Curriculum placement helpers (shared by flagged MCQs, notes, saved sessions
// and the mistake ledger). Placement is resolved by walking UP the tree from the
// topic (topic -> subject -> module -> block); the MCQ's own subjectId/moduleId
// are only a fallback, because older questions often carry just a topicId.
// ---------------------------------------------------------------------------
type Placement = {
  blockName: string | null; moduleName: string | null; subjectName: string | null; topicName: string | null;
  blockOrder: number | null; moduleOrder: number | null; subjectOrder: number | null; topicOrder: number | null;
};
const NO_PLACEMENT: Placement = { blockName: null, moduleName: null, subjectName: null, topicName: null, blockOrder: null, moduleOrder: null, subjectOrder: null, topicOrder: null };

async function placementsForMcqs(ids: number[]): Promise<Map<number, Placement>> {
  const out = new Map<number, Placement>();
  const unique = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))].slice(0, 1000);
  if (!unique.length) return out;
  const rows = await db.select({
    id: mcqsTable.id,
    topicName: topicsTable.name, subjectName: subjectsTable.name, moduleName: modulesTable.name, blockName: blocksTable.name,
    topicOrder: topicsTable.displayOrder, subjectOrder: subjectsTable.displayOrder, moduleOrder: modulesTable.displayOrder, blockOrder: blocksTable.displayOrder,
  }).from(mcqsTable)
    .leftJoin(topicsTable, eq(mcqsTable.topicId, topicsTable.id))
    .leftJoin(subjectsTable, eq(subjectsTable.id, sql`coalesce(${topicsTable.subjectId}, ${mcqsTable.subjectId})`))
    .leftJoin(modulesTable, eq(modulesTable.id, sql`coalesce(${subjectsTable.moduleId}, ${mcqsTable.moduleId})`))
    .leftJoin(blocksTable, eq(modulesTable.blockId, blocksTable.id))
    .where(inArray(mcqsTable.id, unique));
  for (const r of rows) out.set(r.id, { blockName: r.blockName ?? null, moduleName: r.moduleName ?? null, subjectName: r.subjectName ?? null, topicName: r.topicName ?? null, blockOrder: r.blockOrder ?? null, moduleOrder: r.moduleOrder ?? null, subjectOrder: r.subjectOrder ?? null, topicOrder: r.topicOrder ?? null });
  return out;
}

async function placementsForTopics(ids: number[]): Promise<Map<number, Placement>> {
  const out = new Map<number, Placement>();
  const unique = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))].slice(0, 1000);
  if (!unique.length) return out;
  const rows = await db.select({
    id: topicsTable.id,
    topicName: topicsTable.name, subjectName: subjectsTable.name, moduleName: modulesTable.name, blockName: blocksTable.name,
    topicOrder: topicsTable.displayOrder, subjectOrder: subjectsTable.displayOrder, moduleOrder: modulesTable.displayOrder, blockOrder: blocksTable.displayOrder,
  }).from(topicsTable)
    .leftJoin(subjectsTable, eq(topicsTable.subjectId, subjectsTable.id))
    .leftJoin(modulesTable, eq(subjectsTable.moduleId, modulesTable.id))
    .leftJoin(blocksTable, eq(modulesTable.blockId, blocksTable.id))
    .where(inArray(topicsTable.id, unique));
  for (const r of rows) out.set(r.id, { blockName: r.blockName ?? null, moduleName: r.moduleName ?? null, subjectName: r.subjectName ?? null, topicName: r.topicName ?? null, blockOrder: r.blockOrder ?? null, moduleOrder: r.moduleOrder ?? null, subjectOrder: r.subjectOrder ?? null, topicOrder: r.topicOrder ?? null });
  return out;
}

// Placement for a batch of question ids — used by the on-device Mistakes list
// (its ledger only stores ids) so it can be grouped like every other review tool.
router.post("/mcq-placements", requireAuth, async (req, res): Promise<void> => {
  const parsed = z.object({ ids: z.array(z.number().int().positive()).max(1000) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "ids must be an array of question ids" }); return; }
  const map = await placementsForMcqs(parsed.data.ids);
  res.json(parsed.data.ids.map((id) => ({ id, ...(map.get(id) ?? NO_PLACEMENT), found: map.has(id) })));
});

router.get("/notebook", requireAuth, async (req, res): Promise<void> => {
  const rows = await db.select().from(notebookEntriesTable).where(eq(notebookEntriesTable.userId, req.user!.id)).orderBy(desc(notebookEntriesTable.updatedAt));
  // Notes linked to a question are filed under that question's Block > Module > Subject > Topic (additive fields).
  const linkedIds = [...new Set(rows.map((r) => r.mcqId).filter((x): x is number => x !== null))];
  const places = await placementsForMcqs(linkedIds);
  // The attached question's text, so a note shows WHICH MCQ it belongs to (null when the question was deleted).
  const qRows = linkedIds.length ? await db.select({ id: mcqsTable.id, question: mcqsTable.question }).from(mcqsTable).where(inArray(mcqsTable.id, linkedIds.slice(0, 1000))) : [];
  const questions = new Map(qRows.map((q) => [q.id, q.question]));
  res.json(rows.map((r) => ({ ...r, ...(r.mcqId !== null ? (places.get(r.mcqId) ?? NO_PLACEMENT) : NO_PLACEMENT), question: r.mcqId !== null ? (questions.get(r.mcqId) ?? null) : null, mcqDeleted: r.mcqId !== null && !questions.has(r.mcqId) })));
});

const NotebookBody = z.object({ title: z.string().max(160).optional(), content: z.string().min(1).max(10000), mcqId: z.number().int().positive().optional() });

router.post("/notebook", requireAuth, async (req, res): Promise<void> => {
  const parsed = NotebookBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message }); return; }
  const [row] = await db.insert(notebookEntriesTable).values({ userId: req.user!.id, title: parsed.data.title ?? "", content: parsed.data.content, mcqId: parsed.data.mcqId }).returning();
  res.status(201).json(row);
});

router.patch("/notebook/:id", requireAuth, async (req, res): Promise<void> => {
  const parsed = NotebookBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message }); return; }
  const [row] = await db.update(notebookEntriesTable).set(parsed.data).where(and(eq(notebookEntriesTable.id, Number(req.params.id)), eq(notebookEntriesTable.userId, req.user!.id))).returning();
  if (!row) { res.status(404).json({ error: "Note not found" }); return; }
  res.json(row);
});

router.delete("/notebook/:id", requireAuth, async (req, res): Promise<void> => {
  await db.delete(notebookEntriesTable).where(and(eq(notebookEntriesTable.id, Number(req.params.id)), eq(notebookEntriesTable.userId, req.user!.id)));
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Saved sessions
// ---------------------------------------------------------------------------

router.get("/saved-sessions", requireAuth, async (req, res): Promise<void> => {
  const rows = await db.select().from(savedSessionsTable).where(eq(savedSessionsTable.userId, req.user!.id)).orderBy(desc(savedSessionsTable.createdAt));
  const parsedRows = rows.map((row) => { let config: Record<string, unknown> = {}; try { config = JSON.parse(row.config); } catch { /* corrupt config: keep empty */ } return { ...row, config }; });
  // Sessions saved against a topic are filed under that topic's Block > Module > Subject > Topic (additive fields).
  const topicIds = parsedRows.map((r) => Number(r.config.topicId)).filter((n) => Number.isInteger(n) && n > 0);
  const places = await placementsForTopics(topicIds);
  res.json(parsedRows.map((r) => ({ ...r, ...(places.get(Number(r.config.topicId)) ?? NO_PLACEMENT) })));
});

router.post("/saved-sessions", requireAuth, async (req, res): Promise<void> => {
  const parsed = z.object({ name: z.string().min(1).max(120), config: z.record(z.string(), z.any()) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "name and config are required" }); return; }
  const [row] = await db.insert(savedSessionsTable).values({ userId: req.user!.id, name: parsed.data.name, config: JSON.stringify(parsed.data.config) }).returning();
  res.status(201).json({ ...row, config: parsed.data.config });
});

// In-progress practice sessions ("start where I left off"). One per student per
// topic / past paper: saving again replaces the previous snapshot, so the list
// never fills up with duplicates. Registered before /saved-sessions/:id.
const progressKey = (c: Record<string, unknown>) => (Number(c.topicId) > 0 ? `t${Number(c.topicId)}` : Number(c.pastPaperId) > 0 ? `p${Number(c.pastPaperId)}` : null);
const parseConfig = (raw: string): Record<string, unknown> => { try { return JSON.parse(raw); } catch { return {}; } };

router.put("/saved-sessions/progress", requireAuth, async (req, res): Promise<void> => {
  const parsed = z.object({
    name: z.string().min(1).max(120),
    config: z.object({
      topicId: z.number().int().positive().optional(), pastPaperId: z.number().int().positive().optional(),
      mcqIds: z.array(z.number().int().positive()).min(1).max(1000),
      answers: z.record(z.string(), z.string().nullable()),
      index: z.number().int().min(0), mode: z.enum(["timed", "untimed"]), remainingSeconds: z.number().int().min(0).optional(),
    }).passthrough(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid progress payload" }); return; }
  const config = { ...parsed.data.config, kind: "progress" };
  const key = progressKey(config);
  if (!key) { res.status(400).json({ error: "Progress can only be saved for a topic or past paper" }); return; }
  const mine = await db.select().from(savedSessionsTable).where(eq(savedSessionsTable.userId, req.user!.id));
  const existing = mine.filter((r) => { const c = parseConfig(r.config); return c.kind === "progress" && progressKey(c) === key; });
  const body = { name: parsed.data.name, config: JSON.stringify(config) };
  let row;
  if (existing.length) {
    [row] = await db.update(savedSessionsTable).set(body).where(eq(savedSessionsTable.id, existing[0].id)).returning();
    for (const extra of existing.slice(1)) await db.delete(savedSessionsTable).where(eq(savedSessionsTable.id, extra.id));
  } else {
    [row] = await db.insert(savedSessionsTable).values({ userId: req.user!.id, ...body }).returning();
  }
  res.json({ ...row, config });
});

router.delete("/saved-sessions/progress", requireAuth, async (req, res): Promise<void> => {
  const key = progressKey({ topicId: req.query.topicId, pastPaperId: req.query.pastPaperId });
  if (!key) { res.json({ ok: true }); return; }
  const mine = await db.select().from(savedSessionsTable).where(eq(savedSessionsTable.userId, req.user!.id));
  for (const r of mine) { const c = parseConfig(r.config); if (c.kind === "progress" && progressKey(c) === key) await db.delete(savedSessionsTable).where(eq(savedSessionsTable.id, r.id)); }
  res.json({ ok: true });
});

router.delete("/saved-sessions/:id", requireAuth, async (req, res): Promise<void> => {
  await db.delete(savedSessionsTable).where(and(eq(savedSessionsTable.id, Number(req.params.id)), eq(savedSessionsTable.userId, req.user!.id)));
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Saved MCQs (the practice "Save" button) — filed under Block > Module >
// Subject > Topic so students can re-attempt them later.
// ---------------------------------------------------------------------------

router.get("/saved-mcqs", requireAuth, async (req, res): Promise<void> => {
  const rows = await db.select({
    saved: savedMcqsTable,
    question: mcqsTable.question,
    topicName: topicsTable.name, subjectName: subjectsTable.name, moduleName: modulesTable.name, blockName: blocksTable.name,
    topicOrder: topicsTable.displayOrder, subjectOrder: subjectsTable.displayOrder, moduleOrder: modulesTable.displayOrder, blockOrder: blocksTable.displayOrder,
  }).from(savedMcqsTable)
    .leftJoin(mcqsTable, eq(savedMcqsTable.mcqId, mcqsTable.id))
    .leftJoin(topicsTable, eq(mcqsTable.topicId, topicsTable.id))
    .leftJoin(subjectsTable, eq(subjectsTable.id, sql`coalesce(${topicsTable.subjectId}, ${mcqsTable.subjectId})`))
    .leftJoin(modulesTable, eq(modulesTable.id, sql`coalesce(${subjectsTable.moduleId}, ${mcqsTable.moduleId})`))
    .leftJoin(blocksTable, eq(modulesTable.blockId, blocksTable.id))
    .where(eq(savedMcqsTable.userId, req.user!.id))
    .orderBy(desc(savedMcqsTable.createdAt));
  res.json(rows.map((r) => ({
    ...r.saved,
    question: r.question,
    path: [r.blockName, r.moduleName, r.subjectName, r.topicName].filter(Boolean).join(" \u203a ") || null,
    blockName: r.blockName ?? null, moduleName: r.moduleName ?? null, subjectName: r.subjectName ?? null, topicName: r.topicName ?? null,
    blockOrder: r.blockOrder ?? null, moduleOrder: r.moduleOrder ?? null, subjectOrder: r.subjectOrder ?? null, topicOrder: r.topicOrder ?? null,
    mcqDeleted: r.question === null,
  })));
});

router.post("/saved-mcqs", requireAuth, async (req, res): Promise<void> => {
  const parsed = z.object({ mcqId: z.number().int().positive() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "mcqId is required" }); return; }
  const [exists] = await db.select({ id: mcqsTable.id }).from(mcqsTable).where(eq(mcqsTable.id, parsed.data.mcqId)).limit(1);
  if (!exists) { res.status(404).json({ error: "Question not found" }); return; }
  const [row] = await db.insert(savedMcqsTable).values({ userId: req.user!.id, mcqId: parsed.data.mcqId })
    .onConflictDoUpdate({ target: [savedMcqsTable.userId, savedMcqsTable.mcqId], set: { updatedAt: new Date() } }).returning();
  res.status(201).json(row);
});

// Delete by saved-row id (from the Saved MCQs page)
router.delete("/saved-mcqs/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
  const deleted = await db.delete(savedMcqsTable).where(and(eq(savedMcqsTable.id, id), eq(savedMcqsTable.userId, req.user!.id))).returning({ id: savedMcqsTable.id });
  if (!deleted.length) { res.status(404).json({ error: "Saved question not found" }); return; }
  res.json({ ok: true });
});

// Un-save by question id (from the practice screen's Saved toggle)
router.delete("/saved-mcqs/by-mcq/:mcqId", requireAuth, async (req, res): Promise<void> => {
  const mcqId = Number(req.params.mcqId);
  if (!Number.isInteger(mcqId) || mcqId <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(savedMcqsTable).where(and(eq(savedMcqsTable.mcqId, mcqId), eq(savedMcqsTable.userId, req.user!.id)));
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Flagged MCQs
// ---------------------------------------------------------------------------

// Bug fix: this used to `select()` the bare flaggedMcqsTable row only —
// the frontend had nothing but a numeric mcqId to show, so a saved/
// flagged question rendered as inert text ("MCQ #123") with no way to
// actually open it and no curriculum context. Left-joined (not inner —
// an mcq can be hard-deleted after being flagged, and this must still
// list the flag row rather than silently dropping it) down to the
// question text and its full Block > Module > Subject > Topic path, the
// same breadcrumb shape /admin/mcqs/generate builds for its AI prompt
// (see explanations.ts). `mcqDeleted` lets the frontend grey out "Open"
// instead of navigating to a question that's gone.
router.get("/flagged-mcqs", requireAuth, async (req, res): Promise<void> => {
  const isAdmin = isAdminRole(req.user!.role);
  // Placement is resolved by walking UP the curriculum tree from the topic
  // (topic -> subject -> module -> block), falling back to the MCQ's own
  // subjectId / moduleId only where a link is missing. Older questions often
  // carry just a topicId (or a stale/null subjectId/moduleId copy), and the
  // previous direct joins on mcq.subjectId / mcq.moduleId dropped those into
  // "Uncategorised". Walking the parent chain files every old flag under its
  // real Block > Module > Subject > Topic automatically, with no data fix.
  const rows = await db.select({
    flag: flaggedMcqsTable,
    question: mcqsTable.question,
    topicName: topicsTable.name,
    subjectName: subjectsTable.name,
    moduleName: modulesTable.name,
    blockName: blocksTable.name,
    topicOrder: topicsTable.displayOrder,
    subjectOrder: subjectsTable.displayOrder,
    moduleOrder: modulesTable.displayOrder,
    blockOrder: blocksTable.displayOrder,
  }).from(flaggedMcqsTable)
    .leftJoin(mcqsTable, eq(flaggedMcqsTable.mcqId, mcqsTable.id))
    .leftJoin(topicsTable, eq(mcqsTable.topicId, topicsTable.id))
    .leftJoin(subjectsTable, eq(subjectsTable.id, sql`coalesce(${topicsTable.subjectId}, ${mcqsTable.subjectId})`))
    .leftJoin(modulesTable, eq(modulesTable.id, sql`coalesce(${subjectsTable.moduleId}, ${mcqsTable.moduleId})`))
    .leftJoin(blocksTable, eq(modulesTable.blockId, blocksTable.id))
    .where(isAdmin ? undefined : eq(flaggedMcqsTable.userId, req.user!.id))
    .orderBy(desc(flaggedMcqsTable.createdAt));
  res.json(rows.map((r) => ({
    ...r.flag,
    question: r.question,
    path: [r.blockName, r.moduleName, r.subjectName, r.topicName].filter(Boolean).join(" \u203a ") || null,
    // Structured parts (+ admin display order) so the student page can group into
    // collapsible Block > Module > Subject > Topic sections in curriculum order.
    blockName: r.blockName ?? null,
    moduleName: r.moduleName ?? null,
    subjectName: r.subjectName ?? null,
    topicName: r.topicName ?? null,
    blockOrder: r.blockOrder ?? null,
    moduleOrder: r.moduleOrder ?? null,
    subjectOrder: r.subjectOrder ?? null,
    topicOrder: r.topicOrder ?? null,
    mcqDeleted: r.question === null,
  })));
});

router.post("/flagged-mcqs", requireAuth, async (req, res): Promise<void> => {
  const parsed = z.object({ mcqId: z.number().int().positive(), reason: z.string().max(500).optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "mcqId is required" }); return; }
  const [row] = await db
    .insert(flaggedMcqsTable)
    .values({ userId: req.user!.id, mcqId: parsed.data.mcqId, reason: parsed.data.reason ?? "" })
    .onConflictDoUpdate({ target: [flaggedMcqsTable.userId, flaggedMcqsTable.mcqId], set: { reason: parsed.data.reason ?? "", status: "open" } })
    .returning();
  res.status(201).json(row);
});

// "Resolve all" for the Content Quality Center's "AI Fix All" action — a
// single bulk UPDATE rather than one request per flag, so clearing a large
// reported-questions queue can't hit a hosting gateway timeout the way a
// sequential per-row loop over hundreds of flags could.
router.post("/admin/flagged-mcqs/resolve-all", requireAdmin, async (_req, res): Promise<void> => {
  const resolved = await db.update(flaggedMcqsTable).set({ status: "resolved" }).where(eq(flaggedMcqsTable.status, "open")).returning({ id: flaggedMcqsTable.id });
  res.json({ ok: true, resolved: resolved.length });
});

router.patch("/flagged-mcqs/:id", requireAdmin, async (req, res): Promise<void> => {
  const parsed = z.object({ status: z.enum(["open", "resolved"]) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid status" }); return; }
  const [row] = await db.update(flaggedMcqsTable).set({ status: parsed.data.status }).where(eq(flaggedMcqsTable.id, Number(req.params.id))).returning();
  if (!row) { res.status(404).json({ error: "Flag not found" }); return; }
  res.json(row);
});

// Bug fix: this always responded {ok:true} regardless of whether a row
// actually matched — an invalid/already-removed id, or (before the isAdmin
// allowance below) an admin trying to clear a student's flag, all deleted
// nothing but still told the caller it worked, which is exactly what "Remove
// doesn't actually remove it" looks like from the UI. `.returning()` now
// reports the real outcome as a 404 instead of a false positive. Admins can
// also clear any student's flag/bookmark (matching GET's isAdmin scope
// above); regular users are still restricted to their own.
router.delete("/flagged-mcqs/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const isAdmin = isAdminRole(req.user!.role);
  const [deleted] = await db.delete(flaggedMcqsTable)
    .where(and(eq(flaggedMcqsTable.id, id), isAdmin ? undefined : eq(flaggedMcqsTable.userId, req.user!.id)))
    .returning();
  if (!deleted) { res.status(404).json({ error: "Not found, or you don't have permission to remove it" }); return; }
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

router.get("/feedback", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(feedbackTable).orderBy(desc(feedbackTable.createdAt));
  const userIds = [...new Set(rows.map((r) => r.userId).filter((id): id is number => id !== null))];
  const users = userIds.length ? await db.select().from(usersTable) : [];
  const userMap = new Map(users.filter((u) => userIds.includes(u.id)).map((u) => [u.id, { name: u.name, email: u.email }]));
  res.json(rows.map((row) => ({ ...row, user: row.userId ? userMap.get(row.userId) ?? null : null })));
});

router.post("/feedback", requireAuth, async (req, res): Promise<void> => {
  const parsed = z.object({ category: z.string().max(60).optional(), message: z.string().min(1).max(4000), rating: z.number().int().min(1).max(5).optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "A message is required" }); return; }
  const [row] = await db.insert(feedbackTable).values({ userId: req.user!.id, category: parsed.data.category ?? "general", message: parsed.data.message, rating: parsed.data.rating ?? null }).returning();
  res.status(201).json(row);
});

// Admins clearing out the inbox — permanent delete, replies cascade with it
// since there's no point keeping an orphaned reply thread around.
router.delete("/feedback/:id", requireAdmin, async (req, res): Promise<void> => {
  const feedbackId = Number(req.params.id);
  await db.delete(feedbackRepliesTable).where(eq(feedbackRepliesTable.feedbackId, feedbackId));
  const [row] = await db.delete(feedbackTable).where(eq(feedbackTable.id, feedbackId)).returning();
  if (!row) { res.status(404).json({ error: "Feedback not found" }); return; }
  res.json({ ok: true });
});

router.patch("/feedback/:id", requireAdmin, async (req, res): Promise<void> => {
  const parsed = z.object({ status: z.enum(["open", "replied", "reviewed"]).optional(), featured: z.boolean().optional() }).refine((v) => v.status !== undefined || v.featured !== undefined, { message: "Nothing to update" }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid update" }); return; }
  if (parsed.data.featured) {
    // Only ever let a 5-star entry be marked featured — this is the
    // server-side backstop for the public /feedback/featured endpoint
    // below, which trusts this flag alone to decide what's safe to show
    // signed-out visitors. The admin UI already only offers the toggle on
    // 5-star rows, but this keeps a bad/forged PATCH from featuring
    // anything else.
    const [existing] = await db.select().from(feedbackTable).where(eq(feedbackTable.id, Number(req.params.id)));
    if (!existing) { res.status(404).json({ error: "Feedback not found" }); return; }
    if (existing.rating !== 5) { res.status(400).json({ error: "Only 5-star feedback can be featured" }); return; }
  }
  const update: Partial<typeof feedbackTable.$inferInsert> = {};
  if (parsed.data.status !== undefined) update.status = parsed.data.status;
  if (parsed.data.featured !== undefined) update.featured = parsed.data.featured;
  const [row] = await db.update(feedbackTable).set(update).where(eq(feedbackTable.id, Number(req.params.id))).returning();
  if (!row) { res.status(404).json({ error: "Feedback not found" }); return; }
  res.json(row);
});

// Public, unauthenticated — powers the testimonials section on the
// marketing homepage. Deliberately narrow: only 5-star rows an admin has
// explicitly marked featured=true (see the PATCH above), and only the
// fields that are safe to show a signed-out visitor (no email, no user
// id — just a first name/initial so it reads as a real review without
// exposing contact details).
router.get("/feedback/featured", async (_req, res): Promise<void> => {
  const rows = await db.select().from(feedbackTable)
    .where(and(eq(feedbackTable.featured, true), eq(feedbackTable.rating, 5)))
    .orderBy(desc(feedbackTable.createdAt))
    .limit(24);
  const userIds = [...new Set(rows.map((r) => r.userId).filter((id): id is number => id !== null))];
  const users = userIds.length ? await db.select().from(usersTable) : [];
  const userMap = new Map(users.filter((u) => userIds.includes(u.id)).map((u) => [u.id, u.name]));
  res.json(rows.map((row) => {
    const fullName = row.userId ? userMap.get(row.userId) : null;
    const [first, ...rest] = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
    const displayName = first ? `${first}${rest.length ? ` ${rest[rest.length - 1][0].toUpperCase()}.` : ""}` : "A student";
    return { id: row.id, rating: row.rating, message: row.message, createdAt: row.createdAt, name: displayName };
  }));
});

// A student's own feedback history, each with its reply thread — lets them
// see whether the team has responded instead of submitting into a void.
router.get("/feedback/mine", requireAuth, async (req, res): Promise<void> => {
  const rows = await db.select().from(feedbackTable).where(eq(feedbackTable.userId, req.user!.id)).orderBy(desc(feedbackTable.createdAt));
  const replies = rows.length ? await db.select().from(feedbackRepliesTable).orderBy(feedbackRepliesTable.createdAt) : [];
  const repliesByFeedback = new Map<number, typeof replies>();
  for (const reply of replies) {
    if (!rows.some((r) => r.id === reply.feedbackId)) continue;
    const list = repliesByFeedback.get(reply.feedbackId);
    if (list) list.push(reply); else repliesByFeedback.set(reply.feedbackId, [reply]);
  }
  res.json(rows.map((row) => ({ ...row, replies: repliesByFeedback.get(row.id) ?? [] })));
});

function canAccessFeedback(feedback: typeof feedbackTable.$inferSelect, userId: number, isAdmin: boolean) {
  return isAdmin || feedback.userId === userId;
}

router.get("/feedback/:id/replies", requireAuth, async (req, res): Promise<void> => {
  const feedbackId = Number(req.params.id);
  const [feedback] = await db.select().from(feedbackTable).where(eq(feedbackTable.id, feedbackId));
  if (!feedback) { res.status(404).json({ error: "Feedback not found" }); return; }
  if (!canAccessFeedback(feedback, req.user!.id, isAdminRole(req.user!.role))) { res.status(403).json({ error: "Not authorized to view this thread" }); return; }
  const rows = await db.select().from(feedbackRepliesTable).where(eq(feedbackRepliesTable.feedbackId, feedbackId)).orderBy(feedbackRepliesTable.createdAt);
  res.json(rows);
});

router.post("/feedback/:id/replies", requireAuth, async (req, res): Promise<void> => {
  const feedbackId = Number(req.params.id);
  const parsed = z.object({ message: z.string().min(1).max(4000) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "A message is required" }); return; }
  const [feedback] = await db.select().from(feedbackTable).where(eq(feedbackTable.id, feedbackId));
  if (!feedback) { res.status(404).json({ error: "Feedback not found" }); return; }
  const isAdmin = isAdminRole(req.user!.role);
  if (!canAccessFeedback(feedback, req.user!.id, isAdmin)) { res.status(403).json({ error: "Not authorized to reply to this thread" }); return; }

  const [reply] = await db.insert(feedbackRepliesTable).values({
    feedbackId,
    authorId: req.user!.id,
    authorRole: isAdmin ? "admin" : "student",
    message: parsed.data.message,
  }).returning();

  // Admin replying -> mark as answered for the admin queue, and let the
  // student know. Student following up -> reopen it so it doesn't sit
  // buried under "replied" items the admin has already addressed.
  if (isAdmin) {
    await db.update(feedbackTable).set({ status: "replied" }).where(eq(feedbackTable.id, feedbackId));
    if (feedback.userId) {
      await db.insert(notificationsTable).values({ userId: feedback.userId, title: "The team replied to your feedback", body: parsed.data.message.slice(0, 140), type: "info" });
    }
  } else {
    await db.update(feedbackTable).set({ status: "open" }).where(eq(feedbackTable.id, feedbackId));
  }

  res.status(201).json(reply);
});

export default router;
