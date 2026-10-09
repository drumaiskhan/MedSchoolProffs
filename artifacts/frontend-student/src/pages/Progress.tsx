// "My Progress" — code-split via React.lazy() in App.tsx. Reached from the
// sidebar and from the dashboard's "My Progress" quick link.
//
// One request (GET /student/progress-overview) feeds every tab. Nothing on this
// page is sample data: every figure, label and chart point is read from that
// response, and the only constants (score bands, trend cut-off) live in
// lib/progressConfig.ts. Colours are the theme's --tone-* tokens, so there are
// no hex literals here. Pre-Proffs scores the exam is still holding back arrive
// as `released: false` and show as "awaiting release" — this page never has them.
import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Area, Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import { Activity, ArrowRight, CheckCircle2, ClipboardCheck, Clock3, FileStack, Flame, Hourglass, LineChart, Minus, Sparkles, Target, TrendingDown, TrendingUp, Trophy, type LucideIcon } from 'lucide-react';
import { analyticsApi, type ProgressOverview, type ProgressTopic } from '@/lib/api';
import { EmptyState, ErrorState, SectionHeader, SkeletonPage, cn } from '@/lib/shared';
import { SubjectIcon } from '@/lib/subject-icons';
import { Count, SegTabs } from '@/lib/fx3d';
import { TiltDiv } from '@/lib/tilt';
import { TREND_POINTS, fmtDate, fmtMinutes, pctText, plural, toneColor, toneOf, type Tone } from '@/lib/progressConfig';

type Tab = 'overview' | 'mcqs' | 'papers' | 'improvement' | 'exams';

const tone = (t: Tone | 'info' | 'violet') => ({ ['--c' as string]: toneColor(t) }) as CSSProperties;

