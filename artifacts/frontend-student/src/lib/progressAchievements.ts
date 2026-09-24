// "My progress" achievements — computed client-side from the one overview
// object the Progress page already loads (GET /student/progress-overview),
// same "read only what already exists, no new backend model" approach as
// the friend-challenge achievements (see challengeAchievements.ts). Recomputed
// on every view, so a badge is "what your practice history demonstrates"
// rather than a persisted unlock log.
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

/** Overall accuracy only counts toward a badge once there's enough practice
 * behind it (20+ questions) — otherwise a lucky first few questions would
 * unlock "90%+ accuracy" instantly, which wouldn't mean much. */
const MIN_QUESTIONS_FOR_ACCURACY_BADGE = 20;

export function computeProgressAchievements(d: ProgressOverview): ProgressAchievement[] {
  const s = d.summary;
  const masteredSubjects = d.bySubject.filter((sub) => sub.answered >= 5 && (sub.accuracy ?? 0) >= 80).length;
  const perfectSessions = d.recentSessions.filter((r) => r.scorePercent >= 100).length;
  const completedPapers = d.pastPapers.filter((p) => p.coveragePercent >= 100).length;
  const passedExams = d.exams.filter((e) => e.passed).length;
  const accuracyForBadge = s.questionsAnswered >= MIN_QUESTIONS_FOR_ACCURACY_BADGE ? Math.round(s.accuracy ?? 0) : 0;

  return [
    // Practice — sheer volume of MCQ practice.
    ...family({ id: 'pr-questions', category: 'Practice', icon: Target, current: s.questionsAnswered, thresholds: [50, 200, 500, 1000, 2500],
      label: (t) => `${t} questions answered`, hint: (t) => `Answer ${t} questions in practice, in total` }),
    ...family({ id: 'pr-unique', category: 'Practice', icon: Layers, current: s.uniqueMcqsAttempted, thresholds: [25, 100, 300, 750],
      label: (t) => `${t} different questions tried`, hint: (t) => `Attempt ${t} different questions across the bank` }),
    ...family({ id: 'pr-sessions', category: 'Practice', icon: BookOpenCheck, current: s.sessions, thresholds: [1, 10, 25, 50, 100],
      label: (t) => (t === 1 ? 'First practice session' : `${t} practice sessions`), hint: (t) => `Finish ${t} practice ${t === 1 ? 'session' : 'sessions'}` }),
    ...family({ id: 'pr-time', category: 'Practice', icon: Clock3, current: s.timeSpentMinutes, thresholds: [60, 300, 600, 1500],
      label: (t) => `${hours(t)} studied`, hint: (t) => `Spend ${hours(t)} practising, in total` }),
    ...family({ id: 'pr-perfect', category: 'Practice', icon: Crown, current: perfectSessions, thresholds: [1, 3, 5],
      label: (t) => (t === 1 ? 'Flawless session' : `${t} flawless sessions`), hint: (t) => `Score 100% in ${t} practice ${t === 1 ? 'session' : 'sessions'}` }),

    // Streaks — daily consistency.
    ...family({ id: 'pr-streak', category: 'Streaks', icon: Flame, current: s.currentStreak, thresholds: [3, 7, 14, 30, 60],
      label: (t) => `${t}-day streak`, hint: (t) => `Practise ${t} days in a row` }),
    ...family({ id: 'pr-beststreak', category: 'Streaks', icon: Zap, current: s.longestStreak, thresholds: [7, 14, 30, 60, 100],
      label: (t) => `Best streak: ${t} days`, hint: (t) => `Reach a ${t}-day streak at your peak` }),
    ...family({ id: 'pr-active30', category: 'Streaks', icon: CalendarCheck, current: s.activeDaysLast30, thresholds: [5, 10, 20, 30],
      label: (t) => `Active ${t} of the last 30 days`, hint: (t) => `Practise on ${t} different days within a 30-day window` }),

    // Mastery — accuracy and depth in a topic.
    ...family({ id: 'pr-accuracy', category: 'Mastery', icon: Star, current: accuracyForBadge, thresholds: [70, 80, 90],
      label: (t) => `${t}%+ overall accuracy`, hint: (t) => `Keep your overall accuracy at ${t}% or higher (after 20+ questions)` }),
    ...family({ id: 'pr-subjects', category: 'Mastery', icon: GraduationCap, current: masteredSubjects, thresholds: [1, 3, 5, 8],
      label: (t) => `${t} subject${t === 1 ? '' : 's'} mastered`, hint: (t) => `Reach 80%+ accuracy in ${t} subject${t === 1 ? '' : 's'} (5+ questions each)` }),

    // Milestones — past papers and Pre-Proffs exams.
    ...family({ id: 'pr-papers', category: 'Milestones', icon: Sparkles, current: d.pastPapers.length, thresholds: [1, 3, 5, 10],
      label: (t) => (t === 1 ? 'First past paper started' : `${t} past papers started`), hint: (t) => `Start ${t} different past ${t === 1 ? 'paper' : 'papers'}` }),
    ...family({ id: 'pr-papers-done', category: 'Milestones', icon: Award, current: completedPapers, thresholds: [1, 3, 5],
      label: (t) => `${t} past paper${t === 1 ? '' : 's'} completed`, hint: (t) => `Reach 100% coverage on ${t} past ${t === 1 ? 'paper' : 'papers'}` }),
    ...family({ id: 'pr-exams', category: 'Milestones', icon: ClipboardCheck, current: d.exams.length, thresholds: [1, 3, 5],
      label: (t) => (t === 1 ? 'First Pre-Proffs attempt' : `${t} Pre-Proffs attempts`), hint: (t) => `Sit ${t} Pre-Proffs ${t === 1 ? 'exam' : 'exams'}` }),
    ...family({ id: 'pr-exams-passed', category: 'Milestones', icon: Trophy, current: passedExams, thresholds: [1, 3],
      label: (t) => (t === 1 ? 'Passed a Pre-Proffs exam' : `Passed ${t} Pre-Proffs exams`), hint: (t) => `Pass ${t} Pre-Proffs ${t === 1 ? 'exam' : 'exams'}` }),
  ];
}
