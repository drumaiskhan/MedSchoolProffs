// Celebration toast for newly-earned "My progress" achievements.
//
// Achievements are computed client-side from the progress overview (see
// lib/progressAchievements.ts), so "newly earned" = an id that is earned now
// but isn't in this student's locally-stored "seen" list. Behaviour:
//   • First run on a device only records a silent baseline (no toast flood
//     for badges the student already had).
//   • While the student is on the Profile page (where the Achievements
//     gallery lives) nothing pops up — they're just marked as seen.
//   • Never shown during exams / focus mode; it waits until they leave.
//   • Swipe left or right (or tap ×) to dismiss; auto-dismisses after a few
//     seconds. Tap the card to open Profile → Achievements.
//   • Respects prefers-reduced-motion (no confetti / bounce, simple fade).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { useLocation } from 'wouter';
import { analyticsApi } from '@/lib/api';
import { computeProgressAchievements, type ProgressAchievement } from '@/lib/progressAchievements';
import { useAchievementConfig } from '@/lib/useAchievementConfig';

const TIERS = [
  { name: 'Bronze', from: 'hsl(28 62% 58%)', to: 'hsl(24 55% 38%)' },
  { name: 'Silver', from: 'hsl(210 14% 80%)', to: 'hsl(212 10% 52%)' },
  { name: 'Gold', from: 'hsl(44 92% 66%)', to: 'hsl(34 78% 44%)' },
  { name: 'Platinum', from: 'hsl(164 55% 68%)', to: 'hsl(190 45% 40%)' },
  { name: 'Legend', from: 'hsl(271 60% 72%)', to: 'hsl(258 50% 45%)' },
];
const CONFETTI = ['#f5c542', '#ef6f6c', '#4cc9a4', '#5aa9e6', '#b388eb', '#ff9f68'];
const AUTO_DISMISS_MS = 7000;
const SWIPE_PX = 70;

const storageKey = (userId: number | string) => `msp-ach-seen:${userId}`;
function readSeen(userId: number | string): Set<string> | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? new Set<string>(JSON.parse(raw)) : null;
  } catch { return null; }
}
function writeSeen(userId: number | string, ids: Iterable<string>) {
  try { localStorage.setItem(storageKey(userId), JSON.stringify([...ids])); } catch { /* storage unavailable */ }
}

function ConfettiBurst() {
  const pieces = useMemo(() => Array.from({ length: 18 }, (_, i) => {
    const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 46 + Math.random() * 44;
    return {
      x: Math.cos(angle) * dist, y: Math.sin(angle) * dist - 10, rot: Math.random() * 540 - 270,
      color: CONFETTI[i % CONFETTI.length], w: 5 + Math.random() * 4, h: 3 + Math.random() * 5,
      delay: Math.random() * 0.12,
    };
  }), []);
  return <span aria-hidden className="pointer-events-none absolute left-9 top-1/2 size-0">
    {pieces.map((p, i) => <motion.span key={i}
      className="absolute rounded-[1px]"
      style={{ width: p.w, height: p.h, background: p.color }}
      initial={{ x: 0, y: 0, opacity: 1, scale: 0.4, rotate: 0 }}
      animate={{ x: p.x, y: [0, p.y, p.y + 38], opacity: [1, 1, 0], scale: 1, rotate: p.rot }}
      transition={{ duration: 1.25, delay: p.delay, ease: 'easeOut' }} />)}
  </span>;
}

