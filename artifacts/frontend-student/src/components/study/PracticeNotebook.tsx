// Floating Notebook for the Practice session (v85).
// A "Notes" button sits over the session. It opens a small panel where the student writes notes about the
// CURRENT question; the note is autosaved to their Notebook with that MCQ attached (same table/API the
// Notebook page already uses, so it appears there grouped under Block > Module > Subject > Topic and shows
// the question). The panel can be minimized to a pill (draft kept) and stays open while moving between
// questions: the text switches to that question's note.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, Loader2, Minus, NotebookPen, Plus, Trash2, X } from 'lucide-react';
import { notebookApi, type NotebookEntry } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { cn } from '@/lib/shared';

type View = 'closed' | 'open' | 'min';
type Status = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
const AUTOSAVE_MS = 900;
const MAX_LEN = 10000;

export function PracticeNotebook({ mcqId, questionText, questionNumber }: { mcqId: number; questionText: string; questionNumber: number }) {
  const [view, setView] = useState<View>('closed');
  const [text, setText] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [pickedId, setPickedId] = useState<number | null>(null); // which of this question's notes is being edited (null = newest/new)
  const [creatingNew, setCreatingNew] = useState(false);

  const entries = useQuery({ queryKey: ['notebook'], queryFn: notebookApi.list, staleTime: 60_000 });
  const mine = useMemo(
    () => (entries.data ?? []).filter((n) => n.mcqId === mcqId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [entries.data, mcqId],
  );
  const active: NotebookEntry | undefined = creatingNew ? undefined : mine.find((n) => n.id === pickedId) ?? mine[0];

  // Latest values for the async save / flush paths (avoids stale closures).
  const latest = useRef({ text, mcqId, activeId: active?.id ?? null });
  latest.current = { text, mcqId, activeId: active?.id ?? null };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void>>(Promise.resolve());
  const savedText = useRef('');           // last text known to be on the server for the editor's note
  const createdId = useRef<Map<number, number>>(new Map()); // mcqId -> id of a note created this session (stops duplicates on fast saves)
  const loadedKey = useRef('');

  const upsertCache = (row: NotebookEntry) => {
    queryClient.setQueryData<NotebookEntry[]>(['notebook'], (old) => {
      const list = old ?? [];
      return list.some((n) => n.id === row.id) ? list.map((n) => (n.id === row.id ? { ...n, ...row } : n)) : [{ ...row, question: row.question ?? questionText }, ...list];
    });
  };

  // Save `value` for `forMcq`. Calls are chained so a create always finishes before the next update.
  const save = useCallback((value: string, forMcq: number, noteId: number | null): Promise<void> => {
    const next = inFlight.current.then(async () => {
      const body = value.trim();
      if (!body || body === savedText.current.trim()) { setStatus((s) => (s === 'dirty' ? 'saved' : s)); return; }
      setStatus('saving');
      try {
        const id = noteId ?? createdId.current.get(forMcq) ?? null;
        let row: NotebookEntry;
        if (id) row = await notebookApi.update(id, { content: body });
        else { row = await notebookApi.create({ content: body, mcqId: forMcq }); createdId.current.set(forMcq, row.id); }
        upsertCache(row);
        if (forMcq === latest.current.mcqId) {
          savedText.current = body;
          if (!id) { loadedKey.current = `${forMcq}:${row.id}`; setCreatingNew(false); setPickedId(row.id); }
        }
        setStatus(forMcq === latest.current.mcqId && latest.current.text.trim() !== body ? 'dirty' : 'saved');
      } catch {
        setStatus('error');
      }
    });
    inFlight.current = next.catch(() => undefined);
    return inFlight.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flush = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const { text: t, mcqId: m, activeId } = latest.current;
    return save(t, m, activeId);
  }, [save]);

  const snap = useRef({ text: '', mcqId, activeId: null as number | null });
  // Question changed (or the note list arrived): save what was typed for the previous question, then load this question's note.
  const prevMcq = useRef(mcqId);
  useEffect(() => {
    if (prevMcq.current !== mcqId) {
      // flush using the OLD question's text/ids captured before the switch
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      const s0 = snap.current;
      void save(s0.text, prevMcq.current, s0.activeId);
      prevMcq.current = mcqId;
      setPickedId(null); setCreatingNew(false); setText('');
      loadedKey.current = '';
    }
  }, [mcqId, save]);
  useEffect(() => { if (prevMcq.current === mcqId) snap.current = { text, mcqId, activeId: active?.id ?? null }; });

  useEffect(() => {
    const key = `${mcqId}:${creatingNew ? 'new' : active?.id ?? 'none'}`;
    if (loadedKey.current === key) return;
    if (!creatingNew && entries.isLoading) return;
    loadedKey.current = key;
    const content = creatingNew ? '' : active?.content ?? '';
    setText(content); savedText.current = content; setStatus('idle');
  }, [mcqId, active?.id, active?.content, creatingNew, entries.isLoading]);

  // Autosave while typing.
  const onChange = (v: string) => {
    setText(v.slice(0, MAX_LEN)); setStatus('dirty');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, AUTOSAVE_MS);
  };

  // Never lose a draft: flush when leaving the page / tab or when the session screen unmounts.
  useEffect(() => {
    const onHide = () => { if (latest.current.text.trim()) void flush(); };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => { window.removeEventListener('pagehide', onHide); document.removeEventListener('visibilitychange', onHide); onHide(); };
  }, [flush]);

  const remove = async () => {
    if (!active) { setText(''); setCreatingNew(false); return; }
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (!window.confirm('Delete this note?')) return;
    try {
      await notebookApi.remove(active.id);
      createdId.current.delete(mcqId);
      queryClient.setQueryData<NotebookEntry[]>(['notebook'], (old) => (old ?? []).filter((n) => n.id !== active.id));
      setPickedId(null); setCreatingNew(false); setText(''); savedText.current = ''; setStatus('idle'); loadedKey.current = '';
    } catch { setStatus('error'); }
  };

  const startNew = async () => { await flush(); createdId.current.delete(mcqId); setCreatingNew(true); setPickedId(null); setText(''); savedText.current = ''; setStatus('idle'); };
  const close = async () => { await flush(); setView('closed'); };

  const hasNote = mine.length > 0 || text.trim().length > 0;
  const statusEl = status === 'saving' ? <span className="inline-flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Saving…</span>
    : status === 'saved' ? <span className="inline-flex items-center gap-1 text-[#287058]"><Check size={11} /> Saved to Notebook</span>
    : status === 'dirty' ? <span>Unsaved…</span>
    : status === 'error' ? <button onClick={() => void flush()} className="font-bold text-destructive underline" data-testid="button-notebook-retry">Couldn’t save — retry</button>
    : <span>Autosaves to your Notebook</span>;

  // ---- closed: floating button -------------------------------------------------------------------------------
  const fabPos = 'fixed right-3 z-40 bottom-[max(0.9rem,env(safe-area-inset-bottom))] sm:right-6 sm:bottom-6';
  if (view === 'closed') {
    return <button onClick={() => setView('open')} className={cn(fabPos, 'inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-[#32647b] to-[#264c5e] px-4 py-3 text-xs font-extrabold text-white shadow-[0_8px_24px_-6px_rgba(0,0,0,0.45)] transition-transform hover:-translate-y-0.5 active:scale-95')} aria-label="Open notebook" data-testid="button-open-notebook">
      <NotebookPen size={16} /> Notes
      {hasNote && <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-white bg-[#e5a952]" aria-hidden />}
    </button>;
  }

  // ---- minimized: slim pill ----------------------------------------------------------------------------------
  if (view === 'min') {
    return <button onClick={() => setView('open')} className={cn(fabPos, 'inline-flex max-w-[78vw] items-center gap-2 rounded-full border border-[#32647b]/30 bg-card px-3.5 py-2.5 text-xs font-bold text-[#32647b] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.35)]')} aria-label="Expand notebook" data-testid="button-expand-notebook">
      <NotebookPen size={14} className="shrink-0" /><span className="truncate">Q{questionNumber} note</span>
      <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">{status === 'saving' ? 'saving…' : status === 'dirty' ? 'unsaved' : status === 'error' ? 'not saved' : hasNote ? 'saved' : 'empty'}</span>
      <ChevronDown size={14} className="shrink-0 rotate-180" />
    </button>;
  }

  // ---- open: panel -------------------------------------------------------------------------------------------
  return <div className="fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-40 flex max-h-[62dvh] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[380px]" role="dialog" aria-label="Practice notebook" data-testid="panel-practice-notebook">
    <div className="flex items-center gap-2 bg-gradient-to-br from-[#32647b] to-[#264c5e] px-3.5 py-2.5 text-white">
      <NotebookPen size={15} /><div className="text-xs font-extrabold">My Notebook</div>
      <div className="ml-auto flex items-center gap-1">
        <button onClick={() => setView('min')} className="rounded-lg p-1.5 hover:bg-white/15" aria-label="Minimize notebook" data-testid="button-minimize-notebook"><Minus size={15} /></button>
        <button onClick={() => void close()} className="rounded-lg p-1.5 hover:bg-white/15" aria-label="Close notebook" data-testid="button-close-notebook"><X size={15} /></button>
      </div>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
      <div className="rounded-xl border border-[#32647b]/20 bg-[#eef2fb] px-3 py-2">
        <div className="text-[10px] font-bold uppercase tracking-wide text-[#32647b]">Attached to question {questionNumber}</div>
        <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-5 text-foreground">{questionText}</p>
      </div>
      {(mine.length > 1 || creatingNew) && <div className="mt-2.5 flex flex-wrap gap-1.5">
        {mine.map((n, i) => <button key={n.id} onClick={async () => { await flush(); setCreatingNew(false); setPickedId(n.id); }} className={cn('rounded-full px-2.5 py-1 text-[10px] font-bold', !creatingNew && active?.id === n.id ? 'bg-[#32647b] text-white' : 'border border-border text-muted-foreground')}>Note {mine.length - i}</button>)}
        {creatingNew && <span className="rounded-full bg-[#32647b] px-2.5 py-1 text-[10px] font-bold text-white">New note</span>}
      </div>}
      <textarea value={text} onChange={(e) => onChange(e.target.value)} autoFocus placeholder="Write what you want to remember about this question…" className="mt-2.5 min-h-[130px] w-full resize-y rounded-xl border border-border bg-background p-3 text-sm leading-6 outline-none focus:border-[#32647b]" data-testid="input-practice-note" />
    </div>
    <div className="flex items-center justify-between gap-2 border-t border-border px-3.5 py-2 text-[10px] font-semibold text-muted-foreground">
      <div className="min-w-0 truncate" aria-live="polite" data-testid="text-notebook-status">{statusEl}</div>
      <div className="flex shrink-0 items-center gap-3">
        {(active || text.trim()) && <button onClick={() => void remove()} className="inline-flex items-center gap-1 font-bold text-destructive" data-testid="button-delete-practice-note"><Trash2 size={11} /> Delete</button>}
        {!creatingNew && (active || text.trim()) && <button onClick={() => void startNew()} className="inline-flex items-center gap-1 font-bold text-[#32647b]" data-testid="button-new-practice-note"><Plus size={11} /> New note</button>}
      </div>
    </div>
  </div>;
}
