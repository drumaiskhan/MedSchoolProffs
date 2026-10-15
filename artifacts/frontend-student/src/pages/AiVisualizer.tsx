// AI Visualizer page (v73): 2D interactive widgets only. The old 3D "model" and
// "scene" modes (three.js) were removed — they were heavy, slow to load and the
// main reason the page seemed to load forever on phones.
import { Suspense, lazy, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { RotateCcw, Sparkles, Wand2 } from 'lucide-react';
import { aiVisualizerApi, ApiRequestError, siteContentApi, type AnyVisualization } from '@/lib/api';
import { AI_VISUALIZER_EXAMPLES, BrandSpinner, EmptyState, SectionHeader, SkeletonPage } from '@/lib/shared';

const WidgetStage = lazy(() => import('@/components/visualizer/WidgetStage'));

function AiVisualizer() {
  const [prompt, setPrompt] = useState('');
  const [spec, setSpec] = useState<AnyVisualization | null>(null);
  const [version, setVersion] = useState(0);

  // Same AI_VISUALIZER_ENABLED check SideNav uses — this covers someone
  // navigating here directly by URL while the sidebar link is hidden, or a
  // tab that was already open on this page when an admin turned it off.
  const siteContentQ = useQuery({ queryKey: ['site-content'], queryFn: siteContentApi.get });
  const aiVisualizerEnabled = siteContentQ.data?.AI_VISUALIZER_ENABLED !== 'false';

  const generate = useMutation({
    mutationFn: ({ p, fresh }: { p: string; fresh: boolean }) => aiVisualizerApi.generate(p, fresh),
    onSuccess: (data) => { setSpec(data.visualization); setVersion((v) => v + 1); },
  });

  const run = (fresh: boolean) => { if (prompt.trim().length >= 3 && !generate.isPending) generate.mutate({ p: prompt.trim(), fresh }); };
  const submit = () => run(false); // repeat topics come from the saved library (no AI call)
  const regenerate = () => run(true); // "Regenerate" always builds a new one and replaces the saved copy
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
      <SectionHeader eyebrow="Study tools" title="AI Visualizer" description="Describe any concept to get an interactive 2D diagram with sliders and live values. Try a process, a physiological relationship or a calculation — e.g. cardiac output, body fluid compartments, the oxygen–haemoglobin curve." />
      <div className="rounded-2xl border border-border bg-card p-5">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Cardiac output = heart rate × stroke volume — or: Body fluid compartments by body weight…"
          className="min-h-32 w-full resize-none rounded-xl border border-border bg-background p-3 text-xs leading-6 outline-none focus:ring-2 focus:ring-primary/20"
          data-testid="textarea-visualizer-prompt"
        />
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
          {generate.isPending ? 'Building your interactive visualization… (can take up to a minute)' : 'Generate Visualization'}
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
        <button onClick={regenerate} disabled={generate.isPending || prompt.trim().length < 3} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-extrabold text-primary-foreground disabled:opacity-50 sm:flex-none" data-testid="button-visualizer-regenerate">
          {generate.isPending ? <BrandSpinner size={13} /> : <RotateCcw size={13} />}{generate.isPending ? 'Generating…' : 'Regenerate'}
        </button>
        <button onClick={startOver} className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-border bg-card px-4 text-xs font-bold hover:bg-muted sm:flex-none" data-testid="button-visualizer-new">New</button>
      </div>
    </div>
    {errorBlock}
    <div className={generate.isPending ? 'pointer-events-none opacity-60 transition-opacity' : 'transition-opacity'}>
      <Suspense fallback={<div className="grid h-[420px] place-items-center rounded-2xl border border-border bg-card"><BrandSpinner size={22} /></div>}>
        <WidgetStage key={version} spec={spec} />
      </Suspense>
    </div>
  </div>;
}

export default AiVisualizer;
