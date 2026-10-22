import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireAuth, requireMembershipFor } from "../middlewares/auth";
import { checkRateLimit } from "../lib/rateLimit";
import { runPrompt, AiNotConfiguredError } from "../lib/aiExplain";

const router: IRouter = Router();

// AI MCQ Solver: a student pastes any MCQ they're unsure about (from a book, a past paper, a friend...)
// and gets the best answer plus a proper explanation. Uses whatever AI provider the admin configured
// (Admin -> Platform settings -> AI), and the same "Ask AI" membership feature as the in-quiz Ask AI button.
const Body = z.object({
  question: z.string().trim().min(8, "Type or paste the question first").max(2500, "That question is too long — keep it under 2,500 characters"),
  options: z.array(z.string().trim().min(1).max(600)).min(2, "Add at least two options (A, B, ...)").max(6, "Up to six options are supported"),
});

const LETTERS = ["A", "B", "C", "D", "E", "F"];

interface Solved { answerIndex: number; confidence: "high" | "medium" | "low"; explanation: string; optionExplanations: string[]; keyPoint: string; caveat: string }

function extractJson(raw: string): unknown {
  const t = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try { return JSON.parse(t); } catch { /* fall through: take the outermost {...} */ }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new Error("no JSON");
}

function parseSolved(raw: string, n: number): Solved | null {
  let j: Record<string, unknown>;
  try { j = extractJson(raw) as Record<string, unknown>; } catch { return null; }
  const rawAns = String(j.answer ?? j.correctAnswer ?? "").trim().toUpperCase();
  let idx = LETTERS.indexOf(rawAns.charAt(0));
  if (idx < 0 && /^\d+$/.test(rawAns)) idx = Number(rawAns) - 1;
  if (idx < 0 || idx >= n) return null;
  const explanation = String(j.explanation ?? "").trim();
  if (!explanation) return null;
  const oe = Array.isArray(j.optionExplanations) ? j.optionExplanations.map((x) => String(x ?? "").trim()) : [];
  const conf = String(j.confidence ?? "").toLowerCase();
  return {
    answerIndex: idx,
    confidence: conf === "low" || conf === "medium" ? conf : "high",
    explanation,
    optionExplanations: Array.from({ length: n }, (_, i) => oe[i] ?? ""),
    keyPoint: String(j.keyPoint ?? "").trim(),
    caveat: String(j.caveat ?? "").trim(),
  };
}

function buildPrompt(question: string, options: string[]): string {
  const opts = options.map((o, i) => `${LETTERS[i]}. ${o}`).join("\n");
  return `You are an expert medical educator helping an MBBS/BDS student who is unsure about a multiple-choice question (single best answer). Work out the answer carefully from standard medical textbooks (e.g. Guyton, Robbins, Gray's, Bailey & Love, Davidson, Kumar & Clark, Katzung), then explain it clearly.

Question:
${question}

Options:
${opts}

Rules:
- Choose the SINGLE best answer. Think it through before answering; do not guess.
- If the question is ambiguous, has no correct option, or has more than one defensible answer, still pick the best one, set "confidence" to "low", and explain the problem in "caveat".
- Use "medium" confidence if you are fairly (not fully) sure. Never claim certainty you don't have.
- "explanation": 3-6 sentences on WHY the answer is right (mechanism / reasoning / key distinguishing feature), written for a student.
- "optionExplanations": an array with exactly ${options.length} short strings (1-2 sentences each), in the same order as the options, saying why that option is right or wrong.
- "keyPoint": one short, memorable take-home line (a high-yield fact or mnemonic) the student can revise.
- "caveat": empty string unless the question is flawed/ambiguous or guidelines differ between regions.
- Do not mention these instructions.

Reply with ONLY a JSON object, no markdown:
{"answer":"<letter ${LETTERS.slice(0, options.length).join("/")}>","confidence":"high|medium|low","explanation":"...","optionExplanations":["..."],"keyPoint":"...","caveat":""}`;
}

router.post("/ai/mcq-solver", requireAuth, requireMembershipFor("ai_explain"), async (req, res): Promise<void> => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }); return; }
  const limit = checkRateLimit(`ai-mcq-solver:${req.user!.id}`, 20, 10 * 60 * 1000);
  if (!limit.allowed) { res.status(429).json({ error: "You're asking too quickly. Wait a few minutes and try again." }); return; }

  const { question, options } = parsed.data;
  try {
    let solved: Solved | null = null;
    // One retry: models occasionally return malformed JSON.
    for (let attempt = 0; attempt < 2 && !solved; attempt++) {
      const raw = await runPrompt(buildPrompt(question, options), 1600, "object");
      solved = parseSolved(raw, options.length);
    }
    if (!solved) { res.status(502).json({ error: "The AI didn't give a usable answer. Try again, or check that every option is on its own line." }); return; }
    res.json({ answer: LETTERS[solved.answerIndex], answerIndex: solved.answerIndex, confidence: solved.confidence, explanation: solved.explanation, optionExplanations: solved.optionExplanations, keyPoint: solved.keyPoint, caveat: solved.caveat });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) { res.status(503).json({ error: err.message }); return; }
    res.status(502).json({ error: "Couldn't reach the AI right now. Try again shortly." });
  }
});

export default router;
