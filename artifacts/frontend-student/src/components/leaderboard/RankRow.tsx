// One row of the ranked list: raised card, place medal, avatar, name and
// college, a progress bar (relative to the best value on screen), the headline
// number for the active metric and a streak badge.
import { memo } from 'react';
import { CheckCircle2, Flame, Target, Zap } from 'lucide-react';
import { initials } from '@/lib/shared';
import { Avatar3D, Medal } from '@/lib/fx3d';
import { placeTone, type Metric, type RankedRow } from './metrics';

export function StreakBadge({ days, className = '' }: { days: number | undefined; className?: string }) {
  const n = days ?? 0;
  if (n <= 0) return null;
  return <span className={`inline-flex items-center gap-1 rounded-full bg-[#fff0cb] px-2 py-0.5 text-[10px] font-extrabold text-[#94651c] ring-1 ring-inset ring-[#e0a72f]/30 dark:bg-[#f5a623]/20 dark:text-[#ffd98a] ${className}`} title={`${n}-day streak`} data-testid="badge-streak"><Flame size={10} fill="currentColor" />{n}</span>;
}

const ACCENT: Record<string, string> = { gold: '#f2c94c', silver: '#c5cdd8', bronze: '#dc9a5e' };

function RankRowCardImpl({ row, metric, max, index }: { row: RankedRow; metric: Metric; max: number; index: number }) {
  const value = metric.value(row);
  const pct = max > 0 ? Math.max(4, Math.min(100, (value / max) * 100)) : 0;
  const ranked = row.position != null;
  const tone = placeTone(row.position, row.isYou);
  const accent = row.isYou ? undefined : ACCENT[tone];
  return <div id={row.isYou ? 'lb-you-row' : undefined} className={`lbx-row ${index < 8 ? 'lbx-row--enter' : ''} ${row.isYou ? 'lbx-row--you' : ''} ${ranked ? '' : 'opacity-75'}`} style={{ ['--i' as string]: index, ...(accent ? { ['--accent' as string]: accent } : {}) }} data-testid={`row-leaderboard-${row.userId}`}>
    <span className="lbx-row__bar" aria-hidden="true" />
    <Medal tone={tone} size={36}>{row.position ?? '–'}</Medal>
    <Avatar3D text={initials(row.name)} size={44} className="shrink-0" />
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1.5"><span className="truncate text-sm font-extrabold">{row.name}</span>{row.isYou && <span className="shrink-0 rounded-full bg-primary px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide text-primary-foreground">you</span>}</div>
      {row.institution && <div className="truncate text-[11px] text-muted-foreground">{row.institution}</div>}
      <div className="lbx-meter mt-2"><i style={{ transform: `scaleX(${ranked ? pct / 100 : 0})` }} /></div>
      <div className="mt-1.5 flex flex-wrap gap-1.5"><span className="lbx-pill"><Target size={10} />{row.accuracy}%</span><span className="lbx-pill"><Zap size={10} />{row.questionsAnswered.toLocaleString()} q</span><span className="lbx-pill"><CheckCircle2 size={10} />{row.sessions} sessions</span></div>
    </div>
    <div className="shrink-0 text-right">
      <div className="lbx-num" data-testid={`value-leaderboard-${row.userId}`}>{ranked || metric.key === 'points' || metric.key === 'questions' ? metric.format(value) : '—'}</div>
      <div className="text-[9px] font-bold uppercase tracking-[.1em] text-muted-foreground">{metric.unit}</div>
      {metric.key !== 'streak' && <StreakBadge days={row.currentStreak} className="mt-1.5" />}
    </div>
  </div>;
}

// Memoised: a poll or a search keystroke only re-renders rows whose data actually changed.
export const RankRowCard = memo(RankRowCardImpl);
