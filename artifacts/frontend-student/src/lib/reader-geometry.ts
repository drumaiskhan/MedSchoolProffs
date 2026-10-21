// Pure geometry for the secure reader's highlighting (kept apart from the page
// component so it can be unit-tested without a browser). Everything is in
// normalised page coordinates: 0..1 of the page's width/height.
import type { WordBox } from '@/lib/api';

export type Rect = { x: number; y: number; w: number; h: number };

/** Merges a run of word boxes into one rectangle per line of text. */
export function lineRects(words: WordBox[], start: number, end: number): Rect[] {
  const out: Rect[] = [];
  for (const [x, y, w, h] of words.slice(start, end + 1)) {
    const last = out[out.length - 1];
    if (last && Math.abs(y - last.y) < h * 0.6) {
      const right = Math.max(last.x + last.w, x + w);
      last.x = Math.min(last.x, x); last.w = right - last.x;
      const bottom = Math.max(last.y + last.h, y + h); last.y = Math.min(last.y, y); last.h = bottom - last.y;
    } else out.push({ x, y, w, h });
  }
  return out;
}

export function hitWord(words: WordBox[], nx: number, ny: number): number | null {
  let best: number | null = null, bestD = 0.03 * 0.03;
  for (let i = 0; i < words.length; i++) {
    const [x, y, w, h] = words[i];
    if (nx >= x - 0.004 && nx <= x + w + 0.004 && ny >= y - 0.004 && ny <= y + h + 0.004) return i;
    const dx = Math.max(x - nx, 0, nx - (x + w)), dy = Math.max(y - ny, 0, ny - (y + h));
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}


// ---- Pen strokes ------------------------------------------------------------
// A stroke is a list of [x, y] points in 0..1 page coordinates. `aspect` is page
// height / width, used so distances and widths stay uniform on non-square pages.
export type InkPts = Array<[number, number]>;

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay; const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Ramer–Douglas–Peucker thinning + rounding, capped at `max` points. */
export function simplifyInk(pts: InkPts, aspect: number, eps = 0.0007, max = 700): InkPts {
  if (pts.length <= 2) return pts.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]);
  const keep = new Array<boolean>(pts.length).fill(false); keep[0] = keep[pts.length - 1] = true;
  const stack: Array<[number, number]> = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!; let worst = 0, idx = -1;
    for (let i = a + 1; i < b; i++) { const d = segDist(pts[i][0], pts[i][1] * aspect, pts[a][0], pts[a][1] * aspect, pts[b][0], pts[b][1] * aspect); if (d > worst) { worst = d; idx = i; } }
    if (idx >= 0 && worst > eps) { keep[idx] = true; stack.push([a, idx], [idx, b]); }
  }
  let out = pts.filter((_, i) => keep[i]);
  if (out.length > max) { const step = out.length / max; out = Array.from({ length: max }, (_, i) => out[Math.min(out.length - 1, Math.floor(i * step))]); }
  return out.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]);
}

/** SVG path (in a viewBox of 0..1 wide, 0..aspect tall) with gentle curve smoothing. */
export function inkPath(pts: InkPts, aspect: number): string {
  if (!pts.length) return '';
  const r4 = (n: number) => Math.round(n * 10000) / 10000;
  const P = pts.map(([x, y]) => [r4(x), r4(y * aspect)] as const);
  if (P.length === 1) return `M${P[0][0]} ${P[0][1]}l0.0001 0`;
  if (P.length === 2) return `M${P[0][0]} ${P[0][1]}L${P[1][0]} ${P[1][1]}`;
  let d = `M${P[0][0]} ${P[0][1]}`;
  for (let i = 1; i < P.length - 1; i++) d += `Q${P[i][0]} ${P[i][1]} ${r4((P[i][0] + P[i + 1][0]) / 2)} ${r4((P[i][1] + P[i + 1][1]) / 2)}`;
  const last = P[P.length - 1]; return d + `L${last[0]} ${last[1]}`;
}

/** True when (x, y) is within `r` (in page-width units) of any part of the stroke. */
export function inkNear(pts: InkPts, x: number, y: number, aspect: number, r: number): boolean {
  const py = y * aspect;
  if (pts.length === 1) return Math.hypot(pts[0][0] - x, pts[0][1] * aspect - py) <= r;
  for (let i = 1; i < pts.length; i++) if (segDist(x, py, pts[i - 1][0], pts[i - 1][1] * aspect, pts[i][0], pts[i][1] * aspect) <= r) return true;
  return false;
}
