// Admin dashboard charts. Each chart is a self-contained card fed by data the
// dashboard already loads (payments, students, studentsByStatus, import logs),
// so no backend change is needed.
import { useMemo, type ReactNode } from 'react';
import { Link } from 'wouter';
import { Bar, BarChart, CartesianGrid, Cell, Area, AreaChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

const MONTHS = 6;
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

function lastMonths(n = MONTHS) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return { key: monthKey(d), label: d.toLocaleDateString('en-US', { month: 'short' }), full: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) };
  });
}

export function buildRevenueSeries(payments: Array<{ status: string; amount: number; submittedAt: string }>) {
  const months = lastMonths().map((m) => ({ ...m, revenue: 0, count: 0 }));
  const idx = new Map(months.map((m, i) => [m.key, i]));
  for (const p of payments) {
    if (p.status !== 'APPROVED') continue;
    const i = idx.get(monthKey(new Date(p.submittedAt)));
    if (i === undefined) continue;
    months[i].revenue += Number(p.amount) || 0;
    months[i].count += 1;
  }
  return months;
}

export function buildSignupSeries(students: Array<{ joinedAt: string }>) {
  const months = lastMonths().map((m) => ({ ...m, signups: 0, total: 0 }));
  const idx = new Map(months.map((m, i) => [m.key, i]));
  const firstKey = months[0].key;
  let before = 0;
  for (const s of students) {
    const k = monthKey(new Date(s.joinedAt));
    if (k < firstKey) { before += 1; continue; }
    const i = idx.get(k);
    if (i !== undefined) months[i].signups += 1;
  }
  let running = before;
  for (const m of months) { running += m.signups; m.total = running; }
  return months;
}

const compact = (n: number) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

function Card({ title, subtitle, right, children, className = '', testId }: { title: string; subtitle?: string; right?: ReactNode; children: ReactNode; className?: string; testId?: string }) {
  return <div className={`rounded-2xl border border-border bg-card p-5 ${className}`} data-testid={testId}>
    <div className="flex items-start justify-between gap-3">
      <div><div className="text-sm font-extrabold">{title}</div>{subtitle && <div className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</div>}</div>
      {right}
    </div>
    {children}
  </div>;
}

function Delta({ now, prev }: { now: number; prev: number }) {
  if (!prev && !now) return <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground"><Minus size={11} />No change</span>;
  if (!prev) return <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-1 text-[10px] font-bold text-primary"><ArrowUpRight size={11} />New</span>;
  const pct = Math.round(((now - prev) / prev) * 100);
  const up = pct >= 0;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${up ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive'}`}>{up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{Math.abs(pct)}% vs last month</span>;
}

function ChartTip({ active, payload, label, render }: { active?: boolean; payload?: any[]; label?: string; render: (p: any, label?: string) => ReactNode }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lg">{render(payload[0].payload, label)}</div>;
}

const axis = { tickLine: false, axisLine: false, fontSize: 11, stroke: 'hsl(var(--muted-foreground))' } as const;
const empty = (msg: string) => <div className="grid h-full place-items-center text-xs text-muted-foreground">{msg}</div>;

export function RevenueChart({ payments, currency, format }: { payments: Array<{ status: string; amount: number; submittedAt: string }>; currency?: string; format: (n: number, c?: string) => string }) {
  const data = useMemo(() => buildRevenueSeries(payments), [payments]);
  const cur = data[data.length - 1]; const prev = data[data.length - 2];
  const total = data.reduce((s, m) => s + m.revenue, 0);
  return <Card title="Revenue" subtitle={`Approved payments · last ${MONTHS} months`} testId="chart-revenue" right={<Delta now={cur.revenue} prev={prev.revenue} />}>
    <div className="mt-4 flex items-end gap-6">
      <div><div className="font-display text-3xl leading-none">{format(cur.revenue, currency)}</div><div className="mt-1 text-[11px] text-muted-foreground">This month · {cur.count} payment{cur.count === 1 ? '' : 's'}</div></div>
      <div className="hidden sm:block"><div className="text-sm font-bold">{format(total, currency)}</div><div className="mt-0.5 text-[11px] text-muted-foreground">{MONTHS}-month total</div></div>
    </div>
    <div className="mt-4 h-56">{total === 0 ? empty('No approved payments in this period yet') : <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barCategoryGap="28%">
        <defs><linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.55} /></linearGradient></defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} width={44} tickFormatter={compact} allowDecimals={false} />
        <Tooltip cursor={{ fill: 'hsl(var(--muted) / .5)' }} content={<ChartTip render={(p) => <><div className="font-extrabold">{p.full}</div><div className="mt-1 text-primary font-bold">{format(p.revenue, currency)}</div><div className="text-muted-foreground">{p.count} approved payment{p.count === 1 ? '' : 's'}</div></>} />} />
        <Bar dataKey="revenue" radius={[8, 8, 3, 3]} maxBarSize={44}>{data.map((m, i) => <Cell key={m.key} fill={i === data.length - 1 ? 'url(#revFill)' : 'hsl(var(--primary) / .4)'} />)}</Bar>
      </BarChart>
    </ResponsiveContainer>}</div>
  </Card>;
}