function Meter({ value, tone: t }: { value: number | null; tone: Tone | 'info' | 'violet' }) {
  return <div className="pgx-meter"><i style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%`, ...tone(t) }} /></div>;
}

/** Small circular score (session rows, paper cards). */
function ScoreRing({ value, size = 44 }: { value: number | null; size?: number }) {
  const R = 18, C = 2 * Math.PI * R;
  const t = toneOf(value);
  return <span className="pgx-score" style={{ width: size, height: size, ...tone(t) }}>
    <svg viewBox="0 0 44 44" aria-hidden="true"><circle className="pgx-score__bg" cx="22" cy="22" r={R} /><circle className="pgx-score__fg" cx="22" cy="22" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(100, Math.max(0, value ?? 0)) / 100)} /></svg>
    <b>{value == null ? '—' : Math.round(value)}</b>
  </span>;
}

function DeltaChip({ delta }: { delta: number | null }) {
  if (delta == null) return <span className="text-[10px] text-muted-foreground">not enough data yet</span>;
  const up = delta >= TREND_POINTS, down = delta <= -TREND_POINTS;
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  return <span className="pgx-delta" style={tone(up ? 'good' : down ? 'bad' : 'none')} data-flat={!up && !down}><Icon size={12} />{delta > 0 ? '+' : ''}{delta} pts</span>;
}

function Pill({ t, children }: { t: Tone | 'info'; children: ReactNode }) {
  return <span className="pgx-pill" style={tone(t)}>{children}</span>;
}

function TopicList({ title, accent, topics, empty }: { title: string; accent: Tone | 'info'; topics: ProgressTopic[]; empty: string }) {
  return <div className="pgx-panel">
    <div className="flex items-center gap-2 text-sm font-extrabold"><span className="pgx-dot" style={tone(accent)} />{title}</div>
    {topics.length === 0 ? <p className="mt-3 text-xs text-muted-foreground">{empty}</p> : <ul className="mt-3 space-y-3.5">
      {topics.map((t) => <li key={t.id}>
        <div className="flex items-baseline justify-between gap-3"><span className="min-w-0 truncate text-xs font-bold">{t.name}</span><span className="shrink-0 text-xs font-extrabold tabular-nums">{pctText(t.accuracy)}</span></div>
        <div className="mt-1.5"><Meter value={t.accuracy} tone={toneOf(t.accuracy)} /></div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground"><span className="truncate">{t.subject ? `${t.subject} · ` : ''}{t.answered} answered</span><DeltaChip delta={t.delta} /></div>
      </li>)}
    </ul>}
  </div>;
}

/** Weekly accuracy as a tiny line — real points only; nothing is drawn with fewer than two. */
function Sparkline({ weekly }: { weekly: ProgressOverview['improvement']['weekly'] }) {
  const pts = weekly.map((w, i) => ({ i, v: w.accuracy })).filter((p): p is { i: number; v: number } => p.v != null);
  if (pts.length < 2) return null;
  const W = 160, H = 44, last = Math.max(1, weekly.length - 1);
  const xy = pts.map((p) => `${((p.i / last) * W).toFixed(1)},${(H - 4 - (p.v / 100) * (H - 8)).toFixed(1)}`);
  const end = xy[xy.length - 1].split(',');
  return <svg viewBox={`0 0 ${W} ${H}`} className="pgx-spark" aria-hidden="true" preserveAspectRatio="none">
    <polyline points={xy.join(' ')} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx={end[0]} cy={end[1]} r="3.4" fill="currentColor" />
  </svg>;
}

function Hero({ d }: { d: ProgressOverview }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const { summary: s, improvement: imp } = d;
  const R = 52, C = 2 * Math.PI * R;
  const acc = s.accuracy == null ? 0 : Math.min(100, Math.max(0, s.accuracy));
  const verdict = imp.trend === 'up' ? { label: 'Improving', text: `Accuracy is up ${imp.deltaPoints} points versus the weeks before. Keep this pace.` }
    : imp.trend === 'down' ? { label: 'Needs more practice', text: `Accuracy is down ${Math.abs(imp.deltaPoints ?? 0)} points versus the weeks before — a little more daily practice should turn it around.` }
    : imp.trend === 'flat' ? { label: 'Holding steady', text: 'About the same as the weeks before. Push for a new high in your next session.' }
    : { label: 'Getting started', text: 'Practise on a few different days and a trend will show up here.' };
  const stats: Array<{ icon: LucideIcon; label: string; value: ReactNode }> = [
    { icon: CheckCircle2, label: 'Questions', value: <Count value={s.questionsAnswered} /> },
    { icon: Clock3, label: 'Time studied', value: fmtMinutes(s.timeSpentMinutes) },
    { icon: Flame, label: 'Day streak', value: <Count value={s.currentStreak} /> },
    { icon: Trophy, label: 'Active days', value: <Count value={s.activeDaysLast30} /> },
  ];
  return <section className="lb-hero pgx-hero rounded-[1.75rem] p-4 sm:p-6" data-testid="banner-progress">
    <div className="hero-grid" />
    <div className="orb -left-16 -top-24 size-72 bg-[hsl(var(--sidebar-primary))]" style={{ opacity: 0.25 }} />
    <div className="orb -bottom-28 right-6 size-60 bg-[hsl(var(--tone-info))]" style={{ opacity: 0.18, animationDelay: '-6s' }} />
    <div className="relative grid gap-5 lg:grid-cols-[auto_1fr] lg:items-center">
      <div className="flex items-center gap-4 sm:gap-5">
        <div className="pgx-ring">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <defs><linearGradient id={`pr${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="hsl(var(--sidebar-primary))" /><stop offset="1" stopColor={toneColor(toneOf(s.accuracy) === 'none' ? 'info' : toneOf(s.accuracy))} /></linearGradient></defs>
            <circle className="pgx-ring__bg" cx="60" cy="60" r={R} />
            <circle className="pgx-ring__fg" cx="60" cy="60" r={R} stroke={`url(#pr${uid})`} strokeDasharray={C} strokeDashoffset={C * (1 - acc / 100)} />
          </svg>
          <div className="relative text-center leading-none">
            <div className="font-display text-4xl tabular-nums text-white">{s.accuracy == null ? '—' : <Count value={Math.round(s.accuracy)} suffix="%" />}</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-[.14em] text-white/55">accuracy</div>
          </div>
        </div>
        <div className="min-w-0 lg:hidden"><div className="font-mono-app text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--sidebar-primary))]">Trend</div><div className="font-display text-2xl leading-tight text-white">{verdict.label}</div></div>
      </div>
      <div className="grid gap-3.5">
        <div>
          <div className="hidden items-center gap-2 lg:flex"><Sparkles size={14} className="text-[hsl(var(--sidebar-primary))]" /><span className="font-mono-app text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--sidebar-primary))]">How you're doing</span></div>
          <div className="mt-1 hidden font-display text-3xl leading-tight text-white lg:block">{verdict.label}</div>
          <div className="flex items-end justify-between gap-4"><p className="max-w-md text-xs font-bold leading-5 text-white/70">{verdict.text}</p>
            <div className="pgx-spark-wrap hidden sm:block"><Sparkline weekly={imp.weekly} /></div></div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {stats.map(({ icon: Icon, label, value }) => <div key={label} className="lb-tile flex items-center gap-2.5 px-3 py-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/10 text-[hsl(var(--sidebar-primary))]"><Icon size={15} /></span>
            <div className="min-w-0"><div className="truncate text-base font-extrabold leading-5 tabular-nums text-white">{value}</div><div className="truncate text-[9px] font-bold uppercase tracking-[.12em] text-white/50">{label}</div></div>
          </div>)}
        </div>
      </div>
    </div>
  </section>;
}

function Overview({ d, go }: { d: ProgressOverview; go: (t: Tab) => void }) {
  const { improvement: imp } = d;
  const latestPaper = d.pastPapers[0], latestExam = d.exams[0];
  const cards: Array<{ tab: Tab; icon: LucideIcon; title: string; line: string; sub: string; value: number | null }> = [
    { tab: 'mcqs', icon: Target, title: 'MCQ practice', line: `${plural(d.summary.uniqueMcqsAttempted, 'different question')} attempted`, sub: `${pctText(d.summary.accuracy)} overall accuracy`, value: d.summary.accuracy },
    { tab: 'papers', icon: FileStack, title: 'Past papers', line: d.pastPapers.length ? `${plural(d.pastPapers.length, 'paper')} started` : 'None started yet', sub: latestPaper ? `Latest: ${latestPaper.title}` : 'Try one from Past papers', value: latestPaper?.coveragePercent ?? null },
    { tab: 'exams', icon: ClipboardCheck, title: 'Pre-Proffs', line: d.exams.length ? plural(d.exams.length, 'attempt') : 'No attempts yet', sub: latestExam?.released ? `Latest: ${pctText(latestExam.percentage)}` : latestExam ? 'Latest result awaiting release' : 'Sit one when it opens', value: latestExam?.released ? latestExam.percentage : null },
  ];
  return <div className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c, i) => <TiltDiv key={c.tab} className="pgx-card" testId={`card-progress-${c.tab}`} style={{ '--i': i, '--tilt': 5 } as never}>
        <button type="button" onClick={() => go(c.tab)} className="group flex w-full items-start gap-3 text-left no-3d">
          <span className="pgx-puck" style={tone(c.value == null ? 'info' : toneOf(c.value))}><c.icon size={18} /></span>
          <span className="min-w-0 flex-1"><span className="block text-xs font-extrabold">{c.title}</span><span className="mt-0.5 block text-xs">{c.line}</span><span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{c.sub}</span></span>
          <ArrowRight size={15} className="mt-1 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </button>
      </TiltDiv>)}
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <TopicList title="Needs more work" accent="bad" topics={imp.needsWork} empty="Your weakest topics will show here once you've answered enough questions in them." />
      <TopicList title="Strongest topics" accent="good" topics={imp.strongest} empty="Your strongest topics will appear once you've answered enough questions." />
    </div>
  </div>;
}

