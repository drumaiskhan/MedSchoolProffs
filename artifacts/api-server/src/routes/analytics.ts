import { Router, type IRouter } from "express";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, practiceAttemptsTable, practiceAnswersTable, mcqsTable, usersTable, topicsTable, subjectsTable } from "@workspace/db";
import { requireAuth, requireMembershipFor } from "../middlewares/auth";
import { liveStreak, utcDay, parseTzOffset, streakFromDays, type RebuiltStreak } from "../lib/streak";
import { buildLeaderboard, RANGE_DAYS } from "../lib/leaderboard";
import { trialDailyMcqCapError, getTrialDailyMcqStatus } from "../lib/trial";

const router: IRouter = Router();

/** Every UTC day on which the student finished at least one practice session
 *  (timed, untimed, past-paper and AI MCQ maker sessions all land in
 *  practice_attempts), rebuilt into streak numbers. */
export async function streakFromHistory(userId: number, tzOffsetMin = 0): Promise<RebuiltStreak> {
  const rows = await db
    .select({ day: sql<string>`to_char((coalesce(${practiceAttemptsTable.completedAt}, ${practiceAttemptsTable.createdAt}) at time zone 'UTC') - (${tzOffsetMin} * interval '1 minute'), 'YYYY-MM-DD')` })
    .from(practiceAttemptsTable)
    .where(eq(practiceAttemptsTable.userId, userId))
    .groupBy(sql`1`);
  return streakFromDays(rows.map((r) => r.day));
}

export async function bumpStreak(userId: number, tzOffsetMin = 0): Promise<void> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) return;
  const today = utcDay(0, tzOffsetMin);
  if (user.lastPracticeDate != null && user.lastPracticeDate >= today) return; // already counted today
  const continuing = user.lastPracticeDate === utcDay(-1, tzOffsetMin);
  let currentStreak = continuing ? user.currentStreak + 1 : 1;
  // Self-heal: the stored counter only moves when this function runs, so any
  // session that was saved without it (an earlier bug, a failed write, a data
  // import) left the streak short for good. The saved sessions are the truth —
  // never let the counter sit below the run they prove. `max` keeps an
  // admin-restored streak (see POST /students/:id/streak/restore) intact too.
  try {
    const history = await streakFromHistory(userId, tzOffsetMin);
    if (history.lastPracticeDate === today) currentStreak = Math.max(currentStreak, history.currentStreak);
  } catch { /* the plain increment above is still correct */ }
  const longestStreak = Math.max(user.longestStreak, currentStreak);
  await db.update(usersTable).set({ currentStreak, longestStreak, lastPracticeDate: today }).where(eq(usersTable.id, userId));
}

// ---------------------------------------------------------------------------
// Submit a completed practice session (single call — quick sessions, not a
// multi-step exam flow)
// ---------------------------------------------------------------------------

const SubmitSessionBody = z.object({
  moduleId: z.number().int().positive().optional(),
  subjectId: z.number().int().positive().optional(),
  topicId: z.number().int().positive().optional(),
  mode: z.enum(["timed", "untimed"]).optional(),
  answers: z.array(z.object({ mcqId: z.number().int().positive(), selectedAnswer: z.string().nullable() })).min(1),
  durationSeconds: z.number().int().min(0).optional(),
  tz: z.number().int().min(-840).max(840).optional(),
});

