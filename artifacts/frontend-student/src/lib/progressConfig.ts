// One home for every number and colour name the Progress page used to hardcode
// inline. The page itself only ever renders values that come from
// GET /student/progress-overview; this file just says how to *judge* them
// (score bands, what counts as a real trend) so a threshold changes in one place.
// Colours are never literals here — they are the --tone-* tokens in premium3d.css.

/** Score bands for "how am I doing": >= good is green, >= fair is amber, below is red. */
export const SCORE_BANDS = { good: 70, fair: 50 } as const;

/** A change smaller than this many points reads as "holding steady" (matches the API's own up/down/flat cut-off). */
export const TREND_POINTS = 3;

export type Tone = 'good' | 'fair' | 'bad' | 'none';

export const toneOf = (n: number | null | undefined): Tone =>
  n == null ? 'none' : n >= SCORE_BANDS.good ? 'good' : n >= SCORE_BANDS.fair ? 'fair' : 'bad';

/** CSS colour for a tone (theme-aware token, defined for light + dark). */
export const toneColor = (t: Tone | 'info' | 'violet') => (t === 'none' ? 'hsl(var(--muted-foreground) / .35)' : `hsl(var(--tone-${t}))`);

export const pctText = (n: number | null | undefined) => (n == null ? '—' : `${Math.round(n)}%`);

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export const fmtMinutes = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
