// Student dashboard charts — same card/chart look as the admin dashboard.
// All data comes from queries the dashboard already makes (progress overview,
// streak card), so there is no backend change.
import { useMemo, type ReactNode } from 'react';
import { Link } from 'wouter';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { ProgressOverview, StreakCard } from '@/lib/api';

// The student theme may not define --info / --violet, so every use has a fallback.
const C = {
  primary: 'hsl(var(--primary))',
  info: 'hsl(var(--info, 206 41% 40%))',
  violet: 'hsl(var(--violet, 271 34% 46%))',
  accent: 'hsl(var(--accent))',
  muted: 'hsl(var(--muted-foreground))',
  destructive: 'hsl(var(--destructive))',
};
const faded = (c: string, a: number) => c.replace(/\)$/, ` / ${a})`);
const axis = { tickLine: false, axisLine: false, fontSize: 11, stroke: 'hsl(var(--muted-foreground))' } as const;
const empty = (msg: string) => <div className="grid h-full place-items-center px-4 text-center text-xs text-muted-foreground">{msg}</div>;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function Card({ title, subtitle, right, children, testId }: { title: string; subtitle?: string; right?: ReactNode; children: ReactNode; testId?: string }) {
  return <div className="rounded-2xl border border-border bg-card p-5" data-testid={testId}>
    <div className="flex items-start justify-between gap-3">
      <div><div className="text-sm font-extrabold">{title}</div>{subtitle && <div className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</div>}</div>
      {right}
    </div>
    {children}
  </div>;
}

