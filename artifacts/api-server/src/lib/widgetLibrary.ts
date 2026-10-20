// Saved library of generated AI Visualizer widgets (v81).
//
// Every successful widget is saved under a normalised key built from the student's prompt. The
// next time anyone asks for the same (or a near-identical) topic, the saved widget is served
// straight from the database: no AI call, no tokens, instant. Bump LIBRARY_VERSION to retire
// every saved widget at once (e.g. after a big prompt/figure improvement); admins can also delete
// single entries or clear the library from Admin -> AI Visualizer activity.
import { and, desc, eq, sql } from "drizzle-orm";
import { db, aiVisualizerLibraryTable } from "@workspace/db";
import { FUZZY_THRESHOLD, MAX_KEY_LENGTH, jaccard, promptKey, promptTokens } from "./promptKey";
import { catalogKeySet } from "./visualizerCatalog";

// v2 (v82): figures became animated, so widgets saved with the old still figures are retired.
export const LIBRARY_VERSION = 3;
const MAX_FUZZY_ROWS = 20000; // the library is meant to hold 5000+ topics, so the near-match scan must cover them all

// Normalisation lives in promptKey.ts (pure, shared with the topic catalog).
export { promptTokens, promptKey };

export interface SavedWidget { id: number; title: string; description: string; html: string }

/** A saved widget for this prompt (exact normalised match, else a very close one), or null. */
export async function findSavedWidget(prompt: string): Promise<SavedWidget | null> {
  const tokens = promptTokens(prompt);
  if (!tokens.length) return null;
  const key = tokens.join(" ").slice(0, MAX_KEY_LENGTH);
  const exact = await db.select().from(aiVisualizerLibraryTable)
    .where(and(eq(aiVisualizerLibraryTable.key, key), eq(aiVisualizerLibraryTable.version, LIBRARY_VERSION))).limit(1);
  let hit = exact[0];
  // Catalog topics are curated and distinct ("Infarction: morphology" vs "Myocardial infarction:
  // morphology" differ by one word but must not share a widget), so a catalog topic is matched
  // exactly only, and a free-text prompt is never fuzzy-matched onto a different catalog topic's widget.
  const catalogKeys = catalogKeySet();
  if (!hit && !catalogKeys.has(key)) {
    const rows = await db.select({ id: aiVisualizerLibraryTable.id, key: aiVisualizerLibraryTable.key })
      .from(aiVisualizerLibraryTable).where(eq(aiVisualizerLibraryTable.version, LIBRARY_VERSION))
      .orderBy(desc(aiVisualizerLibraryTable.hits)).limit(MAX_FUZZY_ROWS);
    let best: { id: number; score: number } | null = null;
    for (const r of rows) {
      if (catalogKeys.has(r.key)) continue;
      const { score, shared } = jaccard(tokens, r.key.split(" "));
      if (shared >= 2 && score >= FUZZY_THRESHOLD && (!best || score > best.score)) best = { id: r.id, score };
    }
    if (best) hit = (await db.select().from(aiVisualizerLibraryTable).where(eq(aiVisualizerLibraryTable.id, best.id)).limit(1))[0];
  }
  if (!hit) return null;
  await db.update(aiVisualizerLibraryTable)
    .set({ hits: sql`${aiVisualizerLibraryTable.hits} + 1`, lastUsedAt: new Date() })
    .where(eq(aiVisualizerLibraryTable.id, hit.id));
  return { id: hit.id, title: hit.title, description: hit.description, html: hit.html };
}

/** Save (or replace, for "regenerate") the widget generated for this prompt. Best-effort. */
export async function saveWidget(prompt: string, spec: { title: string; description: string; html: string }): Promise<void> {
  const key = promptKey(prompt);
  if (!key) return;
  const values = { key, prompt: prompt.slice(0, 500), title: spec.title, description: spec.description, html: spec.html, version: LIBRARY_VERSION };
  await db.insert(aiVisualizerLibraryTable).values(values)
    .onConflictDoUpdate({ target: aiVisualizerLibraryTable.key, set: { ...values, updatedAt: new Date() } });
}
