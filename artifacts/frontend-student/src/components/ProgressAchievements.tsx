// Achievements for "My progress" / the Profile → Achievements tab.
//
// Layout: a dark showcase stage (unlock ring, clinical rank, tier shelf and
// the "next up" badge) → filter tabs with live counts → badges grouped by
// category. Every badge is a minted coin (metal rim, ridged edge, face,
// shine sweep); locked ones get a progress ring around the coin.
//
// 3D rules are the same as the rest of the student UI (see lib/fx.ts): the
// only real 3D transform is the small pointer tilt from <TiltDiv>, applied to
// the one hovered card. Everything else is gradients, layered shadows and 2D
// motion. Styles live in premium3d.css; colours come from the app tokens plus
// the five metal palettes below.
import { useId, useMemo, useState, type CSSProperties } from 'react';
import { Award, Flame, Lock, Sparkles, Star, Target, Trophy, type LucideIcon } from 'lucide-react';
import type { ProgressOverview } from '@/lib/api';
import { cn } from '@/lib/shared';
import { Count, SegTabs } from '@/lib/fx3d';
import { TiltDiv } from '@/lib/tilt';
import { computeProgressAchievements, profileRank, type ProgressAchievement, type ProgressCategory } from '@/lib/progressAchievements';
import { useAchievementConfig } from '@/lib/useAchievementConfig';

const TIERS = [
  { name: 'Bronze', t1: '#fde6cf', t2: '#dc9a5e', t3: '#91541f', ink: '#4a2a0f', h: 28 },
  { name: 'Silver', t1: '#f5f7fa', t2: '#c5cdd8', t3: '#7c8898', ink: '#33404f', h: 215 },
  { name: 'Gold', t1: '#fff3bf', t2: '#f2c94c', t3: '#b98512', ink: '#5a3f05', h: 44 },
  { name: 'Platinum', t1: '#c9f7ee', t2: '#6fd6c0', t3: '#1e8a86', ink: '#0b3d3b', h: 172 },
  { name: 'Legend', t1: '#eadcff', t2: '#a67be0', t3: '#5f3aa3', ink: '#2d1259', h: 265 },
] as const;

const CATEGORIES: Array<{ id: ProgressCategory; icon: LucideIcon; blurb: string }> = [
  { id: 'Practice', icon: Target, blurb: 'Volume, sessions and time on task' },
  { id: 'Streaks', icon: Flame, blurb: 'Showing up day after day' },
  { id: 'Mastery', icon: Star, blurb: 'Accuracy and depth in a subject' },
  { id: 'Milestones', icon: Award, blurb: 'Past papers and Pre-Proffs exams' },
];

type Filter = 'All' | 'Unlocked' | 'In progress' | ProgressCategory;
const FILTERS: Filter[] = ['All', 'Unlocked', 'In progress', 'Practice', 'Streaks', 'Mastery', 'Milestones'];

const matches = (a: ProgressAchievement, f: Filter) =>
  f === 'All' ? true : f === 'Unlocked' ? a.earned : f === 'In progress' ? !a.earned && a.progress > 0 : a.category === f;

const tierOf = (tier: number) => TIERS[Math.min(tier, TIERS.length - 1)];
const tierVars = (tier: number) => { const t = tierOf(tier); return { '--t1': t.t1, '--t2': t.t2, '--t3': t.t3, '--ink': t.ink, '--h': t.h } as CSSProperties; };

/** Minted coin. `progress` (0..1) draws a ring around a locked coin. */
function CoinMedal({ tier, earned, progress = 0, icon: Icon, size = 52, className }: {
  tier: number; earned: boolean; progress?: number; icon: LucideIcon; size?: number; className?: string;
}) {
  const R = 47, C = 2 * Math.PI * R;
  return <span className={cn('ach-medal', earned ? 'ach-medal--on' : 'ach-medal--off', className)} style={{ ...tierVars(tier), '--s': `${size}px` } as CSSProperties}>
    {!earned && progress > 0 && <svg className="ach-medal__ring" viewBox="0 0 100 100" aria-hidden="true">
      <circle className="ach-medal__ring-bg" cx="50" cy="50" r={R} />
      <circle className="ach-medal__ring-fg" cx="50" cy="50" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(1, progress))} />
    </svg>}
    <span className="ach-medal__rim" /><span className="ach-medal__face" />
    <span className="ach-medal__icon">{earned ? <Icon size={Math.round(size * 0.42)} strokeWidth={2.2} /> : <Lock size={Math.round(size * 0.32)} strokeWidth={2.4} />}</span>
    {earned && <span className="ach-medal__shine" aria-hidden="true" />}
  </span>;
}