function McqTab({ d }: { d: ProgressOverview }) {
  if (!d.summary.sessions) return <EmptyState icon={Target} title="No practice sessions yet" body="Finish a practice session and every question you attempt, and how you did, will be tracked here." action={<Link href="/blocks" className="rounded-xl bg-primary px-4 py-2.5 text-xs font-extrabold text-primary-foreground">Start practising</Link>} />;
  return <div className="space-y-6">
    <div><h3 className="mb-3 text-sm font-extrabold">Accuracy by subject</h3>
      <div className="pgx-panel">{d.bySubject.length === 0 ? <p className="text-xs text-muted-foreground">Subject breakdown appears once your practice includes subject-tagged questions.</p> : <ul className="space-y-4">
        {d.bySubject.map((s) => <li key={s.id}>
          <div className="flex items-center justify-between gap-3"><span className="flex min-w-0 items-center gap-2.5"><SubjectIcon name={s.name} size="xs" /><span className="min-w-0 truncate text-xs font-bold">{s.name}</span></span><span className="shrink-0 text-xs font-extrabold tabular-nums">{pctText(s.accuracy)}</span></div>
          <div className="mt-1.5"><Meter value={s.accuracy} tone={toneOf(s.accuracy)} /></div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground"><span>{s.answered} answered</span><DeltaChip delta={s.delta} /></div>
        </li>)}
      </ul>}</div>
    </div>
    <div><h3 className="mb-3 text-sm font-extrabold">Recent sessions</h3>
      <div className="space-y-2.5">
        {d.recentSessions.map((s, i) => <div key={s.id} className="pgx-row" style={{ '--i': i } as CSSProperties} data-testid={`row-session-${s.id}`}>
          <ScoreRing value={s.scorePercent} />
          <div className="min-w-0 flex-1"><div className="truncate text-xs font-bold">{s.scope}</div><div className="mt-0.5 text-[10px] text-muted-foreground">{fmtDate(s.date)} · {s.correctCount}/{s.totalQuestions} correct{s.durationMinutes != null ? ` · ${s.durationMinutes} min` : ''} · {s.mode}</div></div>
          <Pill t={toneOf(s.scorePercent)}>{Math.round(s.scorePercent)}%</Pill>
        </div>)}
      </div>
    </div>
  </div>;
}

