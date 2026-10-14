// One-screen stage for the anatomy "model" mode: the solid 3D model with
// atlas-style leader-line labels, a view toolbar (front/back/left/right,
// labels, x-ray, reset, save image, full screen) and a side panel with the
// parts list (with show/hide) and the selected part's details.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Camera, ChevronDown, ChevronUp, Eye, EyeOff, Info, Lightbulb, List, Loader2, LocateFixed, Maximize2, Minimize2, ScanEye, Search, Tag, X,
} from 'lucide-react';
import { aiVisualizerApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Model3D, partColor, type Model3DHandle, type ModelView } from './Model3D';
import type { ModelPart, ModelSpec } from './schema';
import './visualizer3d.css';

type Tab = 'parts' | 'details';

const VIEWS: Array<{ id: ModelView; label: string; title: string }> = [
  { id: 'front', label: 'Front', title: 'Anterior view' },
  { id: 'back', label: 'Back', title: 'Posterior view' },
  { id: 'left', label: 'Left', title: 'View from the left' },
  { id: 'right', label: 'Right', title: 'View from the right' },
];

function ToolButton({ active, onClick, title, testId, children }: { active?: boolean; onClick: () => void; title: string; testId: string; children: ReactNode }) {
  return (
    <button
      type="button" onClick={onClick} title={title} aria-label={title} aria-pressed={active === undefined ? undefined : active} data-testid={testId}
      className={cn('grid size-9 shrink-0 place-items-center rounded-xl border transition-colors', active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground')}
    >{children}</button>
  );
}

export function ModelStage({ spec }: { spec: ModelSpec }) {
  const sceneRef = useRef<Model3DHandle>(null);
  const { parts } = spec;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('parts');
  const [showLabels, setShowLabels] = useState(true);
  const [xray, setXray] = useState(false);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [expanded, setExpanded] = useState(false);
  const [panelOpen, setPanelOpen] = useState(() => (typeof window === 'undefined' ? true : window.innerWidth >= 768));
  const [query, setQuery] = useState('');
  const [webglFailed, setWebglFailed] = useState(false);

  const byId = useMemo(() => new Map(parts.map((p) => [p.id, p])), [parts]);
  const colorOf = (p: ModelPart) => partColor(p, parts.indexOf(p));
  const selected = selectedId ? byId.get(selectedId) ?? null : null;

  const explain = useMutation({ mutationFn: (p: ModelPart) => aiVisualizerApi.explainStep(spec.title, p.label, p.description) });
  useEffect(() => { explain.reset(); }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const select = (id: string | null) => {
    setSelectedId(id);
    if (id) { setTab('details'); setPanelOpen(true); }
  };
  const selectFromList = (id: string) => {
    if (hidden.has(id)) setHidden((h) => { const n = new Set(h); n.delete(id); return n; });
    select(id);
    sceneRef.current?.revealPart(id);
  };
  const toggleHidden = (id: string) => setHidden((h) => { const n = new Set(h); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; if (expanded) setExpanded(false); else setSelectedId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);
  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [expanded]);

  const downloadSnapshot = () => {
    const url = sceneRef.current?.snapshot();
    if (!url) return;
    const a = document.createElement('a'); a.href = url; a.download = `${spec.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'anatomy-model'}.png`; a.click();
  };

  // Parts list grouped by `group`, in first-appearance order.
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? parts.filter((p) => p.label.toLowerCase().includes(q) || (p.group ?? '').toLowerCase().includes(q)) : parts;
    const m = new Map<string, ModelPart[]>();
    for (const p of list) { const g = p.group ?? ''; if (!m.has(g)) m.set(g, []); m.get(g)!.push(p); }
    return [...m.entries()];
  }, [parts, query]);

  const tabs: Array<{ id: Tab; label: string; icon: ReactNode }> = [
    { id: 'parts', label: 'Parts', icon: <List size={13} /> },
    { id: 'details', label: 'Details', icon: <Info size={13} /> },
  ];

  const panelBody = (
    <>
      {tab === 'parts' && (
        <div>
          <p className="text-xs leading-5 text-muted-foreground">{spec.description}</p>
          <p className="mt-2 rounded-lg bg-muted px-2.5 py-1.5 text-[10.5px] font-semibold leading-4 text-muted-foreground">Drag to rotate · pinch/scroll to zoom · tap a part or its label to read about it. Dashed labels are hidden from this angle; tap one to turn the model to it.</p>
          {parts.length > 8 && (
            <div className="relative mt-3">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a part…" className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-2 text-xs outline-none" data-testid="input-anatomy-search" />
            </div>
          )}
          <div className="mt-3 space-y-3">
            {grouped.map(([g, list]) => (
              <div key={g || '_'}>
                {g && <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-wide text-muted-foreground">{g}</div>}
                <ul className="space-y-0.5">
                  {list.map((p) => (
                    <li key={p.id} className="flex items-center gap-1">
                      <button type="button" onClick={() => selectFromList(p.id)} className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted', selectedId === p.id && 'bg-primary/10', hidden.has(p.id) && 'opacity-50')} data-testid={`row-anatomy-part-${p.id}`}>
                        <span className="size-3 shrink-0 rounded-[4px] ring-1 ring-foreground/20" style={{ background: colorOf(p) }} />
                        <span className="min-w-0 flex-1 truncate text-xs font-bold">{p.label}</span>
                      </button>
                      <button type="button" onClick={() => toggleHidden(p.id)} className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label={hidden.has(p.id) ? `Show ${p.label}` : `Hide ${p.label}`} title={hidden.has(p.id) ? 'Show' : 'Hide'} data-testid={`button-anatomy-toggle-${p.id}`}>
                        {hidden.has(p.id) ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {!grouped.length && <p className="px-2 py-3 text-xs text-muted-foreground">No parts match “{query}”.</p>}
          </div>
        </div>
      )}

      {tab === 'details' && selected && (
        <div data-testid="panel-anatomy-details">
          <div className="flex items-start gap-2.5">
            <span className="mt-1 size-3 shrink-0 rounded-[4px] ring-1 ring-foreground/20" style={{ background: colorOf(selected) }} />
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-extrabold leading-5" data-testid="text-anatomy-part-title">{selected.label}</h4>
              {selected.group && <div className="mt-0.5 text-[10.5px] font-bold text-muted-foreground"><span className="rounded-full bg-muted px-2 py-0.5">{selected.group}</span></div>}
            </div>
            <button type="button" onClick={() => setSelectedId(null)} className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Clear selection" data-testid="button-anatomy-clear"><X size={14} /></button>
          </div>
          <p className="mt-3 text-xs leading-6" data-testid="text-anatomy-part-description">{selected.description}</p>
          {!!selected.facts?.length && (
            <ul className="mt-3 space-y-1.5">
              {selected.facts.map((f, i) => <li key={i} className="flex gap-2 text-[11.5px] leading-5 text-muted-foreground"><span className="mt-2 size-1 shrink-0 rounded-full bg-primary" /><span>{f}</span></li>)}
            </ul>
          )}
          <div className="mt-4">
            {!explain.data && (
              <button type="button" onClick={() => explain.mutate(selected)} disabled={explain.isPending} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-primary hover:bg-muted disabled:opacity-60" data-testid="button-anatomy-explain">
                {explain.isPending ? <Loader2 size={13} className="animate-spin" /> : <Lightbulb size={13} />}{explain.isPending ? 'Explaining…' : 'Explain deeper'}
              </button>
            )}
            {explain.data && <p className="rounded-xl bg-muted p-3 text-xs leading-6" data-testid="text-anatomy-explain-result">{explain.data.explanation}</p>}
            {explain.isError && <p className="mt-2 text-xs text-destructive">Couldn't generate an explanation right now.</p>}
          </div>
        </div>
      )}

      {tab === 'details' && !selected && (
        <div className="py-6 text-center text-xs leading-6 text-muted-foreground" data-testid="text-anatomy-nothing-selected">Tap any part of the model — or pick one from the Parts tab — to read about it here.</div>
      )}
    </>
  );

  // No WebGL: same content as a plain list so the feature degrades gracefully.
  if (webglFailed) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5" data-testid="anatomy-fallback">
        <h3 className="text-sm font-extrabold">{spec.title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{spec.description}</p>
        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-[11px] font-semibold text-muted-foreground">3D isn't available on this device, so here is the same content as a list.</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {parts.map((p) => <li key={p.id} className="rounded-xl border border-border p-3"><div className="flex items-center gap-2 text-xs font-extrabold"><span className="size-2.5 rounded-sm" style={{ background: colorOf(p) }} />{p.label}</div><p className="mt-1.5 text-[11.5px] leading-5 text-muted-foreground">{p.description}</p></li>)}
        </ul>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col overflow-hidden border border-border bg-card', expanded ? 'fixed inset-0 z-50 rounded-none' : 'h-[calc(100dvh-14.5rem)] min-h-[520px] rounded-2xl md:min-h-[580px]')} data-testid="anatomy-stage">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-3 py-2.5">
        <div className="min-w-0 flex-1 basis-48">
          <h3 className="truncate text-sm font-extrabold" data-testid="text-anatomy-title">{spec.title}</h3>
          <p className="line-clamp-1 text-[11px] text-muted-foreground">{spec.description}</p>
        </div>
        <div className="flex max-w-full items-center gap-1.5 overflow-x-auto pb-0.5">
          <div className="flex shrink-0 overflow-hidden rounded-xl border border-border" role="group" aria-label="Standard views">
            {VIEWS.map((v) => (
              <button key={v.id} type="button" title={v.title} onClick={() => sceneRef.current?.setView(v.id)} className="h-9 border-r border-border bg-card px-2.5 text-[11px] font-bold text-muted-foreground last:border-r-0 hover:bg-muted hover:text-foreground" data-testid={`button-anatomy-view-${v.id}`}>{v.label}</button>
            ))}
          </div>
          <ToolButton active={showLabels} onClick={() => setShowLabels((v) => !v)} title="Show all labels" testId="button-anatomy-labels"><Tag size={16} /></ToolButton>
          <ToolButton active={xray} onClick={() => setXray((v) => !v)} title="X-ray (see through parts)" testId="button-anatomy-xray"><ScanEye size={16} /></ToolButton>
          <ToolButton onClick={() => { sceneRef.current?.resetView(); setSelectedId(null); setHidden(new Set()); }} title="Reset view" testId="button-anatomy-reset"><LocateFixed size={16} /></ToolButton>
          <ToolButton onClick={downloadSnapshot} title="Save image" testId="button-anatomy-snapshot"><Camera size={16} /></ToolButton>
          <ToolButton onClick={() => setExpanded((v) => !v)} title={expanded ? 'Exit full screen' : 'Full screen'} testId="button-anatomy-expand">{expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</ToolButton>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="viz3d-stage-bg relative min-h-[260px] flex-1">
          <Model3D ref={sceneRef} parts={parts} selectedId={selectedId} onSelect={select} showLabels={showLabels} xray={xray} hidden={hidden} onWebglFailed={() => setWebglFailed(true)} />
          <div className="viz3d-hint pointer-events-none absolute bottom-3 left-3 z-10 hidden rounded-full bg-card/80 px-3 py-1.5 text-[10.5px] font-semibold text-muted-foreground backdrop-blur md:block">Drag to rotate · scroll to zoom · tap a part or label</div>
        </div>

        <aside role="complementary" aria-label="Model details"
          className={cn('flex shrink-0 flex-col overflow-hidden border-t border-border bg-card md:w-80 md:max-h-none md:border-l md:border-t-0', panelOpen ? 'max-h-[42%]' : 'max-h-12')}
          data-testid="panel-anatomy-side">
          <div className="flex shrink-0 items-center gap-1 border-b border-border p-1.5">
            <div className="flex min-w-0 flex-1 items-center gap-1" role="tablist">
              {tabs.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => { setTab(t.id); setPanelOpen(true); }}
                  className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold transition-colors', tab === t.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')} data-testid={`tab-anatomy-${t.id}`}>
                  {t.icon}{t.label}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setPanelOpen((v) => !v)} className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted md:hidden" aria-label={panelOpen ? 'Collapse panel' : 'Expand panel'} data-testid="button-anatomy-panel-toggle">{panelOpen ? <ChevronDown size={15} /> : <ChevronUp size={15} />}</button>
          </div>
          {panelOpen && <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">{panelBody}</div>}
        </aside>
      </div>
    </div>
  );
}

export default ModelStage;
