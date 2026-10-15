import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "crypto";
import { db, aiVisualizerLogsTable, aiVisualizerLibraryTable, usersTable } from "@workspace/db";
import { requireAuth, requireMembershipFor, requireAdmin } from "../middlewares/auth";
import { checkRateLimit } from "../lib/rateLimit";
import { explainStep, AiNotConfiguredError, InvalidVisualizationError } from "../lib/aiVisualizer";
import { generateWidget } from "../lib/aiWidget";
import { findSavedWidget, saveWidget, LIBRARY_VERSION } from "../lib/widgetLibrary";
import { CATALOG_DISCIPLINES, catalogKeySet, getCatalog } from "../lib/visualizerCatalog";
import { getAllSettings } from "../lib/settings";

const router: IRouter = Router();

type Job = { userId: number; status: "pending" | "done" | "error"; createdAt: number; visualization?: unknown; error?: string; httpStatus?: number };
const jobs = new Map<string, Job>();
setInterval(() => { const cutoff = Date.now() - 15 * 60 * 1000; for (const [id, j] of jobs) if (j.createdAt < cutoff) jobs.delete(id); }, 5 * 60 * 1000).unref?.();

// ---------------------------------------------------------------------------
// Student: generate a visualization
// ---------------------------------------------------------------------------

// `mode`: "auto" picks a solid anatomy model for structures ("tibia", "draw the heart")
// and the node/flow scene for processes and comparisons; the student can force either.
const VisualizerBody = z.object({ prompt: z.string().min(3).max(500), mode: z.enum(["auto", "model", "scene", "widget"]).optional(), fresh: z.boolean().optional() });

router.post("/ai/visualizer", requireAuth, requireMembershipFor("ai_visualizer"), async (req, res): Promise<void> => {
  // Defense in depth: the student sidebar already hides this page when
  // AI_VISUALIZER_ENABLED is off, but that's just UI — a direct API call
  // (or a stale page still open in a tab) should be refused too, not just
  // hidden from navigation.
  const settings = await getAllSettings();
  if (settings.AI_VISUALIZER_ENABLED === "false") { res.status(403).json({ error: "The AI Visualizer is turned off right now." }); return; }
  const parsed = VisualizerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? "A prompt is required" }); return; }

  const limit = checkRateLimit(`ai-visualizer:${req.user!.id}`, 10, 10 * 60 * 1000); // 10 generations / 10 min / student
  if (!limit.allowed) { res.status(429).json({ error: "You're generating visualizations too quickly. Try again in a minute." }); return; }

  // Generation (esp. 2D widgets) can take far longer than the host proxy's ~26s
  // request ceiling, so it runs in the background: this returns a job id right
  // away and the client polls GET /ai/visualizer/job/:id. In-memory (same
  // single-process assumption as rateLimit.ts).
  const userId = req.user!.id;
  const { prompt, mode, fresh } = parsed.data;
  const jobId = randomUUID();
  jobs.set(jobId, { userId, status: "pending", createdAt: Date.now() });
  void runJob(jobId, userId, prompt, mode ?? "auto", fresh === true);
  res.status(202).json({ jobId });
});

router.get("/ai/visualizer/job/:id", requireAuth, requireMembershipFor("ai_visualizer"), (req, res): void => {
  const job = jobs.get(String(req.params.id));
  if (!job || job.userId !== req.user!.id) { res.status(404).json({ error: "This visualization request expired. Please generate it again." }); return; }
  if (job.status === "pending") { res.json({ status: "pending" }); return; }
  if (job.status === "error") { res.status(job.httpStatus ?? 502).json({ status: "error", error: job.error }); return; }
  res.json({ status: "done", visualization: job.visualization });
});