function PapersTab({ d }: { d: ProgressOverview }) {
  if (!d.pastPapers.length) return <EmptyState icon={FileStack} title="No past papers attempted yet" body="Start a session on any past paper and your coverage and accuracy for it will show up here." action={<Link href="/past-papers" className="rounded-xl bg-primary px-4 py-2.5 text-xs font-extrabold text-primary-foreground">Browse past papers</Link>} />;
  return <div className="grid gap-3 sm:grid-cols-2">
    {d.pastPapers.map((p, i) => <TiltDiv key={p.id} className="pgx-card" testId={`card-paper-${p.id}`} style={{ '--i': i, '--tilt': 4 } as never}>
      <div className="flex items-start gap-3.5">
        <ScoreRing value={p.accuracy} size={52} />
        <div className="min-w-0 flex-1"><div className="truncate text-sm font-extrabold">{p.title}</div><div className="mt-0.5 text-[11px] text-muted-foreground">{[p.examBoard, p.year].filter(Boolean).join(' · ') || 'Past paper'} · last attempted {fmtDate(p.lastAttemptAt)}</div></div>
        <Pill t={toneOf(p.accuracy)}>{pctText(p.accuracy)}</Pill>
      </div>
      <div className="mt-4"><div className="flex justify-between text-[11px] font-semibold"><span>Coverage</span><span className="tabular-nums">{p.attemptedQuestions}/{p.totalQuestions} questions</span></div><div className="mt-1.5"><Meter value={p.coveragePercent} tone="info" /></div></div>
      <Link href={`/practice?pastPaperId=${p.id}`} className="no-3d mt-4 inline-flex items-center gap-1 text-xs font-extrabold text-primary">{p.coveragePercent >= 100 ? 'Practise again' : 'Continue'} <ArrowRight size={12} /></Link>
    </TiltDiv>)}
  </div>;
}

