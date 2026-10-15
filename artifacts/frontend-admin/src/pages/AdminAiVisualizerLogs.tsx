// Admin -> AI Visualizer. Organised into four tabs instead of one long scroll:
//   Overview       - headline numbers + how much of the 5000+ topic catalog already has a saved widget
//   Topic catalog  - coverage per discipline > group
//   Saved library  - every saved widget: search, filter (catalog / custom), sort, page, delete
//   Activity       - what students asked for: filter by outcome, search, page, failures with raw AI output
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, BookMarked, CheckCircle2, ChevronRight, Library, Search, Sparkles, Wand2, Zap } from 'lucide-react';
import { aiVisualizerAdminApi, type AiVisualizerLogEntry } from '@/lib/api';
import { EmptyState, SectionHeader, cn } from '@/lib/shared';
import { Chip, StatTiles } from '@/lib/admin-ui';

type Tab = 'overview' | 'catalog' | 'library' | 'activity';
const TABS: Array<{ id: Tab; label: string; icon: typeof Activity }> = [
  { id: 'overview', label: 'Overview', icon: Zap },
  { id: 'catalog', label: 'Topic catalog', icon: BookMarked },
  { id: 'library', label: 'Saved library', icon: Library },
  { id: 'activity', label: 'Activity', icon: Activity },
];

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