function Toast({ a, remaining, onDismiss, onOpen }: { a: ProgressAchievement; remaining: number; onDismiss: () => void; onOpen: () => void }) {
  const reduce = useReducedMotion();
  const t = TIERS[Math.min(a.tier, TIERS.length - 1)];
  const Icon = a.icon;
  const timer = useRef<number | undefined>(undefined);
  const arm = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(onDismiss, AUTO_DISMISS_MS); };
  useEffect(() => { arm(); return () => window.clearTimeout(timer.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <motion.div
    role="status" aria-live="polite"
    drag="x" dragElastic={0.6} dragConstraints={{ left: 0, right: 0 }}
    onDragStart={() => window.clearTimeout(timer.current)}
    onDragEnd={(_, info) => {
      if (Math.abs(info.offset.x) > SWIPE_PX || Math.abs(info.velocity.x) > 500) onDismiss(); else arm();
    }}
    initial={reduce ? { opacity: 0 } : { y: -90, opacity: 0, scale: 0.92 }}
    animate={reduce ? { opacity: 1 } : { y: 0, opacity: 1, scale: 1 }}
    exit={reduce ? { opacity: 0 } : { opacity: 0, x: 0, scale: 0.95, transition: { duration: 0.18 } }}
    transition={{ type: 'spring', stiffness: 380, damping: 26 }}
    className="pointer-events-auto relative w-full max-w-sm touch-pan-y select-none overflow-hidden rounded-2xl border border-primary/30 bg-card/95 shadow-2xl backdrop-blur-md"
    style={{ boxShadow: `0 18px 40px -14px ${t.to}` }}
    data-testid={`toast-achievement-${a.id}`}>
    <span aria-hidden className="pointer-events-none absolute inset-0 opacity-20" style={{ background: `linear-gradient(110deg, transparent 20%, ${t.from} 50%, transparent 80%)` }} />
    {!reduce && <motion.span aria-hidden className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-white/25"
      initial={{ left: '-40%' }} animate={{ left: '130%' }} transition={{ duration: 1.1, delay: 0.25, ease: 'easeInOut' }} />}
    {!reduce && <ConfettiBurst />}
    <button type="button" onClick={onOpen} className="relative flex w-full items-center gap-3 p-3.5 pr-10 text-left">
      <motion.span
        className="relative grid size-12 shrink-0 place-items-center rounded-full"
        style={{ background: `radial-gradient(circle at 30% 25%, ${t.from}, ${t.to})`, boxShadow: `0 6px 14px -4px ${t.to}, inset 0 2px 2px hsl(0 0% 100% / .55), inset 0 -3px 5px hsl(0 0% 0% / .25)` }}
        initial={reduce ? false : { scale: 0, rotate: -40 }}
        animate={reduce ? undefined : { scale: [0, 1.25, 1], rotate: [-40, 12, 0] }}
        transition={{ duration: 0.7, delay: 0.1 }}>
        <Icon size={22} strokeWidth={2.2} className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,.35)]" />
      </motion.span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-primary"><Sparkles size={11} /> Congratulations! · {t.name}</span>
        <span className="mt-0.5 block truncate whitespace-nowrap text-sm font-extrabold text-foreground">{a.label}</span>
        <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
          {a.hint}{remaining > 0 ? ` · +${remaining} more` : ''}
        </span>
      </span>
    </button>
    <button type="button" onClick={onDismiss} aria-label="Dismiss" className="absolute right-2 top-2 grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-muted">
      <X size={14} />
    </button>
    {!reduce && <motion.span aria-hidden className="absolute bottom-0 left-0 h-0.5 bg-primary/60"
      initial={{ width: '100%' }} animate={{ width: '0%' }} transition={{ duration: AUTO_DISMISS_MS / 1000, ease: 'linear' }} />}
  </motion.div>;
}

export function AchievementToaster({ userId, suspended }: { userId: number | string; suspended: boolean }) {
  const [location, setLocation] = useLocation();
  const onProfilePage = location === '/profile' || location.startsWith('/profile/');
  const q = useQuery({ queryKey: ['progress-overview'], queryFn: analyticsApi.overview, staleTime: 30_000, retry: false });
  const [queue, setQueue] = useState<ProgressAchievement[]>([]);
  const achCfg = useAchievementConfig();

  // Re-check (only if stale) whenever the student moves to another page, so a
  // badge earned at the end of a practice session shows up right after it.
  useEffect(() => { if (!suspended) void q.refetch(); }, [location]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!q.data) return;
    const earned = computeProgressAchievements(q.data, achCfg).filter((a) => a.earned);
    const seen = readSeen(userId);
    if (seen === null) { writeSeen(userId, earned.map((a) => a.id)); return; } // silent baseline
    const fresh = earned.filter((a) => !seen.has(a.id));
    if (!fresh.length) return;
    if (onProfilePage) { writeSeen(userId, [...seen, ...fresh.map((a) => a.id)]); return; } // gallery lives on Profile
    if (suspended) return; // exam / focus mode: wait
    writeSeen(userId, [...seen, ...fresh.map((a) => a.id)]);
    setQueue((cur) => [...cur, ...fresh.filter((f) => !cur.some((c) => c.id === f.id))]);
  }, [q.data, achCfg, userId, onProfilePage, suspended]);

  // Drop anything queued if the student lands on Profile or enters an exam.
  useEffect(() => { if (onProfilePage || suspended) setQueue([]); }, [onProfilePage, suspended]);

  const current = queue[0];
  return <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex justify-center px-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}>
    <AnimatePresence mode="wait">
      {current && <Toast key={current.id} a={current} remaining={queue.length - 1}
        onDismiss={() => setQueue((cur) => cur.slice(1))}
        onOpen={() => { setQueue([]); setLocation('/profile?tab=achievements'); }} />}
    </AnimatePresence>
  </div>;
}
