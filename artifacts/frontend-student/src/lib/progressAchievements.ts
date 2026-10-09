// "My progress" achievements — computed client-side from the one overview
// object the Progress page already loads (GET /student/progress-overview),
// same "read only what already exists, no new backend model" approach as
// the friend-challenge achievements (see challengeAchievements.ts). Recomputed
// on every view, so a badge is "what your practice history demonstrates"
// rather than a persisted unlock log.
//
// Targets are NOT baked into the logic any more: every badge ladder, the
// accuracy/mastery gates and the profile rank steps come from an
// AchievementConfig. The shipped DEFAULT_ACHIEVEMENT_CONFIG below is only the
// fallback; an admin can override any part of it in Settings → Access (saved
// as the ACHIEVEMENT_CONFIG setting, delivered with /site-content). Overrides
// are sanitised in parseAchievementConfig so a bad value can never break the page.
import { Award, BookOpenCheck, CalendarCheck, ClipboardCheck, Clock3, Crown, Flame, GraduationCap, Layers, Sparkles, Star, Target, Trophy, Zap, type LucideIcon } from 'lucide-react';
import type { ProgressOverview } from '@/lib/api';

export type ProgressCategory = 'Practice' | 'Streaks' | 'Mastery' | 'Milestones';
export type ProgressAchievement = {
  id: string; label: string; hint: string; icon: LucideIcon; category: ProgressCategory;
  tier: number;            // 0-based position inside its family (bronze → legend)
  earned: boolean;
  progress: number;        // 0..1 for the locked-card progress bar
  current: number; target: number;
};

export type RankStep = { name: string; at: number };
export type AchievementConfig = {
  /** Badge ladder per family id (ascending targets). */
  thresholds: Record<string, number[]>;
  /** Overall accuracy only counts toward a badge after this many questions. */
  minAccuracyQuestions: number;
  /** A subject counts as "mastered" at this accuracy % … */
  masteryAccuracy: number;
  /** … once at least this many questions were answered in it. */
  masteryMinAnswered: number;
  /** Profile rank steps (first step must start at 0). */
  ranks: RankStep[];
};

export const DEFAULT_ACHIEVEMENT_CONFIG: AchievementConfig = {
  thresholds: {
    'pr-questions': [50, 200, 500, 1000, 2500],
    'pr-unique': [25, 100, 300, 750],
    'pr-sessions': [1, 10, 25, 50, 100],
    'pr-time': [60, 300, 600, 1500], // minutes
    'pr-perfect': [1, 3, 5],
    'pr-streak': [3, 7, 14, 30, 60],
    'pr-beststreak': [7, 14, 30, 60, 100],
    'pr-active30': [5, 10, 20, 30],
    'pr-accuracy': [70, 80, 90],
    'pr-subjects': [1, 3, 5, 8],
    'pr-papers': [1, 3, 5, 10],
    'pr-papers-done': [1, 3, 5],
    'pr-exams': [1, 3, 5],
    'pr-exams-passed': [1, 3],
  },
  minAccuracyQuestions: 20,
  masteryAccuracy: 80,
  masteryMinAnswered: 5,
  ranks: [
    { name: 'Intern', at: 0 }, { name: 'Resident', at: 3 }, { name: 'Fellow', at: 8 },
    { name: 'Registrar', at: 16 }, { name: 'Consultant', at: 28 }, { name: 'Professor', at: 42 },
  ],
};

const MAX_TIERS = 5; // the coin palettes (bronze → legend)

const cleanLadder = (v: unknown, fallback: number[]): number[] => {
  if (!Array.isArray(v)) return fallback;
  const nums = Array.from(new Set(v.map(Number).filter((n) => Number.isFinite(n) && n > 0 && n <= 1_000_000))).sort((a, b) => a - b).slice(0, MAX_TIERS);
  return nums.length ? nums : fallback;
};
const cleanInt = (v: unknown, fallback: number, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : fallback;
};

