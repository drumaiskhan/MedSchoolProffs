// Automatic highlighter for the MCQ practice screen (v89).
//
// Switch the highlighter on, then just select any text in the question, the options, the hint, the explanation or the
// reference — it is highlighted the moment you let go (no extra tap). Tap a highlight to remove it, or switch to the
// eraser to wipe a selected stretch. Highlights are remembered per question on this device (localStorage), so they are
// still there when you come back to the question or reopen the session.
//
//   const hl = usePracticeHighlighter(current.id);
//   <div ref={hl.rootRef} onClickCapture={hl.onClickCapture}> … {hl.render('stem', current.question)} … </div>
//   <HighlighterBar hl={hl} />
//
// Text is rendered through hl.render(key, text) which splits the string into plain / highlighted segments. Selections are
// mapped back to character offsets inside the keyed element, so nothing depends on the DOM structure around it.
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { Eraser, Highlighter, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type HlMode = 'off' | 'hl' | 'erase';
interface Span { s: number; e: number; c: string }
interface Field { l: number; spans: Span[] }
type Store = Record<string, Field>;

export const PRACTICE_HL_COLORS = ['#ffe14d', '#7df09a', '#ff9ccf', '#7cc8ff', '#ffb066'];
const STORE_KEY = 'msp:practice-highlights:v1';
const PREF_KEY = 'msp:practice-highlighter-pref:v1';
const MAX_QUESTIONS = 600;

type All = { order: number[]; byId: Record<string, Store> };
const readAll = (): All => {
  try { const o = JSON.parse(localStorage.getItem(STORE_KEY) || ''); if (o && Array.isArray(o.order) && o.byId) return o as All; } catch { /* first run / corrupt */ }
  return { order: [], byId: {} };
};
function loadStore(mcqId: number): Store { return readAll().byId[String(mcqId)] ?? {}; }
function saveStore(mcqId: number, store: Store): void {
  try {
    const all = readAll(); const id = String(mcqId);
    const empty = !Object.values(store).some((f) => f.spans.length);
    all.order = all.order.filter((x) => x !== mcqId);
    if (empty) delete all.byId[id];
    else { all.byId[id] = store; all.order.push(mcqId); }
    while (all.order.length > MAX_QUESTIONS) { const drop = all.order.shift(); if (drop !== undefined) delete all.byId[String(drop)]; }
    localStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch { /* storage full / blocked: highlights simply stay in memory */ }
}
function loadPref(): { mode: HlMode; color: string } {
  try { const o = JSON.parse(localStorage.getItem(PREF_KEY) || ''); return { mode: o?.mode === 'hl' ? 'hl' : 'off', color: PRACTICE_HL_COLORS.includes(o?.color) ? o.color : PRACTICE_HL_COLORS[0] }; } catch { return { mode: 'off', color: PRACTICE_HL_COLORS[0] }; }
}

/** Add [s, e) in colour c: it replaces whatever it overlaps, and touching same-colour spans are merged. */
export function addSpan(spans: Span[], s: number, e: number, c: string): Span[] {
  const out: Span[] = [];
  for (const sp of spans) {
    if (sp.e <= s || sp.s >= e) { out.push(sp); continue; }
    if (sp.s < s) out.push({ s: sp.s, e: s, c: sp.c });
    if (sp.e > e) out.push({ s: e, e: sp.e, c: sp.c });
  }
  out.push({ s, e, c });
  out.sort((a, b) => a.s - b.s);
  const merged: Span[] = [];
  for (const sp of out) { const last = merged[merged.length - 1]; if (last && last.c === sp.c && sp.s <= last.e) last.e = Math.max(last.e, sp.e); else merged.push({ ...sp }); }
  return merged;
}
/** Remove [s, e) from every span. */
export function cutSpan(spans: Span[], s: number, e: number): Span[] {
  const out: Span[] = [];
  for (const sp of spans) {
    if (sp.e <= s || sp.s >= e) { out.push(sp); continue; }
    if (sp.s < s) out.push({ s: sp.s, e: s, c: sp.c });
    if (sp.e > e) out.push({ s: e, e: sp.e, c: sp.c });
  }
  return out;
}

export interface PracticeHighlighter {
  mode: HlMode; setMode: (m: HlMode) => void;
  color: string; setColor: (c: string) => void;
  count: number; clearAll: () => void;
  rootRef: React.RefObject<HTMLDivElement | null>;
  onClickCapture: (e: ReactMouseEvent<HTMLElement>) => void;
  /** Render `text` with this question's highlights applied. `key` identifies the text block (stem, option 2, explanation…). */
  render: (key: string, text: string) => ReactNode;
}

export function usePracticeHighlighter(mcqId: number): PracticeHighlighter {
  const [pref, setPref] = useState(loadPref);
  const [store, setStore] = useState<Store>(() => loadStore(mcqId));
  const rootRef = useRef<HTMLDivElement>(null);
  const lastApplied = useRef(0);
  const idRef = useRef(mcqId); idRef.current = mcqId;
  const prefRef = useRef(pref); prefRef.current = pref;
  const storeRef = useRef(store); storeRef.current = store;

  // switching question → load that question's highlights
  useEffect(() => { setStore(loadStore(mcqId)); }, [mcqId]);

  const commit = useCallback((next: Store) => { storeRef.current = next; setStore(next); saveStore(idRef.current, next); }, []);
  const setMode = useCallback((mode: HlMode) => setPref((p) => { const n = { ...p, mode }; try { localStorage.setItem(PREF_KEY, JSON.stringify({ mode: mode === 'erase' ? 'hl' : mode, color: n.color })); } catch { /* ignore */ } return n; }), []);
  const setColor = useCallback((color: string) => setPref((p) => { const n = { mode: p.mode === 'off' ? 'hl' as HlMode : p.mode === 'erase' ? 'hl' as HlMode : p.mode, color }; try { localStorage.setItem(PREF_KEY, JSON.stringify(n)); } catch { /* ignore */ } return n; }), []);

  // Turn the current text selection into highlights.
  const applySelection = useCallback(() => {
    const root = rootRef.current, sel = window.getSelection();
    if (!root || !sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return;
    const mode = prefRef.current.mode; if (mode === 'off') return;
    let next = storeRef.current; let changed = false;
    root.querySelectorAll<HTMLElement>('[data-hlk]').forEach((el) => {
      if (!range.intersectsNode(el)) return;
      const text = el.textContent ?? ''; const len = text.length;
      const offsetIn = (node: Node, off: number) => { const r = document.createRange(); r.selectNodeContents(el); r.setEnd(node, off); return r.toString().length; };
      let s = el.contains(range.startContainer) ? offsetIn(range.startContainer, range.startOffset) : 0;
      let e = el.contains(range.endContainer) ? offsetIn(range.endContainer, range.endOffset) : len;
      while (s < e && /\s/.test(text[s])) s++;
      while (e > s && /\s/.test(text[e - 1])) e--;
      if (e - s < 1) return;
      const key = el.dataset.hlk!;
      const cur = next[key] && next[key].l === len ? next[key].spans : [];
      const spans = mode === 'erase' ? cutSpan(cur, s, e) : addSpan(cur, s, e, prefRef.current.color);
      next = { ...next, [key]: { l: len, spans } }; changed = true;
    });
    if (changed) { commit(next); lastApplied.current = Date.now(); }
    sel.removeAllRanges();
  }, [commit]);

  // Auto-apply: shortly after a selection settles (right after pointer-up for mouse/pen; a touch longer on phones so the
  // selection handles can still be adjusted).
  useEffect(() => {
    if (pref.mode === 'off') return;
    let timer: ReturnType<typeof setTimeout> | undefined; let down = false; let ptype = 'mouse';
    const schedule = () => { if (timer) clearTimeout(timer); if (down) return; timer = setTimeout(applySelection, ptype === 'touch' ? 750 : 220); };
    const onDown = (e: PointerEvent) => { ptype = e.pointerType || 'mouse'; if (ptype !== 'touch') down = true; };
    const onUp = (e: PointerEvent) => { ptype = e.pointerType || ptype; down = false; schedule(); };
    document.addEventListener('selectionchange', schedule);
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointerup', onUp, true);
    return () => { if (timer) clearTimeout(timer); document.removeEventListener('selectionchange', schedule); document.removeEventListener('pointerdown', onDown, true); document.removeEventListener('pointerup', onUp, true); };
  }, [pref.mode, applySelection]);

  // While the highlighter is on: a click that ends a text selection must not also pick the answer under it, and tapping an
  // existing highlight removes it.
  const onClickCapture = useCallback((e: ReactMouseEvent<HTMLElement>) => {
    if (prefRef.current.mode === 'off') return;
    const sel = window.getSelection();
    const selecting = !!sel && !sel.isCollapsed && !!rootRef.current && rootRef.current.contains(sel.anchorNode);
    if (selecting || Date.now() - lastApplied.current < 600) { e.stopPropagation(); e.preventDefault(); return; }
    const mark = (e.target as HTMLElement).closest?.('mark[data-hls]') as HTMLElement | null;
    if (mark) {
      const holder = mark.closest<HTMLElement>('[data-hlk]'); if (!holder) return;
      const key = holder.dataset.hlk!, s = Number(mark.dataset.s), end = Number(mark.dataset.e);
      const f = storeRef.current[key];
      if (f) commit({ ...storeRef.current, [key]: { l: f.l, spans: cutSpan(f.spans, s, end) } });
      e.stopPropagation(); e.preventDefault();
    }
  }, [commit]);

  const clearAll = useCallback(() => commit({}), [commit]);
  const count = useMemo(() => Object.values(store).reduce((n, f) => n + f.spans.length, 0), [store]);
  const on = pref.mode !== 'off';

  const render = useCallback((key: string, text: string): ReactNode => {
    const f = store[key];
    const spans = f && f.l === text.length ? f.spans : [];
    const parts: ReactNode[] = []; let at = 0;
    for (const sp of spans) {
      if (sp.s > at) parts.push(text.slice(at, sp.s));
      parts.push(<mark key={sp.s} data-hls="1" data-s={sp.s} data-e={sp.e} className={cn('rounded-[3px] px-[1px] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]', on && 'cursor-pointer')} style={{ background: `${sp.c}b3`, color: '#1b1b1f' }}>{text.slice(sp.s, sp.e)}</mark>);
      at = sp.e;
    }
    if (at < text.length) parts.push(text.slice(at));
    return <span data-hlk={key} className={on ? 'select-text [-webkit-user-select:text]' : undefined}>{parts}</span>;
  }, [store, on]);

  return { mode: pref.mode, setMode, color: pref.color, setColor, count, clearAll, rootRef, onClickCapture, render };
}

/** Compact toolbar: a highlighter toggle that expands into colours, an eraser and "clear all". */
export function HighlighterBar({ hl, className }: { hl: PracticeHighlighter; className?: string }) {
  const on = hl.mode !== 'off';
  return <div className={cn('flex items-center gap-1', className)} data-testid="practice-highlighter">
    <button onClick={() => hl.setMode(on ? 'off' : 'hl')} aria-pressed={on} aria-label={on ? 'Turn highlighter off' : 'Turn highlighter on'} title="Highlighter — select text to highlight it"
      className={cn('inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[11px] font-bold transition-colors', on ? 'bg-[#ffe14d] text-[#3d3200] shadow-sm' : 'border border-border bg-card text-muted-foreground hover:text-foreground')} data-testid="button-highlighter-toggle">
      <Highlighter size={14} />{on ? 'On' : <span className="hidden sm:inline">Highlight</span>}
    </button>
    {on && <>
      {PRACTICE_HL_COLORS.map((c) => <button key={c} onClick={() => hl.setColor(c)} aria-label={`Highlight colour ${c}`} className={cn('size-5 rounded-full border border-black/10 transition-transform', hl.mode === 'hl' && hl.color === c && 'scale-110 ring-2 ring-primary ring-offset-1 ring-offset-card')} style={{ background: c }} data-testid="button-highlighter-color" />)}
      <button onClick={() => hl.setMode(hl.mode === 'erase' ? 'hl' : 'erase')} aria-pressed={hl.mode === 'erase'} aria-label="Highlight eraser" title="Select highlighted text to remove the highlight" className={cn('grid size-7 place-items-center rounded-full', hl.mode === 'erase' ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground')} data-testid="button-highlighter-eraser"><Eraser size={13} /></button>
      {hl.count > 0 && <button onClick={() => { if (window.confirm('Remove all highlights on this question?')) hl.clearAll(); }} aria-label="Clear highlights" title="Clear all highlights on this question" className="grid size-7 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-destructive" data-testid="button-highlighter-clear"><Trash2 size={13} /></button>}
    </>}
  </div>;
}
