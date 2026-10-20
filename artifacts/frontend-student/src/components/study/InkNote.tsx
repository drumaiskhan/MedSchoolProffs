// Glue between the Journal-style editor and the Notebook API (v89).
//  • <InkNoteSheet>  full-screen editor for one note: loads the saved page, autosaves, creates the note on the first stroke.
//  • <InkPreview>    lazy vector thumbnail of a note's handwriting (fetched only when scrolled into view).
//
// Deliberately imports nothing from '@/lib/shared' (that barrel re-exports the cards that use these components).
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, PenLine, X } from 'lucide-react';
import { notebookApi } from '@/lib/api';
import { inkToSvg, parseInk } from '@/lib/ink';
import { queryClient } from '@/lib/query-client';
import { cn } from '@/lib/utils';

const InkEditor = lazy(() => import('./InkEditor'));

function useInView<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el || seen) return;
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen];
}

/** Vector thumbnail of a handwritten note. Colours inside the SVG are validated by inkToSvg. */
export function InkPreview({ noteId, maxHeight = 420, className }: { noteId: number; maxHeight?: number; className?: string }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const q = useQuery({ queryKey: ['notebook-ink', noteId], queryFn: () => notebookApi.get(noteId), enabled: seen, staleTime: 5 * 60_000 });
  const svg = useMemo(() => {
    const doc = parseInk(q.data?.ink);
    return doc && doc.strokes.length ? inkToSvg(doc, { maxHeight }) : null;
  }, [q.data?.ink, maxHeight]);
  return <div ref={ref} className={cn('overflow-hidden rounded-xl border border-border bg-[#fffdf8]', className)} data-testid={`ink-preview-${noteId}`}>
    {svg ? <div dangerouslySetInnerHTML={{ __html: svg }} />
      : <div className="grid h-24 place-items-center text-[11px] font-semibold text-muted-foreground">{q.isError ? 'Could not load this page' : q.isLoading || !seen ? <Loader2 size={14} className="animate-spin" /> : <span className="inline-flex items-center gap-1"><PenLine size={12} /> Empty page</span>}</div>}
  </div>;
}

export interface InkNoteSheetProps {
  /** Existing note to open, or null to start a new handwritten note (created on the first stroke). */
  noteId: number | null;
  mcqId?: number;
  /** Shown under the title, e.g. the question the note is attached to. */
  questionText?: string;
  initialTitle?: string;
  onClose: () => void;
  onCreated?: (id: number) => void;
}

export function InkNoteSheet({ noteId, mcqId, questionText, initialTitle = '', onClose, onCreated }: InkNoteSheetProps) {
  const idRef = useRef<number | null>(noteId);
  const loaded = useQuery({
    queryKey: ['notebook-ink-edit', noteId],
    queryFn: () => notebookApi.get(noteId!),
    enabled: noteId !== null,
    staleTime: 0, gcTime: 0, retry: 1,
  });

  const onSave = async ({ ink, title }: { ink: string | null; title: string }) => {
    const id = idRef.current;
    if (id) {
      await notebookApi.update(id, { ink, title });
      queryClient.setQueryData(['notebook-ink', id], (old: unknown) => ({ ...(old as object ?? {}), id, ink }));
    } else if (ink) {
      const row = await notebookApi.create({ title: title || undefined, ink, mcqId });
      idRef.current = row.id;
      queryClient.setQueryData(['notebook-ink', row.id], { ...row, ink });
      onCreated?.(row.id);
    } else return;                     // nothing worth creating yet (only a title / still empty)
    void queryClient.invalidateQueries({ queryKey: ['notebook'] });
  };

  if (noteId !== null && (loaded.isLoading || loaded.isError || !loaded.data)) {
    return <div className="fixed inset-0 z-[80] grid place-items-center bg-background/90 backdrop-blur-sm" data-testid="ink-loading">
      {loaded.isError ? <div className="rounded-2xl border border-border bg-card p-5 text-center text-sm"><p className="font-bold">Couldn’t open this page.</p><button onClick={onClose} className="mt-3 inline-flex items-center gap-1 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"><X size={13} /> Close</button></div>
        : <Loader2 className="animate-spin text-muted-foreground" />}
    </div>;
  }

  return <Suspense fallback={<div className="fixed inset-0 z-[80] grid place-items-center bg-background/90"><Loader2 className="animate-spin text-muted-foreground" /></div>}>
    <InkEditor
      initialInk={loaded.data?.ink ?? null}
      initialTitle={loaded.data?.title ?? initialTitle}
      subtitle={questionText ? <span className="truncate">Q: {questionText}</span> : undefined}
      onSave={onSave}
      onClose={onClose}
    />
  </Suspense>;
}