router.post("/practice-sessions", requireAuth, requireMembershipFor(["mcqs", "past_papers"]), async (req, res): Promise<void> => {
  const parsed = SubmitSessionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message }); return; }
  const data = parsed.data;

  // Trial-only students (see lib/trial.ts studentIsTrialOnly) are capped at
  // TRIAL_DAILY_MCQ_LIMIT MCQs per UTC day, summed across sessions — set by
  // an admin on Settings → Access & trial. Paying students are never capped.
  if (req.user!.role === "student") {
    const capError = await trialDailyMcqCapError(req.user!.id, data.answers.length);
    if (capError) { res.status(403).json({ error: capError, code: "TRIAL_DAILY_LIMIT_REACHED" }); return; }
  }

  // Only fetch the rows being graded (id + correct answer). This used to load
  // the ENTIRE MCQ bank (every question, option and explanation) on every
  // submit, which got slower as the bank grew until Hostinger's proxy cut the
  // request off (a 504 with no CORS headers -> the browser's generic network
  // error -> "Session not saved").
  const mcqIds = [...new Set(data.answers.map((a) => a.mcqId))];
  const mcqs = await db
    .select({ id: mcqsTable.id, correctAnswer: mcqsTable.correctAnswer })
    .from(mcqsTable)
    .where(inArray(mcqsTable.id, mcqIds));
  const mcqMap = new Map(mcqs.map((m) => [m.id, m]));

  let correctCount = 0;
  for (const answer of data.answers) {
    const mcq = mcqMap.get(answer.mcqId);
    if (mcq && mcq.correctAnswer && answer.selectedAnswer === mcq.correctAnswer) correctCount += 1;
  }
  const scorePercent = ((correctCount / data.answers.length) * 100).toFixed(2);

  // "Time spent" on the dashboard is sum(completedAt - startedAt) per row
  // (see GET /student/analytics below). Without this, startedAt defaults to
  // now() at insert time — identical to completedAt — so time spent is
  // always ~0 regardless of how long the student actually studied. Prefer
  // the client-tracked durationSeconds (session-start to session-finish) to
  // back-date startedAt; fall back to "now" only if the client didn't send one.
  const completedAt = new Date();
  const startedAt = data.durationSeconds != null ? new Date(completedAt.getTime() - data.durationSeconds * 1000) : completedAt;

  // The Practice page only ever sends `topicId`, so moduleId/subjectId used to
  // be saved as null — which left nothing to tell the dashboard's "continue
  // where you left off" card which module a session belonged to. Derive both
  // from the topic (topic -> subject -> module) when the client didn't send
  // them; explicit values from the client still win.
  let { moduleId, subjectId } = data;
  if (data.topicId != null && (moduleId == null || subjectId == null)) {
    const [placement] = await db
      .select({ subjectId: topicsTable.subjectId, moduleId: subjectsTable.moduleId })
      .from(topicsTable)
      .innerJoin(subjectsTable, eq(topicsTable.subjectId, subjectsTable.id))
      .where(eq(topicsTable.id, data.topicId));
    if (placement) { subjectId ??= placement.subjectId; moduleId ??= placement.moduleId; }
  }

  const [attempt] = await db
    .insert(practiceAttemptsTable)
    .values({
      userId: req.user!.id, moduleId, subjectId, topicId: data.topicId,
      mode: data.mode ?? "untimed", totalQuestions: data.answers.length, correctCount, scorePercent,
      startedAt, completedAt,
    })
    .returning();

  await db.insert(practiceAnswersTable).values(
    data.answers.map((a) => ({ attemptId: attempt.id, mcqId: a.mcqId, selectedAnswer: a.selectedAnswer, correct: mcqMap.get(a.mcqId)?.correctAnswer === a.selectedAnswer })),
  );

  // The session is already saved — a streak hiccup must not turn it into an
  // error (the client would report "not saved" and the student would redo it).
  try { await bumpStreak(req.user!.id, data.tz ?? 0); } catch (err) { console.error("bumpStreak failed after saving session", err); }

  res.status(201).json({ ...attempt, scorePercent: Number(attempt.scorePercent) });
});

// ---------------------------------------------------------------------------
// Trial MCQ usage — powers the Practice page's "X of Y MCQs used today" bar
// for trial-only students, so the cap shows up as they go instead of only
// surfacing as a rejected submission after they've already answered past
// it. Paying students (and any student when the cap is unlimited) just get
// back { limited: false }.
// ---------------------------------------------------------------------------
router.get("/student/trial-mcq-usage", requireAuth, async (req, res): Promise<void> => {
  if (req.user!.role !== "student") { res.json({ limited: false, limit: 0, used: 0, remaining: null }); return; }
  const status = await getTrialDailyMcqStatus(req.user!.id);
  res.json({ ...status, remaining: Number.isFinite(status.remaining) ? status.remaining : null });
});

// ---------------------------------------------------------------------------
// Analytics dashboard
// ---------------------------------------------------------------------------


router.get("/student/analytics", requireAuth, async (req, res): Promise<void> => {
  const range = typeof req.query.range === "string" ? req.query.range : "7d";
  const days = RANGE_DAYS[range] ?? 7;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const attempts = await db.select().from(practiceAttemptsTable).where(and(eq(practiceAttemptsTable.userId, req.user!.id), gte(practiceAttemptsTable.createdAt, since)));
  const totalSessions = attempts.length;
  const totalQuestions = attempts.reduce((sum, a) => sum + a.totalQuestions, 0);
  const totalCorrect = attempts.reduce((sum, a) => sum + a.correctCount, 0);
  const averageScore = totalQuestions ? (totalCorrect / totalQuestions) * 100 : 0;
  const timeSpentSeconds = attempts.reduce((sum, a) => sum + (a.completedAt && a.startedAt ? Math.max(0, (a.completedAt.getTime() - a.startedAt.getTime()) / 1000) : 0), 0);

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));

  res.json({
    range,
    totalSessions,
    averageScore: Number(averageScore.toFixed(1)),
    questionsAnswered: totalQuestions,
    timeSpentMinutes: Math.round(timeSpentSeconds / 60),
    // liveStreak(): the stored number goes stale the moment a student stops
    // practising, so a lapsed run reads 0 instead of its old value.
    currentStreak: liveStreak(user, parseTzOffset(req.query.tz)).current,
    longestStreak: liveStreak(user, parseTzOffset(req.query.tz)).longest,
  });
});

