// Top-three podium (modern redesign): a dark gradient stage with soft glows,
// gradient-ringed avatars, rounded pillars that rise into place and a crown on
// the champion. Flat gradients + one soft shadow per pillar — cheap on phones.
// Export name kept (Podium3D) so the page import doesn't change.
import { Crown, Flame } from 'lucide-react';
import { initials } from '@/lib/shared';
import { Count } from '@/lib/fx3d';
import { LmAvatar } from './LmParts';
import type { Metric, RankedRow } from './metrics';

type Place = 1 | 2 | 3;

const PLACE: Record<Place, { tone: 'gold' | 'silver' | 'bronze'; order: string; pillar: string; avatar: number; delay: string }> = {
  1: { tone: 'gold', order: 'order-2', pillar: 'h-32 sm:h-44', avatar: 76, delay: '.05s' },
  2: { tone: 'silver', order: 'order-1', pillar: 'h-24 sm:h-36', avatar: 60, delay: '.2s' },
  3: { tone: 'bronze', order: 'order-3', pillar: 'h-20 sm:h-28', avatar: 60, delay: '.35s' },
};

function Slot({ row, place, metric }: { row: RankedRow; place: Place; metric: Metric }) {
  const cfg = PLACE[place];
  const value = metric.value(row);
  const decimals = metric.key === 'accuracy' && value % 1 ? 1 : 0;
  const suffix = metric.key === 'accuracy' ? '%' : metric.key === 'points' ? ' pts' : metric.key === 'streak' ? ' d' : ' q';
  return <div className={`lm-slot ${cfg.order}`} data-testid={`podium-place-${place}`}>
    <div className="relative flex flex-col items-center">
      {place === 1 && <Crown size={30} className="lm-crown mb-1.5" fill="currentColor" />}
      <LmAvatar name={row.name} text={initials(row.name)} size={cfg.avatar} ring={cfg.tone} />
    </div>
    <div className="mt-2.5 flex max-w-full flex-col items-center px-1 text-center">
      <div className="max-w-[96px] truncate text-xs font-extrabold text-white sm:max-w-[160px] sm:text-sm">{row.name}</div>
      {row.isYou && <span className="mt-0.5 rounded-full bg-white/20 px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide text-white">you</span>}
      {row.institution && <div className="max-w-[96px] truncate text-[9px] font-semibold text-white/50 sm:max-w-[160px] sm:text-[10px]">{row.institution}</div>}
      <div className={`lm-chip lm-chip--${cfg.tone} mt-2 font-mono-app tabular-nums`}><Count value={value} decimals={decimals} suffix={suffix} /></div>
      {metric.key !== 'streak' && (row.currentStreak ?? 0) > 0 && <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-orange-400/20 px-2 py-0.5 text-[10px] font-extrabold text-orange-200"><Flame size={10} fill="currentColor" />{row.currentStreak}</div>}
    </div>
    <div className={`lm-pillar lm-pillar--${cfg.tone} ${cfg.pillar} mt-3`} style={{ ['--d' as string]: cfg.delay }}>
      <span className="lm-pillar__num">{place}</span>
    </div>
  </div>;
}

export function Podium3D({ rows, metric }: { rows: RankedRow[]; metric: Metric }) {
  const [first, second, third] = rows;
  if (!first) return null;
  return <div id="lb-podium" className="lm-stage mt-5 overflow-hidden rounded-[1.75rem] px-3 pt-9 sm:px-8" data-testid="podium">
    <span className="lm-stage__glow" aria-hidden="true" />
    <div className="relative flex items-end justify-center gap-2 sm:gap-5">
      {second && <Slot row={second} place={2} metric={metric} />}
      <Slot row={first} place={1} metric={metric} />
      {third && <Slot row={third} place={3} metric={metric} />}
    </div>
  </div>;
}
