// Ink engine for the Journal-style notebook (v86, extended in v89: tile rendering, lasso/transform helpers). Pure TypeScript (no React / DOM types beyond a canvas context),
// so it can be unit tested and shared by the editor (canvas) and the Notebook page previews (SVG).
//
// Document model (stored as JSON text in med_notebook_entries.ink):
//   { v: 1, paper: 'blank'|'lined'|'grid'|'dots', w: 800, h: <grows>, strokes: Stroke[] }
// A stroke is { t: 'pen'|'pencil'|'hl', c: '#rrggbb', s: size, p: [x, y, pressure, x, y, pressure, ...] } in logical units
// (the page is always 800 units wide and scales to whatever width the screen has).

export type StrokeKind = 'pen' | 'pencil' | 'hl';
export type Paper = 'blank' | 'lined' | 'grid' | 'dots';
export interface Stroke { t: StrokeKind; c: string; s: number; p: number[] }
export interface InkDoc { v: 1; paper: Paper; w: number; h: number; strokes: Stroke[] }

export const PAGE_W = 800;
export const PAGE_MIN_H = 1000;
export const PAGE_GROW = 500;       // extra blank space kept below the lowest stroke
export const PAPER_COLOR = '#fffdf8';
const HEX = /^#[0-9a-f]{6}$/i;

export const PEN_COLORS = ['#1b1b1f', '#1f5fbf', '#d63a3a', '#1f9d62', '#e8862a', '#7a4fc7', '#d6479c', '#7a5230'];
export const HL_COLORS = ['#ffe14d', '#7df09a', '#ff9ccf', '#7cc8ff', '#ffb066', '#c9a6ff'];

export const emptyInk = (paper: Paper = 'blank'): InkDoc => ({ v: 1, paper, w: PAGE_W, h: PAGE_MIN_H, strokes: [] });
export const inkIsEmpty = (d: InkDoc | null | undefined): boolean => !d || d.strokes.length === 0;

/** Parse stored ink; returns null for empty/invalid input. Colours and numbers are sanitised. */
export function parseInk(raw: string | null | undefined): InkDoc | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (!o || o.v !== 1 || !Array.isArray(o.strokes)) return null;
    const paper: Paper = ['blank', 'lined', 'grid', 'dots'].includes(o.paper) ? o.paper : 'blank';
    const strokes: Stroke[] = [];
    for (const s of o.strokes) {
      if (!s || !['pen', 'pencil', 'hl'].includes(s.t) || !Array.isArray(s.p) || s.p.length < 3) continue;
      const p = (s.p as unknown[]).map(Number);
      if (p.some((n) => !Number.isFinite(n))) continue;
      strokes.push({ t: s.t, c: HEX.test(s.c) ? s.c : '#1b1b1f', s: Math.min(40, Math.max(0.5, Number(s.s) || 3)), p });
    }
    const maxY = maxStrokeY(strokes);
    return { v: 1, paper, w: PAGE_W, h: pageHeightFor(maxY, Number(o.h) || PAGE_MIN_H), strokes };
  } catch { return null; }
}

export const serializeInk = (d: InkDoc): string => JSON.stringify({ v: 1, paper: d.paper, w: d.w, h: d.h, strokes: d.strokes });

