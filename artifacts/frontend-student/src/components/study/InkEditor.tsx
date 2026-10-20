// Journal-style handwriting editor (v89) — modelled on the Windows 11 "Journal" app.
//
//  • Pen (ballpoint, pressure-sensitive), Pencil (grainy graphite — works in every colour), Highlighter (multiply blend)
//  • Stroke eraser (also the pen's eraser end / barrel button), Lasso (move / resize / rotate / recolour / duplicate / delete)
//  • Ruler (drag it, strokes that start on it snap to the straight edge), Undo / Redo, zoom, paper (blank / lined / grid / dots)
//  • Touch writing toggle: with a stylus the pen writes and fingers scroll / pinch (like Journal); with no stylus fingers write
//  • Per-tool colour + thickness, tap the active tool again for its colour / size flyout
//  • Autosave (debounced) through `onSave`; the page grows as you write
//
// The page is painted into stacked "tile" canvases (≤ 600 page-units tall each) so a long page never exceeds the browser's
// canvas size limits (iOS Safari!). Only the tiles a change touches are repainted. All drawing maths lives in '@/lib/ink'.
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle, ArrowLeft, Check, Copy, Eraser, Hand, Highlighter, LassoSelect, Loader2, MoreHorizontal, PenLine, Pencil,
  Redo2, Ruler as RulerIcon, Trash2, Undo2, ZoomIn, ZoomOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DEFAULT_TOOL_COLOR, HL_COLORS, PAGE_W, PEN_COLORS, TOOL_SIZES, affineAround, bboxOf, cloneStroke, drawStrokeInBand, emptyInk,
  isIdentity, maxStrokeY, pageHeightFor, parseInk, recolorStroke, renderRegion, renderStrokesTransparent, serializeInk,
  simplifyPoints, strokeBBox, strokesAt, strokesInLasso, transformStroke, unionBBox,
  type Affine, type BBox, type InkDoc, type Paper, type Stroke, type StrokeKind,
} from '@/lib/ink';

const TILE = 600;            // page units per tile canvas
const MAX_PX_SCALE = 5;      // canvas pixels per page unit (keeps a tile ≤ 4000 × 3000 px)
const SAVE_DELAY = 1100;
const MAX_UNDO = 250;

type Tool = 'pen' | 'pencil' | 'hl' | 'eraser' | 'lasso';
type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error';
interface Action { undo(): BBox | null; redo(): BBox | null }
interface Sel { strokes: Stroke[]; box: BBox }
interface RulerState { x1: number; y1: number; x2: number; y2: number }
interface ToolCfg { c: string; s: number }

export interface InkEditorProps {
  initialInk: string | null;
  initialTitle?: string;
  /** Called (debounced) with the serialised page, or null when the page is empty. Throw / reject to show "retry". */
  onSave: (v: { ink: string | null; title: string }) => Promise<void>;
  onClose: () => void;
  /** Small context shown under the title (e.g. the attached question). */
  subtitle?: ReactNode;
  defaultPaper?: Paper;
}

const PAPERS: Array<{ id: Paper; label: string }> = [{ id: 'lined', label: 'Lined' }, { id: 'grid', label: 'Grid' }, { id: 'dots', label: 'Dots' }, { id: 'blank', label: 'Blank' }];
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const HEXC = /^#[0-9a-f]{6}$/i;