async function runJob(jobId: string, userId: number, prompt: string, mode: "auto" | "model" | "scene" | "widget", fresh = false): Promise<void> {
  const job = jobs.get(jobId)!;
  try {
    // 2D interactive widgets only (3D model/scene modes were removed). `mode` is
    // still accepted so a stale open tab doesn't get a 400, but is ignored.
    void mode;
    // Hard guard: whatever happens inside, the job ALWAYS ends (done or error) so
    // the page can never spin forever.
    // Saved library first: a repeat/near-identical topic is served with no AI call at all
    // (zero tokens, instant). `fresh` (the student's "Regenerate") skips it and replaces the saved copy.
    if (!fresh) {
      try {
        const saved = await findSavedWidget(prompt);
        if (saved) {
          const reused = { type: "widget" as const, title: saved.title, description: saved.description, html: saved.html };
          await db.insert(aiVisualizerLogsTable).values({ userId, prompt, status: "success", visualizationType: "widget" });
          Object.assign(job, { status: "done", visualization: reused });
          return;
        }
      } catch (err) { console.error("widget library lookup failed (generating instead)", err); }
    }
    const visualization = await Promise.race([
      generateWidget(prompt),
      new Promise<never>((_, reject) => setTimeout(() => reject(new InvalidVisualizationError("The visualization was too long to complete in time — try a simpler or more specific prompt.")), 255_000).unref?.()),
    ]);
    await db.insert(aiVisualizerLogsTable).values({ userId, prompt, status: "success", visualizationType: visualization.type });
    try { await saveWidget(prompt, visualization); } catch (err) { console.error("saving widget to library failed", err); }
    Object.assign(job, { status: "done", visualization });
  } catch (err) {
    const errorMessage = err instanceof AiNotConfiguredError ? err.message : err instanceof InvalidVisualizationError ? `Invalid AI output: ${err.issues}` : (err instanceof Error ? err.message.slice(0, 300) : "Unknown error");
    // Capped well under the DB's practical limits — this is for admin
    // diagnosis (Admin -> AI Visualizer activity), not a full transcript.
    const rawResponse = err instanceof InvalidVisualizationError && err.raw ? err.raw.slice(0, 8000) : null;
    try { await db.insert(aiVisualizerLogsTable).values({ userId, prompt, status: "error", errorMessage, rawResponse }); } catch { /* logging is best-effort */ }
    if (err instanceof AiNotConfiguredError) Object.assign(job, { status: "error", httpStatus: 503, error: err.message });
    else if (err instanceof InvalidVisualizationError) {
      const timedOut = err.issues.includes("too long to complete in time");
      Object.assign(job, { status: "error", httpStatus: 502, error: timedOut ? err.issues : "The AI produced an unusable visualization. Try rephrasing your prompt or regenerating." });
    } else Object.assign(job, { status: "error", httpStatus: 502, error: "Couldn't generate a visualization right now. Try again shortly." });
  }
}

// ---------------------------------------------------------------------------
// Student: browse the topic catalog (5000+ topics, Discipline > Group > Topic)
// ---------------------------------------------------------------------------
// Keys of widgets already saved at the current library version (short-cached): a catalog topic with a
// saved widget opens instantly, so the picker marks it.
let savedKeysCache: { at: number; keys: Set<string> } | null = null;
async function savedKeys(): Promise<Set<string>> {
  if (savedKeysCache && Date.now() - savedKeysCache.at < 60_000) return savedKeysCache.keys;
  const rows = await db.select({ key: aiVisualizerLibraryTable.key }).from(aiVisualizerLibraryTable).where(eq(aiVisualizerLibraryTable.version, LIBRARY_VERSION));
  savedKeysCache = { at: Date.now(), keys: new Set(rows.map((r) => r.key)) };
  return savedKeysCache.keys;
}