export function maxStrokeY(strokes: Stroke[]): number {
  let m = 0;
  for (const s of strokes) for (let i = 1; i < s.p.length; i += 3) if (s.p[i] > m) m = s.p[i];
  return m;
}
export const pageHeightFor = (maxY: number, current = PAGE_MIN_H): number =>
  Math.max(PAGE_MIN_H, current, Math.ceil((maxY + PAGE_GROW) / 100) * 100);

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Drop points closer than `minDist` (keeps first/last) and round numbers, so saved pages stay small. */
export function simplifyPoints(p: number[], minDist = 0.7): number[] {
  if (p.length <= 6) return p.map((n, i) => (i % 3 === 2 ? Math.round(n * 100) / 100 : r1(n)));
  const out: number[] = [r1(p[0]), r1(p[1]), Math.round(p[2] * 100) / 100];
  let lx = p[0], ly = p[1];
  for (let i = 3; i < p.length - 3; i += 3) {
    if (Math.hypot(p[i] - lx, p[i + 1] - ly) >= minDist) { out.push(r1(p[i]), r1(p[i + 1]), Math.round(p[i + 2] * 100) / 100); lx = p[i]; ly = p[i + 1]; }
  }
  const n = p.length;
  out.push(r1(p[n - 3]), r1(p[n - 2]), Math.round(p[n - 1] * 100) / 100);
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Geometry / eraser
// ---------------------------------------------------------------------------------------------------------------
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
/** Does the eraser circle (x, y, radius) touch this stroke? */
export function strokeHit(s: Stroke, x: number, y: number, radius: number): boolean {
  const reach = radius + (s.t === 'hl' ? s.s * 1.6 : s.s * 0.5);
  const p = s.p;
  if (p.length === 3) return Math.hypot(p[0] - x, p[1] - y) <= reach;
  for (let i = 0; i + 5 < p.length; i += 3) if (segDist(x, y, p[i], p[i + 1], p[i + 3], p[i + 4]) <= reach) return true;
  return false;
}
/** Indices of every stroke touched by the eraser at (x, y). */
export function strokesAt(strokes: Stroke[], x: number, y: number, radius: number): number[] {
  const hit: number[] = [];
  for (let i = 0; i < strokes.length; i++) if (strokeHit(strokes[i], x, y, radius)) hit.push(i);
  return hit;
}

// ---------------------------------------------------------------------------------------------------------------
// Canvas rendering
// ---------------------------------------------------------------------------------------------------------------
type Ctx = CanvasRenderingContext2D;
const hlWidth = (s: Stroke) => s.s * 3.4;
const penWidth = (s: Stroke, pr: number) => s.s * (0.45 + 1.1 * Math.max(0.05, Math.min(1, pr)));
// cheap deterministic noise for the pencil grain
const noise = (a: number, b: number) => { const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return v - Math.floor(v); };

/** Paper background (blank / lined / grid / dots). `scale` = canvas pixels per logical unit. */
export function drawPaper(ctx: Ctx, paper: Paper, w: number, h: number, scale: number, y0 = 0, y1 = h): void {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.fillStyle = PAPER_COLOR;
  ctx.fillRect(0, y0, w, y1 - y0);
  ctx.lineWidth = 1 / scale * 1.1;
  // Only the rules that fall inside [y0, y1] are drawn, so a tall page can be painted tile by tile.
  if (paper === 'lined') {
    ctx.strokeStyle = 'rgba(70,110,180,.28)';
    ctx.beginPath();
    const first = Math.max(70, 70 + Math.floor((y0 - 70) / 38) * 38);
    for (let y = first; y < Math.min(h, y1 + 2); y += 38) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(214,58,58,.28)';
    ctx.beginPath(); ctx.moveTo(72, y0); ctx.lineTo(72, y1); ctx.stroke();
  } else if (paper === 'grid') {
    ctx.strokeStyle = 'rgba(70,110,180,.2)';
    ctx.beginPath();
    for (let x = 0; x <= w; x += 32) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
    for (let y = Math.floor(y0 / 32) * 32; y <= Math.min(h, y1 + 2); y += 32) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
  } else if (paper === 'dots') {
    ctx.fillStyle = 'rgba(70,90,130,.38)';
    for (let x = 32; x < w; x += 32) for (let y = Math.max(32, Math.floor(y0 / 32) * 32); y < Math.min(h, y1 + 2); y += 32) { ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}

/** Smooth quadratic path through the stroke's points (midpoint technique). */
function tracePath(ctx: Ctx, p: number[], from = 0): void {
  ctx.beginPath();
  ctx.moveTo(p[from], p[from + 1]);
  if (p.length - from === 3) { ctx.lineTo(p[from] + 0.01, p[from + 1] + 0.01); return; }
  for (let i = from + 3; i < p.length - 3; i += 3) ctx.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[i + 3]) / 2, (p[i + 1] + p[i + 4]) / 2);
  ctx.lineTo(p[p.length - 3], p[p.length - 2]);
}

/** Draw one stroke. `scale` = canvas pixels per logical unit. */
export function drawStroke(ctx: Ctx, s: Stroke, scale: number): void {
  const p = s.p;
  if (p.length < 3) return;
  ctx.save();
  ctx.scale(scale, scale);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (s.t === 'hl') {
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = s.c; ctx.lineWidth = hlWidth(s); ctx.lineCap = 'butt';
    tracePath(ctx, p); ctx.stroke();
  } else if (s.t === 'pencil') {
    ctx.strokeStyle = s.c;
    // grainy graphite: a soft body pass + two thin jittered passes
    for (let pass = 0; pass < 3; pass++) {
      ctx.globalAlpha = pass === 0 ? 0.5 : 0.28;
      const w = pass === 0 ? s.s * 0.85 : s.s * 0.4;
      for (let i = 0; i + 3 < p.length; i += 3) {
        const j = pass === 0 ? 0 : (noise(p[i], p[i + 1] + pass) - 0.5) * s.s * 0.5;
        ctx.lineWidth = w * (0.6 + 0.8 * Math.max(0.05, Math.min(1, p[i + 2])));
        ctx.beginPath(); ctx.moveTo(p[i] + j, p[i + 1] - j); ctx.lineTo(p[i + 3] + j, p[i + 4] - j); ctx.stroke();
      }
    }
  } else {
    ctx.strokeStyle = s.c; ctx.fillStyle = s.c;
    if (p.length === 3) { ctx.beginPath(); ctx.arc(p[0], p[1], penWidth(s, p[2]) / 2, 0, Math.PI * 2); ctx.fill(); }
    // variable width follows pen pressure: draw short smoothed pieces
    let px = p[0], py = p[1];
    for (let i = 3; i < p.length; i += 3) {
      const mx = i + 3 < p.length ? (p[i] + p[i + 3]) / 2 : p[i], my = i + 3 < p.length ? (p[i + 1] + p[i + 4]) / 2 : p[i + 1];
      ctx.lineWidth = penWidth(s, (p[i - 1] + p[i + 2]) / 2);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(p[i], p[i + 1], mx, my); ctx.stroke();
      px = mx; py = my;
    }
  }
  ctx.restore();
}

/** Paper + every stroke. */
export function renderAll(ctx: Ctx, doc: InkDoc, scale: number): void {
  drawPaper(ctx, doc.paper, doc.w, doc.h, scale);
  for (const s of doc.strokes) drawStroke(ctx, s, scale);
}

// ---------------------------------------------------------------------------------------------------------------
// v89 — tiles, bounding boxes, lasso selection and affine transforms (used by the Journal-style editor)
// ---------------------------------------------------------------------------------------------------------------
export interface BBox { x0: number; y0: number; x1: number; y1: number }
const bboxCache = new WeakMap<Stroke, BBox>();

/** Bounding box of a stroke in page units, padded by the stroke's own thickness. */
export function strokeBBox(s: Stroke): BBox {
  const hit = bboxCache.get(s);
  if (hit) return hit;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i + 2 < s.p.length; i += 3) {
    if (s.p[i] < x0) x0 = s.p[i]; if (s.p[i] > x1) x1 = s.p[i];
    if (s.p[i + 1] < y0) y0 = s.p[i + 1]; if (s.p[i + 1] > y1) y1 = s.p[i + 1];
  }
  const pad = (s.t === 'hl' ? hlWidth(s) : s.s * 1.6) / 2 + 2;
  const b = { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
  bboxCache.set(s, b);
  return b;
}
export function bboxOf(strokes: readonly Stroke[]): BBox | null {
  if (!strokes.length) return null;
  const out = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const s of strokes) { const b = strokeBBox(s); out.x0 = Math.min(out.x0, b.x0); out.y0 = Math.min(out.y0, b.y0); out.x1 = Math.max(out.x1, b.x1); out.y1 = Math.max(out.y1, b.y1); }
  return out;
}
export const unionBBox = (a: BBox | null, b: BBox | null): BBox | null => (!a ? b : !b ? a : { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) });

