// Bulk pre-generation of the AI Visualizer library.
//
// The topic catalog (5000+ topics) is already browsable, and every saved widget opens instantly with
// no AI call. Until now a topic was only saved when the first student generated it. This runs the same
// generator over the catalog in the background so the library is filled BEFORE students arrive and every
// topic opens instantly for everyone.
//
// Safe by design:
//  - only topics with no saved widget (at the current library version) are generated, so it can be
//    stopped and started again at any time and simply carries on (also after a server restart);
//  - small fixed concurrency + a short pause between calls (AI provider rate limits, and cost);
//  - it stops itself on "AI not configured" and after a run of consecutive failures (no burning money);
//  - nothing already saved is ever overwritten.
import { eq } from "drizzle-orm";
import { db, aiVisualizerLibraryTable } from "@workspace/db";
import { generateWidget } from "./aiWidget";
import { AiNotConfiguredError } from "./aiVisualizer";
import { saveWidget, LIBRARY_VERSION } from "./widgetLibrary";
import { getCatalog, type CatalogTopic } from "./visualizerCatalog";

export interface PregenScope { discipline?: string; group?: string; limit?: number; concurrency?: number }
export interface PregenStatus {
  running: boolean; stopping: boolean; startedAt: number | null; finishedAt: number | null;
  scope: { discipline: string | null; group: string | null; limit: number | null; concurrency: number };
  target: number; done: number; failed: number; active: string[]; consecutiveFailures: number;
  stoppedReason: string | null; recentErrors: { prompt: string; error: string; at: number }[];
  /** Rough finishing time in seconds for what is left, from the speed so far (null until there is a sample). */
  etaSeconds: number | null;
}

const PAUSE_MS = 400;               // breathing room between calls per worker
const PER_TOPIC_TIMEOUT_MS = 240_000;
const MAX_CONSECUTIVE_FAILURES = 8; // then stop: something systemic is wrong (quota, outage, bad key)
const MAX_CONCURRENCY = 4;

const state: PregenStatus = {
  running: false, stopping: false, startedAt: null, finishedAt: null,
  scope: { discipline: null, group: null, limit: null, concurrency: 2 },
  target: 0, done: 0, failed: 0, active: [], consecutiveFailures: 0, stoppedReason: null, recentErrors: [], etaSeconds: null,
};

export function getPregenStatus(): PregenStatus {
  const s = { ...state, active: [...state.active], recentErrors: [...state.recentErrors] };
  if (s.running && s.startedAt && s.done > 0) {
    const perItem = (Date.now() - s.startedAt) / (s.done + s.failed);
    s.etaSeconds = Math.round(((s.target - s.done - s.failed) * perItem) / 1000);
  } else s.etaSeconds = null;
  return s;
}

async function savedKeySet(): Promise<Set<string>> {
  const rows = await db.select({ key: aiVisualizerLibraryTable.key }).from(aiVisualizerLibraryTable).where(eq(aiVisualizerLibraryTable.version, LIBRARY_VERSION));
  return new Set(rows.map((r) => r.key));
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("No response yet; it will be picked up on the next run")), ms).unref?.())]);
}

/** How many topics in this scope still have no saved widget. */
export async function countPending(scope: Pick<PregenScope, "discipline" | "group"> = {}): Promise<{ pending: number; total: number }> {
  const saved = await savedKeySet();
  const inScope = getCatalog().filter((t) => (!scope.discipline || t.disciplineId === scope.discipline) && (!scope.group || t.group === scope.group));
  return { pending: inScope.filter((t) => !saved.has(t.key)).length, total: inScope.length };
}

export async function startPregen(scope: PregenScope): Promise<{ started: boolean; reason?: string; target?: number }> {
  if (state.running) return { started: false, reason: "A pre-generation run is already in progress." };
  const saved = await savedKeySet();
  let queue: CatalogTopic[] = getCatalog().filter((t) => (!scope.discipline || t.disciplineId === scope.discipline) && (!scope.group || t.group === scope.group) && !saved.has(t.key));
  if (!queue.length) return { started: false, reason: "Every topic in this selection already has a saved visualization." };
  if (scope.limit && scope.limit > 0) queue = queue.slice(0, scope.limit);
  const concurrency = Math.max(1, Math.min(MAX_CONCURRENCY, Math.floor(scope.concurrency ?? 2)));

  Object.assign(state, {
    running: true, stopping: false, startedAt: Date.now(), finishedAt: null,
    scope: { discipline: scope.discipline ?? null, group: scope.group ?? null, limit: scope.limit ?? null, concurrency },
    target: queue.length, done: 0, failed: 0, active: [], consecutiveFailures: 0, stoppedReason: null, recentErrors: [],
  } satisfies Partial<PregenStatus>);

  let next = 0;
  const worker = async (): Promise<void> => {
    while (!state.stopping) {
      const topic = queue[next++];
      if (!topic) return;
      state.active.push(topic.prompt);
      try {
        let spec;
        try { spec = await withTimeout(generateWidget(topic.prompt), PER_TOPIC_TIMEOUT_MS); }
        catch (err) { if (err instanceof AiNotConfiguredError) throw err; await sleep(1500); spec = await withTimeout(generateWidget(topic.prompt), PER_TOPIC_TIMEOUT_MS); } // one retry
        await saveWidget(topic.prompt, spec);
        state.done++; state.consecutiveFailures = 0;
      } catch (err) {
        if (err instanceof AiNotConfiguredError) { state.stopping = true; state.stoppedReason = err.message; }
        else {
          state.failed++; state.consecutiveFailures++;
          state.recentErrors.unshift({ prompt: topic.prompt, error: (err instanceof Error ? err.message : "Unknown error").slice(0, 200), at: Date.now() });
          state.recentErrors.length = Math.min(state.recentErrors.length, 8);
          if (state.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) { state.stopping = true; state.stoppedReason = `Stopped after ${MAX_CONSECUTIVE_FAILURES} failures in a row (check the AI provider key, quota or status), then start again.`; }
        }
      } finally { state.active = state.active.filter((p) => p !== topic.prompt); }
      await sleep(PAUSE_MS);
    }
  };

  void Promise.all(Array.from({ length: concurrency }, worker))
    .catch((err) => { state.stoppedReason = err instanceof Error ? err.message : "Unexpected error"; })
    .finally(() => { if (state.stopping && !state.stoppedReason) state.stoppedReason = "Stopped by an admin."; state.running = false; state.stopping = false; state.finishedAt = Date.now(); state.active = []; });
  return { started: true, target: queue.length };
}

export function stopPregen(): boolean {
  if (!state.running) return false;
  state.stopping = true; // workers finish the topic they are on, then exit
  return true;
}
