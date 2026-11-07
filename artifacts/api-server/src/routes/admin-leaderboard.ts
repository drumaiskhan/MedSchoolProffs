// Admin controls for the student leaderboard: add/remove points or move a
// student up/down in rank. Everything is stored as one signed points offset
// per student (med_leaderboard_adjustments) layered over earned points, so the
// public board keeps a single source of truth and rank stays derived.
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auditLogsTable, db, leaderboardAdjustmentsTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/auth";
import { buildLeaderboard, RANGE_DAYS, type LeaderboardEntry } from "../lib/leaderboard";

const router: IRouter = Router();

const MAX_ABS_DELTA = 1_000_000;
const rangeOf = (raw: unknown) => (typeof raw === "string" && raw in RANGE_DAYS ? raw : "30d");

const view = (e: LeaderboardEntry) => ({
  rank: e.rank,
  userId: e.userId,
  name: e.user.name,
  email: e.user.email,
  institution: e.user.institution ?? null,
  sessions: e.sessions,
  questionsAnswered: e.total,
  correct: e.correct,
  earnedPoints: e.basePoints,
  adjustment: e.adjustment,
  points: e.points,
});

async function saveDelta(userId: number, delta: number, actorId: number, action: string, extra: Record<string, unknown>): Promise<void> {
  const clamped = Math.max(-MAX_ABS_DELTA, Math.min(MAX_ABS_DELTA, Math.trunc(delta)));
  if (clamped === 0) {
    await db.delete(leaderboardAdjustmentsTable).where(eq(leaderboardAdjustmentsTable.userId, userId));
  } else {
    await db.insert(leaderboardAdjustmentsTable)
      .values({ userId, pointsDelta: clamped, updatedBy: actorId })
      .onConflictDoUpdate({ target: leaderboardAdjustmentsTable.userId, set: { pointsDelta: clamped, updatedBy: actorId, updatedAt: new Date() } });
  }
  await db.insert(auditLogsTable).values({ actorId, action, entity: "leaderboard", entityId: userId, metadata: JSON.stringify({ ...extra, newAdjustment: clamped }) });
}

// Every student (not just those who've practised) with earned points,
// adjustment and final rank, so the admin can adjust anyone.
router.get("/admin/leaderboard", requireAdmin, async (req, res): Promise<void> => {
  const range = rangeOf(req.query.range);
  const board = await buildLeaderboard(range, { includeAllStudents: true });
  res.json({ range, rows: board.map(view) });
});

// Add (positive) or remove (negative) points, or set the exact final points.
const PointsBody = z.union([
  z.object({ delta: z.coerce.number().int().refine((n) => n !== 0, "Enter a non-zero amount") }),
  z.object({ setTo: z.coerce.number().int().min(0) }),
]);

router.post("/admin/leaderboard/:userId/points", requireAdmin, async (req, res): Promise<void> => {
  const userId = Number(req.params.userId);
  const parsed = PointsBody.safeParse(req.body);
  const range = rangeOf(req.query.range);
  if (!Number.isInteger(userId) || !parsed.success) { res.status(400).json({ error: (!parsed.success && parsed.error.issues[0]?.message) || "Invalid request" }); return; }
  const board = await buildLeaderboard(range, { includeAllStudents: true });
  const entry = board.find((e) => e.userId === userId);
  if (!entry) { res.status(404).json({ error: "Student not found" }); return; }

  // Adjust relative to what's currently SHOWN so +50 always means +50 on the
  // board, even when the floor at 0 is clipping the stored offset.
  const finalPoints = Math.max(0, "delta" in parsed.data ? entry.points + parsed.data.delta : parsed.data.setTo);
  const newAdjustment = finalPoints - entry.basePoints;
  await saveDelta(userId, newAdjustment, req.user!.id, "LEADERBOARD_POINTS_ADJUSTED", { range, before: entry.points, request: parsed.data });

  const after = (await buildLeaderboard(range, { includeAllStudents: true })).find((e) => e.userId === userId)!;
  res.json(view(after));
});

// Move a student up/down N places, or to an exact rank. The server works out
// the points offset that lands them there (one point above the student
// currently holding that spot, or just below when moving down), then reports
// where they actually ended up — ties on points are broken by accuracy and
// volume, so the landing spot can differ by one in a dead heat.
const RankBody = z.union([
  z.object({ direction: z.enum(["up", "down"]), places: z.coerce.number().int().min(1).max(10_000).default(1) }),
  z.object({ targetRank: z.coerce.number().int().min(1) }),
]);

router.post("/admin/leaderboard/:userId/rank", requireAdmin, async (req, res): Promise<void> => {
  const userId = Number(req.params.userId);
  const parsed = RankBody.safeParse(req.body);
  const range = rangeOf(req.query.range);
  if (!Number.isInteger(userId) || !parsed.success) { res.status(400).json({ error: (!parsed.success && parsed.error.issues[0]?.message) || "Invalid request" }); return; }
  const board = await buildLeaderboard(range, { includeAllStudents: true });
  const entry = board.find((e) => e.userId === userId);
  if (!entry) { res.status(404).json({ error: "Student not found" }); return; }

  const others = board.filter((e) => e.userId !== userId); // already in rank order
  const wanted = "targetRank" in parsed.data
    ? parsed.data.targetRank
    : entry.rank + (parsed.data.direction === "up" ? -parsed.data.places : parsed.data.places);
  const target = Math.max(1, Math.min(others.length + 1, wanted));
  if (target === entry.rank) { res.json(view(entry)); return; } // already there — change nothing

  // Points that put the student at index (target - 1) among `others`.
  let finalPoints: number;
  if (target === 1) finalPoints = (others[0]?.points ?? 0) + 1; // beat the leader
  else if (target > others.length) finalPoints = Math.max(0, (others[others.length - 1]?.points ?? 0) - 1); // below the last
  else finalPoints = others[target - 2]!.points > others[target - 1]!.points
    ? others[target - 1]!.points + 1 // just above the one they must pass, still ≤ the one above
    : others[target - 1]!.points; // neighbours tied — can't wedge between, tie-break decides
  finalPoints = Math.max(0, finalPoints);

  await saveDelta(userId, finalPoints - entry.basePoints, req.user!.id, "LEADERBOARD_RANK_ADJUSTED", { range, beforeRank: entry.rank, requested: parsed.data, targetRank: target });

  const after = (await buildLeaderboard(range, { includeAllStudents: true })).find((e) => e.userId === userId)!;
  res.json(view(after));
});

// Remove the adjustment entirely — back to earned points.
router.delete("/admin/leaderboard/:userId/adjustment", requireAdmin, async (req, res): Promise<void> => {
  const userId = Number(req.params.userId);
  const range = rangeOf(req.query.range);
  if (!Number.isInteger(userId)) { res.status(400).json({ error: "Invalid student" }); return; }
  await saveDelta(userId, 0, req.user!.id, "LEADERBOARD_ADJUSTMENT_RESET", { range });
  const after = (await buildLeaderboard(range, { includeAllStudents: true })).find((e) => e.userId === userId);
  if (!after) { res.status(404).json({ error: "Student not found" }); return; }
  res.json(view(after));
});

export default router;