const STATUS_COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--info))', 'hsl(var(--violet))', 'hsl(var(--destructive))', 'hsl(var(--muted-foreground))'];

export function StatusDonut({ byStatus, active }: { byStatus: Record<string, number>; active: number }) {
  const entries = Object.entries(byStatus).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  const data = entries.map(([name, value], i) => ({ name, value, color: STATUS_COLORS[i % STATUS_COLORS.length] }));
  return <Card title="Student status" subtitle="Where everyone stands right now" testId="chart-status">
    <div className="relative mx-auto mt-3 h-48 w-48">
      {total === 0 ? empty('No students yet') : <>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="100%" paddingAngle={data.length > 1 ? 3 : 0} cornerRadius={6} stroke="none" startAngle={90} endAngle={-270}>
              {data.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            <Tooltip content={<ChartTip render={(p) => <><div className="font-extrabold capitalize">{String(p.name).toLowerCase()}</div><div className="text-muted-foreground">{p.value} student{p.value === 1 ? '' : 's'} · {Math.round((p.value / total) * 100)}%</div></>} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center"><div className="text-center"><div className="font-display text-3xl leading-none">{active}</div><div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">subscribed</div></div></div>
      </>}
    </div>
    <div className="mt-4 space-y-1.5">{data.map((d) => <Link key={d.name} href={`/admin/students?status=${encodeURIComponent(d.name)}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs transition hover:bg-muted" data-testid={`link-status-${d.name.toLowerCase()}`}>
      <span className="flex items-center gap-2 capitalize"><span className="size-2.5 rounded-full" style={{ background: d.color }} />{d.name.toLowerCase()}</span>
      <span className="flex items-center gap-2"><span className="text-[10px] text-muted-foreground">{Math.round((d.value / total) * 100)}%</span><span className="font-mono-app font-bold">{d.value}</span></span>
    </Link>)}</div>
  </Card>;
}

export function SignupsChart({ students }: { students: Array<{ joinedAt: string }> }) {
  const data = useMemo(() => buildSignupSeries(students), [students]);
  const cur = data[data.length - 1]; const prev = data[data.length - 2];
  return <Card title="Student growth" subtitle={`New registrations · last ${MONTHS} months`} testId="chart-signups" right={<Delta now={cur.signups} prev={prev.signups} />}>
    <div className="mt-4 flex items-end gap-6">
      <div><div className="font-display text-3xl leading-none">{cur.signups}</div><div className="mt-1 text-[11px] text-muted-foreground">Joined this month</div></div>
      <div className="hidden sm:block"><div className="text-sm font-bold">{cur.total}</div><div className="mt-0.5 text-[11px] text-muted-foreground">Total students</div></div>
    </div>
    <div className="mt-4 h-48"><ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <defs><linearGradient id="signFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--info))" stopOpacity={0.4} /><stop offset="100%" stopColor="hsl(var(--info))" stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} width={40} allowDecimals={false} />
        <Tooltip cursor={{ stroke: 'hsl(var(--info))', strokeDasharray: 4 }} content={<ChartTip render={(p) => <><div className="font-extrabold">{p.full}</div><div className="mt-1 font-bold" style={{ color: 'hsl(var(--info))' }}>{p.signups} new student{p.signups === 1 ? '' : 's'}</div><div className="text-muted-foreground">{p.total} total</div></>} />} />
        <Area type="monotone" dataKey="signups" stroke="hsl(var(--info))" strokeWidth={2.5} fill="url(#signFill)" dot={{ r: 3.5, strokeWidth: 2, fill: 'hsl(var(--card))' }} activeDot={{ r: 5 }} />
      </AreaChart>
    </ResponsiveContainer></div>
  </Card>;
}

export function ImportsChart({ series, loading }: { series: Array<{ date: string; label: string; count: number }>; loading?: boolean }) {
  const total = series.reduce((s, r) => s + r.count, 0);
  const todayIdx = series.length - 1;
  return <Card title="MCQ imports" subtitle="Questions imported · last 7 days" testId="chart-imports" right={<span className="rounded-full bg-violet/15 px-2.5 py-1 text-[10px] font-bold text-violet">{total} total</span>}>
    <div className="mt-4 h-[17.5rem]">{loading ? empty('Loading import history…') : total === 0 ? empty('No MCQs imported this week') : <ResponsiveContainer width="100%" height="100%">
      <BarChart data={series} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} width={44} allowDecimals={false} tickFormatter={compact} />
        <Tooltip cursor={{ fill: 'hsl(var(--muted) / .5)' }} content={<ChartTip render={(p) => <><div className="font-extrabold">{p.date}</div><div className="mt-1 font-bold" style={{ color: 'hsl(var(--violet))' }}>{p.count} question{p.count === 1 ? '' : 's'}</div></>} />} />
        <Bar dataKey="count" radius={[8, 8, 3, 3]} maxBarSize={36}>{series.map((r, i) => <Cell key={r.date} fill={i === todayIdx ? 'hsl(var(--violet))' : 'hsl(var(--violet) / .35)'} />)}</Bar>
      </BarChart>
    </ResponsiveContainer>}</div>
  </Card>;
}