export default function InkEditor({ initialInk, initialTitle = '', onSave, onClose, subtitle, defaultPaper = 'lined' }: InkEditorProps) {
  const docRef = useRef<InkDoc>(null as unknown as InkDoc);
  if (!docRef.current) docRef.current = parseInk(initialInk) ?? emptyInk(defaultPaper);
  const doc = docRef.current;
  const [, bump] = useReducer((n: number) => n + 1, 0);

  // ---- tool state ------------------------------------------------------------------------------------------------
  const [tool, setTool] = useState<Tool>('pen');
  const [cfg, setCfg] = useState<Record<StrokeKind, ToolCfg>>({
    pen: { c: DEFAULT_TOOL_COLOR.pen, s: TOOL_SIZES.pen[1] },
    pencil: { c: DEFAULT_TOOL_COLOR.pencil, s: TOOL_SIZES.pencil[1] },
    hl: { c: DEFAULT_TOOL_COLOR.hl, s: TOOL_SIZES.hl[1] },
  });
  const [eraserR, setEraserR] = useState(16);
  const [flyout, setFlyout] = useState(false);
  const [menu, setMenu] = useState(false);
  const [touchDraw, setTouchDraw] = useState(true);   // flips to false the first time a stylus touches the page
  const [ruler, setRuler] = useState<RulerState | null>(null);
  const [title, setTitle] = useState(initialTitle);
  const toolRef = useRef(tool); toolRef.current = tool;
  const cfgRef = useRef(cfg); cfgRef.current = cfg;
  const eraserRRef = useRef(eraserR); eraserRRef.current = eraserR;
  const touchDrawRef = useRef(touchDraw); touchDrawRef.current = touchDraw;
  const rulerRef = useRef(ruler); rulerRef.current = ruler;
  const titleRef = useRef(title); titleRef.current = title;

  // ---- layout / zoom ---------------------------------------------------------------------------------------------
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(360);
  const [zoom, setZoom] = useState(1);
  const [zoomR, setZoomR] = useState(1);           // debounced copy: canvases are only re-rasterised once zooming settles
  const [docH, setDocH] = useState(doc.h);
  const baseW = Math.min(Math.max(avail - 16, 240), 980);
  const cssW = baseW * zoom;
  const cssScale = cssW / PAGE_W;
  const dpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2.5);
  const pxScale = Math.min((baseW * zoomR / PAGE_W) * dpr, MAX_PX_SCALE);
  const tileCount = Math.max(1, Math.ceil(docH / TILE));
  const L = useRef({ cssScale, pxScale, tileCount });
  L.current = { cssScale, pxScale, tileCount };

  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setAvail(el.clientWidth));
    ro.observe(el); setAvail(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { const t = setTimeout(() => setZoomR(zoom), 220); return () => clearTimeout(t); }, [zoom]);

  const zoomAnchor = useRef<{ cx: number; cy: number; ratio: number } | null>(null);
  const zoomTo = useCallback((next: number, anchor?: { cx: number; cy: number }) => {
    const el = scrollRef.current; const z = clamp(next, 0.5, 3);
    setZoom((prev) => {
      if (el && prev !== z) {
        const r = el.getBoundingClientRect();
        zoomAnchor.current = { cx: anchor ? anchor.cx - r.left : el.clientWidth / 2, cy: anchor ? anchor.cy - r.top : el.clientHeight / 2, ratio: z / prev };
      }
      return z;
    });
  }, []);
  useLayoutEffect(() => {
    const a = zoomAnchor.current, el = scrollRef.current; if (!a || !el) return;
    zoomAnchor.current = null;
    el.scrollLeft = (el.scrollLeft + a.cx) * a.ratio - a.cx;
    el.scrollTop = (el.scrollTop + a.cy) * a.ratio - a.cy;
  }, [zoom]);
  const zoomRefLive = useRef(zoom); zoomRefLive.current = zoom;

  // ---- tile painting ---------------------------------------------------------------------------------------------
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const dirty = useRef(new Set<number>());
  const hidden = useRef(new Set<Stroke>());        // strokes not painted on the tiles (selected, or being erased)
  const raf = useRef(0);

  const paintTile = useCallback((i: number) => {
    const cv = canvasRefs.current[i]; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const y0 = i * TILE, y1 = Math.min(doc.h, y0 + TILE);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    renderRegion(ctx, doc, y0, y1, L.current.pxScale, hidden.current);
  }, [doc]);
  const flushDirty = useCallback(() => {
    raf.current = 0;
    for (const i of dirty.current) paintTile(i);
    dirty.current.clear();
  }, [paintTile]);
  const scheduleFlush = useCallback(() => { if (!raf.current) raf.current = requestAnimationFrame(flushDirty); }, [flushDirty]);
  const markDirty = useCallback((b: BBox | null) => {
    if (!b) return;
    const a = Math.max(0, Math.floor(b.y0 / TILE)), z = Math.min(L.current.tileCount - 1, Math.floor(b.y1 / TILE));
    for (let i = a; i <= z; i++) dirty.current.add(i);
    scheduleFlush();
  }, [scheduleFlush]);
  const markAllDirty = useCallback(() => { for (let i = 0; i < L.current.tileCount; i++) dirty.current.add(i); scheduleFlush(); }, [scheduleFlush]);

  const prevLayout = useRef<{ px: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const p = prevLayout.current; prevLayout.current = { px: pxScale, h: docH };
    if (!p || p.px !== pxScale) for (let i = 0; i < tileCount; i++) dirty.current.add(i);
    else if (p.h !== docH) for (let i = Math.max(0, Math.ceil(p.h / TILE) - 1); i < tileCount; i++) dirty.current.add(i);
    if (dirty.current.size) flushDirty();
  }, [pxScale, docH, tileCount, flushDirty]);
  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  const syncHeight = useCallback(() => {
    const h = pageHeightFor(maxStrokeY(doc.strokes), doc.h);
    // the page only ever grows while editing (so undo never makes the canvas jump under the writer)
    if (h > doc.h) { doc.h = h; setDocH(h); }
  }, [doc]);

  // ---- history ---------------------------------------------------------------------------------------------------
  const undoStack = useRef<Action[]>([]);
  const redoStack = useRef<Action[]>([]);
  const [status, setStatus] = useState<SaveStatus>('saved');
  const dirtyDoc = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingP = useRef<Promise<void>>(Promise.resolve());
  const onSaveRef = useRef(onSave); onSaveRef.current = onSave;
  const [tooBig, setTooBig] = useState(false);

  const flushSave = useCallback((): Promise<void> => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    if (!dirtyDoc.current) return savingP.current;
    dirtyDoc.current = false;
    const ink = doc.strokes.length ? serializeInk(doc) : null;
    setTooBig(!!ink && ink.length > 2_600_000);
    setStatus('saving');
    savingP.current = savingP.current
      .then(() => onSaveRef.current({ ink, title: titleRef.current.trim() }))
      .then(() => setStatus(dirtyDoc.current ? 'dirty' : 'saved'))
      .catch(() => { dirtyDoc.current = true; setStatus('error'); });
    return savingP.current;
  }, [doc]);
  const scheduleSave = useCallback(() => {
    dirtyDoc.current = true; setStatus((s) => (s === 'saving' ? s : 'dirty'));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void flushSave(); }, SAVE_DELAY);
  }, [flushSave]);

  const pushAction = useCallback((a: Action) => {
    undoStack.current.push(a); if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
    redoStack.current.length = 0;
    bump(); scheduleSave();
  }, [scheduleSave]);

  const addAction = useCallback((strokes: Stroke[]): Action => ({
    undo: () => { const set = new Set(strokes); doc.strokes = doc.strokes.filter((s) => !set.has(s)); return bboxOf(strokes); },
    redo: () => { doc.strokes.push(...strokes); return bboxOf(strokes); },
  }), [doc]);
  const removeAction = useCallback((items: Array<{ i: number; s: Stroke }>): Action => ({
    undo: () => { for (const it of items) doc.strokes.splice(it.i, 0, it.s); return bboxOf(items.map((x) => x.s)); },
    redo: () => { const set = new Set(items.map((x) => x.s)); doc.strokes = doc.strokes.filter((s) => !set.has(s)); return bboxOf(items.map((x) => x.s)); },
  }), [doc]);
  const replaceAction = useCallback((items: Array<{ i: number; before: Stroke; after: Stroke }>): Action => ({
    undo: () => { let b: BBox | null = null; for (const it of items) { doc.strokes[it.i] = it.before; b = unionBBox(b, unionBBox(strokeBBox(it.before), strokeBBox(it.after))); } return b; },
    redo: () => { let b: BBox | null = null; for (const it of items) { doc.strokes[it.i] = it.after; b = unionBBox(b, unionBBox(strokeBBox(it.before), strokeBBox(it.after))); } return b; },
  }), [doc]);

  // ---- selection (lasso) -----------------------------------------------------------------------------------------
  const [sel, setSel] = useState<Sel | null>(null);
  const selRef = useRef<Sel | null>(null);
  const xf = useRef({ dx: 0, dy: 0, rot: 0, sc: 1 });
  const selWrapRef = useRef<HTMLDivElement>(null);
  const selFrameRef = useRef<HTMLDivElement>(null);
  const selCanvasRef = useRef<HTMLCanvasElement>(null);

  const applyXf = useCallback(() => {
    const { dx, dy, rot, sc } = xf.current; const cs = L.current.cssScale;
    const t = `translate(${dx * cs}px, ${dy * cs}px) rotate(${rot}rad) scale(${sc})`;
    if (selWrapRef.current) selWrapRef.current.style.transform = t;
    if (selFrameRef.current) {
      selFrameRef.current.style.transform = t;
      selFrameRef.current.querySelectorAll<HTMLElement>('[data-h]').forEach((h) => { h.style.transform = `scale(${1 / sc})`; });
      selFrameRef.current.style.borderWidth = `${1.5 / sc}px`;
    }
  }, []);

  const setSelection = useCallback((strokes: Stroke[]) => {
    const box = bboxOf(strokes);
    hidden.current = new Set(strokes);
    xf.current = { dx: 0, dy: 0, rot: 0, sc: 1 };
    if (!box || !strokes.length) { selRef.current = null; setSel(null); return; }
    const s = { strokes, box }; selRef.current = s; setSel(s);
    markDirty(box);
  }, [markDirty]);

  /** Bake the live selection transform into the strokes. Returns the (new) strokes. `keep` keeps them selected. */
  const commitSelection = useCallback((keep = false): Stroke[] => {
    const s = selRef.current; if (!s) return [];
    const { dx, dy, rot, sc } = xf.current;
    let strokes = s.strokes;
    let touched: BBox | null = s.box;
    const cx = (s.box.x0 + s.box.x1) / 2, cy = (s.box.y0 + s.box.y1) / 2;
    let m: Affine = affineAround(cx, cy, dx, dy, rot, sc);
    if (!isIdentity(m)) {
      let after = strokes.map((st) => transformStroke(st, m));
      const nb = bboxOf(after);
      if (nb && nb.y0 < 0) { m = { ...m, f: m.f - nb.y0 }; after = strokes.map((st) => transformStroke(st, m)); }  // never above the page top
      const items = strokes.map((st, k) => ({ i: doc.strokes.indexOf(st), before: st, after: after[k] })).filter((it) => it.i >= 0);
      for (const it of items) doc.strokes[it.i] = it.after;
      if (items.length) pushAction(replaceAction(items));
      touched = unionBBox(touched, bboxOf(after));
      strokes = after;
      syncHeight();
    }
    hidden.current = new Set();
    xf.current = { dx: 0, dy: 0, rot: 0, sc: 1 };
    markDirty(touched);
    if (keep) setSelection(strokes); else { selRef.current = null; setSel(null); }
    return strokes;
  }, [doc, markDirty, pushAction, replaceAction, setSelection, syncHeight]);

  // Paint the floating selection bitmap whenever the selection changes.
  const selScale = useMemo(() => {
    if (!sel) return 1;
    const w = sel.box.x1 - sel.box.x0, h = sel.box.y1 - sel.box.y0;
    return Math.max(0.2, Math.min(pxScale, 4096 / w, 4096 / h, Math.sqrt(12e6 / Math.max(1, w * h))));
  }, [sel, pxScale]);
  useLayoutEffect(() => {
    const cv = selCanvasRef.current; if (!cv || !sel) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    renderStrokesTransparent(ctx, sel.strokes, { x: sel.box.x0, y: sel.box.y0 }, selScale);
    applyXf();
  }, [sel, selScale, applyXf, cssScale]);

  const deleteSelection = useCallback(() => {
    const strokes = commitSelection(true); if (!strokes.length) return;
    const items = strokes.map((s) => ({ i: doc.strokes.indexOf(s), s })).filter((x) => x.i >= 0).sort((a, b) => a.i - b.i);
    const set = new Set(items.map((x) => x.s));
    doc.strokes = doc.strokes.filter((s) => !set.has(s));
    pushAction(removeAction(items));
    hidden.current = new Set(); selRef.current = null; setSel(null);
    markDirty(bboxOf(strokes));
  }, [commitSelection, doc, markDirty, pushAction, removeAction]);

  const duplicateSelection = useCallback(() => {
    const strokes = commitSelection(true); if (!strokes.length) return;
    const shift: Affine = { a: 1, b: 0, c: 0, d: 1, e: 28, f: 28 };
    const copies = strokes.map((s) => transformStroke(cloneStroke(s), shift));
    doc.strokes.push(...copies);
    pushAction(addAction(copies));
    syncHeight();
    setSelection(copies);
  }, [addAction, commitSelection, doc, pushAction, setSelection, syncHeight]);

  const recolorSelection = useCallback((c: string) => {
    const strokes = commitSelection(true); if (!strokes.length) return;
    const after = strokes.map((s) => recolorStroke(s, c));
    const items = strokes.map((st, k) => ({ i: doc.strokes.indexOf(st), before: st, after: after[k] })).filter((it) => it.i >= 0);
    for (const it of items) doc.strokes[it.i] = it.after;
    if (items.length) pushAction(replaceAction(items));
    setSelection(after);
    markDirty(bboxOf(after));
  }, [commitSelection, doc, markDirty, pushAction, replaceAction, setSelection]);

  // ---- undo / redo -----------------------------------------------------------------------------------------------
  const undo = useCallback(() => {
    commitSelection(false);
    const a = undoStack.current.pop(); if (!a) return;
    const box = a.undo(); redoStack.current.push(a);
    markDirty(box); bump(); scheduleSave();
  }, [commitSelection, markDirty, scheduleSave]);
  const redo = useCallback(() => {
    commitSelection(false);
    const a = redoStack.current.pop(); if (!a) return;
    const box = a.redo(); undoStack.current.push(a);
    syncHeight(); markDirty(box); bump(); scheduleSave();
  }, [commitSelection, markDirty, scheduleSave, syncHeight]);

  const setPaper = (p: Paper) => {
    if (p === doc.paper) return;
    const from = doc.paper; doc.paper = p;
    pushAction({ undo: () => { doc.paper = from; markAllDirty(); return null; }, redo: () => { doc.paper = p; markAllDirty(); return null; } });
    markAllDirty();
  };
  const clearPage = () => {
    if (!doc.strokes.length || !window.confirm('Clear everything on this page? (You can still undo.)')) return;
    commitSelection(false);
    const items = doc.strokes.map((s, i) => ({ i, s }));
    doc.strokes = [];
    pushAction(removeAction(items)); markDirty({ x0: 0, y0: 0, x1: PAGE_W, y1: doc.h });
  };

  // ---- pointer input ---------------------------------------------------------------------------------------------
  const toPage = useCallback((cx: number, cy: number) => {
    const r = pageRef.current!.getBoundingClientRect();
    return { x: clamp(((cx - r.left) / r.width) * PAGE_W, 0, PAGE_W), y: Math.max(0, ((cy - r.top) / r.width) * PAGE_W) };
  }, []);

  interface Live { id: number; kind: StrokeKind; stroke: Stroke; snaps: Map<number, HTMLCanvasElement>; box: BBox; snap: boolean; last: { x: number; y: number }; pointerType: string }
  const live = useRef<Live | null>(null);
  const erasing = useRef<{ id: number; hit: Set<Stroke> } | null>(null);
  const lassoPts = useRef<{ id: number; pts: number[]; moved: number } | null>(null);
  const lassoPathRef = useRef<SVGPathElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ lastCx: number; lastCy: number; lastDist: number; vx: number; vy: number; t: number } | null>(null);
  const inertia = useRef(0);

  const snapToRuler = (x: number, y: number) => {
    const r = rulerRef.current; if (!r) return { x, y };
    const dx = r.x2 - r.x1, dy = r.y2 - r.y1, l2 = dx * dx + dy * dy || 1;
    const t = clamp(((x - r.x1) * dx + (y - r.y1) * dy) / l2, 0, 1);
    return { x: r.x1 + t * dx, y: r.y1 + t * dy };
  };
  const nearRuler = (x: number, y: number) => {
    const r = rulerRef.current; if (!r) return false;
    const p = snapToRuler(x, y); return Math.hypot(p.x - x, p.y - y) <= 30;
  };

  const paintLive = useCallback(() => {
    const lv = live.current; if (!lv) return;
    const { pxScale: ps, tileCount: tc } = L.current;
    const a = Math.max(0, Math.floor(lv.box.y0 / TILE)), z = Math.min(tc - 1, Math.floor(lv.box.y1 / TILE));
    for (let i = a; i <= z; i++) {
      const cv = canvasRefs.current[i]; if (!cv) continue;
      let snap = lv.snaps.get(i);
      if (!snap) { snap = document.createElement('canvas'); snap.width = cv.width; snap.height = cv.height; snap.getContext('2d')!.drawImage(cv, 0, 0); lv.snaps.set(i, snap); }
      const ctx = cv.getContext('2d')!;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(snap, 0, 0);
      drawStrokeInBand(ctx, lv.stroke, i * TILE, ps);
    }
  }, []);
  const livePaintQueued = useRef(0);
  const queueLivePaint = () => { if (!livePaintQueued.current) livePaintQueued.current = requestAnimationFrame(() => { livePaintQueued.current = 0; paintLive(); }); };

  const addPoint = (lv: Live, x: number, y: number, pr: number) => {
    let px = x, py = y;
    if (lv.snap) { const s = snapToRuler(x, y); px = s.x; py = s.y; }
    if (Math.hypot(px - lv.last.x, py - lv.last.y) < 0.35 && lv.stroke.p.length > 3) return;
    lv.stroke.p.push(px, py, pr); lv.last = { x: px, y: py };
    const pad = (lv.kind === 'hl' ? lv.stroke.s * 3.4 : lv.stroke.s * 1.6) / 2 + 2;
    lv.box = { x0: Math.min(lv.box.x0, px - pad), y0: Math.min(lv.box.y0, py - pad), x1: Math.max(lv.box.x1, px + pad), y1: Math.max(lv.box.y1, py + pad) };
  };

  const cancelLive = () => {
    const lv = live.current; if (!lv) return;
    live.current = null;
    // put the tiles back exactly as they were
    for (const [i, snap] of lv.snaps) { const cv = canvasRefs.current[i]; if (!cv) continue; const ctx = cv.getContext('2d')!; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(snap, 0, 0); }
  };

  const finishStroke = () => {
    const lv = live.current; if (!lv) return;
    live.current = null;
    const st = lv.stroke;
    if (st.p.length === 3 && st.t !== 'pen') st.p.push(st.p[0] + 0.02, st.p[1] + 0.02, st.p[2]);
    const final: Stroke = { t: st.t, c: st.c, s: st.s, p: simplifyPoints(st.p, 0.6) };
    doc.strokes.push(final);
    pushAction(addAction([final]));
    syncHeight();
    markDirty(strokeBBox(final));
    // tiles currently show the raw live stroke; the repaint swaps in the smoothed, simplified one
    for (const i of lv.snaps.keys()) dirty.current.add(i);
    scheduleFlush();
  };

  const cursorMove = (clientX: number, clientY: number, show: boolean) => {
    const el = cursorRef.current, pg = pageRef.current; if (!el || !pg) return;
    if (!show || toolRef.current !== 'eraser') { el.style.display = 'none'; return; }
    const r = pg.getBoundingClientRect(); const d = eraserRRef.current * 2 * L.current.cssScale;
    el.style.display = 'block'; el.style.width = `${d}px`; el.style.height = `${d}px`;
    el.style.left = `${clientX - r.left - d / 2}px`; el.style.top = `${clientY - r.top - d / 2}px`;
  };

  const startScrollGesture = () => {
    const pts = [...touches.current.values()];
    if (!pts.length) { gesture.current = null; return; }
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length, cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    const dist = pts.length >= 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    gesture.current = { lastCx: cx, lastCy: cy, lastDist: dist, vx: 0, vy: 0, t: performance.now() };
    if (inertia.current) { cancelAnimationFrame(inertia.current); inertia.current = 0; }
  };
  const moveGesture = () => {
    const g = gesture.current, el = scrollRef.current; if (!g || !el) return;
    const pts = [...touches.current.values()]; if (!pts.length) return;
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length, cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    const now = performance.now(), dt = Math.max(1, now - g.t);
    el.scrollLeft -= cx - g.lastCx; el.scrollTop -= cy - g.lastCy;
    g.vx = (cx - g.lastCx) / dt; g.vy = (cy - g.lastCy) / dt; g.t = now;
    if (pts.length >= 2) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (g.lastDist > 0 && dist > 0) zoomTo(zoomRefLive.current * (dist / g.lastDist), { cx, cy });
      g.lastDist = dist;
    }
    g.lastCx = cx; g.lastCy = cy;
  };
  const endGesture = () => {
    const g = gesture.current, el = scrollRef.current; gesture.current = null;
    if (!g || !el || touches.current.size > 0) return;
    let vx = g.vx, vy = g.vy;
    if (performance.now() - g.t > 80) return;
    const step = () => { vx *= 0.95; vy *= 0.95; el.scrollLeft -= vx * 16; el.scrollTop -= vy * 16; inertia.current = Math.abs(vx) + Math.abs(vy) > 0.02 ? requestAnimationFrame(step) : 0; };
    inertia.current = requestAnimationFrame(step);
  };

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    setFlyout(false); setMenu(false);
    if (e.pointerType === 'pen' && touchDrawRef.current) setTouchDraw(false);          // a stylus is in use → fingers just scroll
    if (e.pointerType === 'touch') {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.current.size >= 2) { cancelLive(); erasing.current = null; lassoPts.current = null; if (lassoPathRef.current) lassoPathRef.current.setAttribute('d', ''); startScrollGesture(); return; }
      if (!touchDrawRef.current) { startScrollGesture(); return; }
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (live.current || erasing.current || lassoPts.current) return;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    e.preventDefault();
    const { x, y } = toPage(e.clientX, e.clientY);
    const pr = e.pointerType === 'mouse' ? 0.5 : e.pressure > 0 ? e.pressure : 0.5;
    const penEraser = e.pointerType === 'pen' && ((e.buttons & 32) !== 0 || e.button === 5);
    const t: Tool = penEraser ? 'eraser' : toolRef.current;

    if (t === 'eraser') {
      commitSelection(false);
      erasing.current = { id: e.pointerId, hit: new Set() };
      eraseAt(x, y);
    } else if (t === 'lasso') {
      commitSelection(false);
      lassoPts.current = { id: e.pointerId, pts: [x, y], moved: 0 };
      lassoPathRef.current?.setAttribute('d', `M${x},${y}`);
    } else {
      commitSelection(false);
      const kind: StrokeKind = t;
      const c = cfgRef.current[kind];
      const snap = nearRuler(x, y);
      const p0 = snap ? snapToRuler(x, y) : { x, y };
      const stroke: Stroke = { t: kind, c: c.c, s: c.s, p: [p0.x, p0.y, pr] };
      const pad = (kind === 'hl' ? c.s * 3.4 : c.s * 1.6) / 2 + 2;
      live.current = { id: e.pointerId, kind, stroke, snaps: new Map(), box: { x0: p0.x - pad, y0: p0.y - pad, x1: p0.x + pad, y1: p0.y + pad }, snap, last: p0, pointerType: e.pointerType };
      paintLive();
    }
  };

  const eraseAt = (x: number, y: number) => {
    const er = erasing.current; if (!er) return;
    const hits = strokesAt(doc.strokes, x, y, eraserRRef.current).map((i) => doc.strokes[i]).filter((s) => !er.hit.has(s));
    if (!hits.length) return;
    let box: BBox | null = null;
    for (const s of hits) { er.hit.add(s); hidden.current.add(s); box = unionBBox(box, strokeBBox(s)); }
    markDirty(box);
  };

  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') {
      if (touches.current.has(e.pointerId)) touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (gesture.current) { moveGesture(); return; }
    } else cursorMove(e.clientX, e.clientY, true);
    const lv = live.current;
    if (lv && lv.id === e.pointerId) {
      const evs = (e.nativeEvent as PointerEvent).getCoalescedEvents?.();
      const list = evs && evs.length ? evs : [e.nativeEvent as PointerEvent];
      for (const ev of list) {
        const { x, y } = toPage(ev.clientX, ev.clientY);
        addPoint(lv, x, y, lv.pointerType === 'mouse' ? 0.5 : ev.pressure > 0 ? ev.pressure : 0.5);
      }
      queueLivePaint();
      return;
    }
    if (erasing.current && erasing.current.id === e.pointerId) {
      const evs = (e.nativeEvent as PointerEvent).getCoalescedEvents?.();
      for (const ev of evs && evs.length ? evs : [e.nativeEvent as PointerEvent]) { const p = toPage(ev.clientX, ev.clientY); eraseAt(p.x, p.y); }
      return;
    }
    const lp = lassoPts.current;
    if (lp && lp.id === e.pointerId) {
      const { x, y } = toPage(e.clientX, e.clientY);
      const n = lp.pts.length; lp.moved += Math.hypot(x - lp.pts[n - 2], y - lp.pts[n - 1]);
      lp.pts.push(x, y);
      lassoPathRef.current?.setAttribute('d', 'M' + lp.pts.reduce((a, v, i) => a + (i % 2 === 0 ? (i ? 'L' : '') + v : ',' + v), ''));
    }
  };

  const onPointerUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') {
      touches.current.delete(e.pointerId);
      if (gesture.current) { if (touches.current.size >= 1) startScrollGesture(); else endGesture(); return; }
    }
    const lv = live.current;
    if (lv && lv.id === e.pointerId) {
      if (livePaintQueued.current) { cancelAnimationFrame(livePaintQueued.current); livePaintQueued.current = 0; }
      finishStroke(); return;
    }
    const er = erasing.current;
    if (er && er.id === e.pointerId) {
      erasing.current = null;
      const items = [...er.hit].map((s) => ({ i: doc.strokes.indexOf(s), s })).filter((x) => x.i >= 0).sort((a, b) => a.i - b.i);
      hidden.current = new Set();
      if (items.length) {
        const set = new Set(items.map((x) => x.s));
        doc.strokes = doc.strokes.filter((s) => !set.has(s));
        pushAction(removeAction(items));
      }
      return;
    }
    const lp = lassoPts.current;
    if (lp && lp.id === e.pointerId) {
      lassoPts.current = null; lassoPathRef.current?.setAttribute('d', '');
      if (lp.moved < 8) {                                   // a tap: pick the stroke under the finger
        const x = lp.pts[0], y = lp.pts[1];
        const idx = strokesAt(doc.strokes, x, y, 8); const top = idx.length ? doc.strokes[idx[idx.length - 1]] : null;
        if (top) setSelection([top]);
      } else {
        const picked = strokesInLasso(doc.strokes, lp.pts);
        if (picked.length) setSelection(picked);
      }
    }
  };
  const onPointerCancel = (e: RPointerEvent<HTMLDivElement>) => {
    touches.current.delete(e.pointerId);
    if (live.current?.id === e.pointerId) cancelLive();
    if (erasing.current?.id === e.pointerId) { hidden.current = new Set(); markDirty({ x0: 0, y0: 0, x1: PAGE_W, y1: doc.h }); erasing.current = null; }
    if (lassoPts.current?.id === e.pointerId) { lassoPts.current = null; lassoPathRef.current?.setAttribute('d', ''); }
    if (!touches.current.size) gesture.current = null;
  };

  // ---- selection / ruler handle dragging -------------------------------------------------------------------------
  const drag = (e: RPointerEvent<HTMLElement | SVGElement>, onMove: (px: number, py: number, dxP: number, dyP: number) => void, onEnd?: () => void) => {
    e.stopPropagation(); e.preventDefault();
    const target = e.currentTarget as Element; target.setPointerCapture(e.pointerId);
    let last = toPage(e.clientX, e.clientY);
    const move = (ev: PointerEvent) => { if (ev.pointerId !== e.pointerId) return; const p = toPage(ev.clientX, ev.clientY); onMove(p.x, p.y, p.x - last.x, p.y - last.y); last = p; };
    const up = (ev: PointerEvent) => { if (ev.pointerId !== e.pointerId) return; target.removeEventListener('pointermove', move as EventListener); target.removeEventListener('pointerup', up as EventListener); target.removeEventListener('pointercancel', up as EventListener); onEnd?.(); };
    target.addEventListener('pointermove', move as EventListener); target.addEventListener('pointerup', up as EventListener); target.addEventListener('pointercancel', up as EventListener);
  };
  const selCenter = () => { const b = selRef.current!.box; return { cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2 }; };
  const onSelMove = (e: RPointerEvent<HTMLElement>) => drag(e, (_x, _y, dx, dy) => { xf.current.dx += dx; xf.current.dy += dy; applyXf(); });
  const onSelScale = (e: RPointerEvent<HTMLElement>) => {
    const { cx, cy } = selCenter(); const st = xf.current;
    const start = toPage(e.clientX, e.clientY); const d0 = Math.hypot(start.x - (cx + st.dx), start.y - (cy + st.dy)) || 1; const sc0 = st.sc;
    drag(e, (x, y) => { xf.current.sc = clamp(sc0 * (Math.hypot(x - (cx + xf.current.dx), y - (cy + xf.current.dy)) / d0), 0.2, 6); applyXf(); });
  };
  const onSelRotate = (e: RPointerEvent<HTMLElement>) => {
    const { cx, cy } = selCenter(); const st = xf.current;
    const start = toPage(e.clientX, e.clientY); const a0 = Math.atan2(start.y - (cy + st.dy), start.x - (cx + st.dx)); const r0 = st.rot;
    drag(e, (x, y) => {
      let r = r0 + (Math.atan2(y - (cy + xf.current.dy), x - (cx + xf.current.dx)) - a0);
      const snap = Math.round(r / (Math.PI / 12)) * (Math.PI / 12); if (Math.abs(r - snap) < 0.05) r = snap;
      xf.current.rot = r; applyXf();
    });
  };

  const rulerMoveAll = (e: RPointerEvent<SVGElement>) => drag(e, (_x, _y, dx, dy) => setRuler((r) => (r ? { x1: r.x1 + dx, y1: r.y1 + dy, x2: r.x2 + dx, y2: r.y2 + dy } : r)));
  const rulerMoveEnd = (which: 1 | 2) => (e: RPointerEvent<SVGElement>) => drag(e, (x, y) => setRuler((r) => {
    if (!r) return r;
    const ox = which === 1 ? r.x2 : r.x1, oy = which === 1 ? r.y2 : r.y1;
    let ang = Math.atan2(y - oy, x - ox); const len = Math.max(120, Math.hypot(x - ox, y - oy));
    const step = Math.PI / 12, snap = Math.round(ang / step) * step; if (Math.abs(ang - snap) < 0.04) ang = snap;   // click into 15° steps
    const nx = ox + Math.cos(ang) * len, ny = oy + Math.sin(ang) * len;
    return which === 1 ? { ...r, x1: nx, y1: ny } : { ...r, x2: nx, y2: ny };
  }));
  const toggleRuler = () => {
    if (ruler) { setRuler(null); return; }
    const el = scrollRef.current; const top = el ? el.scrollTop / L.current.cssScale : 0;
    setRuler({ x1: 120, y1: top + 260, x2: 680, y2: top + 260 });
  };

  // ---- tool switching, keyboard, lifecycle -----------------------------------------------------------------------
  const pickTool = (t: Tool) => {
    if (t === tool) { if (t !== 'lasso') setFlyout((f) => !f); return; }
    commitSelection(false); setTool(t); setFlyout(false);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement | null)?.closest('input, textarea');
      if (typing) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selRef.current) { e.preventDefault(); deleteSelection(); }
      else if (e.key === 'Escape') { if (selRef.current) commitSelection(false); else { setFlyout(false); setMenu(false); } }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, deleteSelection, commitSelection]);
  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomTo(zoomRefLive.current * Math.exp(-e.deltaY * 0.0025), { cx: e.clientX, cy: e.clientY }); } };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomTo]);
  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const hide = () => { commitSelection(false); void flushSave(); };
    window.addEventListener('pagehide', hide);
    return () => { document.body.style.overflow = prev; window.removeEventListener('pagehide', hide); commitSelection(false); void flushSave(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = async () => { commitSelection(false); await flushSave(); if (dirtyDoc.current) { if (!window.confirm('This page could not be saved yet. Leave anyway?')) return; } onClose(); };

  // ---- render ----------------------------------------------------------------------------------------------------
  const brush = tool === 'pen' || tool === 'pencil' || tool === 'hl' ? cfg[tool] : null;
  const palette = tool === 'hl' ? HL_COLORS : PEN_COLORS;
  const setBrush = (patch: Partial<ToolCfg>) => { if (tool === 'pen' || tool === 'pencil' || tool === 'hl') setCfg((c) => ({ ...c, [tool]: { ...c[tool], ...patch } })); };
  const canUndo = undoStack.current.length > 0, canRedo = redoStack.current.length > 0;
  const selAllHl = !!sel && sel.strokes.every((s) => s.t === 'hl');
  const selBox = sel?.box;
  const selW = selBox ? selBox.x1 - selBox.x0 : 0, selH = selBox ? selBox.y1 - selBox.y0 : 0;

  const toolBtn = (id: Tool, label: string, icon: ReactNode, color?: string) => (
    <button key={id} onClick={() => pickTool(id)} aria-label={label} aria-pressed={tool === id} title={label} data-testid={`ink-tool-${id}`}
      className={cn('relative grid size-10 shrink-0 place-items-center rounded-xl transition-colors', tool === id ? 'bg-primary/12 text-primary ring-1 ring-primary/40' : 'text-muted-foreground hover:bg-muted')}>
      {icon}
      {color && <span className="absolute bottom-1 left-1/2 h-1 w-4 -translate-x-1/2 rounded-full" style={{ background: color }} />}
    </button>
  );
  const iconBtn = (label: string, onClick: () => void, icon: ReactNode, disabled = false, testId?: string) => (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={label} data-testid={testId} className="grid size-9 shrink-0 place-items-center rounded-lg text-foreground hover:bg-muted disabled:opacity-35">{icon}</button>
  );

  const statusEl = status === 'saving' ? <span className="inline-flex items-center gap-1"><Loader2 size={12} className="animate-spin" />Saving…</span>
    : status === 'dirty' ? <span>Unsaved…</span>
    : status === 'error' ? <button onClick={() => { dirtyDoc.current = true; void flushSave(); }} className="inline-flex items-center gap-1 font-bold text-destructive" data-testid="ink-retry"><AlertTriangle size={12} />Retry save</button>
    : <span className="inline-flex items-center gap-1 text-[#287058]"><Check size={12} />Saved</span>;

  const ui = (
    <div className="fixed inset-0 z-[80] flex h-[100dvh] flex-col bg-muted text-foreground" role="dialog" aria-label="Handwritten note" data-testid="ink-editor">
      {/* header */}
      <div className="flex items-center gap-1 border-b border-border bg-card px-2 pt-[max(0.25rem,env(safe-area-inset-top))] pb-1">
        {iconBtn('Back to notes', () => void close(), <ArrowLeft size={18} />, false, 'ink-close')}
        <div className="min-w-0 flex-1 px-1">
          <input value={title} onChange={(e) => { setTitle(e.target.value.slice(0, 160)); scheduleSave(); }} placeholder="Untitled note" className="h-7 w-full bg-transparent text-sm font-extrabold outline-none placeholder:font-semibold placeholder:text-muted-foreground" data-testid="ink-title" />
          <div className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground" aria-live="polite" data-testid="ink-status">{statusEl}{subtitle && <span className="min-w-0 truncate">{subtitle}</span>}</div>
        </div>
        {iconBtn('Undo', undo, <Undo2 size={17} />, !canUndo, 'ink-undo')}
        {iconBtn('Redo', redo, <Redo2 size={17} />, !canRedo, 'ink-redo')}
        <div className="hidden items-center sm:flex">
          {iconBtn('Zoom out', () => zoomTo(zoom / 1.2), <ZoomOut size={16} />)}
          <button onClick={() => zoomTo(1)} className="w-11 text-center text-[11px] font-bold text-muted-foreground" title="Fit width">{Math.round(zoom * 100)}%</button>
          {iconBtn('Zoom in', () => zoomTo(zoom * 1.2), <ZoomIn size={16} />)}
        </div>
        <div className="relative">
          {iconBtn('More', () => { setMenu((m) => !m); setFlyout(false); }, <MoreHorizontal size={18} />, false, 'ink-more')}
          {menu && <div className="absolute right-0 top-10 z-20 w-64 rounded-2xl border border-border bg-card p-3 shadow-xl" data-testid="ink-menu">
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Paper</div>
            <div className="mt-1.5 grid grid-cols-4 gap-1.5">{PAPERS.map((p) => <button key={p.id} onClick={() => setPaper(p.id)} className={cn('rounded-lg border px-1 py-1.5 text-[11px] font-bold', doc.paper === p.id ? 'border-primary bg-primary/10 text-primary' : 'border-border')}>{p.label}</button>)}</div>
            <div className="mt-3 flex items-center justify-between sm:hidden">
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Zoom</span>
              <div className="flex items-center">{iconBtn('Zoom out', () => zoomTo(zoom / 1.2), <ZoomOut size={16} />)}<button onClick={() => zoomTo(1)} className="w-11 text-[11px] font-bold">{Math.round(zoom * 100)}%</button>{iconBtn('Zoom in', () => zoomTo(zoom * 1.2), <ZoomIn size={16} />)}</div>
            </div>
            <button onClick={() => setTouchDraw((v) => !v)} className="mt-3 flex w-full items-center justify-between rounded-xl border border-border px-3 py-2 text-left" data-testid="ink-touch-toggle">
              <span className="flex items-center gap-2 text-xs font-bold"><Hand size={15} />Touch writing</span>
              <span className={cn('h-5 w-9 rounded-full p-0.5 transition-colors', touchDraw ? 'bg-primary' : 'bg-muted-foreground/30')}><span className={cn('block size-4 rounded-full bg-white transition-transform', touchDraw && 'translate-x-4')} /></span>
            </button>
            <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{touchDraw ? 'Fingers write. Use two fingers to scroll and pinch-zoom.' : 'Only a pen or mouse writes; fingers scroll and pinch-zoom.'}</p>
            <button onClick={() => { setMenu(false); clearPage(); }} className="mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/10"><Trash2 size={14} />Clear page</button>
          </div>}
        </div>
      </div>

      {/* tools */}
      <div className="relative border-b border-border bg-card/95">
        <div className="flex items-center gap-0.5 overflow-x-auto px-2 py-1.5 [scrollbar-width:none]" data-testid="ink-toolbar">
          {toolBtn('pen', 'Pen', <PenLine size={19} />, cfg.pen.c)}
          {toolBtn('pencil', 'Pencil', <Pencil size={19} />, cfg.pencil.c)}
          {toolBtn('hl', 'Highlighter', <Highlighter size={19} />, cfg.hl.c)}
          {toolBtn('eraser', 'Eraser', <Eraser size={19} />)}
          {toolBtn('lasso', 'Select', <LassoSelect size={19} />)}
          <button onClick={toggleRuler} aria-label="Ruler" aria-pressed={!!ruler} title="Ruler" data-testid="ink-tool-ruler" className={cn('grid size-10 shrink-0 place-items-center rounded-xl transition-colors', ruler ? 'bg-primary/12 text-primary ring-1 ring-primary/40' : 'text-muted-foreground hover:bg-muted')}><RulerIcon size={19} /></button>
          <span className="mx-1.5 h-6 w-px shrink-0 bg-border" />
          {brush && palette.slice(0, 8).map((c) => <button key={c} onClick={() => setBrush({ c })} aria-label={`Colour ${c}`} className={cn('size-6 shrink-0 rounded-full border border-black/10 transition-transform', brush.c.toLowerCase() === c.toLowerCase() && 'scale-110 ring-2 ring-primary ring-offset-1 ring-offset-card')} style={{ background: c }} />)}
          {tool === 'eraser' && <span className="px-1 text-[11px] font-semibold text-muted-foreground">Touch a stroke to erase it</span>}
          {tool === 'lasso' && !sel && <span className="px-1 text-[11px] font-semibold text-muted-foreground">Circle ink to select · tap a stroke</span>}
        </div>
        {flyout && (brush || tool === 'eraser') && <div className="absolute left-2 right-2 top-full z-20 mt-1 max-w-sm rounded-2xl border border-border bg-card p-3 shadow-xl sm:left-auto sm:right-auto" data-testid="ink-flyout">
          {brush ? <>
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Thickness</div>
            <div className="mt-1.5 flex items-center gap-2">
              {TOOL_SIZES[tool as StrokeKind].map((s) => <button key={s} onClick={() => setBrush({ s })} aria-label={`Size ${s}`} className={cn('grid size-10 place-items-center rounded-xl border', brush.s === s ? 'border-primary bg-primary/10' : 'border-border')}><span className="rounded-full" style={{ width: Math.min(26, 4 + s * (tool === 'hl' ? 2.4 : 2.6)), height: tool === 'hl' ? 8 : Math.min(26, 3 + s * 2), background: brush.c, opacity: tool === 'hl' ? 0.55 : 1 }} /></button>)}
              <input type="range" min={tool === 'hl' ? 2 : 1} max={tool === 'hl' ? 12 : 10} step={0.5} value={brush.s} onChange={(e) => setBrush({ s: Number(e.target.value) })} className="ml-1 min-w-0 flex-1" aria-label="Thickness" />
            </div>
            <div className="mt-3 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Colour</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {palette.map((c) => <button key={c} onClick={() => setBrush({ c })} aria-label={`Colour ${c}`} className={cn('size-8 rounded-full border border-black/10', brush.c.toLowerCase() === c.toLowerCase() && 'ring-2 ring-primary ring-offset-2 ring-offset-card')} style={{ background: c }} />)}
              <label className="relative grid size-8 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-border text-[10px] font-bold text-muted-foreground" title="Custom colour">+<input type="color" value={HEXC.test(brush.c) ? brush.c : '#000000'} onChange={(e) => setBrush({ c: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Custom colour" /></label>
            </div>
          </> : <>
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Eraser size</div>
            <input type="range" min={6} max={60} value={eraserR} onChange={(e) => setEraserR(Number(e.target.value))} className="mt-2 w-full" aria-label="Eraser size" />
          </>}
        </div>}
        {sel && <div className="flex items-center gap-1.5 overflow-x-auto border-t border-border bg-primary/5 px-2 py-1.5 [scrollbar-width:none]" data-testid="ink-selection-bar">
          <button onClick={deleteSelection} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-destructive hover:bg-destructive/10" data-testid="ink-sel-delete"><Trash2 size={13} />Delete</button>
          <button onClick={duplicateSelection} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold hover:bg-muted" data-testid="ink-sel-duplicate"><Copy size={13} />Duplicate</button>
          <span className="mx-1 h-5 w-px shrink-0 bg-border" />
          {(selAllHl ? HL_COLORS : PEN_COLORS).map((c) => <button key={c} onClick={() => recolorSelection(c)} aria-label={`Recolour ${c}`} className="size-5 shrink-0 rounded-full border border-black/10" style={{ background: c }} />)}
          <button onClick={() => commitSelection(false)} className="ml-auto shrink-0 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground" data-testid="ink-sel-done">Done</button>
        </div>}
      </div>

      {tooBig && <div className="flex items-center gap-2 bg-[#fdf6e8] px-3 py-1.5 text-[11px] font-semibold text-[#8a5a12]"><AlertTriangle size={13} />This page is getting very large — start a new note soon so it keeps saving.</div>}

      {/* page */}
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto overscroll-contain px-2 py-3" data-testid="ink-scroll">
        <div ref={pageRef} className="relative mx-auto select-none rounded-sm bg-[#fffdf8] shadow-[0_6px_30px_-8px_rgba(0,0,0,0.35)]"
          style={{ width: cssW, height: docH * cssScale, touchAction: 'none', cursor: tool === 'eraser' ? 'none' : tool === 'lasso' ? 'crosshair' : 'crosshair', marginBottom: 80 }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}
          onPointerLeave={(e) => { if (e.pointerType !== 'touch') cursorMove(0, 0, false); }} onContextMenu={(e) => e.preventDefault()} data-testid="ink-page">
          {Array.from({ length: tileCount }, (_, i) => {
            const y0 = i * TILE, y1 = Math.min(docH, y0 + TILE);
            return <canvas key={i} ref={(el) => { canvasRefs.current[i] = el; }} width={Math.round(PAGE_W * pxScale)} height={Math.max(1, Math.round((y1 - y0) * pxScale))}
              style={{ position: 'absolute', left: 0, top: y0 * cssScale, width: cssW, height: (y1 - y0) * cssScale, pointerEvents: 'none' }} />;
          })}

          {/* lasso path + ruler */}
          <svg className="pointer-events-none absolute left-0 top-0" width={cssW} height={docH * cssScale} viewBox={`0 0 ${PAGE_W} ${docH}`} preserveAspectRatio="none">
            <path ref={lassoPathRef} d="" fill="rgba(50,100,123,.08)" stroke="#32647b" strokeWidth={1.6} strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
            {ruler && (() => {
              const len = Math.hypot(ruler.x2 - ruler.x1, ruler.y2 - ruler.y1), ang = (Math.atan2(ruler.y2 - ruler.y1, ruler.x2 - ruler.x1) * 180) / Math.PI;
              const ticks: ReactNode[] = [];
              for (let u = 0; u <= len; u += 10) { const big = u % 100 === 0, mid = u % 50 === 0; ticks.push(<line key={u} x1={u} x2={u} y1={-28} y2={-28 + (big ? 18 : mid ? 12 : 7)} stroke="rgba(40,70,120,.7)" strokeWidth={big ? 1.4 : 0.9} />); if (big && u > 0) ticks.push(<text key={`t${u}`} x={u + 3} y={-6} fontSize={10} fill="rgba(40,70,120,.8)">{u / 100}</text>); }
              return <g transform={`translate(${ruler.x1} ${ruler.y1}) rotate(${ang})`} data-testid="ink-ruler">
                <rect x={0} y={-28} width={len} height={56} rx={7} fill="rgba(120,160,215,.28)" stroke="rgba(50,90,160,.6)" strokeWidth={1.2} />
                {ticks}
                <circle cx={len / 2} cy={10} r={15} fill="rgba(255,255,255,.9)" stroke="rgba(50,90,160,.8)" strokeWidth={1.5} style={{ pointerEvents: 'auto', cursor: 'move', touchAction: 'none' }} onPointerDown={rulerMoveAll} />
                <circle cx={0} cy={0} r={13} fill="rgba(255,255,255,.9)" stroke="rgba(50,90,160,.8)" strokeWidth={1.5} style={{ pointerEvents: 'auto', cursor: 'grab', touchAction: 'none' }} onPointerDown={rulerMoveEnd(1)} />
                <circle cx={len} cy={0} r={13} fill="rgba(255,255,255,.9)" stroke="rgba(50,90,160,.8)" strokeWidth={1.5} style={{ pointerEvents: 'auto', cursor: 'grab', touchAction: 'none' }} onPointerDown={rulerMoveEnd(2)} />
              </g>;
            })()}
          </svg>

          {/* floating selection: bitmap + frame with handles */}
          {sel && selBox && <>
            <div ref={selWrapRef} className="pointer-events-none absolute" style={{ left: selBox.x0 * cssScale, top: selBox.y0 * cssScale, width: selW * cssScale, height: selH * cssScale, transformOrigin: '50% 50%' }}>
              <canvas ref={selCanvasRef} width={Math.max(1, Math.round(selW * selScale))} height={Math.max(1, Math.round(selH * selScale))} style={{ width: '100%', height: '100%' }} />
            </div>
            <div ref={selFrameRef} onPointerDown={onSelMove} data-testid="ink-selection" className="absolute cursor-move border-dashed border-primary" style={{ left: selBox.x0 * cssScale, top: selBox.y0 * cssScale, width: selW * cssScale, height: selH * cssScale, transformOrigin: '50% 50%', borderWidth: 1.5, background: 'rgba(50,100,123,.05)', touchAction: 'none' }}>
              {(['-9px -9px', '-9px calc(100% - 9px)', 'calc(100% - 9px) -9px', 'calc(100% - 9px) calc(100% - 9px)'] as const).map((pos) => { const [l, t] = pos.split(' '); return <span key={pos} data-h onPointerDown={onSelScale} className="absolute size-[18px] cursor-nwse-resize rounded-full border-2 border-primary bg-card" style={{ left: l, top: t, touchAction: 'none' }} />; })}
              <span data-h onPointerDown={onSelRotate} className="absolute size-[18px] cursor-grab rounded-full border-2 border-primary bg-primary" style={{ left: 'calc(50% - 9px)', top: -34, touchAction: 'none' }} title="Rotate" />
              <span className="pointer-events-none absolute left-1/2 top-[-17px] h-[17px] w-px -translate-x-1/2 bg-primary" />
            </div>
          </>}

          <div ref={cursorRef} className="pointer-events-none absolute hidden rounded-full border-2 border-foreground/60 bg-white/30" />
        </div>
      </div>
    </div>
  );
  return createPortal(ui, document.body);
}

