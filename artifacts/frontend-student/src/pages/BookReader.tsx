// Book reader — code-split via React.lazy() in App.tsx. Used for PAID books a
// student has unlocked AND for free books, so both get the same full reader.
//
// What this page does and doesn't have, on purpose:
//  * It never holds the PDF. Each page is a watermarked JPEG rendered by the
//    server (see api-server/src/lib/bookReader.ts), painted onto a <canvas>
//    and not kept as a URL, so there's no file to download, print or "save as".
//  * Highlighting works on word BOXES the server sends (no text), so a
//    highlight is a range of boxes — and there's nothing to copy. Search works
//    the same way: the server returns where the words are, never the text.
//  * Paid books get a handful of best-effort browser guards (no context menu,
//    copy, print, common save/print shortcuts; the page is veiled when the tab
//    loses focus or PrintScreen is pressed). These only deter — the real
//    protection is that every page carries the reader's own name baked into its
//    pixels. Free books skip the guards (there is nothing to protect) but keep
//    the same page rendering.
//  * Everything the student makes here — highlights, notes, bookmarks and the
//    reading position — lives on their account. The Save button flushes any
//    pending note/position and re-syncs from the server so they can see it stuck.
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'wouter';
import {
  ArrowLeft, BookOpen, BoxSelect, Bookmark, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Brush, Eraser, EyeOff, Highlighter, List, ListOrdered, PenLine,
  LockKeyhole, Maximize, Minimize, MousePointer2, Save, Search, ShieldCheck, Sun, Moon, Trash2, X, ZoomIn, ZoomOut,
} from 'lucide-react';
import {
  ApiRequestError, booksApi, resolveUploadUrl,
  type AdminBookStudent, type BookBookmark, type BookHighlight, type BookSearchHit, type HighlightColor, type NewBookHighlight, type WordBox,
} from '@/lib/api';
import { BrandSpinner, cn, useFocusMode } from '@/lib/shared';
import { toast } from '@/hooks/use-toast';
import { hitWord, inkNear, inkPath, lineRects, simplifyInk, type InkPts, type Rect } from '@/lib/reader-geometry';
import { clampW, colorHex, EDGE_COLORS, HIGHLIGHTER_COLORS, isHex, MARKER_W, PEN_COLORS, PEN_W } from '@/lib/reader-palette';
import { clearPageCache, loadPageImage, setReaderFocus } from '@/lib/page-loader';
import { enableScreenshotGuard, disableScreenshotGuard } from '@/lib/nativeScreenshotGuard';

type Mode = 'read' | 'text' | 'area' | 'pen' | 'marker' | 'erase';
type Theme = 'light' | 'sepia' | 'night';
type PanelTab = 'highlights' | 'bookmarks' | 'contents' | 'search';
type Found = { start: number; end: number; active: boolean };

const THEMES: Record<Theme, { label: string; filter?: string; room?: string }> = {
  light: { label: 'Light' },
  sepia: { label: 'Sepia', filter: 'sepia(0.45) contrast(0.96) brightness(0.98)', room: '#efe6cf' },
  night: { label: 'Night', filter: 'invert(0.9) hue-rotate(180deg)', room: '#15171c' },
};
const NEXT_THEME: Record<Theme, Theme> = { light: 'sepia', sepia: 'night', night: 'light' };

// Set while two fingers are pinching, so the page layers ignore those touches (no stray strokes / scrolling).
const readerGesture = { pinching: false, penDown: false, onStroke: null as null | (() => void) };

const isField = (t: EventTarget | null): boolean => t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
const readPref = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => { try { const v = localStorage.getItem(key) as T | null; return v && allowed.includes(v) ? v : fallback; } catch { return fallback; } };

// ---------------------------------------------------------------------------

function useReaderGuards(veil: (ms?: number) => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const stop = (e: Event) => { if (isField(e.target)) return; e.preventDefault(); };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      if (k === 'printscreen') { veil(3000); try { void navigator.clipboard?.writeText(' '); } catch { /* clipboard may be unavailable */ } }
      if (mod && ['s', 'p', 'c', 'x', 'a', 'u', 'o'].includes(k)) { if (isField(e.target) && ['c', 'x', 'a'].includes(k)) return; e.preventDefault(); }
      if (k === 'f12' || (mod && e.shiftKey && ['i', 'j', 'c'].includes(k))) e.preventDefault();
    };
    const onHide = () => { if (document.visibilityState === 'hidden') veil(); };
    const onBlur = () => veil();
    const events: Array<[string, EventListener]> = [['contextmenu', stop], ['copy', stop], ['cut', stop], ['dragstart', stop], ['selectstart', stop], ['beforeprint', onBlur]];
    events.forEach(([n, f]) => document.addEventListener(n, f));
    document.addEventListener('keydown', onKey); document.addEventListener('keyup', onKey);
    document.addEventListener('visibilitychange', onHide); window.addEventListener('blur', onBlur);
    window.addEventListener('beforeprint', onBlur);
    return () => {
      events.forEach(([n, f]) => document.removeEventListener(n, f));
      document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey);
      document.removeEventListener('visibilitychange', onHide); window.removeEventListener('blur', onBlur);
      window.removeEventListener('beforeprint', onBlur);
    };
  }, [veil, enabled]);
}

/** Best-effort DevTools-open heuristic: an undocked or docked panel shrinks
 * the viewport relative to the outer window by a wide margin that normal
 * browser chrome (toolbars, mobile address bar) doesn't. Polled rather than
 * event-driven since there's no "devtools opened" event. This exists to stop
 * the easy case — someone opening the console and running
 * `canvas.toDataURL()` to pull a page straight off the rendered bitmap — not
 * to detect every inspector; a determined user can still work around a
 * heuristic. Screen/photo capture of the pixels themselves can never be
 * blocked from inside the page (see bookReader.ts's header comment) — this
 * only raises the bar for the console shortcut, and pairs with a watermark
 * baked into every page so anything that does get out is traceable. */
function useDevtoolsGuard(enabled: boolean): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!enabled) { setOpen(false); return; }
    const THRESHOLD = 180;
    const id = window.setInterval(() => {
      const wide = window.outerWidth - window.innerWidth > THRESHOLD;
      const tall = window.outerHeight - window.innerHeight > THRESHOLD;
      setOpen(wide || tall);
    }, 800);
    return () => window.clearInterval(id);
  }, [enabled]);
  return open;
}

