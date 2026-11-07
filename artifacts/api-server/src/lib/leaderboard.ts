// Leaderboard computation shared by the student board (routes/analytics.ts)
// and the admin editor (routes/admin-leaderboard.ts) so both always rank
// identically.
//
// points = max(0, earned + admin adjustment)
//   earned     = 10 per correct answer - 3 per wrong answer, over the range
//   adjustment = med_leaderboard_adjustments.points_delta (range-independent)
// Rank is derived from final points, so "rank up/down" by an admin is just a
// computed points adjustment (see routes/admin-leaderboard.ts).
import { and, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { db, practiceAttemptsTable, usersTable, leaderboardAdjustmentsTable } from "@workspace/db";

export const RANGE_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "3m": 90, "1y": 365 };

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  user: typeof usersTable.$inferSelect;
  sessions: number;
  total: number;
  correct: number;
  /** Points earned from practice, before any admin adjustment. */
  basePoints: number;
  /** Admin-applied offset (0 when none). */
  adjustment: number;
  /** What the board shows: max(0, basePoints + adjustment). */
  points: number;
}

export async function buildLeaderboard(range: string, opts: { includeAllStudents?: boolean } = {}): Promise<LeaderboardEntry[]> {
  const days = RANGE_DAYS[range] ?? 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [rows, adjustments] = await Promise.all([
    db
      .select({
        userId: practiceAttemptsTable.userId,
        totalQuestions: sql<number>`sum(${practiceAttemptsTable.totalQuestions})`,
        totalCorrect: sql<number>`sum(${practiceAttemptsTable.correctCount})`,
        sessions: sql<number>`count(*)`,
      })
      .from(practiceAttemptsTable)
      .where(gte(practiceAttemptsTable.createdAt, since))
      .groupBy(practiceAttemptsTable.userId),
    db.select().from(leaderboardAdjustmentsTable),
  ]);

  const adjByUser = new Map(adjustments.map((a) => [a.userId, a.pointsDelta]));
  const earned = new Map(rows.map((r) => [r.userId, r]));

  // Students with an adjustment appear even with no practice in the range
  // (otherwise an admin could award points that never show). The admin editor
  // additionally lists every student so anyone can be adjusted.
  const ids = new Set<number>([...earned.keys(), ...adjByUser.keys()]);
  let students: Array<typeof usersTable.$inferSelect>;
  if (opts.includeAllStudents) {
    students = await db.select().from(usersTable).where(and(eq(usersTable.role, "student"), ne(usersTable.status, "DELETED")));
  } else {
    students = ids.size
      ? await db.select().from(usersTable).where(and(inArray(usersTable.id, [...ids]), eq(usersTable.role, "student"), ne(usersTable.status, "DELETED")))
      : [];
  }

  const scored = students.map((user) => {
    const r = earned.get(user.id);
    const correct = Number(r?.totalCorrect ?? 0);
    const total = Number(r?.totalQuestions ?? 0);
    const wrong = Math.max(0, total - correct);
    const basePoints = Math.max(0, correct * 10 - wrong * 3);
    const adjustment = adjByUser.get(user.id) ?? 0;
    return { userId: user.id, user, sessions: Number(r?.sessions ?? 0), total, correct, basePoints, adjustment, points: Math.max(0, basePoints + adjustment) };
  });

  // Stable order: points, then accuracy, then volume, then id.
  scored.sort((a, b) => b.points - a.points || (b.total ? b.correct / b.total : 0) - (a.total ? a.correct / a.total : 0) || b.total - a.total || a.userId - b.userId);
  return scored.map((s, i) => ({ ...s, rank: i + 1 }));
}
