// v59 — 3D profile hero + membership pass. Presentational; styles live in profile3d.css.
import { Link } from 'wouter';
import { useId } from 'react';
import { Award, CheckCircle2, Clock3, Crown, Flame, ShieldCheck, Sparkles, Target, Wifi } from 'lucide-react';
import { useGetStudentDashboard } from '@workspace/api-client-react';
import { TiltDiv } from '@/lib/tilt';
import { Count } from '@/lib/fx3d';
import { cn, initials } from '@/lib/shared';
import type { ProfileRank } from '@/lib/progressAchievements';

const daysLeft = (iso?: string | null) => iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)) : null;

export function ProfileHero({ name, programYear, avatarUrl, isActive, streak, progress, days, rank, earned, total }: {
  name: string; programYear: string; avatarUrl?: string | null; isActive: boolean; streak: number; progress: number; days: number | null;
  /** Clinical rank from unlocked badges (optional — the hero still renders without it). */
  rank?: ProfileRank | null; earned?: number; total?: number;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const R = 46, C = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  const stats = [
    { icon: Flame, label: 'Day streak', value: streak, suffix: '' },
    { icon: Target, label: 'Progress', value: pct, suffix: '%' },
    { icon: Crown, label: isActive ? 'Days left' : 'Membership', value: days ?? 0, suffix: '', text: isActive ? undefined : 'Inactive' },
  ];
  return <TiltDiv className="pf-hero pfx-hero" testId="card-profile-hero" style={{ '--tilt': 3 } as never}>
    <div className="pf-hero__body">
      <span className="pfx-aurora" /><span className="pf-orb pf-orb--a" /><span className="pf-orb pf-orb--b" /><span className="pf-grid" /><span className="pfx-spot" />
      <div className="relative flex flex-wrap items-center gap-5">
        <div className="pfx-avatar-wrap">
          <svg viewBox="0 0 100 100" className="pfx-avatar-ring" aria-hidden="true">
            <defs><linearGradient id={`pa${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffe08a" /><stop offset=".55" stopColor="#5ef0c0" /><stop offset="1" stopColor="#6aa4ff" /></linearGradient></defs>
            <circle className="pfx-ring-bg" cx="50" cy="50" r={R} />
            <circle className="pfx-ring-fg" cx="50" cy="50" r={R} stroke={`url(#pa${uid})`} strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} />
          </svg>
          <div className="pf-avatar">
            {avatarUrl ? <img src={avatarUrl} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : <span>{initials(name)}</span>}
          </div>
          {rank && <span className="pfx-level" data-testid="badge-profile-level">Lv {rank.level}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[.16em] text-[#9fe9d2]">Student profile</div>
          <h2 className="mt-1 truncate font-display text-3xl leading-tight">{name}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="pf-chip"><Sparkles size={12} /> {programYear}</span>
            <span className="pf-chip">{isActive ? <CheckCircle2 size={12} className="text-[#5ef0c0]" /> : <Clock3 size={12} className="text-[#ffd27a]" />}{isActive ? 'Active member' : 'Pending activation'}</span>
            {rank && <span className="pf-chip pfx-chip-rank"><Award size={12} /> {rank.name}</span>}
          </div>
        </div>
      </div>

      <div className="relative mt-5 grid grid-cols-3 gap-2.5">
        {stats.map(({ icon: Icon, label, value, suffix, text }) => <div key={label} className="pf-stat pfx-stat">
          <span className="pfx-puck"><Icon size={15} /></span>
          <div className="min-w-0">
            <div className="font-display text-2xl leading-none">{text ?? <Count value={value} suffix={suffix} />}</div>
            <div className="mt-1 truncate text-[10px] font-bold uppercase tracking-wide text-[#b8ecdc]">{label}</div>
          </div>
        </div>)}
      </div>

      {rank && <div className="relative mt-4" data-testid="profile-rank-progress">
        <div className="flex items-center justify-between gap-3 text-[10px] font-extrabold uppercase tracking-[.1em] text-[#b8ecdc]">
          <span>{rank.name}{earned != null && total ? <span className="ml-1.5 text-white/50">· {earned}/{total} badges</span> : null}</span>
          <span className="truncate text-white/60">{rank.next ? `${rank.toNext} to ${rank.next}` : 'Top rank'}</span>
        </div>
        <div className="pfx-bar mt-1.5"><i style={{ width: `${Math.round(rank.pct * 100)}%` }} /></div>
      </div>}
    </div>
  </TiltDiv>;
}

/** Credit-card style membership pass. Reads its own status from the dashboard. */
export function MembershipPass({ payments = [], name, manageHref }: { payments?: { planName: string; status: string }[]; name?: string; manageHref?: string }) {
  const d = useGetStudentDashboard().data;
  const isActive = d?.membershipStatus === 'ACTIVE';
  const days = daysLeft(d?.membershipExpiry);
  const pending = payments.find((p) => p.status === 'pending');
  const plan = payments.find((p) => p.status === 'approved')?.planName;
  const warn = isActive && days !== null && days <= 7;
  const R = 34, C = 2 * Math.PI * R;
  const frac = isActive && days !== null ? Math.min(1, days / 90) : 0; // ring fills toward a 90-day window
  const expiry = d?.membershipExpiry ? new Date(d.membershipExpiry).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  return <TiltDiv className={cn('pf-pass', warn && 'pf-pass--warn', !isActive && 'pf-pass--off')} testId="card-subscription-status" style={{ '--tilt': 5 } as never}>
    <div className="pf-pass__body">
      <span className="pf-pass__holo" /><span className="pfx-pass__sheen" aria-hidden="true" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3"><div className="pf-pass__chip" /><Wifi size={18} className="pfx-contactless" aria-hidden="true" /></div>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-white/70"><ShieldCheck size={12} /> Membership pass</div>
          <div className="mt-1 font-display text-2xl leading-tight">{isActive ? (plan ?? 'Active member') : pending ? 'Awaiting approval' : 'Not activated'}</div>
        </div>
        <div className="relative grid size-[5.5rem] place-items-center">
          <svg viewBox="0 0 80 80" className="pf-ring absolute inset-0 size-full" aria-hidden="true">
            <circle className="pf-ring__bg" cx="40" cy="40" r={R} strokeWidth="6" />
            <circle className="pf-ring__fg" cx="40" cy="40" r={R} strokeWidth="6" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
          </svg>
          <div className="text-center leading-none"><div className="font-display text-2xl">{isActive && days !== null ? <Count value={days} /> : '—'}</div><div className="mt-0.5 text-[8px] font-bold uppercase tracking-wide text-white/70">days left</div></div>
        </div>
      </div>
      <div className="relative mt-5 flex items-end justify-between gap-3 text-xs">
        <div><div className="text-[9px] font-bold uppercase tracking-[.14em] text-white/55">Member</div><div className="mt-0.5 font-bold tracking-wide">{name ?? d?.user?.name ?? 'Student'}</div></div>
        <div className="text-right"><div className="text-[9px] font-bold uppercase tracking-[.14em] text-white/55">{isActive ? 'Valid until' : 'Status'}</div><div className="mt-0.5 font-bold">{isActive ? (expiry ?? '—') : pending ? 'In review' : 'Choose a plan'}</div></div>
        {manageHref && <Link href={manageHref} className="no-3d rounded-xl bg-white/15 px-3 py-2 text-[11px] font-extrabold backdrop-blur transition-colors hover:bg-white/25" data-testid="link-manage-membership">Manage</Link>}
      </div>
    </div>
  </TiltDiv>;
}
