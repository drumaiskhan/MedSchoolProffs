// Browsable AI Visualizer topic catalog: Program > Discipline > Group, with search. Picking a topic
// hands its prompt back to the page, which opens it (instantly when a widget is already saved).
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Zap } from 'lucide-react';
import { aiVisualizerApi, type VisualizerCatalogTopic } from '@/lib/api';
import { cn } from '@/lib/shared';

const PAGE = 30;

export default function TopicCatalog({ onPick, disabled }: { onPick: (prompt: string) => void; disabled?: boolean }) {
  const [program, setProgram] = useState<'' | 'MBBS' | 'BDS'>('');
  const [discipline, setDiscipline] = useState('');
  const [group, setGroup] = useState('');
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => { const t = setTimeout(() => setDebounced(text.trim()), 250); return () => clearTimeout(t); }, [text]);
  useEffect(() => { setLimit(PAGE); }, [program, discipline, group, debounced]);

  const q = useQuery({
    queryKey: ['visualizer-catalog', program, discipline, group, debounced, limit],
    queryFn: () => aiVisualizerApi.catalog({ program: program || undefined, discipline: discipline || undefined, group: group || undefined, q: debounced || undefined, limit }),
    placeholderData: (prev) => prev, staleTime: 60_000,
  });
  const d = q.data;
  const activeDiscipline = d?.disciplines.find((x) => x.id === discipline);

  return <div className="rounded-2xl border border-border bg-card p-4" data-testid="panel-visualizer-catalog">
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[12rem] flex-1"><Search size={14} className="absolute left-3 top-3 text-muted-foreground" /><input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Search ${d ? d.totalAll.toLocaleString() : ''} topics, e.g. brachial plexus, warfarin, rickets…`} className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-primary/20" aria-label="Search topics" data-testid="input-visualizer-catalog-search" /></div>
      <select value={program} onChange={(e) => { setProgram(e.target.value as typeof program); setDiscipline(''); setGroup(''); }} className="h-10 rounded-xl border border-border bg-background px-3 text-xs font-semibold" aria-label="Program" data-testid="select-visualizer-catalog-program">
        <option value="">MBBS + BDS</option><option value="MBBS">MBBS</option><option value="BDS">BDS</option>
      </select>
    </div>
    <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Disciplines">
      <button role="tab" aria-selected={!discipline} onClick={() => { setDiscipline(''); setGroup(''); }} className={cn('shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold', !discipline ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-muted')}>All</button>
      {(d?.disciplines ?? []).map((x) => <button key={x.id} role="tab" aria-selected={discipline === x.id} onClick={() => { setDiscipline(x.id); setGroup(''); }} className={cn('shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold', discipline === x.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-muted')} data-testid={`button-catalog-discipline-${x.id}`}>{x.name} <span className="opacity-70">{x.count.toLocaleString()}</span></button>)}
    </div>
    {activeDiscipline && <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
      <button onClick={() => setGroup('')} className={cn('shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold', !group ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted')}>All groups</button>
      {activeDiscipline.groups.map((g) => <button key={g.name} onClick={() => setGroup(g.name)} className={cn('shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold', group === g.name ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted')}>{g.name}</button>)}
    </div>}
    <div className="mt-3 max-h-[26rem] divide-y divide-border overflow-y-auto rounded-xl border border-border">
      {(d?.topics ?? []).map((t: VisualizerCatalogTopic) => <button key={t.id} disabled={disabled} onClick={() => onPick(t.prompt)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/60 disabled:opacity-50" data-testid={`button-catalog-topic-${t.id}`}>
        <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{t.entity}</span><span className="block truncate text-[11px] text-muted-foreground">{t.aspect} · {t.discipline} › {t.group}</span></span>
        {t.saved && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary"><Zap size={10} /> Instant</span>}
      </button>)}
      {d && !d.topics.length && <p className="p-6 text-center text-xs text-muted-foreground">No topics match. Try a different word, or type your own concept above.</p>}
      {!d && <p className="p-6 text-center text-xs text-muted-foreground">Loading topics…</p>}
    </div>
    {d && <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
      <span>Showing {Math.min(d.topics.length, d.total).toLocaleString()} of {d.total.toLocaleString()}</span>
      {d.total > d.topics.length && <button onClick={() => setLimit((l) => Math.min(100, l + PAGE))} className="font-bold text-primary hover:underline" disabled={limit >= 100} data-testid="button-catalog-more">{limit >= 100 ? 'Refine your search to see more' : 'Show more'}</button>}
    </div>}
  </div>;
}
