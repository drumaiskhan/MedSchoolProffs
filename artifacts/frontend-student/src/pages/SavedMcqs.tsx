// Saved MCQs — questions the student pressed "Save" on during practice, filed
// under Block › Module › Subject › Topic so they can be re-attempted later.
import { useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { savedMcqsApi, ApiRequestError, type SavedMcq } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { EmptyState, SectionHeader, cn } from '@/lib/shared';
import { ReviewTabs } from '@/components/study/ReviewTabs';
import { HierarchyTree, practiceIdsHref } from '@/components/study/HierarchyTree';
import { queryClient } from '@/lib/query-client';

function SavedMcqs() {
  const [, navigate] = useLocation();
  const [term, setTerm] = useState('');
  const saved = useQuery({ queryKey: ['saved-mcqs'], queryFn: savedMcqsApi.list });
  const remove = useMutation({
    mutationFn: savedMcqsApi.remove,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['saved-mcqs'] }); toast({ title: 'Removed from saved' }); },
    onError: (err: unknown) => toast({ title: 'Could not remove this', description: err instanceof ApiRequestError ? err.message : 'Something went wrong.', variant: 'destructive' }),
  });
  const q = term.trim().toLowerCase();
  const visible = (saved.data || []).filter((s) => !q || `${s.question ?? ''} ${s.path ?? ''}`.toLowerCase().includes(q));
  const attemptable = visible.filter((s) => !s.mcqDeleted);

  const renderItem = (s: SavedMcq) => (
    <div key={s.id} className="rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-md" data-testid={`card-saved-mcq-${s.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-3 text-sm font-bold" data-testid={`text-saved-mcq-question-${s.id}`}>{s.question ?? `This question is no longer available (MCQ #${s.mcqId}).`}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Saved {new Date(s.createdAt).toLocaleDateString()}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={() => navigate(`/practice?mcqId=${s.mcqId}`)} disabled={s.mcqDeleted} title={s.mcqDeleted ? 'This question no longer exists' : undefined} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40" data-testid={`button-attempt-saved-${s.id}`}>Attempt</button>
          <button onClick={() => remove.mutate(s.id)} disabled={remove.isPending} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-destructive disabled:opacity-50" data-testid={`button-unsave-${s.id}`}>Remove</button>
        </div>
      </div>
    </div>
  );

  return <div>
    <SectionHeader eyebrow="Your tools" title="Saved MCQs" description="Questions you saved while practising, organised by Block › Module › Subject › Topic. Attempt a single question, a whole topic, or everything whenever you like." />
    <ReviewTabs />
    {!!saved.data?.length && <div className="mb-4 flex flex-wrap items-center gap-2" data-testid="saved-mcq-toolbar">
      <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search saved questions…" className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-xs" data-testid="input-search-saved-mcqs" />
      {attemptable.length > 0 && <button onClick={() => navigate(practiceIdsHref(attemptable.map((s) => s.mcqId)) ?? '/practice')} className={cn('rounded-xl bg-primary px-3.5 py-2 text-xs font-extrabold text-primary-foreground transition-transform active:scale-95')} data-testid="button-practice-saved">Attempt {attemptable.length > 50 ? 'first 50' : `these ${attemptable.length}`}</button>}
    </div>}
    <div className="space-y-3">
      <HierarchyTree<SavedMcq> items={visible} unit="question" testIdPrefix="saved-mcq-tree" expandAll={!!q} ungroupedLabel="Removed questions"
        place={(s) => (s.mcqDeleted ? null : s)} mcqIds={(s) => (s.mcqDeleted ? [] : [s.mcqId])} renderItem={renderItem} />
      {saved.isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
      {!saved.isLoading && !saved.data?.length && <EmptyState icon={Star} title="No saved questions yet" body="Tap Save on a question during practice and it will appear here, filed by block, module, subject and topic." />}
    </div>
  </div>;
}

export default SavedMcqs;
