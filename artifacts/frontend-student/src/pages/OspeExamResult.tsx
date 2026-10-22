// Auto-extracted route page — code-split via React.lazy() in App.tsx.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'wouter';
import { useState } from 'react';
import { CheckCircle2, Clock3, GraduationCap, Lightbulb, Loader2, X } from 'lucide-react';
import { ApiRequestError, ospeApi, resolveUploadUrl } from '@/lib/api';
import { SkeletonPage, usePageTitle, Badge, cn } from '@/lib/shared';
import { toast } from '@/hooks/use-toast';

/** "Why was this wrong / how do I write it correctly?" — on demand, only for stations where marks were lost. */
function ExplainMistake({ attemptId, stationId }: { attemptId: number; stationId: number }) {
  const [data, setData] = useState<{ whatWentWrong: string; howToWrite: string; tip: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setBusy(true); setError(null);
    try { setData(await ospeApi.explainMistake(attemptId, stationId)); }
    catch (e) { setError(e instanceof ApiRequestError ? e.message : 'Could not load the explanation. Try again.'); }
    finally { setBusy(false); }
  };
  if (!data) return <div className="mt-3">
    <button type="button" onClick={() => void load()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/5 px-3.5 py-2 text-xs font-extrabold text-primary hover:bg-primary/10 disabled:opacity-60" data-testid={`button-explain-mistake-${stationId}`}>
      {busy ? <Loader2 size={14} className="animate-spin" /> : <GraduationCap size={14} />}{busy ? 'Explaining…' : 'Why was this wrong? Show me how to write it'}
    </button>
    {error && <p className="mt-1.5 text-[11px] font-semibold text-destructive">{error}</p>}
  </div>;
  return <div className="mt-3 space-y-2 text-xs" data-testid={`card-explain-mistake-${stationId}`}>
    <div className="rounded-lg border border-[#f0d3cc] bg-[#fff1ed] p-3"><p className="mb-1 text-[10px] font-bold uppercase text-[#a34c3e]">Why you lost marks</p><p className="whitespace-pre-line leading-5">{data.whatWentWrong}</p></div>
    <div className="rounded-lg bg-[#e6f3ed] p-3"><p className="mb-1 text-[10px] font-bold uppercase text-[#287058]">How to write it correctly</p><p className="whitespace-pre-line leading-5 text-[#164b4b]">{data.howToWrite}</p></div>
    {data.tip && <div className="flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/5 p-3 leading-5"><Lightbulb size={14} className="mt-0.5 shrink-0 text-primary" /><span><b>Exam tip:</b> {data.tip}</span></div>}
    <p className="text-[10px] text-muted-foreground">AI tutor explanation — compare with the model answer above.</p>
  </div>;
}

function OspeExamResult() {
  const params = useParams();
  const attemptId = Number(params.attemptId);
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ['ospe-exam-result', attemptId], queryFn: () => ospeApi.result(attemptId), refetchInterval: (query) => query.state.data?.released ? false : 5000 });
  const grade = useMutation({
    mutationFn: () => ospeApi.grade(attemptId),
    onSuccess: (res) => { queryClient.invalidateQueries({ queryKey: ['ospe-exam-result', attemptId] }); if (res.pending > 0) toast({ title: `${res.pending} answer${res.pending === 1 ? '' : 's'} still grading`, description: 'Try again in a moment.' }); },
    onError: () => toast({ title: 'Grading failed', description: 'Try again shortly.', variant: 'destructive' }),
  });
  const r = q.data;
  usePageTitle('OSPE/OSCE Result');
  if (q.isLoading) return <SkeletonPage />;
  if (!r?.released) return <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center"><Clock3 size={28} className="mx-auto text-muted-foreground" /><h2 className="mt-4 font-bold">Results not released yet</h2><p className="mt-2 text-xs text-muted-foreground">Your admin will release results according to this exam's settings. Check back soon.</p><Link href="/ospe-osce" className="mt-5 inline-block text-xs font-bold text-primary" data-testid="link-back-to-ospe">Back to OSPE/OSCE</Link></div>;

  return <div className="max-w-3xl">
    <div className="rounded-3xl border border-border bg-card p-8 text-center">
      <div className={cn('mx-auto grid size-16 place-items-center rounded-full', r.passed === false ? 'bg-destructive/10 text-destructive' : 'bg-[#d7eee4] text-[#164b4b]')}>{r.passed === false ? <X size={28} /> : <CheckCircle2 size={28} />}</div>
      {r.percentage != null && <div className="mt-5 font-display text-5xl">{r.percentage.toFixed(1)}%</div>}
      {r.obtainedMarks != null && r.totalMarks != null && <p className="mt-1 text-xs text-muted-foreground">{r.obtainedMarks} / {r.totalMarks} marks</p>}
      {r.passed !== null && <Badge tone={r.passed ? 'green' : 'red'}>{r.passed ? 'Passed' : 'Not passed'}</Badge>}
      {!r.fullyGraded && <div className="mt-5 rounded-xl border border-dashed border-border bg-muted/40 p-4">
        <p className="text-xs font-semibold text-muted-foreground">Some written answers are still being graded by AI.</p>
        <button onClick={() => grade.mutate()} disabled={grade.isPending} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold hover:bg-muted disabled:opacity-50" data-testid="button-grade-remaining">{grade.isPending ? <><Loader2 size={12} className="animate-spin" /> Grading…</> : 'Check for grades'}</button>
      </div>}
    </div>

    {!!r.breakdown?.length && <div className="mt-6 space-y-3">{r.breakdown.map((b, i) => {
      const ungraded = b.answerType === 'WRITTEN' && !b.aiVerdict;
      const tone = ungraded ? 'border-border' : b.correct === true || b.aiVerdict === 'correct' ? 'border-[#d7eee4]' : b.aiVerdict === 'partial' ? 'border-[#fdf1d9]' : 'border-[#f0d3cc]';
      return <div key={b.stationId} className={cn('rounded-2xl border p-5', tone)} data-testid={`card-result-station-${b.stationId}`}>
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-bold text-muted-foreground">Station {i + 1}</span>
          {b.marksObtained != null ? <Badge tone={b.marksObtained >= b.marks ? 'green' : b.marksObtained > 0 ? 'amber' : 'red'}>{b.marksObtained}/{b.marks} marks</Badge> : <Badge tone="neutral">Grading…</Badge>}
        </div>
        <p className="mt-1 text-sm font-bold">{b.title}</p>
        {b.imagePath && <div className="relative mt-3 overflow-hidden rounded-xl bg-muted">
          <img src={(b.imageUrl ?? resolveUploadUrl(b.imagePath)) ?? undefined} alt="" className="max-h-64 w-full object-contain" />
          {b.answerType === 'LABELING' && (b.labelPoints || []).map((p, pi) => <div key={p.id} style={{ left: `${p.x}%`, top: `${p.y}%` }} className="absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-primary text-[11px] font-extrabold text-primary-foreground shadow-md ring-2 ring-white">{pi + 1}</div>)}
        </div>}
        {b.instructions && <p className="mt-2 text-xs text-muted-foreground">{b.instructions}</p>}

        {b.answerType === 'MCQ' ? <div className="mt-3 space-y-1.5 text-xs">{(b.options || []).map((opt) => { const isCorrectOpt = opt === b.correctAnswer; return <div key={opt} className={cn('rounded-lg px-2.5 py-1.5', isCorrectOpt ? 'bg-[#e6f3ed]' : opt === b.selectedAnswer ? 'bg-[#fff1ed]' : 'bg-muted/40')}><span className={cn(isCorrectOpt && 'font-bold text-[#287058]')}>{opt}</span>{opt === b.selectedAnswer && !isCorrectOpt && <span className="ml-2 text-[10px] font-bold text-[#a34c3e]">Your answer</span>}</div>; })}</div>

          : b.answerType === 'LABELING' ? <div className="mt-3 space-y-1.5 text-xs">{(b.labelPoints || []).map((p, pi) => {
            const given = b.labelAnswers?.[p.id] || '';
            const isCorrectPoint = !!given.trim() && given.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === p.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
            return <div key={p.id} className={cn('flex items-center gap-2 rounded-lg px-2.5 py-1.5', isCorrectPoint ? 'bg-[#e6f3ed]' : 'bg-[#fff1ed]')}>
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-extrabold text-primary-foreground">{pi + 1}</span>
              <span>Your answer: <span className={cn('font-bold', !isCorrectPoint && 'text-[#a34c3e]')}>{given || '(blank)'}</span>{!isCorrectPoint && <span className="ml-2 text-[#287058]">Correct: <span className="font-bold">{p.label}</span></span>}</span>
            </div>;
          })}</div>

          : <div className="mt-3 space-y-2 text-xs">
            <div className="rounded-lg bg-muted/40 p-3"><p className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">Your answer</p><p className="whitespace-pre-wrap">{b.writtenAnswer || '(no answer submitted)'}</p></div>
            {b.modelAnswer && <div className="rounded-lg bg-[#e6f3ed] p-3"><p className="mb-1 text-[10px] font-bold uppercase text-[#287058]">Model answer</p><p className="whitespace-pre-wrap text-[#164b4b]">{b.modelAnswer}</p></div>}
            {b.aiFeedback && <p className="whitespace-pre-line text-[11px] font-semibold text-muted-foreground">AI feedback: {b.aiFeedback}</p>}
            {ungraded && <p className="text-[11px] font-semibold text-muted-foreground">Not graded yet — tap "Check for grades" above.</p>}
          </div>}
        {!ungraded && b.marksObtained != null && b.marksObtained < b.marks && <ExplainMistake attemptId={attemptId} stationId={b.stationId} />}
      </div>;
    })}</div>}
  </div>;
}

export default OspeExamResult;