/** Paint one horizontal band [y0, y1) of the page into a canvas whose top-left is page (0, y0). Strokes in `hidden` are skipped. */
export function renderRegion(ctx: Ctx, doc: InkDoc, y0: number, y1: number, scale: number, hidden?: ReadonlySet<Stroke>): void {
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, doc.w * scale, (y1 - y0) * scale); ctx.clip();
  ctx.translate(0, -y0 * scale);
  drawPaper(ctx, doc.paper, doc.w, doc.h, scale, y0, y1);
  for (const s of doc.strokes) {
    if (hidden && hidden.has(s)) continue;
    const b = strokeBBox(s);
    if (b.y1 < y0 || b.y0 > y1) continue;
    drawStroke(ctx, s, scale);
  }
  ctx.restore();
}

/** Draw one stroke into a band canvas (same coordinate convention as renderRegion). */
export function drawStrokeInBand(ctx: Ctx, s: Stroke, y0: number, scale: number): void {
  ctx.save(); ctx.translate(0, -y0 * scale); drawStroke(ctx, s, scale); ctx.restore();
}

/** Stroke → canvas of just the given strokes on a transparent background (for the floating selection layer). */
export function renderStrokesTransparent(ctx: Ctx, strokes: readonly Stroke[], origin: { x: number; y: number }, scale: number): void {
  ctx.save(); ctx.translate(-origin.x * scale, -origin.y * scale);
  for (const s of strokes) drawStroke(ctx, s, scale);
  ctx.restore();
}

