// One-screen, fully interactive 3D stage for the AI Visualizer: the 3D canvas,
// toolbar, group legend and a side panel (parts list / details / calculator)
// all live on the same screen — no steps, no pages to click through.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  ArrowLeft, ArrowRight, Calculator as CalcIcon, Camera, ChevronDown, ChevronUp, Info, Layers, Lightbulb, List,
  Loader2, LocateFixed, Maximize2, Minimize2, Rotate3d, Search, Tag, Waypoints, X,
} from 'lucide-react';
import { aiVisualizerApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Scene3D, buildGroupColors, nodeColor, type Scene3DHandle } from './Scene3D';
import { Calculator } from './Calculator';
import type { SceneLayout, SceneNode, VisualizationSpec } from './schema';
import './visualizer3d.css';

type Tab = 'parts' | 'details' | 'calc';

const LAYOUT_LABELS: Record<SceneLayout, string> = { auto: 'Auto layout', ring: 'Ring', layers: 'Layers', line: 'Sequence' };

function ToolButton({ active, onClick, title, testId, children }: { active?: boolean; onClick: () => void; title: string; testId: string; children: ReactNode }) {
  return (
    <button
      type="button" onClick={onClick} title={title} aria-label={title} aria-pressed={active === undefined ? undefined : active} data-testid={testId}
      className={cn('grid size-9 shrink-0 place-items-center rounded-xl border transition-colors', active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground')}
    >{children}</button>
  );
}

export function VisualizerStage({ spec }: { spec: VisualizationSpec }) {
  const sceneRef = useRef<Scene3DHandle>(null);
  const { nodes, links } = spec;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLink, setSelectedLink] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('parts');
  const [showLabels, setShowLabels] = useState(true);
  const [showFlow, setShowFlow] = useState(true);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isolated, setIsolated] = useState<string | null>(null);
  const [layout, setLayout] = useState<SceneLayout>(spec.layout ?? 'auto');
  const [expanded, setExpanded] = useState(false);
  const [panelOpen, setPanelOpen] = useState(() => (typeof window === 'undefined' ? true : window.innerWidth >= 768));
  const [query, setQuery] = useState('');
  const [webglFailed, setWebglFailed] = useState(false);

  const groupColors = useMemo(() => buildGroupColors(nodes), [nodes]);
  const legend = useMemo(() => [...groupColors.entries()].filter(([g]) => g !== ''), [groupColors]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const sequence = useMemo(() => links.map((l, index) => ({ l, index })).filter((x) => x.l.order !== undefined).sort((a, b) => a.l.order! - b.l.order!), [links]);
  const colorOf = (n: SceneNode) => nodeColor(n, groupColors);

  const selectedNode = selectedId ? byId.get(selectedId) ?? null : null;
  const selectedLinkObj = selectedLink !== null ? links[selectedLink] ?? null : null;

  const explain = useMutation({ mutationFn: (n: SceneNode) => aiVisualizerApi.explainStep(spec.title, n.label, n.description) });
  useEffect(() => { explain.reset(); }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Selection coming from the canvas (no camera move — double-click flies).
  const fromCanvasNode = (id: string | null) => {
    setSelectedId(id); setSelectedLink(null);
    if (id) { setTab('details'); setPanelOpen(true); }
  };
  const fromCanvasLink = (i: number | null) => {
    setSelectedLink(i); setSelectedId(null);
    if (i !== null) { setTab('details'); setPanelOpen(true); }
  };
  // Selection coming from the panel flies the camera to the part.
  const selectFromPanel = (id: string) => {
    fromCanvasNode(id);
    sceneRef.current?.focusNode(id);
  };
  const clearSelection = () => { setSelectedId(null); setSelectedLink(null); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (expanded) setExpanded(false); else clearSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  // Lock page scroll behind the expanded (full-screen) stage.
  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [expanded]);

  const changeLayout = (mode: SceneLayout) => { setLayout(mode); sceneRef.current?.relayout(mode); };
  const downloadSnapshot = () => {
    const url = sceneRef.current?.snapshot();
    if (!url) return;
    const a = document.createElement('a'); a.href = url; a.download = `${spec.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'visualization'}.png`; a.click();
  };

  const filteredNodes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? nodes.filter((n) => n.label.toLowerCase().includes(q) || (n.group ?? '').toLowerCase().includes(q) || (n.tag ?? '').toLowerCase().includes(q)) : nodes;
  }, [nodes, query]);

  const tabs: Array<{ id: Tab; label: string; icon: ReactNode }> = [
    { id: 'parts', label: 'Parts', icon: <List size={13} /> },
    { id: 'details', label: 'Details', icon: <Info size={13} /> },
    ...(spec.calculator ? [{ id: 'calc' as Tab, label: 'Calculate', icon: <CalcIcon size={13} /> }] : []),
  ];

  const NodeChip = ({ n }: { n: SceneNode }) => (
    <button type="button" onClick={() => selectFromPanel(n.id)} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-bold hover:bg-muted" data-testid={`chip-viz-node-${n.id}`}>
      <span className="size-2 shrink-0 rounded-full" style={{ background: colorOf(n) }} /><span className="truncate">{n.label}</span>
    </button>
  );

  const connections = selectedNode ? {
    out: links.map((l, index) => ({ l, index })).filter((x) => x.l.fromId === selectedNode.id),
    inn: links.map((l, index) => ({ l, index })).filter((x) => x.l.toId === selectedNode.id),
  } : null;

  const panelBody = (
    <>
      {tab === 'parts' && (
        <div>
          <p className="text-xs leading-5 text-muted-foreground">{spec.description}</p>
          <p className="mt-2 rounded-lg bg-muted px-2.5 py-1.5 text-[10.5px] font-semibold leading-4 text-muted-foreground">Drag to rotate · pinch/scroll to zoom · tap a part to select · drag a part to move it · double-tap to fly to it.</p>
          {nodes.length > 8 && (
            <div className="relative mt-3">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a part…" className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-2 text-xs outline-none" data-testid="input-viz-search" />
            </div>
          )}
          {sequence.length > 0 && !query && (
            <div className="mt-4">
              <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-muted-foreground">Sequence</div>
              <ol className="space-y-1">
                {sequence.map(({ l, index }) => (
                  <li key={index}>
                    <button type="button" onClick={() => fromCanvasLink(index)} className={cn('flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-[11.5px] hover:bg-muted', selectedLink === index && 'bg-primary/10')} data-testid={`row-viz-seq-${index}`}>
                      <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-primary text-[9.5px] font-extrabold text-primary-foreground">{l.order}</span>
                      <span className="min-w-0"><span className="font-bold">{byId.get(l.fromId)?.label}</span> <ArrowRight size={10} className="mx-0.5 inline" /> <span className="font-bold">{byId.get(l.toId)?.label}</span>{l.label && <span className="block truncate text-muted-foreground">{l.label}</span>}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <div className="mt-4">
            <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-muted-foreground">All parts ({filteredNodes.length})</div>
            <ul className="space-y-1">
              {filteredNodes.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => selectFromPanel(n.id)} className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted', selectedId === n.id && 'bg-primary/10')} data-testid={`row-viz-part-${n.id}`}>
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: colorOf(n) }} />
                    <span className="min-w-0 flex-1 truncate text-xs font-bold">{n.label}</span>
                    {(n.tag || n.group) && <span className="max-w-[40%] shrink-0 truncate text-[10px] font-semibold text-muted-foreground">{n.tag ?? n.group}</span>}
                  </button>
                </li>
              ))}
              {!filteredNodes.length && <li className="px-2 py-3 text-xs text-muted-foreground">No parts match “{query}”.</li>}
            </ul>
          </div>
        </div>
      )}

      {tab === 'details' && selectedNode && connections && (
        <div data-testid="panel-viz-node-details">
          <div className="flex items-start gap-2.5">
            <span className="mt-1 size-3 shrink-0 rounded-full" style={{ background: colorOf(selectedNode) }} />
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-extrabold leading-5" data-testid="text-viz-node-title">{selectedNode.label}</h4>
              <div className="mt-0.5 flex flex-wrap gap-1.5 text-[10.5px] font-bold text-muted-foreground">
                {selectedNode.group && <span className="rounded-full bg-muted px-2 py-0.5">{selectedNode.group}</span>}
                {selectedNode.tag && <span className="rounded-full bg-muted px-2 py-0.5">{selectedNode.tag}</span>}
              </div>
            </div>
            <button type="button" onClick={clearSelection} className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Clear selection" data-testid="button-viz-clear"><X size={14} /></button>
          </div>
          <p className="mt-3 text-xs leading-6" data-testid="text-viz-node-description">{selectedNode.description}</p>
          {!!selectedNode.facts?.length && (
            <ul className="mt-3 space-y-1.5">
              {selectedNode.facts.map((f, i) => <li key={i} className="flex gap-2 text-[11.5px] leading-5 text-muted-foreground"><span className="mt-2 size-1 shrink-0 rounded-full bg-primary" /><span>{f}</span></li>)}
            </ul>
          )}
          {(connections.inn.length > 0 || connections.out.length > 0) && (
            <div className="mt-4 space-y-3">
              {connections.inn.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center gap-1 text-[10.5px] font-extrabold uppercase tracking-wide text-muted-foreground"><ArrowLeft size={11} /> Comes from</div>
                  <div className="flex flex-wrap gap-1.5">{connections.inn.map(({ l, index }) => { const n = byId.get(l.fromId); return n ? <span key={index} className="inline-flex max-w-full items-center gap-1"><NodeChip n={n} />{l.label && <span className="truncate text-[10px] text-muted-foreground">{l.label}</span>}</span> : null; })}</div>
                </div>
              )}
              {connections.out.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center gap-1 text-[10.5px] font-extrabold uppercase tracking-wide text-muted-foreground">Leads to <ArrowRight size={11} /></div>
                  <div className="flex flex-wrap gap-1.5">{connections.out.map(({ l, index }) => { const n = byId.get(l.toId); return n ? <span key={index} className="inline-flex max-w-full items-center gap-1"><NodeChip n={n} />{l.label && <span className="truncate text-[10px] text-muted-foreground">{l.label}</span>}</span> : null; })}</div>
                </div>
              )}
            </div>
          )}
          <div className="mt-4">
            {!explain.data && (
              <button type="button" onClick={() => explain.mutate(selectedNode)} disabled={explain.isPending} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-primary hover:bg-muted disabled:opacity-60" data-testid="button-explain-step">
                {explain.isPending ? <Loader2 size={13} className="animate-spin" /> : <Lightbulb size={13} />}{explain.isPending ? 'Explaining…' : 'Explain deeper'}
              </button>
            )}
            {explain.data && <p className="rounded-xl bg-muted p-3 text-xs leading-6" data-testid="text-explain-step-result">{explain.data.explanation}</p>}
            {explain.isError && <p className="mt-2 text-xs text-destructive">Couldn't generate an explanation right now.</p>}
          </div>
        </div>
      )}

      {tab === 'details' && !selectedNode && selectedLinkObj && (
        <div data-testid="panel-viz-link-details">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-extrabold">{selectedLinkObj.order !== undefined ? `Step ${selectedLinkObj.order}` : 'Connection'}{selectedLinkObj.label ? ` · ${selectedLinkObj.label}` : ''}</h4>
            <button type="button" onClick={clearSelection} className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Clear selection"><X size={14} /></button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {byId.get(selectedLinkObj.fromId) && <NodeChip n={byId.get(selectedLinkObj.fromId)!} />}
            <ArrowRight size={14} className="text-muted-foreground" />
            {byId.get(selectedLinkObj.toId) && <NodeChip n={byId.get(selectedLinkObj.toId)!} />}
          </div>
          <p className="mt-3 text-[11.5px] leading-5 text-muted-foreground">{selectedLinkObj.style === 'dashed' ? 'Dashed link: an indirect or weaker relationship.' : 'Solid link: a direct relationship or flow.'}{selectedLinkObj.flow === false ? ' No movement is shown along this connection.' : ' The moving dots show the direction of flow.'}</p>
        </div>
      )}

      {tab === 'details' && !selectedNode && !selectedLinkObj && (
        <div className="py-6 text-center text-xs leading-6 text-muted-foreground" data-testid="text-viz-nothing-selected">Tap any part in the 3D view — or pick one from the Parts tab — to read about it here.</div>
      )}

      {tab === 'calc' && spec.calculator && <Calculator calc={spec.calculator} />}
    </>
  );

  // No WebGL (very old device / blocked GPU): the same information as a plain
  // list, so the feature degrades instead of showing a blank canvas.
  if (webglFailed) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5" data-testid="viz-fallback">
        <h3 className="text-sm font-extrabold">{spec.title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{spec.description}</p>
        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-[11px] font-semibold text-muted-foreground">3D isn't available on this device, so here is the same content as a list.</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {nodes.map((n) => <li key={n.id} className="rounded-xl border border-border p-3"><div className="flex items-center gap-2 text-xs font-extrabold"><span className="size-2.5 rounded-full" style={{ background: colorOf(n) }} />{n.label}{n.tag && <span className="text-[10px] font-semibold text-muted-foreground">· {n.tag}</span>}</div><p className="mt-1.5 text-[11.5px] leading-5 text-muted-foreground">{n.description}</p></li>)}
        </ul>
        {links.length > 0 && <ul className="mt-4 space-y-1 text-xs">{[...links].sort((a, b) => (a.order ?? 99) - (b.order ?? 99)).map((l, i) => <li key={i}>{l.order !== undefined && <b>{l.order}. </b>}{byId.get(l.fromId)?.label} → {byId.get(l.toId)?.label}{l.label ? ` (${l.label})` : ''}</li>)}</ul>}
        {spec.calculator && <div className="mt-5"><Calculator calc={spec.calculator} /></div>}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col overflow-hidden border border-border bg-card', expanded ? 'fixed inset-0 z-50 rounded-none' : 'h-[calc(100dvh-14.5rem)] min-h-[500px] rounded-2xl md:min-h-[580px]')} data-testid="viz-stage">
      {/* header: title + toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-3 py-2.5">
        <div className="min-w-0 flex-1 basis-48">
          <h3 className="truncate text-sm font-extrabold" data-testid="text-visualizer-title">{spec.title}</h3>
          <p className="line-clamp-1 text-[11px] text-muted-foreground">{spec.description}</p>
        </div>
        <div className="flex max-w-full items-center gap-1.5 overflow-x-auto pb-0.5">
          <label className="relative shrink-0">
            <Layers size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <select value={layout} onChange={(e) => changeLayout(e.target.value as SceneLayout)} className="h-9 appearance-none rounded-xl border border-border bg-card pl-7 pr-3 text-[11px] font-bold text-foreground" aria-label="Layout" data-testid="select-viz-layout">
              {(Object.keys(LAYOUT_LABELS) as SceneLayout[]).map((k) => <option key={k} value={k}>{LAYOUT_LABELS[k]}</option>)}
            </select>
          </label>
          <ToolButton active={autoRotate} onClick={() => setAutoRotate((v) => !v)} title="Auto-rotate" testId="button-viz-rotate"><Rotate3d size={16} /></ToolButton>
          <ToolButton active={showFlow} onClick={() => setShowFlow((v) => !v)} title="Show flow" testId="button-viz-flow"><Waypoints size={16} /></ToolButton>
          <ToolButton active={showLabels} onClick={() => setShowLabels((v) => !v)} title="Show all labels" testId="button-viz-labels"><Tag size={16} /></ToolButton>
          <ToolButton onClick={() => { sceneRef.current?.resetView(); clearSelection(); setIsolated(null); }} title="Reset view" testId="button-viz-reset"><LocateFixed size={16} /></ToolButton>
          <ToolButton onClick={downloadSnapshot} title="Save image" testId="button-viz-snapshot"><Camera size={16} /></ToolButton>
          <ToolButton onClick={() => setExpanded((v) => !v)} title={expanded ? 'Exit full screen' : 'Full screen'} testId="button-viz-expand">{expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</ToolButton>
        </div>
      </div>

      {/* canvas + overlays */}
      <div className="viz3d-stage-bg relative min-h-0 flex-1">
        <Scene3D
          ref={sceneRef} nodes={nodes} links={links} layout={spec.layout ?? 'auto'}
          selectedId={selectedId} selectedLinkIndex={selectedLink}
          onSelectNode={fromCanvasNode} onSelectLink={fromCanvasLink}
          showLabels={showLabels} showFlow={showFlow} autoRotate={autoRotate} isolatedGroup={isolated}
          onWebglFailed={() => setWebglFailed(true)}
        />

        {legend.length > 1 && (
          <div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-1.5 md:max-w-[calc(100%-21rem)]" data-testid="row-viz-legend">
            {legend.map(([g, color]) => (
              <button key={g} type="button" onClick={() => setIsolated((cur) => (cur === g ? null : g))} aria-pressed={isolated === g}
                className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-extrabold backdrop-blur transition-colors', isolated === g ? 'border-primary bg-card text-foreground shadow' : isolated ? 'border-border bg-card/60 text-muted-foreground' : 'border-border bg-card/85 text-foreground hover:bg-card')}
                data-testid={`button-viz-legend-${g}`}>
                <span className="size-2 rounded-full" style={{ background: color }} />{g}
              </button>
            ))}
          </div>
        )}

        <div className="viz3d-hint pointer-events-none absolute bottom-3 left-3 z-10 hidden rounded-full bg-card/80 px-3 py-1.5 text-[10.5px] font-semibold text-muted-foreground backdrop-blur md:block">Drag to rotate · scroll to zoom · click a part · drag a part to move it</div>

        {/* side panel (right on desktop, bottom sheet on phones) */}
        <aside role="complementary" aria-label="Visualization details"
          className={cn('absolute z-20 flex flex-col overflow-hidden rounded-2xl border border-border bg-card/95 shadow-lg backdrop-blur', 'inset-x-2 bottom-2', panelOpen ? 'max-h-[48%]' : 'max-h-12', 'md:inset-x-auto md:bottom-3 md:right-3 md:top-3 md:max-h-none md:w-80')}
          data-testid="panel-visualizer-side">
          <div className="flex shrink-0 items-center gap-1 border-b border-border p-1.5">
            <div className="flex min-w-0 flex-1 items-center gap-1" role="tablist">
              {tabs.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => { setTab(t.id); setPanelOpen(true); }}
                  className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold transition-colors', tab === t.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')} data-testid={`tab-viz-${t.id}`}>
                  {t.icon}{t.label}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setPanelOpen((v) => !v)} className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted md:hidden" aria-label={panelOpen ? 'Collapse panel' : 'Expand panel'} data-testid="button-viz-panel-toggle">{panelOpen ? <ChevronDown size={15} /> : <ChevronUp size={15} />}</button>
          </div>
          {panelOpen && <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">{panelBody}</div>}
        </aside>
      </div>
    </div>
  );
}

export default VisualizerStage;
