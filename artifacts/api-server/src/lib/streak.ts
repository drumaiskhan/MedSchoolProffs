// Streak helpers shared by the analytics, progress, dashboard and leaderboard
// routes.
//
// Background: `users.current_streak` is only ever rewritten when a student
// finishes a practice session (bumpStreak in routes/analytics.ts). A student
// who stops practising therefore kept showing their old streak forever —
// "12 day streak" three weeks after their last session — on the dashboard and
// (now) the leaderboard. The stored number is still the source of truth for
// "how long was the run", but whether that run is still ALIVE depends on the
// last practice date, so every read goes through liveStreak().
//
// Days are the student's own calendar days (client sends its UTC offset); with no offset they are UTC days. bumpStreak and liveStreak share utcDay so they always agree.

/** Calendar day (YYYY-MM-DD) `offsetDays` from now. `tzOffsetMin` is the
 *  student's own offset as `Date.getTimezoneOffset()` reports it (UTC+5 => -300),
 *  so the day rolls over at THEIR midnight; 0 (default) means UTC. */
export function utcDay(offsetDays = 0, tzOffsetMin = 0): string {
  return new Date(Date.now() - tzOffsetMin * 60_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

/** Parses a client-sent `tz` value (minutes) into a safe offset; anything invalid is UTC. */
export function parseTzOffset(raw: unknown): number {
  const n = Number(raw);
  return raw != null && raw !== "" && Number.isFinite(n) ? Math.max(-840, Math.min(840, Math.trunc(n))) : 0;
}

export interface StreakSource {
  currentStreak: number | null;
  longestStreak: number | null;
  lastPracticeDate: string | null;
}

export interface LiveStreak {
  /** Streak as it stands right now — 0 once a full day has been missed. */
  current: number;
  /** Best run ever (never lower than the live current run). */
  longest: number;
  /** The student has already practised today (UTC). */
  practicedToday: boolean;
  /** Practised yesterday but not yet today — the run breaks at midnight UTC. */
  atRisk: boolean;
}

export function liveStreak(user: StreakSource | null | undefined, tzOffsetMin = 0): LiveStreak {
  const stored = user?.currentStreak ?? 0;
  const last = user?.lastPracticeDate ?? null;
  // Stored days are in the student's own timezone, which can be a day AHEAD of
  // UTC (e.g. 3am in UTC+5 is still "yesterday" in UTC) — so a last-practice
  // day later than today's UTC date still means "practised today".
  const today = utcDay(0, tzOffsetMin);
  const practicedToday = last != null && last >= today;
  const alive = practicedToday || last === utcDay(-1, tzOffsetMin);
  const current = alive ? stored : 0;
  return {
    current,
    longest: Math.max(user?.longestStreak ?? 0, current),
    practicedToday,
    atRisk: !practicedToday && alive && current > 0,
  };
}

export interface RebuiltStreak {
  /** Run of consecutive practice days ending on the most recent practice day. */
  currentStreak: number;
  /** Longest run of consecutive practice days anywhere in the history. */
  longestStreak: number;
  /** Most recent practice day (UTC, YYYY-MM-DD), or null with no history. */
  lastPracticeDate: string | null;
}

const dayNumber = (day: string): number => Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400000);

/**
 * Rebuilds a streak from raw practice dates (UTC YYYY-MM-DD, any order, duplicates
 * fine). `currentStreak` is the run ending at the LAST practice day — whether that
 * run is still alive is decided at read time by liveStreak(), exactly like the
 * stored counter.
 */
export function streakFromDays(days: Iterable<string>): RebuiltStreak {
  const nums = [...new Set([...days].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))].map(dayNumber).sort((a, b) => a - b);
  if (!nums.length) return { currentStreak: 0, longestStreak: 0, lastPracticeDate: null };
  let longest = 1;
  let run = 1;
  for (let i = 1; i < nums.length; i++) {
    run = nums[i] === nums[i - 1] + 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }
  return { currentStreak: run, longestStreak: longest, lastPracticeDate: new Date(nums[nums.length - 1] * 86400000).toISOString().slice(0, 10) };
}