/** Point-in-polygon (even-odd). `poly` is a flat [x, y, x, y, …] list. */
export function inPolygon(x: number, y: number, poly: number[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const xi = poly[i], yi = poly[i + 1], xj = poly[j], yj = poly[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/** Strokes with at least 55% of their points inside the lasso. */
export function strokesInLasso(strokes: readonly Stroke[], poly: number[]): Stroke[] {
  if (poly.length < 6) return [];
  const out: Stroke[] = [];
  for (const s of strokes) {
    let inside = 0, n = 0;
    for (let i = 0; i + 2 < s.p.length; i += 3) { n++; if (inPolygon(s.p[i], s.p[i + 1], poly)) inside++; }
    if (n && inside / n >= 0.55) out.push(s);
  }
  return out;
}

/** 2D affine matrix [a b c d e f] — x' = a·x + c·y + e,  y' = b·x + d·y + f. */
export interface Affine { a: number; b: number; c: number; d: number; e: number; f: number }
export const IDENTITY: Affine = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
/** Move by (dx, dy), then rotate by `rot` radians and scale by `sc`, both about (cx, cy). */
export function affineAround(cx: number, cy: number, dx: number, dy: number, rot: number, sc: number): Affine {
  const cos = Math.cos(rot) * sc, sin = Math.sin(rot) * sc;
  return { a: cos, b: sin, c: -sin, d: cos, e: cx + dx - (cos * cx - sin * cy), f: cy + dy - (sin * cx + cos * cy) };
}
export const isIdentity = (m: Affine): boolean => Math.abs(m.a - 1) < 1e-6 && Math.abs(m.d - 1) < 1e-6 && Math.abs(m.b) < 1e-6 && Math.abs(m.c) < 1e-6 && Math.abs(m.e) < 0.05 && Math.abs(m.f) < 0.05;

/** A transformed copy of a stroke (width follows the scale factor, so resized handwriting keeps its proportions). */
export function transformStroke(s: Stroke, m: Affine): Stroke {
  const k = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
  const p = new Array<number>(s.p.length);
  for (let i = 0; i + 2 < s.p.length; i += 3) { p[i] = r1(m.a * s.p[i] + m.c * s.p[i + 1] + m.e); p[i + 1] = r1(m.b * s.p[i] + m.d * s.p[i + 1] + m.f); p[i + 2] = s.p[i + 2]; }
  return { t: s.t, c: s.c, s: Math.min(40, Math.max(0.5, r1(s.s * k * 10) / 10)), p };
}
export const recolorStroke = (s: Stroke, c: string): Stroke => ({ t: s.t, c: HEX.test(c) ? c : s.c, s: s.s, p: s.p });
export const cloneStroke = (s: Stroke): Stroke => ({ t: s.t, c: s.c, s: s.s, p: s.p.slice() });

/** Sensible per-tool thickness presets (thin / medium / thick) and defaults. */
export const TOOL_SIZES: Record<StrokeKind, number[]> = { pen: [1.6, 3, 5.5], pencil: [2, 3.6, 6], hl: [3, 5, 8] };
export const DEFAULT_TOOL_COLOR: Record<StrokeKind, string> = { pen: '#1b1b1f', pencil: '#3b3b44', hl: '#ffe14d' };

// ---------------------------------------------------------------------------------------------------------------
// SVG export (Notebook page previews: vector, small, no canvas needed)
// ---------------------------------------------------------------------------------------------------------------
function svgPath(p: number[]): string {
  if (p.length === 3) return `M${p[0]},${p[1]}l.01,.01`;
  let d = `M${p[0]},${p[1]}`;
  for (let i = 3; i < p.length - 3; i += 3) d += `Q${p[i]},${p[i + 1]} ${r1((p[i] + p[i + 3]) / 2)},${r1((p[i + 1] + p[i + 4]) / 2)}`;
  return d + `L${p[p.length - 3]},${p[p.length - 2]}`;
}
const safeColor = (c: string) => (HEX.test(c) ? c : '#1b1b1f');

/** Standalone SVG markup of the page, cropped to the written area (plus a margin). Colours are validated. */
export function inkToSvg(doc: InkDoc, opts: { maxHeight?: number; withPaper?: boolean } = {}): string {
  const maxY = maxStrokeY(doc.strokes);
  const h = Math.min(opts.maxHeight ?? 10000, Math.max(180, Math.ceil(maxY + 40)));
  const bg = opts.withPaper === false ? '' : `<rect width="${doc.w}" height="${h}" fill="${PAPER_COLOR}"/>` + paperSvg(doc.paper, doc.w, h);
  const body = doc.strokes.map((s) => {
    const c = safeColor(s.c);
    if (s.t === 'hl') return `<path d="${svgPath(s.p)}" fill="none" stroke="${c}" stroke-width="${hlWidth(s)}" stroke-opacity=".5" style="mix-blend-mode:multiply" stroke-linecap="butt" stroke-linejoin="round"/>`;
    if (s.t === 'pencil') return `<path d="${svgPath(s.p)}" fill="none" stroke="${c}" stroke-width="${r1(s.s * 0.8)}" stroke-opacity=".7" stroke-linecap="round" stroke-linejoin="round"/>`;
    const avg = s.p.reduce((a, v, i) => (i % 3 === 2 ? a + v : a), 0) / (s.p.length / 3);
    return `<path d="${svgPath(s.p)}" fill="none" stroke="${c}" stroke-width="${r1(penWidth(s, avg))}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${doc.w} ${h}" width="100%" preserveAspectRatio="xMinYMin meet" role="img" aria-label="Handwritten note">${bg}${body}</svg>`;
}
function paperSvg(paper: Paper, w: number, h: number): string {
  if (paper === 'lined') { let s = ''; for (let y = 70; y < h; y += 38) s += `M0,${y}H${w}`; return `<path d="${s}" stroke="rgba(70,110,180,.28)" stroke-width="1.1" fill="none"/><path d="M72,0V${h}" stroke="rgba(214,58,58,.28)" stroke-width="1.1"/>`; }
  if (paper === 'grid') { let s = ''; for (let x = 0; x <= w; x += 32) s += `M${x},0V${h}`; for (let y = 0; y <= h; y += 32) s += `M0,${y}H${w}`; return `<path d="${s}" stroke="rgba(70,110,180,.2)" stroke-width="1.1" fill="none"/>`; }
  if (paper === 'dots') { let s = ''; for (let x = 32; x < w; x += 32) for (let y = 32; y < h; y += 32) s += `M${x},${y}h.1`; return `<path d="${s}" stroke="rgba(70,90,130,.45)" stroke-width="3" stroke-linecap="round" fill="none"/>`; }
  return '';
}
