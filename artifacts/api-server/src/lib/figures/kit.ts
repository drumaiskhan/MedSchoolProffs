// Drawing helpers shared by the v84 figures (male.ts, systems.ts). Pure string builders, no DOM.

/** Extra shared gradients/patterns (ids start with hs-). Appended to SHARED_DEFS when figures are embedded. */
export const EXTRA_DEFS = `
<linearGradient id="hs-skintone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7d6b8"/><stop offset="1" stop-color="#d89f7a"/></linearGradient>
<linearGradient id="hs-scrotum-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6b79c"/><stop offset="1" stop-color="#b87a60"/></linearGradient>
<linearGradient id="hs-bone-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f8f0da"/><stop offset="1" stop-color="#cdbb90"/></linearGradient>
<linearGradient id="hs-erectile-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ea9a98"/><stop offset="1" stop-color="#b9545e"/></linearGradient>
<linearGradient id="hs-gland-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4c274"/><stop offset="1" stop-color="#c47f36"/></linearGradient>
<linearGradient id="hs-gut-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#efc3aa"/><stop offset="1" stop-color="#c88a72"/></linearGradient>
<linearGradient id="hs-fat-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fcefb8"/><stop offset="1" stop-color="#ebca6e"/></linearGradient>
<linearGradient id="hs-muscle-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d2706a"/><stop offset="1" stop-color="#8f3d40"/></linearGradient>
<linearGradient id="hs-testis-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0dba8"/><stop offset="1" stop-color="#c9a15c"/></linearGradient>
<linearGradient id="hs-liver-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b8605a"/><stop offset="1" stop-color="#6e2b2c"/></linearGradient>
<linearGradient id="hs-brain-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3c6c2"/><stop offset="1" stop-color="#cf8f8f"/></linearGradient>
<radialGradient id="hs-organ-g" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#f6b5af"/><stop offset=".6" stop-color="#d37f80"/><stop offset="1" stop-color="#9c4a52"/></radialGradient>
<radialGradient id="hs-urine-g" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#fff3b8"/><stop offset="1" stop-color="#f1cf6a"/></radialGradient>
<radialGradient id="hs-lens-g" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fffbe0"/><stop offset="1" stop-color="#e6cf7e"/></radialGradient>
<pattern id="hs-sinus" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="#d97b84"/><ellipse cx="2.6" cy="2.8" rx="2.2" ry="1.6" fill="#f6cdd0" opacity=".85"/><ellipse cx="7" cy="6.4" rx="1.9" ry="2.2" fill="#f6cdd0" opacity=".8"/><circle cx="6.8" cy="1.6" r="1" fill="#b84d5a" opacity=".7"/></pattern>
<pattern id="hs-fibres" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="6" height="6" fill="#cf6f68"/><line x1="0" y1="3" x2="6" y2="3" stroke="#9c3f43" stroke-width="1.1" opacity=".55"/></pattern>
`;

const n = (v: number) => Math.round(v * 10) / 10;

/** A shaded tube along a path: dark outline, body colour, soft highlight stripe. */
export function tube(d: string, w: number, fill: string, edge = "rgba(0,0,0,.45)", id = ""): string {
  const idAttr = id ? ` id="${id}"` : "";
  return `<path${idAttr} d="${d}" fill="none" stroke="${edge}" stroke-width="${n(w + 2.2)}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${fill}" stroke-width="${n(w)}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="${n(Math.max(1, w * 0.26))}" stroke-linecap="round" stroke-linejoin="round" transform="translate(${n(-w * 0.17)},${n(-w * 0.17)})"/>`;
}

/** Filled organ shape with a gradient, thin dark edge and a soft gloss. */
export function organ(d: string, fill: string, opts: { edge?: string; gloss?: number; shadow?: boolean; id?: string; extra?: string } = {}): string {
  const { edge = "rgba(0,0,0,.42)", gloss = 0.55, shadow = false, id = "", extra = "" } = opts;
  const idAttr = id ? ` id="${id}"` : "";
  const body = `<path${idAttr} d="${d}" fill="${fill}" stroke="${edge}" stroke-width="1.4" stroke-linejoin="round"${extra ? " " + extra : ""}/>`;
  return (shadow ? `<g filter="url(#hs-shadow)">${body}</g>` : body) + (gloss > 0 ? `<path d="${d}" fill="url(#hs-gloss)" opacity="${gloss}"/>` : "");
}

/** Points -> smooth-ish polyline path. */
export function poly(pts: Array<[number, number]>): string {
  return pts.map(([x, y], i) => `${i ? "L" : "M"}${n(x)},${n(y)}`).join(" ");
}

/** Points -> smooth quadratic path through the midpoints (organic meanders). */
export function smooth(pts: Array<[number, number]>): string {
  if (pts.length < 3) return poly(pts);
  let d = `M${n(pts[0][0])},${n(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i], [x2, y2] = pts[i + 1];
    d += ` Q${n(x)},${n(y)} ${n((x + x2) / 2)},${n((y + y2) / 2)}`;
  }
  const [lx, ly] = pts[pts.length - 1];
  return d + ` L${n(lx)},${n(ly)}`;
}

/** Sine-wave path along a straight line (used for coiled tubules, sperm tails, wavy veins). */
export function wave(x0: number, y0: number, x1: number, y1: number, amp: number, cycles: number, steps = 36): string {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, s = Math.sin(t * cycles * Math.PI * 2) * amp;
    pts.push([x0 + dx * t + nx * s, y0 + dy * t + ny * s]);
  }
  return poly(pts);
}

/** Deterministic pseudo-random in [0,1) so figures are identical on every build. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export { n as r1 };
