// AI Visualizer page. Two result types, both on a single screen:
//  - "scene" (v60): a process / pathway / comparison as an interactive 3D node graph.
//  - "model" (v61): a structure (bone, organ, vessel tree...) as a SOLID, static 3D
//    model with atlas-style labels that the student rotates by hand.
// The 3D engine (three.js) is lazy-loaded so it never weighs on the rest of the app.
import { Suspense, lazy, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { RotateCcw, Sparkles, Wand2 } from 'lucide-react';
import { aiVisualizerApi, ApiRequestError, siteContentApi, type AnyVisualization, type VisualizerMode } from '@/lib/api';
import { cn } from '@/lib/utils';
import { AI_VISUALIZER_EXAMPLES, BrandSpinner, EmptyState, SectionHeader, SkeletonPage } from '@/lib/shared';

const VisualizerStage = lazy(() => import('@/components/visualizer/VisualizerStage'));
const ModelStage = lazy(() => import('@/components/visualizer/ModelStage'));

const MODES: Array<{ id: VisualizerMode; label: string; hint: string }> = [
  { id: 'auto', label: 'Auto', hint: 'Picks the best format for your request' },
  { id: 'model', label: 'Anatomy model', hint: 'A solid, labelled 3D model of a structure' },
  { id: 'scene', label: 'Process diagram', hint: 'A flow / comparison as linked 3D nodes' },
];

function AiVisualizer() {
  const [prompt, setPrompt] = useState('');
  const [spec, setSpec] = useState<AnyVisualization | null>(null);
  const [mode, setMode] = useState<VisualizerMode>('auto');
  const [version, setVersion] = useState(0);

  // Same AI_VISUALIZER_ENABLED check SideNav uses — this covers someone
  // navigating here directly by URL while the sidebar link is hidden, or a
  // tab that was already open on this page when an admin turned it off.
  const siteContentQ = useQuery({ queryKey: ['site-content'], queryFn: siteContentApi.get });
  const aiVisualizerEnabled = siteContentQ.data?.AI_VISUALIZER_ENABLED !== 'false';

  const generate = useMutation({
    mutationFn: (p: string) => aiVisualizerApi.generate(p, mode),
    onSuccess: (data) => { setSpec(data.visualization); setVersion((v) => v + 1); },
  });

  const submit = () => { if (prompt.trim().length >= 3 && !generate.isPending) generate.mutate(prompt.trim()); };
  const startOver = () => { setSpec(null); setPrompt(''); generate.reset(); };

  if (!siteContentQ.isLoading && !aiVisualizerEnabled) return <EmptyState icon={Wand2} title="AI Visualizer is turned off" body="This feature isn't available right now — check back later." />;

  const errorBlock = generate.isError && (
    <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive" data-testid="text-visualizer-error">
      {generate.error instanceof ApiRequestError ? generate.error.message : "Couldn't generate a visualization right now."}
      <button onClick={submit} className="ml-3 font-bold underline" data-testid="button-visualizer-regenerate-error">Try again</button>
    </div>
  );

  // ---- before the first result: prompt screen ----
  if (!spec) {
    return <div className="mx-auto max-w-3xl">
      <SectionHeader eyebrow="Study tools" title="AI Visualizer" description="Ask for a structure (a bone, an organ, a vessel tree) to get a solid, labelled 3D model you can rotate — or describe a process, pathway or comparison to explore it as an interactive 3D scene." />
      <div className="rounded-2xl border border-border bg-card p-5">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Tibia with all its parts labelled — or: Skeletal muscle contraction from action potential to relaxation…"
          className="min-h-32 w-full resize-none rounded-xl border border-border bg-background p-3 text-xs leading-6 outline-none focus:ring-2 focus:ring-primary/20"
          data-testid="textarea-visualizer-prompt"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Visualization type">
          {MODES.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} title={m.hint} onClick={() => setMode(m.id)}
              className={cn('rounded-full border px-3 py-1.5 text-[11px] font-extrabold transition-colors', mode === m.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground')}
              data-testid={`button-visualizer-mode-${m.id}`}>{m.label}</button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {AI_VISUALIZER_EXAMPLES.map((ex, i) => (
            <button key={i} onClick={() => setPrompt(ex)} className="rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground" data-testid={`button-visualizer-example-${i}`}>{ex.length > 60 ? `${ex.slice(0, 57)}…` : ex}</button>
          ))}
        </div>
        <button
          onClick={submit}
          disabled={generate.isPending || prompt.trim().length < 3}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-xs font-extrabold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-50"
          data-testid="button-generate-visualization"
        >
          {generate.isPending ? <BrandSpinner size={14} /> : <Wand2 size={14} />}
          {generate.isPending ? (mode === 'model' ? 'Building your 3D model…' : 'Building your 3D visualization…') : 'Generate 3D Visualization'}
        </button>
        {generate.isPending && <div className="mt-5"><SkeletonPage /></div>}
        {errorBlock}
      </div>
    </div>;
  }

  // ---- result: wide single-screen stage with a compact prompt bar ----
  return <div className="mx-auto max-w-7xl">
    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3">
        <Sparkles size={14} className="shrink-0 text-primary" />
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="Describe another concept…"
          className="h-10 min-w-0 flex-1 bg-transparent text-xs outline-none"
          aria-label="Visualization prompt"
          data-testid="input-visualizer-prompt-bar"
        />
      </div>
      <div className="flex gap-2">
        <button onClick={submit} disabled={generate.isPending || prompt.trim().length < 3} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-extrabold text-primary-foreground disabled:opacity-50 sm:flex-none" data-testid="button-visualizer-regenerate">
          {generate.isPending ? <BrandSpinner size={13} /> : <RotateCcw size={13} />}{generate.isPending ? 'Generating…' : 'Regenerate'}
        </button>
        <button onClick={startOver} className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-border bg-card px-4 text-xs font-bold hover:bg-muted sm:flex-none" data-testid="button-visualizer-new">New</button>
      </div>
    </div>
    {errorBlock}
    <div className={generate.isPending ? 'pointer-events-none opacity-60 transition-opacity' : 'transition-opacity'}>
      <Suspense fallback={<div className="grid h-[420px] place-items-center rounded-2xl border border-border bg-card"><BrandSpinner size={22} /></div>}>
        {spec.type === 'model' ? <ModelStage key={version} spec={spec} /> : <VisualizerStage key={version} spec={spec} />}
      </Suspense>
    </div>
  </div>;
}

export default AiVisualizer;
