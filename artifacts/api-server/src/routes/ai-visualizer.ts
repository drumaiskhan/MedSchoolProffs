import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "crypto";
import { db, aiVisualizerLogsTable, aiVisualizerLibraryTable, usersTable } from "@workspace/db";
import { requireAuth, requireMembershipFor, requireAdmin } from "../middlewares/auth";
import { checkRateLimit } from "../lib/rateLimit";
import { explainStep, AiNotConfiguredError, InvalidVisualizationError } from "../lib/aiVisualizer";
import { generateWidget } from "../lib/aiWidget";
import { findSavedWidget, saveWidget } from "../lib/widgetLibrary";
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
router.get("/admin/ai-visualizer-library", requireAdmin, async (_req, res): Promise<void> => {
  const t = aiVisualizerLibraryTable;
  const rows = await db.select({ id: t.id, prompt: t.prompt, title: t.title, hits: t.hits, version: t.version, lastUsedAt: t.lastUsedAt, createdAt: t.createdAt, bytes: sql<number>`length(${t.html})` })
    .from(t).orderBy(desc(t.hits), desc(t.createdAt)).limit(300);
  const totals = await db.select({ count: sql<number>`count(*)`, hits: sql<number>`coalesce(sum(${t.hits}), 0)` }).from(t);
  res.json({ entries: rows, count: Number(totals[0]?.count ?? 0), totalReuses: Number(totals[0]?.hits ?? 0) });
});

router.delete("/admin/ai-visualizer-library/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(aiVisualizerLibraryTable).where(eq(aiVisualizerLibraryTable.id, id));
  res.json({ ok: true });
});

router.delete("/admin/ai-visualizer-library", requireAdmin, async (_req, res): Promise<void> => {
  await db.delete(aiVisualizerLibraryTable);
  res.json({ ok: true });
});

export default router;