function Bar({ value, total }: { value: number; total: number }) {
  return <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={total}><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct(value, total)}%` }} /></div>;
}

function Pager({ offset, limit, total, onChange }: { offset: number; limit: number; total: number; onChange: (offset: number) => void }) {
  if (total <= limit) return null;
  return <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
    <span>{offset + 1}-{Math.min(offset + limit, total)} of {total.toLocaleString()}</span>
    <div className="flex gap-2">
      <button disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))} className="rounded-lg border border-border px-3 py-1.5 font-bold disabled:opacity-40" data-testid="button-pager-prev">Previous</button>
      <button disabled={offset + limit >= total} onClick={() => onChange(offset + limit)} className="rounded-lg border border-border px-3 py-1.5 font-bold disabled:opacity-40" data-testid="button-pager-next">Next</button>
    </div>
  </div>;
}

function SearchBox({ value, onChange, placeholder, testId }: { value: string; onChange: (v: string) => void; placeholder: string; testId: string }) {
  return <div className="relative min-w-[12rem] max-w-sm flex-1"><Search className="absolute left-3 top-2.5 text-muted-foreground" size={15} /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-xs outline-none" data-testid={testId} /></div>;
}

// ---------------------------------------------------------------- catalog coverage
function CatalogCoverage() {
  const q = useQuery({ queryKey: ['admin-ai-visualizer-catalog'], queryFn: () => aiVisualizerAdminApi.catalog() });
  const [open, setOpen] = useState<string | null>(null);
  const d = q.data;
  if (q.isLoading) return <p className="text-xs text-muted-foreground">Loading catalog…</p>;
  if (!d) return <p className="text-xs text-destructive">Could not load the catalog.</p>;
  return <div data-testid="card-ai-visualizer-catalog">
    <p className="mb-4 text-xs text-muted-foreground">Students can browse these {d.total.toLocaleString()} topics from the AI Visualizer page. The first student to open a topic generates its widget; it is saved, and everyone after gets it instantly with no AI call.</p>
    <div className="space-y-2">
      {d.disciplines.map((disc) => <div key={disc.id} className="rounded-2xl border border-border bg-card">
        <button type="button" onClick={() => setOpen(open === disc.id ? null : disc.id)} aria-expanded={open === disc.id} className="flex w-full items-center gap-3 px-4 py-3 text-left" data-testid={`button-catalog-discipline-${disc.id}`}>
          <ChevronRight size={14} className={cn('shrink-0 text-primary transition-transform', open === disc.id && 'rotate-90')} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-extrabold">{disc.name}</span><span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold">{disc.program}</span></div>
            <div className="mt-1.5"><Bar value={disc.saved} total={disc.total} /></div>
          </div>
          <div className="shrink-0 text-right text-[11px] text-muted-foreground"><div className="font-bold text-foreground">{disc.saved.toLocaleString()} / {disc.total.toLocaleString()}</div>{pct(disc.saved, disc.total)}% saved</div>
        </button>
        {open === disc.id && <div className="space-y-2 border-t border-border p-3">
          {disc.groups.map((g) => <div key={g.name} className="rounded-xl bg-background px-3 py-2">
            <div className="flex items-center justify-between gap-3 text-[11px]"><span className="font-bold">{g.name}</span><span className="text-muted-foreground">{g.saved} / {g.total}</span></div>
            <div className="mt-1.5"><Bar value={g.saved} total={g.total} /></div>
          </div>)}
        </div>}
      </div>)}
    </div>
  </div>;
}

// ---------------------------------------------------------------- saved library
function SavedLibrary() {
  const [qText, setQText] = useState('');
  const [sort, setSort] = useState<'hits' | 'recent' | 'size' | 'oldest'>('hits');
  const [source, setSource] = useState<'all' | 'catalog' | 'custom'>('all');
  const [offset, setOffset] = useState(0);
  const limit = 25;
  const lib = useQuery({ queryKey: ['admin-ai-visualizer-library', qText, sort, source, offset], queryFn: () => aiVisualizerAdminApi.library({ q: qText.trim(), sort, source, limit, offset }), placeholderData: (prev) => prev });
  const refresh = () => { void lib.refetch(); };
  const del = useMutation({ mutationFn: (id: number) => aiVisualizerAdminApi.deleteLibraryEntry(id), onSuccess: refresh });
  const clear = useMutation({ mutationFn: () => aiVisualizerAdminApi.clearLibrary(), onSuccess: refresh });
  const d = lib.data;
  const reset = (fn: () => void) => { fn(); setOffset(0); };
  return <div data-testid="card-ai-visualizer-library">
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <SearchBox value={qText} onChange={(v) => reset(() => setQText(v))} placeholder="Search saved widgets…" testId="input-search-visualizer-library" />
      <div className="flex flex-wrap items-center gap-1.5">
        {(['all', 'catalog', 'custom'] as const).map((k) => <Chip key={k} active={source === k} onClick={() => reset(() => setSource(k))} testId={`chip-library-source-${k}`}><span className="capitalize">{k === 'custom' ? 'Student-typed' : k}</span></Chip>)}
      </div>
      <select value={sort} onChange={(e) => reset(() => setSort(e.target.value as typeof sort))} className="h-10 rounded-xl border border-border bg-card px-3 text-xs font-semibold" aria-label="Sort saved widgets" data-testid="select-library-sort">
        <option value="hits">Most reused</option><option value="recent">Newest first</option><option value="oldest">Oldest first</option><option value="size">Largest first</option>
      </select>
      {!!d?.count && <button onClick={() => { if (window.confirm('Delete every saved widget? Students will get freshly generated ones (and the library refills).')) clear.mutate(); }} className="ml-auto rounded-xl border border-destructive/40 px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/10" data-testid="button-clear-visualizer-library">Clear library</button>}
    </div>
    <div className="space-y-2">
      {(d?.entries ?? []).map((e) => <div key={e.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5" data-testid={`row-visualizer-library-${e.id}`}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><span className="truncate text-xs font-bold">{e.title}</span><span className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold', e.source === 'catalog' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>{e.source === 'catalog' ? 'Catalog' : 'Student-typed'}</span>{e.hits > 0 && <span className="text-[10px] font-bold text-muted-foreground">{e.hits} reuse{e.hits === 1 ? '' : 's'}</span>}</div>
          <div className="truncate text-[11px] text-muted-foreground">{e.prompt}</div>
          <div className="text-[10px] text-muted-foreground">{(e.bytes / 1024).toFixed(1)} KB · saved {new Date(e.createdAt).toLocaleDateString()}{e.lastUsedAt ? ` · last used ${new Date(e.lastUsedAt).toLocaleDateString()}` : ''}</div>
        </div>
        <button onClick={() => del.mutate(e.id)} className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold text-destructive hover:bg-destructive/10" data-testid={`button-delete-visualizer-library-${e.id}`}>Delete</button>
      </div>)}
      {d && !d.entries.length && <EmptyState icon={Library} title={d.count ? 'No saved widgets match' : 'Nothing saved yet'} body={d.count ? 'Try a different search or filter.' : 'Widgets appear here as students generate them.'} />}
    </div>
    {d && <Pager offset={d.offset} limit={d.limit} total={d.matched} onChange={setOffset} />}
  </div>;
}

// ---------------------------------------------------------------- activity
function ActivityLog() {
  const logs = useQuery({ queryKey: ['admin-ai-visualizer-logs'], queryFn: () => aiVisualizerAdminApi.list(500) });
  const [status, setStatus] = useState<'all' | 'success' | 'error'>('all');
  const [qText, setQText] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 20;
  const all = logs.data ?? [];
  const words = qText.toLowerCase().split(/\s+/).filter(Boolean);
  const rows = all.filter((l) => (status === 'all' || l.status === status) && (!words.length || words.every((w) => `${l.prompt} ${l.student.name} ${l.student.email}`.toLowerCase().includes(w))));
  return <div>
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <SearchBox value={qText} onChange={(v) => { setQText(v); setOffset(0); }} placeholder="Search prompt or student…" testId="input-search-visualizer-activity" />
      {(['all', 'success', 'error'] as const).map((k) => <Chip key={k} active={status === k} onClick={() => { setStatus(k); setOffset(0); }} testId={`chip-activity-${k}`}><span className="capitalize">{k === 'error' ? 'Failed' : k === 'success' ? 'Succeeded' : 'All'}</span></Chip>)}
    </div>
    <div className="space-y-2.5">
      {rows.slice(offset, offset + limit).map((log: AiVisualizerLogEntry) => <div key={log.id} className="rounded-2xl border border-border bg-card p-4" data-testid={`card-ai-visualizer-log-${log.id}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold capitalize', log.status === 'success' ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive')}>{log.status}</span>
          {log.visualizationType && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold capitalize">{log.visualizationType}</span>}
          <span className="ml-auto text-[10px] text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
        </div>
        <p className="mt-2 text-sm leading-6">{log.prompt}</p>
        {log.errorMessage && <p className="mt-1 text-xs text-destructive">{log.errorMessage}</p>}
        {log.rawResponse && <details className="mt-1"><summary className="cursor-pointer text-[11px] font-bold text-muted-foreground">Raw AI response</summary><pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-2 text-[10px]">{log.rawResponse}</pre></details>}
        <div className="mt-2 text-[10px] text-muted-foreground">{log.student.name} · {log.student.email}</div>
      </div>)}
      {!rows.length && <EmptyState icon={Wand2} title={all.length ? 'No activity matches' : 'No activity yet'} body={all.length ? 'Try a different search or filter.' : 'Student AI Visualizer prompts will show up here as they come in.'} />}
    </div>
    <Pager offset={offset} limit={limit} total={rows.length} onChange={setOffset} />
  </div>;
}