// ---------------------------------------------------------------------------
// Progress trend — powers the "improving / steady / needs more practice"
// verdict shown on the practice-session result card and the student
// dashboard's progress profile. Compares the last 7 days against the 7
// days before that (rather than two overlapping cumulative ranges, which
// would double-count and mute any real change) so a genuine improvement or
// dip actually shows up.
// ---------------------------------------------------------------------------

const DAILY_WINDOW_DAYS = 7;

function weightedAverage(attempts: { totalQuestions: number; correctCount: number }[]): number | null {
  const totalQuestions = attempts.reduce((sum, a) => sum + a.totalQuestions, 0);
  if (!totalQuestions) return null;
  const totalCorrect = attempts.reduce((sum, a) => sum + a.correctCount, 0);
  return (totalCorrect / totalQuestions) * 100;
}

router.get("/student/progress", requireAuth, async (req, res): Promise<void> => {
  const now = new Date();
  const recentSince = new Date(now); recentSince.setDate(recentSince.getDate() - 7);
  const priorSince = new Date(now); priorSince.setDate(priorSince.getDate() - 14);

  // Bug fix: this destructured `user` straight out of Promise.all, but
  // db.select() resolves to an ARRAY of rows — so `user?.currentStreak` below
  // was always undefined and the "day streak" on the progress profile card
  // read 0 for everyone. Take the first row explicitly.
  const [allAttempts, userRows] = await Promise.all([
    db.select().from(practiceAttemptsTable).where(and(eq(practiceAttemptsTable.userId, req.user!.id), gte(practiceAttemptsTable.createdAt, priorSince))).orderBy(desc(practiceAttemptsTable.createdAt)),
    db.select().from(usersTable).where(eq(usersTable.id, req.user!.id)),
  ]);
  const user = userRows[0];
  const recentAttempts = allAttempts.filter((a) => a.createdAt >= recentSince);
  const priorAttempts = allAttempts.filter((a) => a.createdAt < recentSince);
  const recentAverage = weightedAverage(recentAttempts);
  const priorAverage = weightedAverage(priorAttempts);

  let trend: "up" | "down" | "flat" | "new" = "new";
  let trendDelta = 0;
  if (recentAverage != null && priorAverage != null) {
    trendDelta = Math.round((recentAverage - priorAverage) * 10) / 10;
    trend = trendDelta >= 3 ? "up" : trendDelta <= -3 ? "down" : "flat";
  }

  const history = allAttempts.slice(0, 10).reverse().map((a) => ({ date: (a.completedAt ?? a.createdAt).toISOString(), scorePercent: Number(a.scorePercent) }));

  // One entry per calendar day for the last 7 days (oldest -> today), bucketed
  // in the STUDENT's local day. The browser sends its own offset as
  // `?tz=<Date.getTimezoneOffset()>` (minutes; UTC+5 => -300) — without it a
  // student in Pakistan who practises at 1 a.m. would see that session on the
  // "previous" day's bar. Missing/invalid => UTC. `history` above is kept as-is
  // for existing consumers; the dashboard chart uses `daily` because ten
  // per-session bars with one-letter weekday labels ("W W T T T T F F S S")
  // can't tell you WHICH Saturday or how many sessions a day had.
  const tzRaw = Number(req.query.tz);
  const tzOffsetMin = Number.isFinite(tzRaw) ? Math.max(-840, Math.min(840, Math.trunc(tzRaw))) : 0;
  const localDayKey = (t: Date) => new Date(t.getTime() - tzOffsetMin * 60_000).toISOString().slice(0, 10);
  const todayKey = localDayKey(now);
  const dayKeys: string[] = [];
  for (let i = DAILY_WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(`${todayKey}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - i);
    dayKeys.push(d.toISOString().slice(0, 10));
  }
  const buckets = new Map(dayKeys.map((k) => [k, { sessions: 0, questions: 0, correct: 0 }]));
  for (const a of allAttempts) {
    const bucket = buckets.get(localDayKey(a.completedAt ?? a.createdAt));
    if (!bucket) continue;
    bucket.sessions += 1;
    bucket.questions += a.totalQuestions;
    bucket.correct += a.correctCount;
  }
  const daily = dayKeys.map((date) => {
    const b = buckets.get(date)!;
    return { date, sessions: b.sessions, questions: b.questions, scorePercent: b.questions ? Number(((b.correct / b.questions) * 100).toFixed(1)) : null };
  });

  res.json({
    recentAverage: recentAverage != null ? Number(recentAverage.toFixed(1)) : null,
    priorAverage: priorAverage != null ? Number(priorAverage.toFixed(1)) : null,
    trend,
    trendDelta,
    recentSessions: recentAttempts.length,
    history,
    daily,
    currentStreak: liveStreak(user, tzOffsetMin).current,
    longestStreak: liveStreak(user, tzOffsetMin).longest,
  });
});

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

router.get("/leaderboard", requireAuth, async (req, res): Promise<void> => {
  const range = typeof req.query.range === "string" ? req.query.range : "30d";

  // Points formula: 10 per correct answer, minus 3 per wrong (floored at 0),
  // plus any admin adjustment — see lib/leaderboard.ts. Only real, current
  // students rank (admins and soft-deleted accounts are excluded there).
  const ranked = (await buildLeaderboard(range)).filter((row) => row.total > 0 || row.adjustment !== 0);

  res.json(ranked.map((row, index) => {
    const student = row.user;
    // Live streak (0 once a day has been missed) — see lib/streak.ts.
    const streak = liveStreak(student);
    return {
      rank: index + 1,
      userId: row.userId,
      name: student.name ?? "Student",
      currentStreak: streak.current,
      longestStreak: streak.longest,
      practicedToday: streak.practicedToday,
      institution: student.institution ?? null,
      sessions: row.sessions,
      questionsAnswered: row.total,
      correct: row.correct,
      points: row.points,
      accuracy: row.total ? Number(((row.correct / row.total) * 100).toFixed(1)) : 0,
      isYou: row.userId === req.user!.id,
    };
  }));
});

// ---------------------------------------------------------------------------
// Streak card — the signed-in student's own streak plus the last 14 days of
// activity, for the leaderboard hero (flame + day dots). Separate from
// /leaderboard so the (polled, all-students) board doesn't carry per-day data.
// ---------------------------------------------------------------------------

router.get("/leaderboard/streak", requireAuth, async (req, res): Promise<void> => {
  const WINDOW_DAYS = 14;
  // The student's own UTC offset (Date.getTimezoneOffset(), UTC+5 => -300): the
  // day dots and the streak roll over at THEIR midnight, not UTC midnight.
  const tz = parseTzOffset(req.query.tz);
  const dayOf = (t: Date) => new Date(t.getTime() - tz * 60_000).toISOString().slice(0, 10);
  const firstDay = utcDay(-(WINDOW_DAYS - 1), tz);
  // Start a day early so the UTC<->local shift can't clip the first bucket.
  const since = new Date(`${firstDay}T00:00:00Z`);
  since.setTime(since.getTime() + tz * 60_000 - 86_400_000);

  const [attempts, [user]] = await Promise.all([
    db.select({ createdAt: practiceAttemptsTable.createdAt, completedAt: practiceAttemptsTable.completedAt, totalQuestions: practiceAttemptsTable.totalQuestions })
      .from(practiceAttemptsTable)
      .where(and(eq(practiceAttemptsTable.userId, req.user!.id), gte(practiceAttemptsTable.createdAt, since))),
    db.select().from(usersTable).where(eq(usersTable.id, req.user!.id)),
  ]);

  const perDay = new Map<string, { sessions: number; questions: number }>();
  for (const a of attempts) {
    const key = dayOf(a.completedAt ?? a.createdAt);
    const cur = perDay.get(key) ?? { sessions: 0, questions: 0 };
    cur.sessions += 1;
    cur.questions += a.totalQuestions;
    perDay.set(key, cur);
  }
  // Oldest -> newest, always WINDOW_DAYS entries (empty days included).
  const days = Array.from({ length: WINDOW_DAYS }, (_, i) => {
    const date = utcDay(i - (WINDOW_DAYS - 1), tz);
    const v = perDay.get(date);
    return { date, sessions: v?.sessions ?? 0, questions: v?.questions ?? 0 };
  });

  const s = liveStreak(user, tz);
  res.json({ currentStreak: s.current, longestStreak: s.longest, practicedToday: s.practicedToday, atRisk: s.atRisk, days });
});

export default router;