function ImprovementTab({ d }: { d: ProgressOverview }) {
  const imp = d.improvement;
  const data = imp.weekly.map((w) => ({ week: fmtDate(w.weekStart), accuracy: w.accuracy, questions: w.questions }));
  const hasAny = imp.weekly.some((w) => w.accuracy != null);
  if (!hasAny) return <EmptyState icon={LineChart} title="Nothing to chart yet" body="Your weekly accuracy will build up here as you practise across different weeks." />;
  const gain = imp.firstAccuracy != null && imp.latestAccuracy != null ? Math.round((imp.latestAccuracy - imp.firstAccuracy) * 10) / 10 : null;
  return <div className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        { label: 'First tracked week', body: <span className="font-display text-3xl">{pctText(imp.firstAccuracy)}</span> },
        { label: 'Latest week', body: <><span className="font-display text-3xl">{pctText(imp.latestAccuracy)}</span>{gain != null && <span className="ml-2 align-middle"><DeltaChip delta={gain} /></span>}</> },
        { label: 'Recent weeks vs before', body: <div className="mt-1.5"><DeltaChip delta={imp.deltaPoints} /></div> },
      ].map((c, i) => <div key={c.label} className="pgx-panel pgx-rise" style={{ '--i': i } as CSSProperties}><div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{c.label}</div><div className="mt-1">{c.body}</div></div>)}
    </div>
    <div className="pgx-panel">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-extrabold">Weekly accuracy — last {plural(imp.weekly.length, 'week')}</h3>
        <span className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground"><span className="inline-flex items-center gap-1.5"><span className="pgx-dot" style={{ ['--c' as string]: 'hsl(var(--primary))' }} />Accuracy</span><span className="inline-flex items-center gap-1.5"><span className="pgx-dot" style={{ ['--c' as string]: 'hsl(var(--tone-info) / .45)' }} />Questions</span></span></div>
      <div className="mt-4 h-60 w-full" data-testid="chart-weekly-accuracy">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
            <defs><linearGradient id="progressFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.38} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="acc" domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit="%" />
            <YAxis yAxisId="q" orientation="right" hide />
            <ChartTooltip formatter={(v: number | string, name: string) => [name === 'accuracy' ? `${v}%` : v, name === 'accuracy' ? 'Accuracy' : 'Questions']} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 12 }} />
            <Bar yAxisId="q" dataKey="questions" fill="hsl(var(--tone-info) / .35)" radius={[6, 6, 0, 0]} maxBarSize={26} />
            <Area yAxisId="acc" type="monotone" dataKey="accuracy" stroke="hsl(var(--primary))" strokeWidth={2.75} fill="url(#progressFill)" connectNulls dot={{ r: 3.5, strokeWidth: 2, fill: 'hsl(var(--card))' }} activeDot={{ r: 5 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <TopicList title="Most improved topics" accent="info" topics={imp.improvedTopics} empty="Practise a topic in two different weeks to see improvement." />
      <TopicList title="Needs more work" accent="bad" topics={imp.needsWork} empty="No weak topics yet — keep going." />
    </div>
  </div>;
}

function ExamsTab({ d }: { d: ProgressOverview }) {
  if (!d.exams.length) return <EmptyState icon={ClipboardCheck} title="No Pre-Proffs attempts yet" body="Your Pre-Proffs results will be listed here after you submit an exam." action={<Link href="/exams" className="rounded-xl bg-primary px-4 py-2.5 text-xs font-extrabold text-primary-foreground">See exams</Link>} />;
  return <div className="space-y-2.5">
    {d.exams.map((e, i) => <div key={e.attemptId} className="pgx-row flex-wrap" style={{ '--i': i } as CSSProperties} data-testid={`row-exam-${e.attemptId}`}>
      {e.released && <ScoreRing value={e.percentage} size={52} />}
      <div className="min-w-0 flex-1"><div className="truncate text-sm font-extrabold">{e.title}</div><div className="mt-0.5 text-[11px] text-muted-foreground">Attempt {e.attemptNumber} · submitted {fmtDate(e.submittedAt)} · {plural(e.totalQuestions, 'question')}</div></div>
      {e.released
        ? <div className="flex items-center gap-3">
          {e.passed != null && <Pill t={e.passed ? 'good' : 'bad'}>{e.passed ? 'Passed' : 'Not passed'}</Pill>}
          <div className="text-right"><div className="font-display text-2xl leading-none">{e.percentage != null ? `${Math.round(e.percentage)}%` : e.score != null ? e.score : `${e.correctCount ?? 0}/${e.totalQuestions}`}</div><div className="mt-1 text-[10px] text-muted-foreground">{e.correctCount ?? 0} correct</div></div>
          <Link href={`/exams/result/${e.attemptId}`} className="inline-flex items-center gap-1 text-xs font-extrabold text-primary">Review <ArrowRight size={12} /></Link>
        </div>
        : <Pill t="fair"><Hourglass size={11} className="mr-1" /> Result not released yet</Pill>}
    </div>)}
  </div>;
}

function Progress_() {
  const q = useQuery({ queryKey: ['progress-overview'], queryFn: analyticsApi.overview });
  const [tab, setTab] = useState<Tab>('overview');
  if (q.isLoading) return <SkeletonPage />;
  if (!q.data) return <ErrorState retry={() => q.refetch()} />;
  const d = q.data;
  const TABS: Array<{ id: Tab; label: string; icon: LucideIcon; count?: number }> = [
    { id: 'overview', label: 'Overview', icon: Activity }, { id: 'mcqs', label: 'MCQs', icon: Target, count: d.summary.sessions },
    { id: 'papers', label: 'Past papers', icon: FileStack, count: d.pastPapers.length },
    { id: 'improvement', label: 'Improvement', icon: LineChart }, { id: 'exams', label: 'Pre-Proffs', icon: ClipboardCheck, count: d.exams.length },
  ];
  return <div className="space-y-6">
    <SectionHeader eyebrow="Where you stand" title="My progress" description="Your accuracy, past papers and improvement over time — visible only to you." />
    <Hero d={d} />
    <SegTabs<Tab> ariaLabel="Progress sections" scroll value={tab} onChange={setTab}
      options={TABS.map((t) => ({ value: t.id, testId: `tab-progress-${t.id}`, label: <><t.icon size={13} />{t.label}{t.count ? <span className="ach-count">{t.count}</span> : null}</> }))} />
    <div key={tab} className="pgx-swap">
      {tab === 'overview' && <Overview d={d} go={setTab} />}
      {tab === 'mcqs' && <McqTab d={d} />}
      {tab === 'papers' && <PapersTab d={d} />}
      {tab === 'improvement' && <ImprovementTab d={d} />}
      {tab === 'exams' && <ExamsTab d={d} />}
    </div>
  </div>;
}

export default Progress_;