// ---------------------------------------------------------------- page
function AdminAiVisualizerLogs() {
  const [tab, setTab] = useState<Tab>('overview');
  const lib = useQuery({ queryKey: ['admin-ai-visualizer-library', '', 'hits', 'all', 0], queryFn: () => aiVisualizerAdminApi.library({ limit: 1 }) });
  const cat = useQuery({ queryKey: ['admin-ai-visualizer-catalog'], queryFn: () => aiVisualizerAdminApi.catalog() });
  const logs = useQuery({ queryKey: ['admin-ai-visualizer-logs'], queryFn: () => aiVisualizerAdminApi.list(500) });
  const succeeded = (logs.data ?? []).filter((l) => l.status === 'success').length;
  const failed = (logs.data ?? []).filter((l) => l.status === 'error').length;

  return <div>
    <SectionHeader eyebrow="Study tools" title="AI Visualizer" />
    <div className="mb-5 flex flex-wrap gap-1.5 border-b border-border pb-3" role="tablist" aria-label="AI Visualizer sections">
      {TABS.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn('inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors', tab === t.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground')} data-testid={`tab-visualizer-${t.id}`}><t.icon size={13} />{t.label}</button>)}
    </div>

    {tab === 'overview' && <div>
      <StatTiles items={[
        { label: 'Catalog topics', value: (cat.data?.total ?? 0).toLocaleString(), icon: BookMarked, tone: 'violet', hint: 'Browsable by students', testId: 'stat-visualizer-catalog' },
        { label: 'Catalog covered', value: `${pct(cat.data?.saved ?? 0, cat.data?.total ?? 0)}%`, icon: CheckCircle2, tone: 'green', hint: `${(cat.data?.saved ?? 0).toLocaleString()} have a saved widget`, testId: 'stat-visualizer-coverage' },
        { label: 'Saved widgets', value: (lib.data?.count ?? 0).toLocaleString(), icon: Library, tone: 'blue', hint: 'Served with no AI call', testId: 'stat-visualizer-saved' },
        { label: 'AI calls avoided', value: (lib.data?.totalReuses ?? 0).toLocaleString(), icon: Sparkles, tone: 'amber', hint: 'Times a saved widget was reused', testId: 'stat-visualizer-reuses' },
        { label: 'Recent succeeded', value: succeeded.toLocaleString(), icon: CheckCircle2, tone: 'green', testId: 'stat-visualizer-succeeded' },
        { label: 'Recent failed', value: failed.toLocaleString(), icon: AlertTriangle, tone: failed ? 'amber' : 'neutral', hint: 'See the Activity tab', testId: 'stat-visualizer-failed' },
      ]} />
      <div className="grid gap-3 md:grid-cols-2">
        {[
          { id: 'catalog' as const, title: 'Topic catalog', body: 'Coverage of every catalog topic, by discipline and group.' },
          { id: 'library' as const, title: 'Saved library', body: 'Search, filter, sort and delete saved widgets.' },
          { id: 'activity' as const, title: 'Activity', body: 'What students asked for, with failures and raw AI output.' },
        ].map((c) => <button key={c.id} onClick={() => setTab(c.id)} className="rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50" data-testid={`card-visualizer-goto-${c.id}`}><div className="flex items-center justify-between text-xs font-extrabold">{c.title}<ChevronRight size={14} className="text-primary" /></div><p className="mt-1 text-[11px] text-muted-foreground">{c.body}</p></button>)}
      </div>
    </div>}
    {tab === 'catalog' && <CatalogCoverage />}
    {tab === 'library' && <SavedLibrary />}
    {tab === 'activity' && <ActivityLog />}
  </div>;
}

export default AdminAiVisualizerLogs;