// ---------------------------------------------------------------------------
// Pen / marker flyout, laid out like the Microsoft Edge PDF viewer's: a colour grid, a live preview stroke, a thickness slider.
function PenFlyout({ kind, color, onColor, width, onWidth, range, onClose }: {
  kind: 'pen' | 'marker'; color: HighlightColor; onColor: (c: HighlightColor) => void; width: number; onWidth: (w: number) => void; range: { min: number; max: number; def: number }; onClose: () => void;
}) {
  const hex = colorHex(color);
  const t = (width - range.min) / (range.max - range.min);
  const px = Math.max(1.5, width * 900);
  const light = (h: string) => { const n = parseInt(h.slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 150; };
  return <div className="mb-2 rounded-2xl border border-border bg-card p-3 shadow-lg" role="dialog" aria-label={kind === 'pen' ? 'Pen options' : 'Marker options'} data-testid="flyout-pen">
    <div className="mb-2 flex items-center"><span className="text-xs font-extrabold">Colours</span>
      <button type="button" onClick={onClose} className="ml-auto grid size-6 place-items-center rounded-md hover:bg-muted" aria-label="Close pen options"><X size={14} /></button></div>
    <div className="grid grid-cols-6 gap-2" role="group" aria-label="Colours">
      {EDGE_COLORS.map((c) => { const on = c.hex.toLowerCase() === hex.toLowerCase();
        return <button key={c.id} type="button" onClick={() => onColor(c.hex)} aria-label={c.label} aria-pressed={on} title={c.label}
          className={cn('mx-auto grid size-8 place-items-center rounded-full border shadow-sm transition-transform', on ? 'scale-110 border-2 border-foreground ring-2 ring-primary/40' : 'border-black/15 hover:scale-105')} style={{ background: c.hex }} data-testid={`flyout-color-${c.hex.slice(1)}`}>
          {on && <Check size={14} strokeWidth={3} className={light(c.hex) ? 'text-black/70' : 'text-white'} />}
        </button>; })}
    </div>
    <svg viewBox="0 0 200 36" className="mt-3 h-9 w-full rounded-lg bg-muted/40" aria-hidden="true">
      <path d="M8 24 C 40 4, 70 4, 100 18 S 160 32, 192 12" fill="none" stroke={hex} strokeWidth={Math.min(px, 22)} strokeLinecap="round" opacity={kind === 'marker' ? 0.5 : 1} />
    </svg>
    <div className="mt-3 text-xs font-extrabold">Thickness</div>
    <input type="range" min={0} max={1} step={0.01} value={Math.min(1, Math.max(0, t))} onChange={(e) => onWidth(clampW(range.min + Number(e.target.value) * (range.max - range.min), range))}
      className="mt-1 w-full accent-primary" aria-label="Thickness" data-testid="flyout-thickness" />
    <div className="flex justify-between text-[10px] font-semibold text-muted-foreground"><span>Thin</span><span>Thick</span></div>
  </div>;
}

// ---------------------------------------------------------------------------

function PageViewBase({ bookId, pageNo, size, widthPx, highlights, found, bookmarked, theme, mode, color, penWidth, fingerScroll, freeKey, onCreate, onOpen, onErase, pageRef }: {
  bookId: number; freeKey: string | null; pageNo: number; size: { w: number; h: number }; widthPx: number; highlights: BookHighlight[]; found: Found[]; bookmarked: boolean; theme: Theme; mode: Mode; color: HighlightColor; penWidth: number; fingerScroll: boolean;
  onCreate: (h: NewBookHighlight) => void; onOpen: (h: BookHighlight) => void; onErase: (id: number) => void; pageRef: (el: HTMLDivElement | null) => void;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [near, setNear] = useState(false);
  const [drawnWidth, setDrawnWidth] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const height = Math.round(widthPx * (size.h / size.w));
  const aspect = size.h / size.w;
  const inking = mode === 'pen' || mode === 'marker';

  useEffect(() => {
    const el = boxRef.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: '1400px 0px' });
    io.observe(el); return () => io.disconnect();
  }, []);

  // Fetch + paint. Re-runs when zoom changes the width bucket. Leaving the
  // "near" zone frees the bitmap so a 900-page book doesn't hold 900 canvases.
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    if (!near) { canvas.width = 1; canvas.height = 1; setDrawnWidth(0); return; }
    const want = Math.min(1600, Math.max(600, Math.ceil((widthPx * Math.min(window.devicePixelRatio || 1, 2)) / 100) * 100));
    if (drawnWidth === want) return;
    let cancelled = false;
    const job = loadPageImage(bookId, pageNo, want, freeKey);
    (async () => {
      try {
        const bitmap = await createImageBitmap(await job.promise);
        if (cancelled) { bitmap.close(); return; }
        canvas.width = bitmap.width; canvas.height = bitmap.height;
        canvas.getContext('2d')?.drawImage(bitmap, 0, 0); bitmap.close();
        setDrawnWidth(want); setFailed(null);
      } catch (err) { if (!cancelled) setFailed(err instanceof ApiRequestError ? err.message : 'This page could not be loaded.'); }
    })();
    return () => { cancelled = true; job.cancel(); };
  }, [near, widthPx, bookId, pageNo, drawnWidth, freeKey]);

  const needWords = near && (mode === 'text' || found.length > 0 || highlights.some((h) => h.kind === 'words'));
  const wordsQ = useQuery({ queryKey: ['book-words', bookId, pageNo], queryFn: () => booksApi.pageWords(bookId, pageNo), enabled: needWords, staleTime: Infinity, gcTime: 5 * 60_000 });
  const words = useMemo(() => wordsQ.data?.words ?? [], [wordsQ.data]);

  // ---- selection (text range / area rectangle) + pen ----
  // Speed notes: the stroke being drawn is painted straight into one <path> (draftRef) once per animation frame,
  // so drawing never re-renders React; the page rectangle is measured once per stroke, not per point; and the
  // saved strokes' SVG paths are computed once (memo), not on every render.
  const [sel, setSel] = useState<{ a: number; b: number } | { rect: Rect; x0: number; y0: number } | null>(null);
  const inkRef = useRef<InkPts | null>(null);
  const draftRef = useRef<SVGPathElement | null>(null);
  const draftD = useRef('');
  const rafRef = useRef(0);
  const inertiaRef = useRef(0);
  const geo = useRef({ left: 0, top: 0, width: 1, height: 1, sx: 0, sy: 0 });
  const erasing = useRef(false);
  const touchScroll = useRef<{ id: number; x: number; y: number; t: number; vx: number; vy: number } | null>(null);
  const strokes = useMemo(() => highlights.filter((h) => h.kind === 'ink' && h.ink), [highlights]);
  const strokePaths = useMemo(() => strokes.map((h) => ({ h, d: inkPath(h.ink!.pts, aspect) })), [strokes, aspect]);
  useEffect(() => { if (!inkRef.current) draftRef.current?.setAttribute('d', ''); }, [strokes]); // the saved stroke has appeared: drop the live copy
  useEffect(() => () => { cancelAnimationFrame(rafRef.current); cancelAnimationFrame(inertiaRef.current); cancelAnimationFrame(pend.current.raf); }, []);
  const r4 = (n: number) => Math.round(n * 10000) / 10000;
  const eraseAt = (x: number, y: number) => { for (const h of strokes) if (h.id > 0 && h.ink && inkNear(h.ink.pts, x, y, aspect, Math.max(0.012, h.ink.w * 1.5))) onErase(h.id); };
  // Finger-drag scrolling is applied once per animation frame (not once per touch event), which is what makes it feel smooth.
  const pend = useRef({ dx: 0, dy: 0, raf: 0 });
  const scrollPage = (dx: number, dy: number) => {
    const q = pend.current; q.dx += dx; q.dy += dy;
    if (q.raf) return;
    q.raf = requestAnimationFrame(() => {
      q.raf = 0; const sc = boxRef.current?.closest('[data-reader-scroll]') as HTMLElement | null;
      if (sc && q.dx) sc.scrollLeft += q.dx; if (q.dy) window.scrollBy(0, q.dy); q.dx = 0; q.dy = 0;
    });
  };
  const measure = () => { const r = boxRef.current!.getBoundingClientRect(); geo.current = { left: r.left, top: r.top, width: r.width || 1, height: r.height || 1, sx: window.scrollX, sy: window.scrollY }; };
  const norm = (cx: number, cy: number) => {
    const g = geo.current; // page position now = position when measured, shifted by how far the window has scrolled since
    return { x: Math.min(1, Math.max(0, (cx - (g.left - (window.scrollX - g.sx))) / g.width)), y: Math.min(1, Math.max(0, (cy - (g.top - (window.scrollY - g.sy))) / g.height)) };
  };
  const paintDraft = () => {
    rafRef.current = 0; const p = inkRef.current, el = draftRef.current; if (!p || !el) return;
    const l = p[p.length - 1]; el.setAttribute('d', `${draftD.current}L${r4(l[0])} ${r4(l[1] * aspect)}`);
  };
  const pushPoint = (x: number, y: number): boolean => {
    const p = inkRef.current!; const last = p[p.length - 1];
    if (Math.hypot(x - last[0], (y - last[1]) * aspect) <= 0.0012) return false;
    p.push([x, y]);
    if (p.length >= 3) { const a = p[p.length - 2], b = p[p.length - 1]; draftD.current += `Q${r4(a[0])} ${r4(a[1] * aspect)} ${r4((a[0] + b[0]) / 2)} ${r4(((a[1] + b[1]) / 2) * aspect)}`; }
    return true;
  };
  const down = (e: React.PointerEvent) => {
    if (mode === 'read') return;
    if (e.pointerType === 'touch' && (readerGesture.pinching || readerGesture.penDown)) return; // a resting palm must not scroll or draw while the stylus is writing
    // Pen/eraser selected + finger scrolling: a finger drags the page (so you can read and write without switching tools).
    if ((inking || mode === 'erase') && e.pointerType === 'touch' && fingerScroll) {
      if (!e.isPrimary) return;
      cancelAnimationFrame(inertiaRef.current);
      touchScroll.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), vx: 0, vy: 0 };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); return;
    }
    measure();
    const { x, y } = norm(e.clientX, e.clientY);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (inking) {
      readerGesture.penDown = true; readerGesture.onStroke?.();
      inkRef.current = [[x, y]]; draftD.current = `M${r4(x)} ${r4(y * aspect)}`;
      draftRef.current?.setAttribute('d', `${draftD.current}l0.0001 0`); return;
    }
    if (mode === 'erase') { erasing.current = true; eraseAt(x, y); return; }
    if (mode === 'text') { const i = hitWord(words, x, y); if (i !== null) setSel({ a: i, b: i }); }
    else setSel({ rect: { x, y, w: 0, h: 0 }, x0: x, y0: y });
  };
  const move = (e: React.PointerEvent) => {
    if (readerGesture.pinching && e.pointerType === 'touch') { inkRef.current = null; touchScroll.current = null; erasing.current = false; draftRef.current?.setAttribute('d', ''); return; }
    const ts = touchScroll.current;
    if (ts && ts.id === e.pointerId) {
      const now = performance.now(), dt = Math.max(1, now - ts.t), dx = ts.x - e.clientX, dy = ts.y - e.clientY;
      scrollPage(dx, dy);
      ts.vx = (dx / dt) * 0.8 + ts.vx * 0.2; ts.vy = (dy / dt) * 0.8 + ts.vy * 0.2; ts.x = e.clientX; ts.y = e.clientY; ts.t = now; return;
    }
    if (mode === 'erase') { if (erasing.current) { const { x, y } = norm(e.clientX, e.clientY); eraseAt(x, y); } return; }
    if (inking) {
      if (!inkRef.current) return;
      const edge = 64; if (e.clientY < edge) window.scrollBy(0, -(edge - e.clientY) * 0.5); else if (e.clientY > window.innerHeight - edge) window.scrollBy(0, (e.clientY - (window.innerHeight - edge)) * 0.5);
      // Coalesced events keep fast pen strokes smooth instead of showing straight jumps.
      const evs = typeof e.nativeEvent.getCoalescedEvents === 'function' ? e.nativeEvent.getCoalescedEvents() : [];
      let changed = false;
      for (const ev of evs.length ? evs : [e.nativeEvent]) { const { x, y } = norm(ev.clientX, ev.clientY); if (pushPoint(x, y)) changed = true; }
      if (changed && !rafRef.current) rafRef.current = requestAnimationFrame(paintDraft);
      return;
    }
    if (!sel) return; const { x, y } = norm(e.clientX, e.clientY);
    if ('a' in sel) { const i = hitWord(words, x, y); if (i !== null) setSel({ a: sel.a, b: i }); }
    else setSel({ ...sel, rect: { x: Math.min(x, sel.x0), y: Math.min(y, sel.y0), w: Math.abs(x - sel.x0), h: Math.abs(y - sel.y0) } });
    // Auto-scroll while dragging a highlight near the top/bottom edge of the
    // viewport, so a selection that runs off-screen doesn't force the reader
    // to release the drag, scroll manually, then restart it.
    const EDGE = 64;
    if (e.clientY < EDGE) window.scrollBy(0, -(EDGE - e.clientY) * 0.5);
    else if (e.clientY > window.innerHeight - EDGE) window.scrollBy(0, (e.clientY - (window.innerHeight - EDGE)) * 0.5);
  };
  const up = (e: React.PointerEvent) => {
    const ts = touchScroll.current;
    if (ts && ts.id === e.pointerId) {
      touchScroll.current = null; let { vx, vy } = ts; // flick: keep scrolling a little, slowing down
      if (Math.abs(vx) + Math.abs(vy) > 0.05) { const step = () => { vx *= 0.95; vy *= 0.95; scrollPage(vx * 16, vy * 16); if (Math.abs(vx) + Math.abs(vy) > 0.02) inertiaRef.current = requestAnimationFrame(step); }; inertiaRef.current = requestAnimationFrame(step); }
      return;
    }
    if (mode === 'erase') { erasing.current = false; return; }
    if (inking) {
      const pts = inkRef.current; inkRef.current = null; readerGesture.penDown = false; cancelAnimationFrame(rafRef.current); rafRef.current = 0;
      if (pts && pts.length) { onCreate({ kind: 'ink', page: pageNo, ink: { pts: simplifyInk(pts, aspect), w: penWidth, ...(mode === 'marker' ? { hl: true } : {}) }, color }); window.setTimeout(() => { if (!inkRef.current) draftRef.current?.setAttribute('d', ''); }, 1500); }
      return;
    }
    if (!sel) return;
    if ('a' in sel) onCreate({ kind: 'words', page: pageNo, startWord: Math.min(sel.a, sel.b), endWord: Math.max(sel.a, sel.b), color });
    else if (sel.rect.w > 0.01 && sel.rect.h > 0.01) onCreate({ kind: 'area', page: pageNo, rect: { x: sel.rect.x, y: sel.rect.y, w: Math.min(sel.rect.w, 1 - sel.rect.x), h: Math.min(sel.rect.h, 1 - sel.rect.y) }, color });
    setSel(null);
  };

  const pct = (n: number) => `${n * 100}%`;
  const rectStyle = (r: Rect, extra: React.CSSProperties = {}): React.CSSProperties => ({ position: 'absolute', left: pct(r.x), top: pct(r.y), width: pct(r.w), height: pct(r.h), ...extra });

  return <div ref={(el) => { boxRef.current = el; pageRef(el); }} data-page={pageNo} className="book-page relative mx-auto mb-4 overflow-hidden rounded-sm bg-white shadow-md" style={{ width: widthPx, height, filter: THEMES[theme].filter }}>
    <canvas ref={canvasRef} className="pointer-events-none block h-full w-full select-none" style={{ WebkitUserSelect: 'none' }} aria-label={`Page ${pageNo}`} />
    {!drawnWidth && !failed && <div className="absolute inset-0 grid place-items-center text-muted-foreground"><BrandSpinner size={22} /></div>}
    {failed && <div className="absolute inset-0 grid place-items-center p-6 text-center text-xs font-semibold text-destructive">{failed}</div>}
    <div className="absolute inset-0" style={{ touchAction: mode === 'read' ? 'auto' : 'none', cursor: mode === 'text' ? 'text' : mode === 'area' || inking ? 'crosshair' : mode === 'erase' ? 'cell' : 'default', pointerEvents: mode === 'read' ? 'none' : 'auto' }}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { setSel(null); inkRef.current = null; readerGesture.penDown = false; draftRef.current?.setAttribute('d', ''); erasing.current = false; touchScroll.current = null; }} data-testid={`layer-page-${pageNo}`}>
      {sel && ('a' in sel ? lineRects(words, Math.min(sel.a, sel.b), Math.max(sel.a, sel.b)).map((r, i) => <div key={i} style={rectStyle(r, { background: 'rgba(80,140,255,.35)' })} />) : <div style={rectStyle(sel.rect, { border: '1.5px dashed #3b82f6', background: 'rgba(80,140,255,.15)' })} />)}
    </div>
    {highlights.map((h) => {
      if (h.kind === 'ink') return null;
      const rects = h.kind === 'area' ? (h.rect ? [h.rect] : []) : lineRects(words, h.startWord ?? 0, h.endWord ?? 0);
      return rects.map((r, i) => <div key={`${h.id}-${i}`} onClick={() => mode === 'read' && onOpen(h)} style={rectStyle(r, { background: colorHex(h.color), opacity: 0.4, mixBlendMode: 'multiply', pointerEvents: mode === 'read' ? 'auto' : 'none', cursor: 'pointer', borderRadius: 2 })} data-testid={`highlight-${h.id}`} />);
    })}
    {(strokePaths.length > 0 || inking) && <svg viewBox={`0 0 1 ${aspect}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" style={{ pointerEvents: 'none' }} aria-hidden="true">
      {strokePaths.map(({ h, d }) => <g key={h.id} style={{ pointerEvents: mode === 'read' ? 'stroke' : 'none', cursor: 'pointer' }} onClick={() => mode === 'read' && onOpen(h)} data-testid={`ink-${h.id}`}>
        <path d={d} fill="none" stroke="transparent" strokeWidth={Math.max(h.ink!.w, 0.018)} strokeLinecap="round" strokeLinejoin="round" />
        <path d={d} fill="none" stroke={colorHex(h.color)} strokeWidth={h.ink!.w} strokeLinecap="round" strokeLinejoin="round" opacity={h.ink!.hl ? 0.42 : h.id < 0 ? 0.7 : 1} style={h.ink!.hl ? { mixBlendMode: 'multiply' } : undefined} />
      </g>)}
      <path ref={draftRef} fill="none" stroke={colorHex(color)} strokeWidth={penWidth} strokeLinecap="round" strokeLinejoin="round" opacity={mode === 'marker' ? 0.42 : 1} style={mode === 'marker' ? { mixBlendMode: 'multiply' } : undefined} />
    </svg>}
    {found.map((f, fi) => lineRects(words, f.start, f.end).map((r, i) => <div key={`f-${fi}-${i}`} style={rectStyle(r, { background: f.active ? 'rgba(255,90,0,.55)' : 'rgba(255,170,0,.35)', outline: f.active ? '2px solid rgba(255,90,0,.9)' : undefined, borderRadius: 2, pointerEvents: 'none' })} data-testid="search-hit" />))}
    {bookmarked && <Bookmark size={26} fill="currentColor" className="pointer-events-none absolute right-3 top-0 text-primary drop-shadow" aria-label="Bookmarked" />}
    <div className="pointer-events-none absolute bottom-1 right-2 text-[10px] font-bold text-black/30">{pageNo}</div>
  </div>;
}

const sameList = <T,>(a: T[], b: T[], eq: (x: T, y: T) => boolean): boolean => a === b || (a.length === b.length && a.every((v, i) => eq(v, b[i])));
// Re-render a page only when something about THAT page changed (a stroke on page 40 no longer repaints all 900 pages).
// Callback props are deliberately ignored: they are stable (setState / refs / mutation.mutate).
const PageView = memo(PageViewBase, (p, n) => p.bookId === n.bookId && p.freeKey === n.freeKey && p.pageNo === n.pageNo && p.size.w === n.size.w && p.size.h === n.size.h && p.widthPx === n.widthPx
  && p.bookmarked === n.bookmarked && p.theme === n.theme && p.mode === n.mode && p.color === n.color && p.penWidth === n.penWidth && p.fingerScroll === n.fingerScroll
  && sameList(p.highlights, n.highlights, (a, b) => a === b) && sameList(p.found, n.found, (a, b) => a.start === b.start && a.end === b.end && a.active === b.active));

// ---------------------------------------------------------------------------

export default function BookReader() {
  const params = useParams<{ id: string }>();
  const bookId = Number(params.id);
  useFocusMode(true);
  const qc = useQueryClient();
  const info = useQuery({ queryKey: ['book-reader', bookId], queryFn: () => booksApi.readerInfo(bookId), retry: false, staleTime: Infinity, gcTime: 0, refetchOnWindowFocus: false });
  const hlQ = useQuery({ queryKey: ['book-highlights', bookId], queryFn: () => booksApi.highlights(bookId), enabled: !!info.data });
  const bmQ = useQuery({ queryKey: ['book-bookmarks', bookId], queryFn: () => booksApi.bookmarks(bookId), enabled: !!info.data });
  const highlights = useMemo(() => hlQ.data ?? [], [hlQ.data]);
  const bookmarks = useMemo(() => bmQ.data ?? [], [bmQ.data]);
  // Only needed to offer the plain file when the reader can't draw it (a free book that isn't a PDF).
  const listQ = useQuery({ queryKey: ['books'], queryFn: booksApi.list, enabled: info.isError });

  // Free books have nothing to protect, so the anti-capture guards are for paid books only.
  const guarded = info.data ? !info.data.isFree : true;

  const [mode, setMode] = useState<Mode>('read');
  // Finger behaviour while the Pen/Eraser is selected: 'auto' and 'scroll' = a finger scrolls the page,
  // 'draw' = a finger writes. (A stylus or mouse always draws.)
  const [touchPref, setTouchPref] = useState<'auto' | 'scroll' | 'draw'>(() => readPref<'auto' | 'scroll' | 'draw'>('reader:touch', ['auto', 'scroll', 'draw'], 'auto'));
  useEffect(() => { try { localStorage.setItem('reader:touch', touchPref); } catch { /* storage blocked */ } }, [touchPref]);
  // 'auto' now always lets a finger scroll (a stylus or mouse still writes); pick 'Draw' to write with a finger.
  // (It used to wait until a stylus was detected, and that detection re-rendered every page in the middle of the first stroke.)
  const fingerScroll = touchPref !== 'draw';
  // Remembers the last color picked so returning to any book keeps it,
  // instead of resetting to yellow every time.
  const readColor = (key: string, fallback: string): string => { try { const v = localStorage.getItem(key); return v && (isHex(v) || ['yellow', 'green', 'pink', 'blue'].includes(v)) ? v : fallback; } catch { return fallback; } };
  const [color, setColor] = useState<HighlightColor>(() => readColor('reader:color', 'yellow'));
  useEffect(() => { try { localStorage.setItem('reader:color', color); } catch { /* private mode / storage blocked */ } }, [color]);
  const [penColor, setPenColor] = useState<HighlightColor>(() => readColor('reader:pen-color', '#1f2937'));
  useEffect(() => { try { localStorage.setItem('reader:pen-color', penColor); } catch { /* storage blocked */ } }, [penColor]);
  const readW = (key: string, r: { min: number; max: number; def: number }): number => { try { const v = parseFloat(localStorage.getItem(key) ?? ''); return clampW(v, r); } catch { return r.def; } };
  const [penW, setPenW] = useState<number>(() => readW('reader:pen-w', PEN_W));
  useEffect(() => { try { localStorage.setItem('reader:pen-w', String(penW)); } catch { /* storage blocked */ } }, [penW]);
  const [markerW, setMarkerW] = useState<number>(() => readW('reader:marker-w', MARKER_W));
  useEffect(() => { try { localStorage.setItem('reader:marker-w', String(markerW)); } catch { /* storage blocked */ } }, [markerW]);
  // The Edge-style pen flyout (colours + thickness). Opens when the Pen/Marker is picked, closes when you start writing.
  const [flyout, setFlyout] = useState(false);
  useEffect(() => { readerGesture.onStroke = () => setFlyout(false); return () => { readerGesture.onStroke = null; readerGesture.penDown = false; }; }, []);
  const [theme, setTheme] = useState<Theme>(() => readPref<Theme>('reader:theme', ['light', 'sepia', 'night'], 'light'));
  useEffect(() => { try { localStorage.setItem('reader:theme', theme); } catch { /* storage blocked */ } }, [theme]);
  const [zoom, setZoom] = useState(() => { try { const v = parseFloat(localStorage.getItem('reader:zoom') ?? ''); return v >= 0.5 && v <= 3 ? v : 1; } catch { return 1; } });
  useEffect(() => { try { localStorage.setItem('reader:zoom', String(zoom)); } catch { /* storage blocked */ } }, [zoom]);
  const [current, setCurrent] = useState(1);
  useEffect(() => { setReaderFocus(current); }, [current]);
  useEffect(() => () => clearPageCache(), []);
  const [panel, setPanel] = useState<PanelTab | null>(null);
  const [active, setActive] = useState<BookHighlight | null>(null);
  const [veiled, setVeiled] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const veilTimer = useRef<number | undefined>(undefined);
  const veil = useCallback((ms?: number) => { setVeiled(true); if (ms) { window.clearTimeout(veilTimer.current); veilTimer.current = window.setTimeout(() => setVeiled(false), ms); } }, []);
  useReaderGuards(veil, guarded);
  const devtoolsOpen = useDevtoolsGuard(guarded);

  // Native (iOS/Android app) screenshot/recording block — no-ops on web.
  // Scoped to this screen only, and only for paid books; see
  // nativeScreenshotGuard.ts for the per-platform caveats.
  useEffect(() => {
    if (!guarded) return;
    void enableScreenshotGuard();
    return () => void disableScreenshotGuard();
  }, [guarded]);

  useEffect(() => {
    const f = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', f);
    return () => { document.removeEventListener('fullscreenchange', f); if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); };
  }, []);
  const toggleFullscreen = () => { try { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen(); } catch { /* not supported */ } };

  // Escape backs out of whatever's open, closest-first: the highlight editor
  // sheet, then the side panel — same as tapping outside them.
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setActive((a) => { if (a) return null; setPanel((p) => (p ? null : p)); return a; });
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  const pageEls = useRef<Array<HTMLDivElement | null>>([]);
  const [viewportW, setViewportW] = useState(() => Math.min(window.innerWidth - 24, 1100));
  useEffect(() => { const f = () => setViewportW(Math.min(window.innerWidth - 24, 1100)); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  const widthPx = Math.round(Math.min(viewportW, 900) * zoom);

  // ---- pinch to zoom (the page's viewport meta blocks the browser's own pinch-zoom) ----
  // While the fingers are down the pages are scaled with a CSS transform (cheap, follows the fingers); on release the
  // real zoom is applied once and the scroll position is set so the spot you pinched stays under your fingers.
  const roomRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef(zoom); zoomRef.current = zoom;
  const anchorRef = useRef<{ ry: number; rx: number; top0: number; cx: number; cy: number; ratio: number; rootLeft: number } | null>(null);
  const hasBook = !!info.data;
  useEffect(() => {
    const root = roomRef.current; if (!root) return;
    const inner = root.firstElementChild as HTMLElement | null; if (!inner) return;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const mid = (t: TouchList) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });
    let p: { d0: number; z0: number; ratio: number; cx: number; cy: number; ry: number; rx: number; top0: number; rootLeft: number } | null = null;
    let release = 0;
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      window.clearTimeout(release);
      const r = root.getBoundingClientRect(), b = inner.getBoundingClientRect(), m = mid(e.touches);
      readerGesture.pinching = true;
      p = { d0: dist(e.touches) || 1, z0: zoomRef.current, ratio: 1, cx: m.x, cy: m.y, ry: m.y - r.top, rx: root.scrollLeft + (m.x - r.left), top0: r.top + window.scrollY, rootLeft: r.left };
      inner.style.transformOrigin = `${m.x - b.left}px ${m.y - b.top}px`; inner.style.willChange = 'transform';
    };
    const onMove = (e: TouchEvent) => {
      if (!p || e.touches.length !== 2) return;
      if (e.cancelable) e.preventDefault();
      const z = Math.min(3, Math.max(0.5, p.z0 * (dist(e.touches) / p.d0)));
      p.ratio = z / p.z0; const m = mid(e.touches); p.cx = m.x; p.cy = m.y;
      inner.style.transform = `scale(${p.ratio})`;
    };
    const onEnd = (e: TouchEvent) => {
      if (!p || e.touches.length >= 2) return;
      const q = p; p = null;
      inner.style.transform = ''; inner.style.transformOrigin = ''; inner.style.willChange = '';
      release = window.setTimeout(() => { readerGesture.pinching = false; }, 200); // ignore the finger that is still lifting
      if (Math.abs(q.ratio - 1) < 0.02) return;
      anchorRef.current = { ry: q.ry, rx: q.rx, top0: q.top0, cx: q.cx, cy: q.cy, ratio: q.ratio, rootLeft: q.rootLeft };
      setZoom(Math.min(3, Math.max(0.5, +(q.z0 * q.ratio).toFixed(2))));
    };
    root.addEventListener('touchstart', onStart, { passive: true });
    root.addEventListener('touchmove', onMove, { passive: false });
    root.addEventListener('touchend', onEnd); root.addEventListener('touchcancel', onEnd);
    return () => { root.removeEventListener('touchstart', onStart); root.removeEventListener('touchmove', onMove); root.removeEventListener('touchend', onEnd); root.removeEventListener('touchcancel', onEnd); window.clearTimeout(release); readerGesture.pinching = false; inner.style.transform = ''; };
  }, [hasBook]);
  // After the new zoom has rendered, put the pinched spot back under the fingers.
  useLayoutEffect(() => {
    const a = anchorRef.current; if (!a) return; anchorRef.current = null;
    const root = roomRef.current; if (root) root.scrollLeft = a.rx * a.ratio - (a.cx - a.rootLeft);
    window.scrollTo(window.scrollX, a.top0 + a.ry * a.ratio - a.cy);
  }, [zoom]);

  // lastSavedRef / pendingRef track what's on screen vs. what's confirmed
  // saved, so a tab-close mid-debounce still gets flushed (see below) instead
  // of silently losing up to 1.2s of reading progress.
  const pendingRef = useRef(1);
  const lastSavedRef = useRef(1);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);

  // Jump to the saved page once the layout exists.
  const resumed = useRef(false);
  useEffect(() => {
    if (!info.data || resumed.current) return; resumed.current = true;
    const p = info.data.resumePage; setCurrent(p); pendingRef.current = p; lastSavedRef.current = p;
    requestAnimationFrame(() => pageEls.current[p - 1]?.scrollIntoView({ block: 'start' }));
  }, [info.data]);

  // Track the page nearest the middle of the screen; save it (debounced).
  useEffect(() => {
    if (!info.data) return;
    let raf = 0, saveT: number | undefined;
    const commit = (page: number) => {
      lastSavedRef.current = page;
      void booksApi.saveProgress(bookId, page).then(() => setSavedAt(Date.now())).catch(() => {});
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // Pages are stacked top to bottom, so binary-search the first page whose bottom edge is below the middle of the screen
        // (about 10 measurements instead of one per page of the book on every scroll frame).
        const mid = window.innerHeight / 2, els = pageEls.current; let lo = 0, hi = els.length - 1, pick = Math.max(0, els.length - 1);
        while (lo <= hi) { const m = (lo + hi) >> 1, el = els[m]; if (!el) { hi = m - 1; continue; } if (el.getBoundingClientRect().bottom >= mid) { pick = m; hi = m - 1; } else lo = m + 1; }
        const best = pick + 1;
        setCurrent(best); pendingRef.current = best;
        window.clearTimeout(saveT); saveT = window.setTimeout(() => commit(best), 1200);
      });
    };
    // Flush immediately (not the 1.2s debounce) the moment the tab is hidden,
    // backgrounded, or closed — `keepalive` lets the request outlive the page.
    const flushNow = () => { if (pendingRef.current !== lastSavedRef.current) { lastSavedRef.current = pendingRef.current; booksApi.saveProgressOnExit(bookId, pendingRef.current); } };
    const onHide = () => { if (document.visibilityState === 'hidden') flushNow(); };
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flushNow);
    return () => {
      window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); window.clearTimeout(saveT);
      document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', flushNow);
      flushNow();
    };
  }, [info.data, bookId]);

  const add = useMutation({
    mutationFn: (body: NewBookHighlight) => booksApi.addHighlight(bookId, body),
    // Pen strokes show instantly (a temporary negative id) and are swapped for the saved row, so drawing never waits on the network.
    onMutate: (body): { tempId: number } | undefined => {
      if (body.kind !== 'ink') return undefined;
      const tempId = -(Date.now() * 1000 + Math.floor(Math.random() * 1000));
      qc.setQueryData<BookHighlight[]>(['book-highlights', bookId], (old) => [...(old ?? []), { id: tempId, page: body.page, kind: 'ink', startWord: null, endWord: null, rect: null, ink: body.ink, color: body.color ?? '#1f2937', note: null, createdAt: new Date().toISOString() }]);
      return { tempId };
    },
    onSuccess: (h, _body, ctx) => { qc.setQueryData<BookHighlight[]>(['book-highlights', bookId], (old) => [...(old ?? []).filter((x) => x.id !== ctx?.tempId), h]); if (h.kind !== 'ink') setActive(h); setSavedAt(Date.now()); },
    onError: (err: unknown, _body, ctx) => {
      if (ctx) qc.setQueryData<BookHighlight[]>(['book-highlights', bookId], (old) => (old ?? []).filter((x) => x.id !== ctx.tempId));
      toast({ title: 'Could not save that', description: err instanceof ApiRequestError ? err.message : 'Try again.', variant: 'destructive' });
    },
  });
  const addRef = useRef(add); addRef.current = add;
  // Eraser: remove the stroke on screen straight away, then delete it on the server (and re-sync if that fails).
  const erasingIds = useRef(new Set<number>());
  const eraseInk = (id: number) => {
    if (id <= 0 || erasingIds.current.has(id)) return;
    erasingIds.current.add(id);
    qc.setQueryData<BookHighlight[]>(['book-highlights', bookId], (old) => (old ?? []).filter((x) => x.id !== id));
    booksApi.deleteHighlight(bookId, id).then(() => setSavedAt(Date.now())).catch(() => { void qc.invalidateQueries({ queryKey: ['book-highlights', bookId] }); }).finally(() => { erasingIds.current.delete(id); });
  };
  const update = useMutation({
    mutationFn: (v: { id: number; color?: HighlightColor; note?: string | null }) => booksApi.updateHighlight(bookId, v.id, { color: v.color, note: v.note }),
    onSuccess: (h) => { qc.setQueryData<BookHighlight[]>(['book-highlights', bookId], (old) => (old ?? []).map((x) => (x.id === h.id ? h : x))); setActive((a) => (a && a.id === h.id ? h : a)); setSavedAt(Date.now()); },
  });
  const remove = useMutation({
    mutationFn: (id: number) => booksApi.deleteHighlight(bookId, id),
    onSuccess: (_r, id) => { qc.setQueryData<BookHighlight[]>(['book-highlights', bookId], (old) => (old ?? []).filter((x) => x.id !== id)); setActive(null); },
  });
  const [noteDraft, setNoteDraft] = useState('');
  useEffect(() => { setNoteDraft(active?.note ?? ''); }, [active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- bookmarks ----
  const addBookmark = useMutation({
    mutationFn: (page: number) => booksApi.addBookmark(bookId, { page }),
    onSuccess: (b) => { qc.setQueryData<BookBookmark[]>(['book-bookmarks', bookId], (old) => [...(old ?? []).filter((x) => x.page !== b.page), b].sort((x, y) => x.page - y.page)); setSavedAt(Date.now()); },
    onError: (err: unknown) => toast({ title: 'Could not add bookmark', description: err instanceof ApiRequestError ? err.message : 'Try again.', variant: 'destructive' }),
  });
  const removeBookmark = useMutation({
    mutationFn: (id: number) => booksApi.deleteBookmark(bookId, id),
    onSuccess: (_r, id) => qc.setQueryData<BookBookmark[]>(['book-bookmarks', bookId], (old) => (old ?? []).filter((x) => x.id !== id)),
  });
  const bookmarkPages = useMemo(() => new Set(bookmarks.map((b) => b.page)), [bookmarks]);
  const currentBookmark = bookmarks.find((b) => b.page === current);
  const toggleBookmark = () => { if (currentBookmark) removeBookmark.mutate(currentBookmark.id); else addBookmark.mutate(current); };

  // ---- contents + search ----
  const outlineQ = useQuery({ queryKey: ['book-outline', bookId], queryFn: () => booksApi.outline(bookId), enabled: !!info.data && panel === 'contents', staleTime: Infinity, retry: false });
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<BookSearchHit[]>([]);
  const [hitIdx, setHitIdx] = useState(0);
  const [searched, setSearched] = useState<{ q: string; truncated: boolean } | null>(null);
  const jump = (p: number) => { const n = Math.min(Math.max(1, p), info.data?.pageCount ?? 1); pageEls.current[n - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const search = useMutation({
    mutationFn: (q: string) => booksApi.search(bookId, q),
    onSuccess: (r, q) => { setHits(r.hits); setHitIdx(0); setSearched({ q, truncated: r.truncated }); if (r.hits[0]) jump(r.hits[0].page); },
    onError: (err: unknown) => toast({ title: 'Search failed', description: err instanceof ApiRequestError ? err.message : 'Try again.', variant: 'destructive' }),
  });
  const goHit = (i: number) => { if (!hits.length) return; const n = (i + hits.length) % hits.length; setHitIdx(n); jump(hits[n].page); };
  const foundByPage = useMemo(() => { const m = new Map<number, Found[]>(); hits.forEach((h, i) => m.set(h.page, [...(m.get(h.page) ?? []), { start: h.start, end: h.end, active: i === hitIdx }])); return m; }, [hits, hitIdx]);
  const hitPages = useMemo(() => { const m = new Map<number, { count: number; first: number }>(); hits.forEach((h, i) => { const e = m.get(h.page); if (e) e.count++; else m.set(h.page, { count: 1, first: i }); }); return [...m.entries()]; }, [hits]);

  const noteCount = useMemo(() => highlights.filter((h) => h.kind !== 'ink').length, [highlights]);
  const strokeCount = highlights.length - noteCount;
  const byPage = useMemo(() => { const m = new Map<number, BookHighlight[]>(); for (const h of highlights) m.set(h.page, [...(m.get(h.page) ?? []), h]); return m; }, [highlights]);

  // ---- Save button: flush anything pending, then re-read from the server so the
  // student sees exactly what's stored on their account. ----
  const saveAll = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (active && noteDraft !== (active.note ?? '')) await update.mutateAsync({ id: active.id, note: noteDraft.trim() || null });
      await booksApi.saveProgress(bookId, pendingRef.current);
      lastSavedRef.current = pendingRef.current;
      const [h, b] = await Promise.all([booksApi.highlights(bookId), booksApi.bookmarks(bookId)]);
      qc.setQueryData(['book-highlights', bookId], h); qc.setQueryData(['book-bookmarks', bookId], b);
      setSavedAt(Date.now()); setSaveFlash(true); window.setTimeout(() => setSaveFlash(false), 2200);
      toast({ title: 'Saved', description: `Page ${pendingRef.current}, ${h.filter((x) => x.kind !== 'ink').length} highlight${h.filter((x) => x.kind !== 'ink').length === 1 ? '' : 's'}, ${h.filter((x) => x.kind === 'ink').length} pen stroke${h.filter((x) => x.kind === 'ink').length === 1 ? '' : 's'} and ${b.length} bookmark${b.length === 1 ? '' : 's'} are saved to your account.` });
    } catch (err) {
      toast({ title: 'Could not save', description: err instanceof ApiRequestError ? err.message : 'Check your connection and try again.', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  // Keyboard: ←/→ turn pages, +/− zoom, B bookmark, / search, Ctrl/⌘+S save. Registered once; it
  // reads the latest handlers through a ref so it never acts on stale state.
  const actions = useRef({ go: (_d: number) => {}, zoom: (_d: number) => {}, bookmark: () => {}, save: () => {}, openSearch: () => {}, tool: (_m: Mode) => {} });
  actions.current = {
    go: (d) => jump(pendingRef.current + d), zoom: (d) => setZoom((z) => Math.min(3, Math.max(0.5, +(z + d).toFixed(1)))),
    bookmark: toggleBookmark, save: () => void saveAll(), openSearch: () => setPanel('search'), tool: (m) => setMode((cur) => (cur === m ? 'read' : m)),
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(); const mod = e.ctrlKey || e.metaKey;
      if (mod && k === 's') { e.preventDefault(); actions.current.save(); return; }
      if (mod || e.altKey || isField(e.target)) return;
      if (k === 'arrowright') { e.preventDefault(); actions.current.go(1); }
      else if (k === 'arrowleft') { e.preventDefault(); actions.current.go(-1); }
      else if (k === '+' || k === '=') actions.current.zoom(0.1);
      else if (k === '-') actions.current.zoom(-0.1);
      else if (k === 'b') actions.current.bookmark();
      else if (k === '/') { e.preventDefault(); actions.current.openSearch(); }
      else if (k === 'p') actions.current.tool('pen');
      else if (k === 'm') actions.current.tool('marker');
      else if (k === 'h') actions.current.tool('text');
      else if (k === 'e') actions.current.tool('erase');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (info.isLoading) return <div className="grid min-h-[60vh] place-items-center text-primary"><div className="flex items-center gap-3 text-sm font-bold"><BrandSpinner size={22} /> Opening your book…</div></div>;
  if (info.isError || !info.data) {
    const err = info.error instanceof ApiRequestError ? info.error : null;
    const listed = (listQ.data as AdminBookStudent[] | undefined)?.find((b) => b.id === bookId);
    // A free book that the reader can't draw (not a PDF, external link, unreachable file) still opens as a plain file.
    const plainUrl = err?.status !== 403 && listed && !listed.locked && listed.isFree ? resolveUploadUrl(listed.storagePath) : null;
    return <div className="mx-auto grid min-h-[50vh] max-w-md place-items-center text-center"><div>
      <LockKeyhole className="mx-auto text-muted-foreground" size={28} />
      <h2 className="mt-3 text-lg font-extrabold">{err?.status === 403 ? 'This book is locked' : "Couldn't open this book"}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{err?.message ?? 'Something went wrong.'}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {plainUrl && <a href={plainUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-xl bg-primary px-4 py-2.5 text-xs font-extrabold text-primary-foreground" data-testid="link-reader-open-file">Open the file instead</a>}
        <Link href="/books" className={cn('inline-flex rounded-xl px-4 py-2.5 text-xs font-extrabold', plainUrl ? 'border border-border bg-card' : 'bg-primary text-primary-foreground')}>Back to books</Link>
      </div>
    </div></div>;
  }
  const d = info.data;
  const pctRead = Math.round((current / d.pageCount) * 100);
  const showVeil = guarded && (veiled || devtoolsOpen);
  const iconBtn = 'grid size-8 place-items-center rounded-lg border border-border bg-card hover:bg-muted';
  const ThemeIcon = theme === 'night' ? Moon : theme === 'sepia' ? BookOpen : Sun;
  const tabBtn = (t: PanelTab, Icon: typeof List, label: string, badge?: number) => <button key={t} type="button" onClick={() => setPanel(t)} aria-pressed={panel === t} title={label} className={cn('relative flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-bold', panel === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')} data-testid={`tab-reader-${t}`}><Icon size={13} /> {label}{!!badge && <span className="rounded-full bg-black/15 px-1 text-[9px]">{badge}</span>}</button>;

  return <div className="book-reader-root select-none" data-veil={showVeil} style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}>
    {/* Veiling hides the whole page box — canvas, highlight overlays, page
       number — not just the canvas, so a blurred/backgrounded/devtools-open
       window doesn't still leak highlight positions or layout through the
       overlay layers sitting on top of it. */}
    <style>{`@media print{.book-reader-root{display:none!important}} .book-reader-root[data-veil="true"] .book-page{visibility:hidden}`}</style>
    <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-border bg-background/95 backdrop-blur sm:-mx-6">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 sm:px-6">
        <Link href="/books" className="grid size-9 place-items-center rounded-xl border border-border bg-card" aria-label="Back to books" data-testid="link-reader-back"><ArrowLeft size={16} /></Link>
        <div className="min-w-0 flex-1 basis-40"><div className="truncate text-sm font-extrabold">{d.title}</div><div className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">{guarded ? <ShieldCheck size={11} /> : <BookOpen size={11} />} <span className="truncate">{guarded ? 'Protected reading' : 'Free book'} · highlights, notes &amp; bookmarks are saved to your account</span>{savedAt && <span className="shrink-0 text-primary" data-testid="text-reader-saved"> · Saved {new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}</div></div>
        <button type="button" onClick={() => void saveAll()} disabled={saving} className={cn('inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-extrabold shadow-sm transition-colors disabled:opacity-60', saveFlash ? 'bg-[#d7eee4] text-[#164b4b]' : 'bg-primary text-primary-foreground hover:opacity-90')} title="Save your work (Ctrl/⌘ + S)" data-testid="button-reader-save">
          {saveFlash ? <Check size={14} /> : <Save size={14} />}{saving ? 'Saving…' : saveFlash ? 'Saved' : 'Save'}
        </button>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => jump(current - 1)} disabled={current <= 1} className={cn(iconBtn, 'disabled:opacity-40')} aria-label="Previous page" data-testid="button-reader-prev"><ChevronLeft size={15} /></button>
          <label className="flex items-center gap-1 text-xs font-bold"><input type="number" min={1} max={d.pageCount} value={current} onChange={(e) => jump(Number(e.target.value))} className="h-8 w-14 rounded-lg border border-border bg-card px-2 text-center" aria-label="Page number" data-testid="input-reader-page" /> / {d.pageCount}</label>
          <button type="button" onClick={() => jump(current + 1)} disabled={current >= d.pageCount} className={cn(iconBtn, 'disabled:opacity-40')} aria-label="Next page" data-testid="button-reader-next"><ChevronRight size={15} /></button>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => actions.current.zoom(-0.1)} className={iconBtn} aria-label="Zoom out"><ZoomOut size={14} /></button>
          <button type="button" onClick={() => setZoom(1)} className="h-8 min-w-11 rounded-lg border border-border bg-card px-1.5 text-[11px] font-bold hover:bg-muted" title="Fit to width" data-testid="button-reader-zoom-reset">{Math.round(zoom * 100)}%</button>
          <button type="button" onClick={() => actions.current.zoom(0.1)} className={iconBtn} aria-label="Zoom in"><ZoomIn size={14} /></button>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setTheme(NEXT_THEME[theme])} className={iconBtn} title={`Reading theme: ${THEMES[theme].label}`} aria-label={`Reading theme: ${THEMES[theme].label}`} data-testid="button-reader-theme"><ThemeIcon size={14} /></button>
          {typeof document !== 'undefined' && document.fullscreenEnabled && <button type="button" onClick={toggleFullscreen} className={iconBtn} aria-label={fullscreen ? 'Exit full screen' : 'Full screen'} data-testid="button-reader-fullscreen">{fullscreen ? <Minimize size={14} /> : <Maximize size={14} />}</button>}
          <button type="button" onClick={toggleBookmark} className={cn(iconBtn, currentBookmark && 'border-primary bg-primary/10 text-primary')} aria-pressed={!!currentBookmark} title={currentBookmark ? 'Remove bookmark (B)' : 'Bookmark this page (B)'} aria-label="Bookmark this page" data-testid="button-reader-bookmark"><Bookmark size={14} fill={currentBookmark ? 'currentColor' : 'none'} /></button>
          <button type="button" onClick={() => setPanel((p) => (p === 'search' ? null : 'search'))} className={cn(iconBtn, panel === 'search' && 'bg-primary text-primary-foreground')} title="Search in book (/)" aria-label="Search in book" data-testid="button-reader-search"><Search size={14} /></button>
          <button type="button" onClick={() => setPanel((p) => (p ? null : 'highlights'))} className={cn('relative', iconBtn, panel && panel !== 'search' && 'bg-primary text-primary-foreground')} aria-label="Highlights, bookmarks and contents" data-testid="button-reader-highlights"><ListOrdered size={14} />{noteCount > 0 && <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-[#e5a952] px-1 text-[9px] font-black text-[#183844]">{noteCount}</span>}</button>
        </div>
      </div>
      <div className="h-0.5 w-full bg-border/60" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pctRead} aria-label="Reading progress"><div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${pctRead}%` }} /></div>
    </div>

    <div ref={roomRef} data-reader-scroll className="overflow-x-auto rounded-xl px-1 pb-48 pt-3" style={{ background: THEMES[theme].room, overscrollBehaviorX: 'contain' }}>
     <div style={{ minWidth: widthPx }}>
      {d.pages.map((size, i) => <PageView key={i} bookId={bookId} freeKey={d.isFree ? d.fileKey : null} pageNo={i + 1} size={size} widthPx={widthPx} highlights={byPage.get(i + 1) ?? []} found={foundByPage.get(i + 1) ?? []} bookmarked={bookmarkPages.has(i + 1)} theme={theme} mode={mode} color={mode === 'pen' ? penColor : color} penWidth={mode === 'marker' ? markerW : penW} fingerScroll={fingerScroll}
        onCreate={(h) => addRef.current.mutate(h)} onOpen={setActive} onErase={eraseInk} pageRef={(el) => { pageEls.current[i] = el; }} />)}
     </div>
    </div>

    {/* Annotation dock: big, labelled tools pinned to the bottom of the screen so the Pen and Highlighter are always one tap away. */}
    {!active && <div className="fixed inset-x-0 bottom-3 z-30 mx-auto w-[calc(100%-1.5rem)] max-w-xl rounded-3xl border border-border bg-card/95 p-2 shadow-2xl backdrop-blur" data-testid="dock-annotate">
      {(mode === 'text' || mode === 'area') && (() => {
        const isPen = mode === 'pen'; const palette = isPen ? PEN_COLORS : HIGHLIGHTER_COLORS; const cur = isPen ? penColor : color; const setCur = isPen ? setPenColor : setColor;
        const custom = !palette.some((c) => c.id === cur);
        return <div className="mb-2 rounded-2xl bg-muted/50 p-2">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label={isPen ? 'Pen colour' : 'Highlighter colour'}>
            {palette.map((c) => <button key={c.id} type="button" onClick={() => setCur(c.id)} aria-label={`${c.label} ${isPen ? 'pen' : 'highlighter'}`} aria-pressed={cur === c.id} title={c.label}
              className={cn('grid size-8 place-items-center rounded-full border-2 shadow-sm transition-transform', cur === c.id ? 'scale-110 border-foreground ring-2 ring-primary/40' : 'border-black/10 hover:scale-105')} style={{ background: c.hex }} data-testid={`button-color-${c.id.replace('#', '')}`}>
              {cur === c.id && <Check size={14} className={c.id === '#1f2937' || c.id === '#1d4ed8' || c.id === '#92400e' || c.id === '#6b7280' ? 'text-white' : 'text-black/70'} strokeWidth={3} />}
            </button>)}
            <label className={cn('relative grid size-8 cursor-pointer place-items-center overflow-hidden rounded-full border-2 shadow-sm', custom ? 'scale-110 border-foreground ring-2 ring-primary/40' : 'border-black/10')} title="Pick any colour" style={{ background: custom ? colorHex(cur) : 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}>
              <input type="color" value={colorHex(cur)} onChange={(e) => setCur(e.target.value.toLowerCase())} className="absolute inset-0 size-full cursor-pointer opacity-0" aria-label="Custom colour" data-testid="input-color-custom" />
              {custom && <Check size={14} className="text-black/70" strokeWidth={3} />}
            </label>
          </div>
        </div>;
      })()}
      {(mode === 'pen' || mode === 'marker') && flyout && <PenFlyout kind={mode} color={mode === 'pen' ? penColor : color} onColor={mode === 'pen' ? setPenColor : setColor}
        width={mode === 'pen' ? penW : markerW} onWidth={mode === 'pen' ? setPenW : setMarkerW} range={mode === 'pen' ? PEN_W : MARKER_W} onClose={() => setFlyout(false)} />}
      {(mode === 'pen' || mode === 'marker' || mode === 'erase') && <div className="mb-2 flex items-center gap-1.5 rounded-2xl bg-muted/50 px-2 py-1.5" role="group" aria-label="What a finger does">
        <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Finger</span>
        {([['auto', 'Auto'], ['scroll', 'Scroll'], ['draw', 'Draw']] as const).map(([v, l]) => <button key={v} type="button" onClick={() => setTouchPref(v)} aria-pressed={touchPref === v} className={cn('rounded-lg px-2.5 py-1 text-[11px] font-extrabold', touchPref === v ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground/80 hover:bg-muted')} data-testid={`button-touch-${v}`}>{l}</button>)}
        <span className="ml-auto truncate text-[10px] font-semibold text-muted-foreground">{fingerScroll ? 'Finger scrolls · pen writes' : 'Finger writes'}</span>
      </div>}
      <div className="grid grid-cols-6 gap-1" role="toolbar" aria-label="Reader tools">
        {([['read', MousePointer2, 'Read', null], ['pen', PenLine, 'Pen', penColor], ['marker', Brush, 'Marker', color], ['text', Highlighter, 'Highlight', color], ['area', BoxSelect, 'Area', color], ['erase', Eraser, 'Eraser', null]] as const).map(([m, Icon, label, chip]) =>
          <button key={m} type="button" onClick={() => { if (m === 'pen' || m === 'marker') { if (mode === m) setFlyout((f) => !f); else { setMode(m); setFlyout(true); } } else { setMode(m); setFlyout(false); } }} aria-pressed={mode === m} title={`${label}${m === 'pen' ? ' (P)' : m === 'marker' ? ' (M)' : m === 'text' ? ' (H)' : m === 'erase' ? ' (E)' : ''}`}
            className={cn('relative flex flex-col items-center gap-0.5 rounded-2xl px-1 py-2 text-[11px] font-extrabold transition-colors', mode === m ? 'bg-primary text-primary-foreground shadow-md' : 'text-foreground/80 hover:bg-muted')} data-testid={`button-mode-${m}`}>
            <Icon size={20} />{label}
            {chip && <span className="absolute right-2 top-1.5 size-2.5 rounded-full border border-white shadow" style={{ background: colorHex(chip) }} />}
          </button>)}
      </div>
    </div>}

    {active && <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md rounded-t-2xl border border-border bg-card p-4 shadow-2xl sm:bottom-4 sm:rounded-2xl" data-testid="sheet-highlight">
      <div className="flex items-center gap-2"><span className="text-xs font-extrabold">{active.kind === 'ink' ? 'Pen stroke' : 'Highlight'} · page {active.page}</span>
        <div className="ml-2 flex flex-wrap gap-1.5">{(active.kind === 'ink' ? PEN_COLORS : HIGHLIGHTER_COLORS).map((c) => <button key={c.id} type="button" onClick={() => update.mutate({ id: active.id, color: c.id })} aria-label={`Make ${c.label}`} className={cn('size-6 rounded-full border-2', active.color === c.id ? 'border-foreground' : 'border-black/10')} style={{ background: c.hex }} />)}</div>
        <button type="button" onClick={() => setActive(null)} className="ml-auto grid size-7 place-items-center rounded-lg hover:bg-muted" aria-label="Close"><X size={15} /></button></div>
      <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} onBlur={() => noteDraft !== (active.note ?? '') && update.mutate({ id: active.id, note: noteDraft.trim() || null })} placeholder="Add a note (optional)" maxLength={1000} rows={2} className="mt-3 w-full select-text rounded-xl border border-border bg-background p-3 text-xs outline-none focus:ring-2 focus:ring-primary/20" data-testid="input-highlight-note" />
      <div className="mt-2 flex items-center justify-between">
        <button type="button" onClick={() => remove.mutate(active.id)} className="inline-flex items-center gap-1.5 text-xs font-bold text-destructive" data-testid="button-delete-highlight"><Trash2 size={13} /> Remove {active.kind === 'ink' ? 'stroke' : 'highlight'}</button>
        <button type="button" onClick={() => update.mutate({ id: active.id, note: noteDraft.trim() || null }, { onSuccess: () => toast({ title: 'Note saved' }) })} disabled={update.isPending || noteDraft === (active.note ?? '')} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-extrabold text-primary-foreground disabled:opacity-50" data-testid="button-save-note"><Save size={12} /> Save note</button>
      </div>
    </div>}

    {panel && <aside className="fixed inset-y-0 right-0 z-40 flex w-80 max-w-[90vw] flex-col border-l border-border bg-card p-4 shadow-2xl" data-testid="panel-highlights">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex flex-1 gap-1 rounded-xl border border-border bg-background p-1">
          {tabBtn('highlights', Highlighter, 'Notes', noteCount)}
          {tabBtn('bookmarks', Bookmark, 'Marks', bookmarks.length)}
          {tabBtn('contents', List, 'Contents')}
          {tabBtn('search', Search, 'Find')}
        </div>
        <button type="button" onClick={() => setPanel(null)} className="grid size-7 shrink-0 place-items-center rounded-lg hover:bg-muted" aria-label="Close"><X size={15} /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {panel === 'highlights' && (noteCount === 0 ? <p className="text-xs text-muted-foreground">Nothing yet. Choose the highlighter, then drag across text — or draw a box around a figure.{strokeCount > 0 ? ` You have ${strokeCount} pen stroke${strokeCount === 1 ? '' : 's'} on the pages.` : ''}</p> :
          <ul className="space-y-2">{[...highlights.filter((h) => h.kind !== 'ink')].sort((a, b) => a.page - b.page || a.id - b.id).map((h) => <li key={h.id}><button type="button" onClick={() => { jump(h.page); setActive(h); }} className="flex w-full items-start gap-2 rounded-xl border border-border p-3 text-left hover:bg-muted/60"><span className="mt-0.5 size-3 shrink-0 rounded-full" style={{ background: colorHex(h.color) }} /><span className="min-w-0 text-xs"><span className="font-bold">Page {h.page}</span> <span className="text-muted-foreground">· {h.kind === 'area' ? 'area' : 'text'}</span>{h.note && <span className="mt-1 block truncate text-muted-foreground">{h.note}</span>}</span></button></li>)}</ul>)}

        {panel === 'bookmarks' && (bookmarks.length === 0 ? <p className="text-xs text-muted-foreground">No bookmarks yet. Tap the bookmark button in the toolbar (or press B) to mark the page you're on.</p> :
          <ul className="space-y-2">{bookmarks.map((b) => <li key={b.id} className="flex items-center gap-2 rounded-xl border border-border p-2 pl-3"><button type="button" onClick={() => jump(b.page)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs"><Bookmark size={13} className="shrink-0 text-primary" fill="currentColor" /><span className="font-bold">Page {b.page}</span>{b.label && <span className="truncate text-muted-foreground">· {b.label}</span>}</button><button type="button" onClick={() => removeBookmark.mutate(b.id)} className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive" aria-label={`Remove bookmark on page ${b.page}`}><Trash2 size={13} /></button></li>)}</ul>)}

        {panel === 'contents' && (outlineQ.isLoading ? <div className="grid place-items-center py-8 text-primary"><BrandSpinner size={20} /></div> :
          !outlineQ.data?.items.length ? <p className="text-xs text-muted-foreground">This book doesn't include a table of contents. Use search or the page box to move around.</p> :
          <ul className="space-y-0.5">{outlineQ.data.items.map((it, i) => <li key={i}><button type="button" onClick={() => jump(it.page)} className="flex w-full items-baseline justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted/60" style={{ paddingLeft: 8 + it.depth * 14 }}><span className={cn('min-w-0 truncate', it.depth === 0 && 'font-bold')}>{it.title}</span><span className="shrink-0 text-[10px] text-muted-foreground">{it.page}</span></button></li>)}</ul>)}

        {panel === 'search' && <div>
          <form onSubmit={(e) => { e.preventDefault(); if (query.trim().length >= 2) search.mutate(query.trim()); }} className="flex gap-1.5">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search this book" autoFocus maxLength={80} className="h-9 min-w-0 flex-1 select-text rounded-xl border border-border bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-primary/20" data-testid="input-reader-search" />
            <button type="submit" disabled={search.isPending || query.trim().length < 2} className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50" aria-label="Search" data-testid="button-reader-search-go">{search.isPending ? <BrandSpinner size={14} /> : <Search size={14} />}</button>
          </form>
          {searched && (hits.length === 0 ? <p className="mt-3 text-xs text-muted-foreground">No matches for “{searched.q}”. Scanned PDFs without selectable text can't be searched.</p> : <>
            <div className="mt-3 flex items-center justify-between text-xs font-bold"><span>{hitIdx + 1} of {hits.length}{searched.truncated ? '+' : ''} matches</span>
              <span className="flex gap-1"><button type="button" onClick={() => goHit(hitIdx - 1)} className={iconBtn} aria-label="Previous match"><ChevronUp size={14} /></button><button type="button" onClick={() => goHit(hitIdx + 1)} className={iconBtn} aria-label="Next match" data-testid="button-search-next"><ChevronDown size={14} /></button></span></div>
            <ul className="mt-2 space-y-1">{hitPages.slice(0, 150).map(([page, v]) => <li key={page}><button type="button" onClick={() => goHit(v.first)} className={cn('flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-muted/60', hits[hitIdx]?.page === page && 'bg-muted')}><span className="font-bold">Page {page}</span><span className="text-[10px] text-muted-foreground">{v.count} match{v.count === 1 ? '' : 'es'}</span></button></li>)}</ul>
          </>)}
        </div>}
      </div>
    </aside>}

    {showVeil && <div className="fixed inset-0 z-50 grid place-items-center bg-background/85 backdrop-blur-2xl" onClick={() => !devtoolsOpen && setVeiled(false)} data-testid="veil-reader">
      <div className="text-center">
        <EyeOff className="mx-auto text-muted-foreground" size={26} />
        <div className="mt-3 text-sm font-extrabold">{devtoolsOpen ? 'Developer tools detected' : 'Reader paused'}</div>
        <p className="mt-1 text-xs text-muted-foreground">{devtoolsOpen ? "Pages are hidden while developer tools are open. Close them to keep reading." : "Pages are hidden while this window isn't in focus."}</p>
        {!devtoolsOpen && <button type="button" onClick={() => setVeiled(false)} className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-xs font-extrabold text-primary-foreground">Resume reading</button>}
      </div>
    </div>}
  </div>;
}
