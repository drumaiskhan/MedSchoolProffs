// Countdown that lives OUTSIDE React state.
//
// Practice used `useState` for the remaining seconds and ticked it once a
// second, so the ENTIRE Practice page (question, options, palette, panels)
// re-rendered every second of a timed session — the source of the "taps feel
// late while the timer runs" lag. The seconds now live in a tiny store; only
// <CountdownBadge> subscribes, so a tick re-renders one <span>.
import { useCallback, useRef, useSyncExternalStore } from 'react';
import { Clock3 } from 'lucide-react';
import { cn } from '@/lib/shared';

export interface CountdownStore {
  get: () => number;
  set: (next: number | ((prev: number) => number)) => void;
  subscribe: (fn: () => void) => () => void;
}

/** Stable per-component store; the owner never re-renders when it ticks. */
export function useCountdownStore(initial = 0): CountdownStore {
  const ref = useRef<CountdownStore | null>(null);
  if (!ref.current) {
    let value = initial;
    const subs = new Set<() => void>();
    ref.current = {
      get: () => value,
      set: (next) => {
        const v = typeof next === 'function' ? next(value) : next;
        if (v === value) return;
        value = v;
        subs.forEach((fn) => fn());
      },
      subscribe: (fn) => { subs.add(fn); return () => { subs.delete(fn); }; },
    };
  }
  return ref.current;
}

export function CountdownBadge({ store, className, warnBelow = 60, warnClass, okClass }: { store: CountdownStore; className?: string; warnBelow?: number; warnClass: string; okClass: string }) {
  const sub = useCallback((fn: () => void) => store.subscribe(fn), [store]);
  const seconds = useSyncExternalStore(sub, store.get, store.get);
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return <span className={cn(className, seconds < warnBelow ? warnClass : okClass)} data-testid="text-timer">{mm}:{ss}</span>;
}

/** Modern clock chip used by the timed exams: a draining ring + mm:ss (turns amber, then red and pulsing under 1 min). */
export function ExamClock({ store, total = 0 }: { store: CountdownStore; total?: number }) {
  const sub = useCallback((fn: () => void) => store.subscribe(fn), [store]);
  const seconds = useSyncExternalStore(sub, store.get, store.get);
  const base = Math.max(total, seconds, 1);
  const frac = Math.max(0, Math.min(1, seconds / base));
  const low = seconds < 60;
  const color = low ? '#e0584a' : frac < 0.25 ? '#f2b93b' : '#2f9e6e';
  const R = 15; const C = 2 * Math.PI * R;
  const hh = Math.floor(seconds / 3600);
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const label = hh > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
  return (
    <div className={cn('flex shrink-0 items-center gap-2 rounded-2xl py-1.5 pl-1.5 pr-3.5 transition-colors', low ? 'bg-[#e0584a]/10' : 'bg-muted/70')} role="timer" aria-label={`${label} remaining`}>
      <div className={cn('relative size-9 shrink-0', low && 'animate-pulse')}>
        <svg viewBox="0 0 36 36" className="size-full -rotate-90">
          <circle cx="18" cy="18" r={R} fill="none" stroke="currentColor" strokeWidth="3.5" className="text-border" />
          <circle cx="18" cy="18" r={R} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} style={{ transition: 'stroke-dashoffset 1s linear, stroke .4s' }} />
        </svg>
        <Clock3 size={12} className="absolute inset-0 m-auto" style={{ color }} />
      </div>
      <span className="font-mono-app text-base font-extrabold tabular-nums leading-none" style={{ color: low ? color : undefined }}>{label}</span>
    </div>
  );
}

/**
 * Modern practice timer: a circular progress ring around a big mm:ss readout.
 * The ring drains as time runs out and shifts calm green -> amber -> red; the
 * last minute pulses. Subscribes to the store itself, so a tick re-renders
 * only this component (same reason as CountdownBadge above).
 */
export function PracticeTimer({ store, total, paused = false }: { store: CountdownStore; total: number; paused?: boolean }) {
  const sub = useCallback((fn: () => void) => store.subscribe(fn), [store]);
  const seconds = useSyncExternalStore(sub, store.get, store.get);
  const base = Math.max(total, seconds, 1);
  const frac = Math.max(0, Math.min(1, seconds / base));
  const low = seconds < 60;
  const mid = !low && frac < 0.25;
  const color = low ? '#e0584a' : mid ? '#f2b93b' : '#2f9e6e';
  const R = 26; const C = 2 * Math.PI * R;
  const hh = Math.floor(seconds / 3600);
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const label = hh > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
  const minsLeft = Math.ceil(seconds / 60);
  return (
    <div className={cn('flex items-center gap-3 rounded-2xl p-2.5 transition-colors', low ? 'bg-[#e0584a]/10' : 'bg-muted/60')} data-testid="text-timer" role="timer" aria-label={`${label} remaining`}>
      <div className={cn('relative size-16 shrink-0', low && !paused && 'animate-pulse')}>
        <svg viewBox="0 0 64 64" className="size-full -rotate-90">
          <circle cx="32" cy="32" r={R} fill="none" stroke="currentColor" strokeWidth="5" className="text-border" />
          <circle cx="32" cy="32" r={R} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} style={{ transition: 'stroke-dashoffset 1s linear, stroke .4s' }} />
        </svg>
        <Clock3 size={16} className="absolute inset-0 m-auto" style={{ color }} />
      </div>
      <div className="min-w-0">
        <div className="font-mono-app text-2xl font-extrabold leading-none tabular-nums tracking-tight" style={{ color: low ? color : undefined }}>{label}</div>
        <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{paused ? 'Paused' : low ? 'Hurry up!' : `${minsLeft} min left`}</div>
      </div>
    </div>
  );
}