/** Merge the admin's saved JSON over the defaults. Anything missing or invalid falls back, never throws. */
export function parseAchievementConfig(raw: string | null | undefined): AchievementConfig {
  const base = DEFAULT_ACHIEVEMENT_CONFIG;
  let o: Record<string, unknown> = {};
  try { const p = raw ? JSON.parse(raw) : null; if (p && typeof p === 'object') o = p as Record<string, unknown>; } catch { /* use defaults */ }
  const t = (o.thresholds && typeof o.thresholds === 'object' ? o.thresholds : {}) as Record<string, unknown>;
  const thresholds = Object.fromEntries(Object.entries(base.thresholds).map(([id, def]) => [id, cleanLadder(t[id], def)]));
  let ranks = base.ranks;
  if (Array.isArray(o.ranks)) {
    const r = (o.ranks as Array<Partial<RankStep>>)
      .map((s) => ({ name: String(s?.name ?? '').trim().slice(0, 24), at: Number(s?.at) }))
      .filter((s) => s.name && Number.isFinite(s.at) && s.at >= 0)
      .sort((a, b) => a.at - b.at).slice(0, 10);
    if (r.length >= 2) { r[0] = { ...r[0], at: 0 }; ranks = r; }
  }
  return {
    thresholds,
    minAccuracyQuestions: cleanInt(o.minAccuracyQuestions, base.minAccuracyQuestions, 0, 10_000),
    masteryAccuracy: cleanInt(o.masteryAccuracy, base.masteryAccuracy, 1, 100),
    masteryMinAnswered: cleanInt(o.masteryMinAnswered, base.masteryMinAnswered, 1, 1000),
    ranks,
  };
}

function family(o: {
  id: string; category: ProgressCategory; icon: LucideIcon; current: number; thresholds: number[];
  label: (t: number) => string; hint: (t: number) => string;
}): ProgressAchievement[] {
  return o.thresholds.map((t, i) => ({
    id: `${o.id}-${t}`, label: o.label(t), hint: o.hint(t), icon: o.icon, category: o.category, tier: i,
    earned: o.current >= t, progress: Math.min(1, o.current / t), current: Math.min(o.current, t), target: t,
  }));
}

const hours = (mins: number) => (mins < 60 ? `${mins} min` : `${Math.round(mins / 60)} hr${Math.round(mins / 60) === 1 ? '' : 's'}`);

