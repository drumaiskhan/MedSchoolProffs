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

/** Clock chip used by the timed exams (same markup they had inline). */
export function ExamClock({ store }: { store: CountdownStore }) {
  const sub = useCallback((fn: () => void) => store.subscribe(fn), [store]);
  const seconds = useSyncExternalStore(sub, store.get, store.get);
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return <div className={cn('flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-extrabold tabular-nums', seconds < 60 ? 'bg-destructive/10 text-destructive' : 'bg-muted')}><Clock3 size={13} /> {mm}:{ss}</div>;
}