const CatalogQuery = z.object({
  q: z.string().trim().max(100).optional(),
  discipline: z.string().max(60).optional(),
  group: z.string().max(120).optional(),
  program: z.enum(["MBBS", "BDS"]).optional(),
  saved: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get("/ai/visualizer/catalog", requireAuth, requireMembershipFor("ai_visualizer"), async (req, res): Promise<void> => {
  const parsed = CatalogQuery.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Invalid catalog query" }); return; }
  const { q, discipline, group, program, saved, limit, offset } = parsed.data;
  const keys = await savedKeys();
  const words = (q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const inProgram = (p: string) => !program || p === "Both" || p === program;
  const all = getCatalog().filter((t) => inProgram(t.program));
  const matches = all.filter((t) =>
    (!discipline || t.disciplineId === discipline) && (!group || t.group === group) &&
    (saved === undefined || keys.has(t.key) === (saved === "true")) &&
    (!words.length || words.every((w) => t.prompt.toLowerCase().includes(w))));
  const disciplines = CATALOG_DISCIPLINES.filter((d) => inProgram(d.program)).map((d) => ({
    id: d.id, name: d.name, program: d.program,
    count: all.filter((t) => t.disciplineId === d.id).length,
    groups: d.groups.map((g) => ({ name: g.name, count: g.entities.length * d.aspects.length })),
  }));
  res.json({
    total: matches.length, offset, limit, totalAll: all.length, disciplines,
    topics: matches.slice(offset, offset + limit).map((t) => ({ id: t.id, prompt: t.prompt, disciplineId: t.disciplineId, discipline: t.discipline, group: t.group, entity: t.entity, aspect: t.aspect, saved: keys.has(t.key) })),
  });
});

// ---------------------------------------------------------------------------
// Student: explain one step further (not logged — high-frequency follow-up,
// same trust tier as ask-ai, not the thing admins need to review)
// ---------------------------------------------------------------------------

const ExplainStepBody = z.object({ overallTitle: z.string().max(160), stepTitle: z.string().max(120), stepDescription: z.string().max(600) });

router.post("/ai/visualizer/explain-step", requireAuth, requireMembershipFor("ai_visualizer"), async (req, res): Promise<void> => {
  const parsed = ExplainStepBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid step" }); return; }
  const limit = checkRateLimit(`ai-visualizer-explain:${req.user!.id}`, 20, 10 * 60 * 1000);
  if (!limit.allowed) { res.status(429).json({ error: "Too many requests. Try again shortly." }); return; }
  try {
    const explanation = await explainStep(parsed.data.stepTitle, parsed.data.stepDescription, parsed.data.overallTitle);
    res.json({ explanation });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) { res.status(503).json({ error: err.message }); return; }
    res.status(502).json({ error: "Couldn't generate an explanation right now." });
  }
});

// ---------------------------------------------------------------------------
// Admin: read-only activity log (what students are generating)
// ---------------------------------------------------------------------------

router.get("/admin/ai-visualizer-logs", requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const rows = await db.select().from(aiVisualizerLogsTable).orderBy(desc(aiVisualizerLogsTable.createdAt)).limit(limit);
  const userIds = [...new Set(rows.map((r) => r.userId))];
  const users = userIds.length ? await db.select().from(usersTable) : [];
  const userMap = new Map(users.filter((u) => userIds.includes(u.id)).map((u) => [u.id, { name: u.name, email: u.email }]));
  res.json(rows.map((row) => ({ ...row, student: userMap.get(row.userId) ?? { name: "Unknown", email: "—" } })));
});


// ---------------------------------------------------------------------------
// Admin: the saved widget library (served to students with no AI call)
// ---------------------------------------------------------------------------
const LibraryQuery = z.object({
  q: z.string().trim().max(100).optional(),
  sort: z.enum(["hits", "recent", "size", "oldest"]).default("hits"),
  source: z.enum(["all", "catalog", "custom"]).default("all"),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get("/admin/ai-visualizer-library", requireAdmin, async (req, res): Promise<void> => {
  const parsed = LibraryQuery.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Invalid library query" }); return; }
  const { q, sort, source, limit, offset } = parsed.data;
  const t = aiVisualizerLibraryTable;
  const rows = await db.select({ id: t.id, key: t.key, prompt: t.prompt, title: t.title, hits: t.hits, version: t.version, lastUsedAt: t.lastUsedAt, createdAt: t.createdAt, bytes: sql<number>`length(${t.html})` }).from(t);
  const catalogKeys = catalogKeySet();
  const words = (q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const tagged = rows.map(({ key, ...r }) => ({ ...r, source: catalogKeys.has(key) ? "catalog" as const : "custom" as const }));
  const matches = tagged.filter((r) => (source === "all" || r.source === source) && (!words.length || words.every((w) => `${r.title} ${r.prompt}`.toLowerCase().includes(w))));
  const time = (d: Date | string | null) => (d ? new Date(d).getTime() : 0);
  matches.sort((a, b) => sort === "hits" ? b.hits - a.hits || time(b.createdAt) - time(a.createdAt) : sort === "size" ? b.bytes - a.bytes : sort === "oldest" ? time(a.createdAt) - time(b.createdAt) : time(b.createdAt) - time(a.createdAt));
  res.json({
    entries: matches.slice(offset, offset + limit), matched: matches.length, offset, limit,
    count: rows.length, totalReuses: rows.reduce((n, r) => n + Number(r.hits ?? 0), 0),
    catalogSaved: tagged.filter((r) => r.source === "catalog" && r.version === LIBRARY_VERSION).length, customSaved: tagged.filter((r) => r.source === "custom").length,
  });
});

// How much of the topic catalog already has a saved widget, per discipline and group, plus the
// most-wanted topics that don't have one yet (students asked for them but generation failed or hasn't happened).
router.get("/admin/ai-visualizer-catalog", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select({ key: aiVisualizerLibraryTable.key, hits: aiVisualizerLibraryTable.hits }).from(aiVisualizerLibraryTable).where(eq(aiVisualizerLibraryTable.version, LIBRARY_VERSION));
  const saved = new Map(rows.map((r) => [r.key, Number(r.hits ?? 0)]));
  const catalog = getCatalog();
  const disciplines = CATALOG_DISCIPLINES.map((d) => {
    const topics = catalog.filter((t) => t.disciplineId === d.id);
    return {
      id: d.id, name: d.name, program: d.program, total: topics.length, saved: topics.filter((t) => saved.has(t.key)).length,
      reuses: topics.reduce((n, t) => n + (saved.get(t.key) ?? 0), 0),
      groups: d.groups.map((g) => { const gt = topics.filter((t) => t.group === g.name); return { name: g.name, total: gt.length, saved: gt.filter((t) => saved.has(t.key)).length }; }),
    };
  });
  res.json({ total: catalog.length, saved: disciplines.reduce((n, d) => n + d.saved, 0), disciplines });
});

router.delete("/admin/ai-visualizer-library/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(aiVisualizerLibraryTable).where(eq(aiVisualizerLibraryTable.id, id));
  savedKeysCache = null;
  res.json({ ok: true });
});

router.delete("/admin/ai-visualizer-library", requireAdmin, async (_req, res): Promise<void> => {
  await db.delete(aiVisualizerLibraryTable);
  savedKeysCache = null;
  res.json({ ok: true });
});

export default router;