function Delta({ trend, points }: { trend: ProgressOverview['improvement']['trend']; points: number | null }) {
  if (trend === 'new' || points == null) return <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground"><Minus size={11} />Just starting</span>;
  if (trend === 'flat' || points === 0) return <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground"><Minus size={11} />Steady</span>;
  const up = points > 0;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${up ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive'}`}>{up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{Math.abs(Math.round(points))} pts since you started</span>;
}

function Tip({ active, payload, render }: { active?: boolean; payload?: any[]; render: (p: any) => ReactNode }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lg">{render(payload[0].payload)}</div>;
}

export function WeeklyChart({ improvement }: { improvement: ProgressOverview['improvement'] }) {
  const data = useMemo(() => improvement.weekly.slice(-8).map((w) => ({ ...w, label: shortDate(w.weekStart), accuracy: w.accuracy == null ? null : Math.round(w.accuracy) })), [improvement.weekly]);
  const last = data[data.length - 1];
  const hasAny = data.some((w) => w.questions > 0);
  return <Card title="Weekly performance" subtitle="Questions practised and accuracy · last 8 weeks" testId="chart-weekly" right={<Delta trend={improvement.trend} points={improvement.deltaPoints} />}>
    <div className="mt-4 flex items-end gap-6">
      <div><div className="font-display text-3xl leading-none">{last?.accuracy == null ? '—' : `${last.accuracy}%`}</div><div className="mt-1 text-[11px] text-muted-foreground">Latest weekly accuracy</div></div>
      <div className="hidden sm:block"><div className="text-sm font-bold">{last?.questions ?? 0}</div><div className="mt-0.5 text-[11px] text-muted-foreground">Questions that week</div></div>
    </div>
    <div className="mt-4 h-56">{!hasAny ? empty('Your weekly accuracy will build up here as you practise.') : <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 0, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="label" {...axis} />
        <YAxis yAxisId="q" {...axis} width={36} allowDecimals={false} />
        <YAxis yAxisId="a" orientation="right" {...axis} width={36} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
        <Tooltip cursor={{ fill: 'hsl(var(--muted) / .5)' }} content={<Tip render={(p) => <><div className="font-extrabold">Week of {p.label}</div><div className="mt-1 font-bold" style={{ color: C.primary }}>{p.accuracy == null ? 'No accuracy yet' : `${p.accuracy}% accuracy`}</div><div className="text-muted-foreground">{p.questions} question{p.questions === 1 ? '' : 's'} · {p.sessions} session{p.sessions === 1 ? '' : 's'}</div></>} />} />
        <Bar yAxisId="q" dataKey="questions" radius={[8, 8, 3, 3]} maxBarSize={38}>{data.map((w, i) => <Cell key={w.weekStart} fill={i === data.length - 1 ? C.primary : faded(C.primary, 0.35)} />)}</Bar>
        <Line yAxisId="a" type="monotone" dataKey="accuracy" stroke={C.accent} strokeWidth={2.5} connectNulls dot={{ r: 3.5, strokeWidth: 2, fill: 'hsl(var(--card))' }} activeDot={{ r: 5 }} />
      </ComposedChart>
    </ResponsiveContainer>}</div>
  </Card>;
}

const SLICES = [C.primary, C.accent, C.info, C.violet, C.destructive, C.muted];

export function SubjectDonut({ bySubject }: { bySubject: ProgressOverview['bySubject'] }) {
  const rows = bySubject.filter((s) => s.answered > 0).sort((a, b) => b.answered - a.answered);
  const total = rows.reduce((s, r) => s + r.answered, 0);
  const data = rows.map((r, i) => ({ ...r, value: r.answered, color: SLICES[i % SLICES.length] }));
  return <Card title="Practice by subject" subtitle="Where your questions have gone" testId="chart-subjects">
    <div className="relative mx-auto mt-3 h-48 w-48">
      {total === 0 ? empty('Practise a few questions to see your split.') : <>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="100%" paddingAngle={data.length > 1 ? 3 : 0} cornerRadius={6} stroke="none" startAngle={90} endAngle={-270}>{data.map((d) => <Cell key={d.id} fill={d.color} />)}</Pie>
            <Tooltip content={<Tip render={(p) => <><div className="font-extrabold">{p.name}</div><div className="text-muted-foreground">{p.answered} answered · {Math.round((p.answered / total) * 100)}%</div>{p.accuracy != null && <div className="font-bold" style={{ color: C.primary }}>{Math.round(p.accuracy)}% accuracy</div>}</>} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center"><div className="text-center"><div className="font-display text-3xl leading-none">{total}</div><div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">answered</div></div></div>
      </>}
    </div>
    <div className="mt-4 space-y-1.5">{data.slice(0, 6).map((d) => <Link key={d.id} href={`/subjects/${d.id}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs transition hover:bg-muted">
      <span className="flex min-w-0 items-center gap-2"><span className="size-2.5 shrink-0 rounded-full" style={{ background: d.color }} /><span className="truncate">{d.name}</span></span>
      <span className="flex shrink-0 items-center gap-2"><span className="text-[10px] text-muted-foreground">{d.accuracy == null ? '—' : `${Math.round(d.accuracy)}%`}</span><span className="font-mono-app font-bold">{d.answered}</span></span>
    </Link>)}</div>
  </Card>;
}

export function DailyChart({ streak }: { streak: StreakCard | undefined }) {
  const data = (streak?.days ?? []).map((d) => ({ ...d, label: new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2), full: shortDate(d.date + 'T00:00:00') }));
  const total = data.reduce((s, d) => s + d.questions, 0);
  const active = data.filter((d) => d.questions > 0).length;
  return <Card title="Daily activity" subtitle="Questions answered · last 14 days" testId="chart-daily" right={<span className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ color: C.violet, background: faded(C.violet, 0.15) }}>{streak?.currentStreak ?? 0}-day streak</span>}>
    <div className="mt-4 flex items-end gap-6">
      <div><div className="font-display text-3xl leading-none">{total}</div><div className="mt-1 text-[11px] text-muted-foreground">Questions in 14 days</div></div>
      <div className="hidden sm:block"><div className="text-sm font-bold">{active} / 14</div><div className="mt-0.5 text-[11px] text-muted-foreground">Active days</div></div>
    </div>
    <div className="mt-4 h-48">{!streak ? empty('Loading…') : total === 0 ? empty('No practice in the last 14 days yet.') : <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }} barCategoryGap="22%">
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="label" {...axis} interval={0} />
        <YAxis {...axis} width={40} allowDecimals={false} />
        <Tooltip cursor={{ fill: 'hsl(var(--muted) / .5)' }} content={<Tip render={(p) => <><div className="font-extrabold">{p.full}</div><div className="mt-1 font-bold" style={{ color: C.violet }}>{p.questions} question{p.questions === 1 ? '' : 's'}</div><div className="text-muted-foreground">{p.sessions} session{p.sessions === 1 ? '' : 's'}</div></>} />} />
        <Bar dataKey="questions" radius={[6, 6, 2, 2]} maxBarSize={22}>{data.map((d, i) => <Cell key={d.date} fill={i === data.length - 1 ? C.violet : faded(C.violet, 0.35)} />)}</Bar>
      </BarChart>
    </ResponsiveContainer>}</div>
  </Card>;
}

export function SessionScoresChart({ sessions }: { sessions: ProgressOverview['recentSessions'] }) {
  const data = useMemo(() => [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-10).map((s, i) => ({ ...s, n: i + 1, label: shortDate(s.date), score: Math.round(s.scorePercent) })), [sessions]);
  const avg = data.length ? Math.round(data.reduce((s, d) => s + d.score, 0) / data.length) : null;
  const best = data.length ? Math.max(...data.map((d) => d.score)) : null;
  return <Card title="Recent session scores" subtitle="Your last 10 practice sessions" testId="chart-sessions" right={best != null ? <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-bold text-primary">Best {best}%</span> : undefined}>
    <div className="mt-4 flex items-end gap-6">
      <div><div className="font-display text-3xl leading-none">{avg == null ? '—' : `${avg}%`}</div><div className="mt-1 text-[11px] text-muted-foreground">Average score</div></div>
      <div className="hidden sm:block"><div className="text-sm font-bold">{data.length}</div><div className="mt-0.5 text-[11px] text-muted-foreground">Sessions shown</div></div>
    </div>
    <div className="mt-4 h-48">{data.length === 0 ? empty('Complete a practice session to see your scores here.') : <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs><linearGradient id="sessFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.info} stopOpacity={0.4} /><stop offset="100%" stopColor={C.info} stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} width={44} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} />
        <Tooltip cursor={{ stroke: C.info, strokeDasharray: 4 }} content={<Tip render={(p) => <><div className="font-extrabold">{p.label}</div><div className="mt-1 font-bold" style={{ color: C.info }}>{p.score}%</div><div className="text-muted-foreground">{p.correctCount}/{p.totalQuestions} correct</div></>} />} />
        <Area type="monotone" dataKey="score" stroke={C.info} strokeWidth={2.5} fill="url(#sessFill)" dot={{ r: 3.5, strokeWidth: 2, fill: 'hsl(var(--card))' }} activeDot={{ r: 5 }} />
      </AreaChart>
    </ResponsiveContainer>}</div>
  </Card>;
}
