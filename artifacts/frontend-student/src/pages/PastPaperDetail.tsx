// Past paper detail — shown between the Past Papers list and practice.
// Mirrors the "paper overview" card: identification, total question index,
// a Topics dropdown ("Comprehensive Assessment (All Topics)" or one topic, each
// with its question count) and a start button. Topics come from the AI, which
// sorts every question of the paper (old and newly added) on its own.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'wouter';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ChevronDown, Clock3, Layers, Sparkles, Star } from 'lucide-react';
import { pastPapersApi } from '@/lib/api';
import { EmptyState, SkeletonPage } from '@/lib/shared';
import { cn } from '@/lib/utils';

function PastPaperDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const [topic, setTopic] = useState<string | null>(null); // null = all topics
  const [menuOpen, setMenuOpen] = useState(false);

  // Same query key as the Past Papers list, so arriving from it is instant.
  const papersQ = useQuery({ queryKey: ['past-papers'], queryFn: () => pastPapersApi.list() });
  const subjectsQ = useQuery({ queryKey: ['past-paper-subjects', id], queryFn: () => pastPapersApi.subjects(id), enabled: Number.isInteger(id) && id > 0, staleTime: 0,
    // While the AI is still sorting the questions, re-check every few seconds so topics appear by themselves.
    refetchInterval: (q) => (q.state.data?.classifying ? 4000 : false) });

  const paper = (papersQ.data ?? []).find((p) => p.id === id);
  if (papersQ.isLoading || subjectsQ.isLoading) return <SkeletonPage />;
  if (!paper) {
    return <div className="max-w-3xl"><EmptyState icon={BookOpen} title="Paper not found" body="This past paper isn't available to you, or it has been removed." action={<Link href="/past-papers" className="text-sm font-bold text-primary">Back to past papers</Link>} /></div>;
  }

  const total = subjectsQ.data?.total ?? paper.mcqCount;
  const subjects = subjectsQ.data?.subjects ?? [];
  const classifying = !!subjectsQ.data?.classifying;
  // Questions the AI could not place sit in "General" — nothing to choose between
  // unless at least one real topic exists.
  const tagged = subjects.filter((s) => s.key !== '__general');
  const showTopics = tagged.length > 0 || classifying;
  const current = topic ? subjects.find((s) => s.key === topic) : undefined;
  const hasSelection = !!current;
  const attemptCount = current ? current.count : total;
  const topicLabel = current ? current.name : 'Comprehensive Assessment (All Topics)';

  const start = () => {
    const qs = new URLSearchParams({ pastPaperId: String(id) });
    if (current) qs.append('subject', current.key);
    navigate(`/practice?${qs.toString()}`);
  };

  return <div className="mx-auto max-w-xl pb-10" data-testid="page-past-paper-detail">
    <div className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm">
      <div className="relative bg-gradient-to-r from-indigo-800 to-blue-600 px-5 pb-6 pt-5 text-white">
        <Link href="/past-papers" className="inline-flex items-center gap-1.5 text-xs font-bold text-white/85 hover:text-white" data-testid="link-paper-back"><ArrowLeft size={14} /> Past papers</Link>
        {[paper.examBoard, paper.year].filter(Boolean).length > 0 && <div className="mt-3 text-[11px] font-extrabold uppercase tracking-[.14em] text-white/75">{[paper.examBoard, paper.year].filter(Boolean).join(' · ')}</div>}
      </div>

      <div className="space-y-7 p-5 sm:p-7">
        <section>
          <div className="mb-3 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-blue-500/10 text-blue-600"><BookOpen size={18} /></span><span className="text-xs font-extrabold uppercase tracking-[.16em] text-muted-foreground">Identification</span></div>
          <div className="rounded-2xl border border-border bg-background px-5 py-4 shadow-sm"><h1 className="text-xl font-extrabold leading-snug" data-testid="text-paper-title">{paper.title}</h1></div>
        </section>

        <section className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-emerald-500/[0.07] p-5 shadow-sm">
          <CheckCircle2 size={92} className="absolute -right-3 top-3 text-emerald-500/15" strokeWidth={1.5} aria-hidden="true" />
          <div className="text-xs font-extrabold uppercase tracking-[.16em] text-emerald-600">{hasSelection ? 'Selected topic questions' : 'Total question index'}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-5xl font-black tracking-tight text-emerald-700 dark:text-emerald-400" data-testid="text-paper-total">{attemptCount}</span>
            {hasSelection && <span className="text-sm font-bold text-emerald-700/70 dark:text-emerald-400/70">of {total}</span>}
          </div>
          <div className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 dark:text-emerald-400"><Star size={14} fill="currentColor" /> Board Certified Content</div>
        </section>

        {showTopics && <section>
          <div className="mb-3 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-purple-500/10 text-purple-600"><Layers size={18} /></span><span className="text-xs font-extrabold uppercase tracking-[.16em] text-muted-foreground">Topics</span></div>
          <button type="button" onClick={() => setMenuOpen(true)} disabled={tagged.length === 0} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3.5 text-left shadow-sm transition-transform active:scale-[.99] disabled:opacity-60" data-testid="select-paper-topic">
            <span className="text-sm font-extrabold leading-snug">{topicLabel}</span>
            <ChevronDown size={18} className="shrink-0 text-muted-foreground" />
          </button>
          {classifying && <div className="mt-2.5 flex items-center gap-2 text-xs font-bold text-primary" data-testid="text-paper-ai-sorting"><Sparkles size={14} className="animate-pulse" /> AI is sorting this paper's questions into topics…</div>}
        </section>}

        {menuOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-5" onClick={() => setMenuOpen(false)} role="presentation">
          <div role="radiogroup" aria-label="Topics" onClick={(e) => e.stopPropagation()} className="max-h-[75vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-[#262a31] text-white shadow-2xl" data-testid="menu-paper-topics">
            {[{ key: null as string | null, name: 'Comprehensive Assessment (All Topics)', count: total }, ...subjects.map((s) => ({ key: s.key as string | null, name: s.name, count: s.count }))].map((o, i) => {
              const on = (topic ?? null) === o.key;
              return <button key={o.key ?? 'all'} type="button" role="radio" aria-checked={on} onClick={() => { setTopic(o.key); setMenuOpen(false); }} className={cn('flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-lg font-medium', i > 0 && 'border-t border-white/10')} data-testid={`option-paper-topic-${o.key ?? 'all'}`}>
                <span>{o.name} <span className="text-sm font-bold text-white/50">· {o.count}</span></span>
                <span className={cn('grid size-6 shrink-0 place-items-center rounded-full border-2', on ? 'border-sky-300' : 'border-white/70')}>{on && <span className="size-3 rounded-full bg-sky-300" />}</span>
              </button>;
            })}
          </div>
        </div>}

        <section className="flex items-center gap-4 rounded-2xl border border-blue-500/15 bg-blue-500/[0.06] p-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-background text-blue-600 shadow-sm"><Clock3 size={22} /></span>
          <div><div className="text-base font-extrabold">Timed or untimed — your choice</div><div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-blue-600">Focus on accuracy &amp; logic</div></div>
        </section>

        <button type="button" onClick={start} disabled={attemptCount === 0} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 text-sm font-extrabold text-primary-foreground shadow-md transition-transform active:scale-[.98] disabled:opacity-50" data-testid="button-paper-start">
          {attemptCount === 0 ? 'No questions in this paper yet' : hasSelection ? `Attempt ${attemptCount} ${current!.name} question${attemptCount === 1 ? '' : 's'}` : `Attempt full paper · ${attemptCount} questions`}
          {attemptCount > 0 && <ArrowRight size={16} />}
        </button>
      </div>
    </div>
  </div>;
}

export default PastPaperDetail;
