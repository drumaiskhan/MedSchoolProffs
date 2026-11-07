// One row of the ranked list (modern redesign): a flat glass card with a rank
// badge, gradient avatar, name + college, a slim progress bar (relative to the
// best value on screen), stat pills and the headline number. Top-3 and "you"
// rows get an accent edge.
import { memo } from 'react';
import { CheckCircle2, Flame, Target, Zap } from 'lucide-react';
import { initials } from '@/lib/shared';
import { LmAvatar, LmRank } from './LmParts';
import { placeTone, type Metric, type RankedRow } from './metrics';

export function StreakBadge({ days, className = '' }: { days: number | undefined; className?: string }) {
  const n = days ?? 0;
  if (n <= 0) return null;
  return <span className={`lm-streak ${className}`} title={`${n}-day streak`} data-testid="badge-streak"><Flame size={10} fill="currentColor" />{n}</span>;
}

function RankRowCardImpl({ row, metric, max, index }: { row: RankedRow; metric: Metric; max: number; index: number }) {
  const value = metric.value(row);
  const pct = max > 0 ? Math.max(4, Math.min(100, (value / max) * 100)) : 0;
  const ranked = row.position != null;
  const tone = placeTone(row.position, row.isYou);
  return <div id={row.isYou ? 'lb-you-row' : undefined} className={`lm-row lm-row--${tone} ${index < 8 ? 'lm-row--enter' : ''} ${row.isYou ? 'lm-row--you' : ''} ${ranked ? '' : 'opacity-70'}`} style={{ ['--i' as string]: index }} data-testid={`row-leaderboard-${row.userId}`}>
    <LmRank place={row.position} tone={tone} size={34} />
    <LmAvatar name={row.name} text={initials(row.name)} size={44} className="shrink-0" />
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1.5">
        <span className="truncate text-sm font-extrabold">{row.name}</span>
        {row.isYou && <span className="shrink-0 rounded-full bg-primary px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide text-primary-foreground">you</span>}
      </div>
      {row.institution && <div className="truncate text-[11px] text-muted-foreground">{row.institution}</div>}
      <div className="lm-meter mt-2"><i style={{ transform: `scaleX(${ranked ? pct / 100 : 0})` }} /></div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <span className="lm-pill"><Target size={10} />{row.accuracy}%</span>
        <span className="lm-pill"><Zap size={10} />{row.questionsAnswered.toLocaleString()} q</span>
        <span className="lm-pill"><CheckCircle2 size={10} />{row.sessions} {row.sessions === 1 ? 'session' : 'sessions'}</span>
      </div>
    </div>
    <div className="shrink-0 text-right">
      <div className="lm-num" data-testid={`value-leaderboard-${row.userId}`}>{ranked || metric.key === 'points' || metric.key === 'questions' ? metric.format(value) : '—'}</div>
      <div className="text-[9px] font-bold uppercase tracking-[.1em] text-muted-foreground">{metric.unit}</div>
      {metric.key !== 'streak' && <StreakBadge days={row.currentStreak} className="mt-1.5" />}
    </div>
  </div>;
}

// Memoised: a poll or a search keystroke only re-renders rows whose data actually changed.
export const RankRowCard = memo(RankRowCardImpl);
