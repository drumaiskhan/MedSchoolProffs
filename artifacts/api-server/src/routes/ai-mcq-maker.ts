import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireAuth, requireMembershipFor } from "../middlewares/auth";
import { checkRateLimit } from "../lib/rateLimit";
import { getAllSettings } from "../lib/settings";
import { generateStudentMcqs, AiNotConfiguredError } from "../lib/aiExplain";
import { contributeStudentMcqsToQbank } from "../lib/studentQbankContribution";
import { db, practiceAttemptsTable } from "@workspace/db";
import { bumpStreak } from "./analytics";

const router: IRouter = Router();

// The student page asks for small batches (<= 5), fires them in parallel and stitches a set
// of up to 25 together itself, so one request never has to outlast the AI provider's timeout
// and the whole set takes about as long as a single batch.
const MAX_PER_REQUEST = 5;
const MAX_TOTAL = 25;

const Body = z.object({
  prompt: z.string().trim().min(3, "Describe a topic (at least a few letters)").max(600, "Keep the topic or prompt under 600 characters"),
  difficulty: z.enum(["easy", "moderate", "hard", "mixed"]),
  count: z.number().int().min(1).max(MAX_PER_REQUEST),
  avoid: z.array(z.string().max(500)).max(MAX_TOTAL).optional(),
  part: z.object({ index: z.number().int().min(0).max(24), total: z.number().int().min(1).max(25) }).refine((p) => p.index < p.total).optional(),
});

router.post("/ai/mcq-maker", requireAuth, requireMembershipFor("ai_mcq_maker"), async (req, res): Promise<void> => {
  const settings = await getAllSettings();
  if (settings.AI_MCQ_MAKER_ENABLED === "false") { res.status(403).json({ error: "The AI MCQ Maker is turned off right now." }); return; }
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }); return; }

  // A full 25-question set is ~9 small parallel requests, so allow ~3 full sets per 10 minutes per student.
  const limit = checkRateLimit(`ai-mcq-maker:${req.user!.id}`, 30, 10 * 60 * 1000);
  if (!limit.allowed) { res.status(429).json({ error: "You're generating questions too quickly. Wait a few minutes and try again." }); return; }

  try {
    const generated = await generateStudentMcqs(parsed.data);
    if (!generated.length) { res.status(502).json({ error: "The AI didn't return usable questions. Try again or rephrase your topic." }); return; }
    res.json({ questions: generated });
    // Silent, non-blocking: AI files these into the right year/block/module/subject/topic of the Qbank
    // (as drafts for admin review unless AI_MCQ_MAKER_AUTO_PUBLISH is on). Never throws, never delays the student.
    void contributeStudentMcqsToQbank({ userId: req.user!.id, prompt: parsed.data.prompt, questions: generated });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) { res.status(503).json({ error: err.message }); return; }
    res.status(502).json({ error: "Couldn't generate questions right now. Try again shortly." });
  }
});

// Records a finished set as a normal practice attempt (mode "ai") so it counts toward the
// student's sessions, accuracy, time spent, streak and leaderboard. Only the totals are saved
// here (no per-MCQ answer rows, no module/subject/topic — it stays out of "continue learning"
// and per-topic progress). The questions themselves are filed into the Qbank separately, in the
// background, by contributeStudentMcqsToQbank (see POST /ai/mcq-maker above).
const SessionBody = z.object({
  answered: z.number().int().min(1).max(MAX_TOTAL),
  correct: z.number().int().min(0).max(MAX_TOTAL),
  durationSeconds: z.number().int().min(0).max(6 * 60 * 60).optional(),
  tz: z.number().int().min(-840).max(840).optional(),
}).refine((b) => b.correct <= b.answered, { message: "correct can't exceed answered" });

router.post("/ai/mcq-maker/session", requireAuth, requireMembershipFor("ai_mcq_maker"), async (req, res): Promise<void> => {
  const parsed = SessionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }); return; }
  const limit = checkRateLimit(`ai-mcq-maker-session:${req.user!.id}`, 15, 10 * 60 * 1000);
  if (!limit.allowed) { res.status(429).json({ error: "Too many sessions saved too quickly. Try again in a few minutes." }); return; }

  const { answered, correct, durationSeconds } = parsed.data;
  const completedAt = new Date();
  const startedAt = durationSeconds != null ? new Date(completedAt.getTime() - durationSeconds * 1000) : completedAt;
  const [attempt] = await db.insert(practiceAttemptsTable).values({
    userId: req.user!.id, mode: "ai", totalQuestions: answered, correctCount: correct,
    scorePercent: ((correct / answered) * 100).toFixed(2), startedAt, completedAt,
  }).returning();
  await bumpStreak(req.user!.id, parsed.data.tz ?? 0);
  res.status(201).json({ id: attempt.id, scorePercent: Number(attempt.scorePercent), correctCount: correct, totalQuestions: answered });
});

export default router;
