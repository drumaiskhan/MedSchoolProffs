// Past paper — ONE page: paper overview + topic picker + difficulty + question count + timer + summary.
// Replaces the old two-step flow (overview page -> /practice setup screen). Pressing Start opens
// /practice with `go=1` plus the chosen options, and Practice begins the session immediately.
// Topics come from the AI, which sorts every question of the paper on its own.
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'wouter';
import { useListMcqs } from '@workspace/api-client-react';
import { ArrowLeft, ArrowRight, BookOpen, Check, Clock3, Infinity as InfinityIcon, Layers, Minus, Plus, Shuffle, Sparkles, Star, Target, Timer } from 'lucide-react';
import { pastPapersApi } from '@/lib/api';
import { EmptyState, SkeletonPage } from '@/lib/shared';
import { cn } from '@/lib/utils';

type Diff = 'all' | 'easy' | 'moderate' | 'hard';
type CountMode = '10' | '20' | '50' | 'all' | 'custom';
const DIFFS: { key: Diff; label: string; dot: string; ring: string }[] = [
  { key: 'all', label: 'All', dot: 'bg-primary', ring: 'border-primary bg-primary/10' },
  { key: 'easy', label: 'Easy', dot: 'bg-emerald-500', ring: 'border-emerald-500 bg-emerald-500/10' },
  { key: 'moderate', label: 'Medium', dot: 'bg-amber-500', ring: 'border-amber-500 bg-amber-500/10' },
  { key: 'hard', label: 'Hard', dot: 'bg-rose-500', ring: 'border-rose-500 bg-rose-500/10' },
];
const diffOf = (d?: string | null) => (d || 'moderate').toLowerCase();

function StepHeader({ n, icon: Icon, title, hint, tone }: { n: number; icon: typeof Layers; title: string; hint?: string; tone: string }) {
  return <div className="mb-3 flex items-center gap-2.5 sm:mb-4 sm:gap-3">
    <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg sm:size-10 sm:rounded-xl', tone)}><Icon size={16} /></span>
    <div className="min-w-0">
      <div className="hidden text-[11px] font-extrabold uppercase tracking-[.16em] text-muted-foreground sm:block">Step {n}</div>
      <h2 className="text-[15px] font-extrabold leading-tight sm:text-lg"><span className="text-muted-foreground sm:hidden">{n} · </span>{title}</h2>
    </div>
    {hint && <span className="ml-auto hidden text-xs font-semibold text-muted-foreground sm:block">{hint}</span>}
  </div>;
}

function PastPaperDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, navigate] = useLocation();

  const [topics, setTopics] = useState<string[]>([]);          // [] = all topics
  const [difficulty, setDifficulty] = useState<Diff>('all');
  const [countMode, setCountMode] = useState<CountMode>('20');
  const [customCount, setCustomCount] = useState('');
  const [timed, setTimed] = useState(true);
  const [customMinutes, setCustomMinutes] = useState<number | null>(null); // null = 1 min per question
  const [shuffle, setShuffle] = useState(false);

  const papersQ = useQuery({ queryKey: ['past-papers'], queryFn: () => pastPapersApi.list() });
  const subjectsQ = useQuery({ queryKey: ['past-paper-subjects', id], queryFn: () => pastPapersApi.subjects(id), enabled: Number.isInteger(id) && id > 0, staleTime: 0,
    // While the AI is still sorting the questions, re-check every few seconds so topics appear by themselves.
    refetchInterval: (q) => (q.state.data?.classifying ? 4000 : false) });
  // Same query Practice uses, so the questions are already cached when the session starts.
  const mcqsQ = useListMcqs(Number.isInteger(id) && id > 0 ? { pastPaperId: id } : undefined);

  const paper = (papersQ.data ?? []).find((p) => p.id === id);
  const subjects = subjectsQ.data?.subjects ?? [];
  const classifying = !!subjectsQ.data?.classifying;
  const tagged = subjects.filter((s) => s.key !== '__general');
  const mcqs = mcqsQ.data ?? [];

  // Pool of questions = chosen topics (or everything), then narrowed by difficulty.
  const topicPool = useMemo(() => {
    if (!topics.length) return mcqs;
    const allowed = new Set(subjects.filter((s) => topics.includes(s.key)).flatMap((s) => s.mcqIds));
    return mcqs.filter((m) => allowed.has(m.id));
  }, [mcqs, subjects, topics]);
  const diffCounts = useMemo(() => {
    const c = { easy: 0, moderate: 0, hard: 0 } as Record<string, number>;
    for (const m of topicPool) { const k = diffOf(m.difficulty); c[k] = (c[k] ?? 0) + 1; }
    return c;
  }, [topicPool]);

  if (papersQ.isLoading || subjectsQ.isLoading) return <SkeletonPage />;
  if (!paper) {
    return <div className="max-w-3xl"><EmptyState icon={BookOpen} title="Paper not found" body="This past paper isn't available to you, or it has been removed." action={<Link href="/past-papers" className="text-sm font-bold text-primary">Back to past papers</Link>} /></div>;
  }

  const total = subjectsQ.data?.total ?? paper.mcqCount;
  const poolCount = diffCounts.easy + diffCounts.moderate + diffCounts.hard + Object.entries(diffCounts).filter(([k]) => !['easy', 'moderate', 'hard'].includes(k)).reduce((a, [, v]) => a + v, 0);
  const available = difficulty === 'all' ? poolCount : (diffCounts[difficulty] ?? 0);
  const customN = Math.floor(Number(customCount));
  const count = countMode === 'all' ? available
    : countMode === 'custom' ? (Number.isFinite(customN) && customN >= 1 ? Math.min(customN, available) : 0)
    : Math.min(Number(countMode), available);
  const autoMinutes = Math.max(1, count);
  const minutes = customMinutes ?? autoMinutes;
  const ends = timed ? new Date(Date.now() + minutes * 60000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null;
  const dataReady = !mcqsQ.isLoading;
  const topicLabel = !topics.length ? 'All topics' : topics.length === 1 ? (subjects.find((s) => s.key === topics[0])?.name ?? '1 topic') : `${topics.length} topics`;
  const diffLabel = DIFFS.find((d) => d.key === difficulty)!.label;

  const toggleTopic = (key: string) => setTopics((t) => (t.includes(key) ? t.filter((k) => k !== key) : [...t, key]));
  const start = () => {
    const qs = new URLSearchParams({ pastPaperId: String(id), go: '1', timer: timed ? 'timed' : 'untimed', n: countMode === 'all' ? 'all' : String(count) });
    topics.forEach((k) => qs.append('subject', k));
    if (difficulty !== 'all') qs.set('diff', difficulty);
    if (timed) qs.set('min', String(minutes));
    if (shuffle) qs.set('shuffle', '1');
    navigate(`/practice?${qs.toString()}`);
  };
  const canStart = dataReady && count > 0;
  const meta = [paper.examBoard, paper.year].filter(Boolean).join(' · ');
  const bar = (n: number) => `${total ? Math.max(4, Math.round((n / total) * 100)) : 0}%`;

  return <div className="mx-auto w-full max-w-6xl pb-28 lg:pb-10" data-testid="page-past-paper-detail">
    {/* ───────── Hero ───────── */}
    <header className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-indigo-700 via-indigo-600 to-blue-500 p-4 text-white shadow-lg sm:rounded-[1.75rem] sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 size-72 rounded-full bg-sky-300/20 blur-3xl" aria-hidden="true" />
      <div className="relative flex flex-col gap-3 sm:gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Link href="/past-papers" className="inline-flex items-center gap-1.5 text-xs font-bold text-white/85 hover:text-white" data-testid="link-paper-back"><ArrowLeft size={14} /> Past papers</Link>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 sm:mt-4 sm:gap-2">
            {meta && <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] sm:px-3 sm:py-1 sm:text-[11px] font-extrabold uppercase tracking-[.14em] backdrop-blur">{meta}</span>}
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-[10px] sm:px-3 sm:py-1 sm:text-[11px] font-extrabold uppercase tracking-[.1em] text-emerald-100"><Star size={11} fill="currentColor" /> Board certified</span>
          </div>
          <h1 className="mt-2 text-xl font-black leading-tight tracking-tight sm:mt-3 sm:text-4xl" data-testid="text-paper-title">{paper.title}</h1>
        </div>
        <div className="grid w-full shrink-0 grid-cols-4 gap-1.5 sm:gap-3 lg:w-auto" data-testid="text-paper-total">
          {[{ l: 'Total', v: total, c: 'text-white' }, { l: 'Easy', v: diffCountsAll(mcqs).easy, c: 'text-emerald-200' }, { l: 'Medium', v: diffCountsAll(mcqs).moderate, c: 'text-amber-200' }, { l: 'Hard', v: diffCountsAll(mcqs).hard, c: 'text-rose-200' }].map((s) =>
            <div key={s.l} className="rounded-xl bg-white/12 px-1.5 py-1.5 text-center backdrop-blur sm:min-w-[5.2rem] sm:rounded-2xl sm:px-4 sm:py-2.5">
              <div className={cn('text-lg font-black leading-none sm:text-3xl', s.c)}>{dataReady || s.l === 'Total' ? s.v : '–'}</div>
              <div className="mt-0.5 text-[9px] font-extrabold uppercase tracking-[.1em] text-white/70 sm:mt-1 sm:text-[10px]">{s.l}</div>
            </div>)}
        </div>
      </div>
    </header>

    <div className="mt-3 grid gap-3 sm:mt-6 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
      {/* ───────── Configuration ───────── */}
      <div className="space-y-3 sm:space-y-6">
        {/* Step 1 — topics */}
        <section className="rounded-2xl border border-border bg-card p-3.5 shadow-sm sm:rounded-3xl sm:p-6" data-testid="section-paper-topics">
          <StepHeader n={1} icon={Layers} title="Choose topics" hint="Pick one, several, or everything" tone="bg-purple-500/10 text-purple-600" />
          <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-3">
            <button type="button" onClick={() => setTopics([])} aria-pressed={!topics.length} data-testid="select-paper-topic"
              className={cn('group relative col-span-2 overflow-hidden rounded-xl border-2 p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md sm:col-span-1 sm:rounded-2xl sm:p-4', !topics.length ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/40')}>
              <div className="flex items-start justify-between gap-2"><span className="text-[13px] font-extrabold leading-snug sm:text-sm">Comprehensive Assessment <span className="font-semibold text-muted-foreground">(All Topics)</span></span>{!topics.length && <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Check size={12} strokeWidth={3} /></span>}</div>
              <div className="mt-1.5 text-xl font-black text-primary sm:mt-3 sm:text-2xl">{total}<span className="ml-1 text-xs font-bold text-muted-foreground">questions</span></div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted sm:mt-2 sm:h-1.5"><div className="h-full w-full rounded-full bg-primary" /></div>
            </button>
            {subjects.map((s) => {
              const on = topics.includes(s.key);
              return <button key={s.key} type="button" onClick={() => toggleTopic(s.key)} aria-pressed={on} data-testid={`option-paper-topic-${s.key}`}
                className={cn('group relative overflow-hidden rounded-xl border-2 p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md sm:rounded-2xl sm:p-4', on ? 'border-purple-500 bg-purple-500/10' : 'border-border bg-background hover:border-purple-400/50')}>
                <div className="flex items-start justify-between gap-2"><span className="text-[13px] font-extrabold leading-snug sm:text-sm">{s.name}</span>{on && <span className="grid size-5 shrink-0 place-items-center rounded-full bg-purple-500 text-white"><Check size={12} strokeWidth={3} /></span>}</div>
                <div className="mt-1.5 text-xl font-black sm:mt-3 sm:text-2xl">{s.count}<span className="ml-1 text-xs font-bold text-muted-foreground">questions</span></div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted sm:mt-2 sm:h-1.5"><div className="h-full rounded-full bg-purple-500 transition-all" style={{ width: bar(s.count) }} /></div>
              </button>;
            })}
          </div>
          {classifying && <div className="mt-3 flex items-center gap-2 text-xs font-bold text-primary" data-testid="text-paper-ai-sorting"><Sparkles size={14} className="animate-pulse" /> AI is sorting this paper's questions into topics…</div>}
          {!classifying && tagged.length === 0 && <p className="mt-4 text-xs font-semibold text-muted-foreground">Topics appear here once the paper's questions have been sorted by subject.</p>}
        </section>

        {/* Step 2 — difficulty + count */}
        <section className="rounded-2xl border border-border bg-card p-3.5 shadow-sm sm:rounded-3xl sm:p-6">
          <StepHeader n={2} icon={Target} title="Difficulty & length" tone="bg-sky-500/10 text-sky-600" />
          <div className="grid grid-cols-4 gap-1.5 sm:gap-3">
            {DIFFS.map((d) => {
              const n = d.key === 'all' ? poolCount : (diffCounts[d.key] ?? 0);
              const on = difficulty === d.key;
              return <button key={d.key} type="button" disabled={d.key !== 'all' && n === 0} onClick={() => setDifficulty(d.key)} data-testid={`button-difficulty-${d.key}`}
                className={cn('rounded-xl border-2 px-1 py-2 text-center transition-all hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-35 sm:rounded-2xl sm:p-3.5', on ? d.ring : 'border-border bg-background hover:border-foreground/20')}>
                <span className={cn('mx-auto block size-2.5 rounded-full', d.dot)} />
                <div className="mt-1 text-xs font-extrabold sm:mt-2 sm:text-sm">{d.label}</div>
                <div className="text-[11px] font-semibold text-muted-foreground sm:text-xs">{n}</div>
              </button>;
            })}
          </div>
          <div className="mt-4 text-[10px] font-extrabold uppercase tracking-[.14em] text-muted-foreground sm:mt-6 sm:text-[11px]">Number of questions</div>
          <div className="mt-1.5 grid grid-cols-4 gap-1.5 sm:mt-2 sm:gap-3">
            {([['10', '10'], ['20', '20'], ['50', '50'], ['all', `All ${available}`]] as [CountMode, string][]).map(([k, label]) => {
              const on = countMode === k;
              return <button key={k} type="button" onClick={() => setCountMode(k)} data-testid={`button-count-${k}`}
                className={cn('rounded-xl border-2 px-1 py-2 text-center transition-all hover:-translate-y-0.5 sm:rounded-2xl sm:px-3 sm:py-3', on ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-foreground/20')}>
                <div className="text-sm font-black sm:text-lg">{label}</div><div className="hidden text-[11px] font-semibold text-muted-foreground sm:block">{k === 'all' ? 'MCQs' : 'questions'}</div>
              </button>;
            })}
          </div>
          <label className={cn('mt-2 flex items-center justify-between gap-3 rounded-xl border-2 px-3 py-1.5 transition-colors sm:mt-3 sm:rounded-2xl sm:px-4 sm:py-3', countMode === 'custom' ? 'border-primary bg-primary/10' : 'border-border bg-background')}>
            <span className="text-xs font-bold sm:text-sm">Or enter your own number</span>
            <input inputMode="numeric" value={customCount} placeholder={`1-${Math.max(1, available)}`} data-testid="input-custom-count"
              onFocus={() => setCountMode('custom')}
              onChange={(e) => { setCustomCount(e.target.value.replace(/\D/g, '')); setCountMode('custom'); }}
              className="w-24 rounded-lg border border-border bg-card px-2 py-1.5 text-center sm:w-28 sm:rounded-xl sm:px-3 sm:py-2 text-sm font-extrabold outline-none focus:border-primary" />
          </label>
        </section>

        {/* Step 3 — timer */}
        <section className="rounded-2xl border border-border bg-card p-3.5 shadow-sm sm:rounded-3xl sm:p-6">
          <StepHeader n={3} icon={Clock3} title="Pace yourself" tone="bg-amber-500/10 text-amber-600" />
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {[{ t: true, icon: Timer, name: 'Timer', body: 'Countdown with auto-submit when time ends.' }, { t: false, icon: InfinityIcon, name: 'Timeless', body: 'No time limit. Study at your own pace.' }].map((o) =>
              <button key={o.name} type="button" onClick={() => setTimed(o.t)} aria-pressed={timed === o.t} data-testid={`button-mode-${o.t ? 'timed' : 'untimed'}`}
                className={cn('flex items-center gap-2.5 rounded-xl border-2 p-2.5 text-left transition-all hover:-translate-y-0.5 sm:items-start sm:gap-3 sm:rounded-2xl sm:p-4', timed === o.t ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-foreground/20')}>
                <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg sm:size-11 sm:rounded-xl', timed === o.t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}><o.icon size={20} /></span>
                <span><span className="block text-sm font-extrabold sm:text-base">{o.name}</span><span className="mt-0.5 hidden text-xs sm:block font-medium leading-relaxed text-muted-foreground">{o.body}</span></span>
              </button>)}
          </div>
          {timed && <div className="mt-3 rounded-xl border border-border bg-background p-3 sm:mt-4 sm:rounded-2xl sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-extrabold">Set your own time</div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground"><Clock3 size={13} /> Ends ~{ends}</div>
            </div>
            <div className="mt-2 flex items-center justify-center gap-4 sm:mt-3">
              <button type="button" onClick={() => setCustomMinutes(Math.max(1, minutes - 1))} className="grid size-9 place-items-center rounded-full border border-border bg-card hover:bg-muted sm:size-11" aria-label="Fewer minutes"><Minus size={16} /></button>
              <div className="text-center"><div className="text-3xl font-black tabular-nums leading-none sm:text-4xl" data-testid="text-minutes">{minutes}</div><div className="mt-1 text-xs font-semibold text-muted-foreground">minutes</div></div>
              <button type="button" onClick={() => setCustomMinutes(Math.min(600, minutes + 1))} className="grid size-9 place-items-center rounded-full border border-border bg-card hover:bg-muted sm:size-11" aria-label="More minutes"><Plus size={16} /></button>
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:mt-4 sm:gap-2">
              <button type="button" onClick={() => setCustomMinutes(null)} className={cn('rounded-full px-3 py-1 text-[11px] font-extrabold sm:px-4 sm:py-1.5 sm:text-xs', customMinutes === null ? 'bg-primary text-primary-foreground' : 'border border-border bg-card hover:bg-muted')}>{autoMinutes} min (recommended)</button>
              {[15, 30, 45, 60, 90].map((m) => <button key={m} type="button" onClick={() => setCustomMinutes(m)} className={cn('rounded-full px-3 py-1 text-[11px] font-extrabold sm:px-4 sm:py-1.5 sm:text-xs', customMinutes === m ? 'bg-primary text-primary-foreground' : 'border border-border bg-card hover:bg-muted')}>{m} min</button>)}
            </div>
            <p className="mt-3 hidden text-center text-[11px] font-semibold text-muted-foreground sm:block">~1 min per question — standard board-exam pacing.</p>
          </div>}
          <button type="button" role="switch" aria-checked={shuffle} onClick={() => setShuffle((s) => !s)} data-testid="switch-shuffle"
            className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2 text-left sm:mt-4 sm:rounded-2xl sm:px-4 sm:py-3">
            <span className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground sm:size-9 sm:rounded-xl"><Shuffle size={15} /></span><span><span className="block text-sm font-extrabold">Shuffle question order</span><span className="hidden text-xs font-medium text-muted-foreground sm:block">Off keeps the paper's original order.</span></span></span>
            <span className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', shuffle ? 'bg-primary' : 'bg-muted-foreground/30')}><span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', shuffle ? 'left-[1.375rem]' : 'left-0.5')} /></span>
          </button>
        </section>
      </div>

      {/* ───────── Live summary (sticky on wide screens) ───────── */}
      <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-md" data-testid="card-paper-summary">
          <div className="bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 p-5">
            <div className="text-[11px] font-extrabold uppercase tracking-[.16em] text-emerald-600">Your test</div>
            <div className="mt-1 flex items-baseline gap-2"><span className="text-5xl font-black tracking-tight text-emerald-700 dark:text-emerald-400" data-testid="text-paper-selected">{dataReady ? count : '–'}</span><span className="text-sm font-bold text-emerald-700/70 dark:text-emerald-400/70">of {total} questions</span></div>
          </div>
          <dl className="divide-y divide-border px-5 text-sm">
            {[['Topics', topicLabel], ['Difficulty', diffLabel], ['Mode', timed ? `Timer · ${minutes} min` : 'Timeless'], ['Order', shuffle ? 'Shuffled' : 'Paper order']].map(([k, v]) =>
              <div key={k} className="flex items-center justify-between gap-3 py-3"><dt className="font-semibold text-muted-foreground">{k}</dt><dd className="text-right font-extrabold">{v}</dd></div>)}
            {timed && <div className="flex items-center justify-between gap-3 py-3"><dt className="font-semibold text-muted-foreground">Finishes about</dt><dd className="font-extrabold">{ends}</dd></div>}
          </dl>
          <div className="p-5 pt-3">
            <button type="button" onClick={start} disabled={!canStart} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 text-sm font-extrabold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:brightness-110 active:scale-[.98] disabled:opacity-50" data-testid="button-paper-start">
              {!dataReady ? 'Loading questions…' : count === 0 ? 'No questions match these options' : topics.length === 0 && difficulty === 'all' && count === total ? `Attempt full paper · ${count} questions` : `Start ${count} question${count === 1 ? '' : 's'}`}
              {canStart && <ArrowRight size={16} />}
            </button>
            <p className="mt-3 text-center text-[11px] font-semibold text-muted-foreground">Focus on accuracy &amp; logic — you can review every answer after.</p>
          </div>
        </div>
      </aside>
    </div>

    {/* Phones: slim sticky summary + Start bar (the full summary card is for wide screens) */}
    <div className="sticky bottom-[5.5rem] z-30 mt-3 lg:hidden" data-testid="bar-paper-start">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/95 p-2.5 pl-4 shadow-xl backdrop-blur">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5"><span className="text-2xl font-black leading-none text-emerald-600 dark:text-emerald-400">{dataReady ? count : '–'}</span><span className="text-xs font-bold text-muted-foreground">of {total} qs</span></div>
          <div className="truncate text-[11px] font-semibold text-muted-foreground">{topicLabel} · {diffLabel} · {timed ? `${minutes} min` : 'Timeless'}</div>
        </div>
        <button type="button" onClick={start} disabled={!canStart} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-5 py-3 text-sm font-extrabold text-primary-foreground shadow-md active:scale-[.97] disabled:opacity-50" data-testid="button-paper-start-mobile">{!dataReady ? 'Loading…' : 'Start'}{canStart && <ArrowRight size={15} />}</button>
      </div>
    </div>
  </div>;
}

function diffCountsAll(mcqs: { difficulty?: string | null }[]) {
  const c = { easy: 0, moderate: 0, hard: 0 };
  for (const m of mcqs) { const k = diffOf(m.difficulty); if (k in c) (c as Record<string, number>)[k]++; }
  return c;
}

export default PastPaperDetail;
