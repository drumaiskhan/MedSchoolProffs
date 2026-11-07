// Small presentational pieces for the modern leaderboard: a gradient avatar
// (colour picked from the name so a student always looks the same) and a flat
// rank badge. Pure CSS — no 3D, no images to load.
import type { ReactNode } from 'react';

const GRADIENTS = [
  ['#6366f1', '#8b5cf6'], ['#0ea5e9', '#6366f1'], ['#10b981', '#0ea5e9'], ['#f59e0b', '#ef4444'],
  ['#ec4899', '#8b5cf6'], ['#14b8a6', '#22c55e'], ['#f97316', '#ec4899'], ['#3b82f6', '#14b8a6'],
] as const;

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function LmAvatar({ name, text, size = 44, ring, className = '' }: { name: string; text: string; size?: number; ring?: 'gold' | 'silver' | 'bronze'; className?: string }) {
  const [a, b] = GRADIENTS[hash(name) % GRADIENTS.length];
  const disc = <span className={`lm-avatar ${className}`} style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.36)), backgroundImage: `linear-gradient(135deg, ${a}, ${b})` }}>{text}</span>;
  return ring ? <span className={`lm-ring lm-ring--${ring}`}>{disc}</span> : disc;
}

export function LmRank({ place, tone, size = 34, children }: { place?: number | null; tone: 'gold' | 'silver' | 'bronze' | 'you' | 'plain'; size?: number; children?: ReactNode }) {
  return <span className={`lm-rank lm-rank--${tone}`} style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.4)) }}>{children ?? place ?? '–'}</span>;
}