function BadgeCard({ a, isNext, index }: { a: ProgressAchievement; isNext: boolean; index: number }) {
  const t = tierOf(a.tier);
  const pct = Math.round(a.progress * 100);
  return <TiltDiv className={cn('ach-card', a.earned && 'ach-card--on', isNext && 'ach-card--next')} testId={`progress-achievement-${a.id}`}
    style={{ ...tierVars(a.tier), '--i': index, '--tilt': 7, '--fx-r': '1.25rem' } as CSSProperties}>
    <div className="flex items-start gap-3">
      <CoinMedal tier={a.tier} earned={a.earned} progress={a.progress} icon={a.icon} size={54} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-[13px] font-extrabold leading-4', !a.earned && 'text-muted-foreground')}>{a.label}</p>
          {isNext && <span className="ach-next-tag shrink-0">Next up</span>}
        </div>
        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{a.hint}</p>
        {a.earned
          ? <span className="ach-chip mt-2.5"><Sparkles size={11} />{t.name} · unlocked</span>
          : <div className="mt-2.5">
            <div className="ach-meter"><i style={{ width: `${pct}%` }} /></div>
            <div className="mt-1 flex items-center justify-between text-[10px] font-bold tabular-nums text-muted-foreground"><span>{a.current}/{a.target}</span><span>{pct}%</span></div>
          </div>}
      </div>
    </div>
  </TiltDiv>;
}