export function computeProgressAchievements(d: ProgressOverview, cfg: AchievementConfig = DEFAULT_ACHIEVEMENT_CONFIG): ProgressAchievement[] {
  const s = d.summary;
  const T = cfg.thresholds;
  const masteredSubjects = d.bySubject.filter((sub) => sub.answered >= cfg.masteryMinAnswered && (sub.accuracy ?? 0) >= cfg.masteryAccuracy).length;
  const perfectSessions = d.recentSessions.filter((r) => r.scorePercent >= 100).length;
  const completedPapers = d.pastPapers.filter((p) => p.coveragePercent >= 100).length;
  const passedExams = d.exams.filter((e) => e.passed).length;
  // Accuracy only counts once there is enough practice behind it — otherwise a
  // lucky first few questions would unlock "90%+ accuracy" instantly.
  const accuracyForBadge = s.questionsAnswered >= cfg.minAccuracyQuestions ? Math.round(s.accuracy ?? 0) : 0;

  return [
    // Practice — sheer volume of MCQ practice.
    ...family({ id: 'pr-questions', category: 'Practice', icon: Target, current: s.questionsAnswered, thresholds: T['pr-questions'],
      label: (t) => `${t} questions answered`, hint: (t) => `Answer ${t} questions in practice, in total` }),
    ...family({ id: 'pr-unique', category: 'Practice', icon: Layers, current: s.uniqueMcqsAttempted, thresholds: T['pr-unique'],
      label: (t) => `${t} different questions tried`, hint: (t) => `Attempt ${t} different questions across the bank` }),
    ...family({ id: 'pr-sessions', category: 'Practice', icon: BookOpenCheck, current: s.sessions, thresholds: T['pr-sessions'],
      label: (t) => (t === 1 ? 'First practice session' : `${t} practice sessions`), hint: (t) => `Finish ${t} practice ${t === 1 ? 'session' : 'sessions'}` }),
    ...family({ id: 'pr-time', category: 'Practice', icon: Clock3, current: s.timeSpentMinutes, thresholds: T['pr-time'],
      label: (t) => `${hours(t)} studied`, hint: (t) => `Spend ${hours(t)} practising, in total` }),
    ...family({ id: 'pr-perfect', category: 'Practice', icon: Crown, current: perfectSessions, thresholds: T['pr-perfect'],
      label: (t) => (t === 1 ? 'Flawless session' : `${t} flawless sessions`), hint: (t) => `Score 100% in ${t} practice ${t === 1 ? 'session' : 'sessions'}` }),

    // Streaks — daily consistency.
    ...family({ id: 'pr-streak', category: 'Streaks', icon: Flame, current: s.currentStreak, thresholds: T['pr-streak'],
      label: (t) => `${t}-day streak`, hint: (t) => `Practise ${t} days in a row` }),
    ...family({ id: 'pr-beststreak', category: 'Streaks', icon: Zap, current: s.longestStreak, thresholds: T['pr-beststreak'],
      label: (t) => `Best streak: ${t} days`, hint: (t) => `Reach a ${t}-day streak at your peak` }),
    ...family({ id: 'pr-active30', category: 'Streaks', icon: CalendarCheck, current: s.activeDaysLast30, thresholds: T['pr-active30'],
      label: (t) => `Active ${t} of the last 30 days`, hint: (t) => `Practise on ${t} different days within a 30-day window` }),

    // Mastery — accuracy and depth in a topic.
    ...family({ id: 'pr-accuracy', category: 'Mastery', icon: Star, current: accuracyForBadge, thresholds: T['pr-accuracy'],
      label: (t) => `${t}%+ overall accuracy`, hint: (t) => `Keep your overall accuracy at ${t}% or higher (after ${cfg.minAccuracyQuestions}+ questions)` }),
    ...family({ id: 'pr-subjects', category: 'Mastery', icon: GraduationCap, current: masteredSubjects, thresholds: T['pr-subjects'],
      label: (t) => `${t} subject${t === 1 ? '' : 's'} mastered`, hint: (t) => `Reach ${cfg.masteryAccuracy}%+ accuracy in ${t} subject${t === 1 ? '' : 's'} (${cfg.masteryMinAnswered}+ questions each)` }),

    // Milestones — past papers and Pre-Proffs exams.
    ...family({ id: 'pr-papers', category: 'Milestones', icon: Sparkles, current: d.pastPapers.length, thresholds: T['pr-papers'],
      label: (t) => (t === 1 ? 'First past paper started' : `${t} past papers started`), hint: (t) => `Start ${t} different past ${t === 1 ? 'paper' : 'papers'}` }),
    ...family({ id: 'pr-papers-done', category: 'Milestones', icon: Award, current: completedPapers, thresholds: T['pr-papers-done'],
      label: (t) => `${t} past paper${t === 1 ? '' : 's'} completed`, hint: (t) => `Reach 100% coverage on ${t} past ${t === 1 ? 'paper' : 'papers'}` }),
    ...family({ id: 'pr-exams', category: 'Milestones', icon: ClipboardCheck, current: d.exams.length, thresholds: T['pr-exams'],
      label: (t) => (t === 1 ? 'First Pre-Proffs attempt' : `${t} Pre-Proffs attempts`), hint: (t) => `Sit ${t} Pre-Proffs ${t === 1 ? 'exam' : 'exams'}` }),
    ...family({ id: 'pr-exams-passed', category: 'Milestones', icon: Trophy, current: passedExams, thresholds: T['pr-exams-passed'],
      label: (t) => (t === 1 ? 'Passed a Pre-Proffs exam' : `Passed ${t} Pre-Proffs exams`), hint: (t) => `Pass ${t} Pre-Proffs ${t === 1 ? 'exam' : 'exams'}` }),
  ];
}

/** Clinical-career rank shown on the profile hero, driven only by how many
 * badges are unlocked (steps come from the config). */
export type ProfileRank = {
  level: number; name: string; next: string | null;
  /** 0..1 progress toward the next rank (1 once the top rank is reached). */
  pct: number; toNext: number;
};

export function profileRank(earned: number, ranks: RankStep[] = DEFAULT_ACHIEVEMENT_CONFIG.ranks): ProfileRank {
  let i = 0;
  ranks.forEach((r, idx) => { if (earned >= r.at) i = idx; });
  const cur = ranks[i];
  const next = ranks[i + 1] ?? null;
  return {
    level: i + 1, name: cur.name, next: next ? next.name : null,
    pct: next ? Math.min(1, (earned - cur.at) / Math.max(1, next.at - cur.at)) : 1,
    toNext: next ? Math.max(0, next.at - earned) : 0,
  };
}