function Showcase({ all, next, ranks }: { all: ProgressAchievement[]; next: ProgressAchievement | undefined; ranks: Parameters<typeof profileRank>[1] }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const earned = all.filter((a) => a.earned).length;
  const frac = all.length ? earned / all.length : 0;
  const rank = profileRank(earned, ranks);
  const R = 52, C = 2 * Math.PI * R;
  const perTier = TIERS.map((t, i) => ({ ...t, i, n: all.filter((a) => a.earned && Math.min(a.tier, TIERS.length - 1) === i).length, of: all.filter((a) => Math.min(a.tier, TIERS.length - 1) === i).length }));
  return <section className="lb-hero ach-hero rounded-[1.75rem] p-4 sm:p-6" data-testid="section-progress-achievements">
    <div className="hero-grid" />
    <div className="orb -left-16 -top-24 size-72 bg-[#f5a623]" style={{ opacity: 0.2 }} />
    <div className="orb -bottom-28 right-6 size-64 bg-[hsl(var(--sidebar-primary))]" style={{ opacity: 0.22, animationDelay: '-6s' }} />
    <div className="relative grid gap-5 lg:grid-cols-[auto_1fr] lg:items-center">
      <div className="flex items-center gap-4 sm:gap-5">
        <div className="ach-ring">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <defs><linearGradient id={`ar${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff3bf" /><stop offset=".55" stopColor="#f2c94c" /><stop offset="1" stopColor="#f08a24" /></linearGradient></defs>
            <circle className="ach-ring__bg" cx="60" cy="60" r={R} />
            <circle className="ach-ring__fg" cx="60" cy="60" r={R} stroke={`url(#ar${uid})`} strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
          </svg>
          <div className="relative text-center leading-none">
            <div className="font-display text-4xl tabular-nums text-white"><Count value={earned} /></div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-[.14em] text-white/55">of {all.length}</div>
          </div>
        </div>
        <div className="min-w-0 lg:hidden">
          <div className="font-mono-app text-[10px] font-bold uppercase tracking-[.18em] text-[#ffd98a]">Your rank</div>
          <div className="font-display text-3xl leading-tight text-white">{rank.name}</div>
        </div>
      </div>

      <div className="grid gap-3.5">
        <div className="hidden lg:block">
          <div className="font-mono-app text-[10px] font-bold uppercase tracking-[.18em] text-[#ffd98a]">Your rank · Level {rank.level}</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3"><span className="font-display text-4xl leading-tight text-white">{rank.name}</span>
            <span className="text-xs font-bold text-white/65">{rank.next ? `${rank.toNext} more badge${rank.toNext === 1 ? '' : 's'} to ${rank.next}` : 'Top rank reached — legend'}</span></div>
        </div>
        <div className="lg:hidden text-xs font-bold text-white/65">{rank.next ? `${rank.toNext} more badge${rank.toNext === 1 ? '' : 's'} to ${rank.next}` : 'Top rank reached — legend'}</div>
        <div className="ach-bar"><i style={{ width: `${Math.round(rank.pct * 100)}%` }} /></div>

        <div className="ach-shelf" aria-label="Badges unlocked per tier">
          {perTier.map((t) => <div key={t.name} className="ach-shelf__item lb-tile" data-zero={t.n === 0} title={`${t.name}: ${t.n} of ${t.of}`}>
            <CoinMedal tier={t.i} earned icon={Trophy} size={36} />
            <div className="text-sm font-extrabold leading-none tabular-nums text-white">{t.n}<span className="text-[10px] font-bold text-white/40">/{t.of}</span></div>
            <div className="text-[9px] font-bold uppercase tracking-[.1em] text-white/50">{t.name}</div>
          </div>)}
        </div>

        {next ? <div className="lb-tile flex items-center gap-3 px-3.5 py-3" data-testid="card-next-achievement">
          <CoinMedal tier={next.tier} earned={false} progress={next.progress} icon={next.icon} size={46} />
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[#ffd98a]">Closest to unlocking</div>
            <div className="truncate text-[13px] font-extrabold text-white">{next.label}</div>
            <div className="mt-1.5 flex items-center gap-2"><div className="ach-bar ach-bar--thin flex-1"><i style={{ width: `${Math.round(next.progress * 100)}%` }} /></div><span className="text-[10px] font-bold tabular-nums text-white/60">{next.current}/{next.target}</span></div>
          </div>
        </div> : <div className="lb-tile px-3.5 py-3 text-xs font-bold text-white/75">Every badge unlocked — nothing left to chase. 🏆</div>}
      </div>
    </div>
  </section>;
}

export function ProgressAchievements({ overview }: { overview: ProgressOverview }) {
  const [filter, setFilter] = useState<Filter>('All');
  const cfg = useAchievementConfig();
  const all = useMemo(() => computeProgressAchievements(overview, cfg), [overview, cfg]);
  const next = useMemo(() => all.filter((a) => !a.earned).sort((x, y) => y.progress - x.progress)[0], [all]);
  const shown = all.filter((a) => matches(a, filter));
  let running = 0;

  return <div data-testid="section-progress-achievements-wrap">
    <Showcase all={all} next={next} ranks={cfg.ranks} />

    <SegTabs<Filter> ariaLabel="Filter achievements" scroll className="mt-5" value={filter} onChange={setFilter}
      options={FILTERS.map((f) => ({
        value: f, testId: `filter-progress-achievements-${f.toLowerCase().replace(/\s+/g, '-')}`,
        label: <>{f}<span className="ach-count">{all.filter((a) => matches(a, f)).length}</span></>,
      }))} />

    <div key={filter}>
      {CATEGORIES.map((cat) => {
        const items = shown.filter((a) => a.category === cat.id);
        if (!items.length) return null;
        const inCat = all.filter((a) => a.category === cat.id);
        const done = inCat.filter((a) => a.earned).length;
        return <section key={cat.id} className="ach-sec" aria-label={cat.id}>
          <div className="ach-sec__head">
            <span className="ach-sec__icon"><cat.icon size={16} /></span>
            <div className="min-w-0 flex-1"><h3 className="font-display text-base leading-tight">{cat.id}</h3><p className="text-[11px] text-muted-foreground">{cat.blurb}</p></div>
            <div className="w-24 shrink-0 text-right"><div className="text-[10px] font-extrabold tabular-nums text-muted-foreground">{done}/{inCat.length}</div><div className="ach-meter mt-1"><i style={{ width: `${Math.round((done / inCat.length) * 100)}%` }} /></div></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((a) => <BadgeCard key={a.id} a={a} isNext={next?.id === a.id} index={running++} />)}
          </div>
        </section>;
      })}
    </div>
    {!shown.length && <p className="py-10 text-center text-xs text-muted-foreground">Nothing here yet — practise a bit and badges will start unlocking.</p>}
  </div>;
}
