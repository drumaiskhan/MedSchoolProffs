// Saved library of generated AI Visualizer widgets (v81).
//
// Every successful widget is saved under a normalised key built from the student's prompt. The
// next time anyone asks for the same (or a near-identical) topic, the saved widget is served
// straight from the database: no AI call, no tokens, instant. Bump LIBRARY_VERSION to retire
// every saved widget at once (e.g. after a big prompt/figure improvement); admins can also delete
// single entries or clear the library from Admin -> AI Visualizer activity.
import { and, desc, eq, sql } from "drizzle-orm";
import { db, aiVisualizerLibraryTable } from "@workspace/db";

export const LIBRARY_VERSION = 1;
const MAX_KEY_LENGTH = 240;
const FUZZY_THRESHOLD = 0.8; // Jaccard similarity of the significant words
const MAX_FUZZY_ROWS = 4000;

// Words that don't change WHAT is being visualised.
const STOP = new Set(("a an the of and or in on at to for with from by into as is are was were be been it its this that these those " +
  "show shows showing me my us our please can could would should you your i we explain explains explanation visualize visualise " +
  "visualization visualisation interactive diagram animation animated simulation simulator simulate demonstrate demo draw make create " +
  "build give about how what why when does do did work works working vs versus between using use via").split(" "));

function stem(w: string): string { return w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w; }

export function promptTokens(prompt: string): string[] {
  const words = prompt.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim().split(" ");
  return [...new Set(words.filter((w) => w && !STOP.has(w)).map(stem))].sort();
}

export function promptKey(prompt: string): string { return promptTokens(prompt).join(" ").slice(0, MAX_KEY_LENGTH); }

function jaccard(a: string[], b: string[]): { score: number; shared: number } {
  const B = new Set(b); let shared = 0;
  for (const x of a) if (B.has(x)) shared++;
  const union = a.length + b.length - shared;
  return { score: union ? shared / union : 0, shared };
}

export interface SavedWidget { id: number; title: string; description: string; html: string }

/** A saved widget for this prompt (exact normalised match, else a very close one), or null. */
export async function findSavedWidget(prompt: string): Promise<SavedWidget | null> {
  const tokens = promptTokens(prompt);
  if (!tokens.length) return null;
  const key = tokens.join(" ").slice(0, MAX_KEY_LENGTH);
  const exact = await db.select().from(aiVisualizerLibraryTable)
    .where(and(eq(aiVisualizerLibraryTable.key, key), eq(aiVisualizerLibraryTable.version, LIBRARY_VERSION))).limit(1);
  let hit = exact[0];
  if (!hit) {
    const rows = await db.select({ id: aiVisualizerLibraryTable.id, key: aiVisualizerLibraryTable.key })
      .from(aiVisualizerLibraryTable).where(eq(aiVisualizerLibraryTable.version, LIBRARY_VERSION))
      .orderBy(desc(aiVisualizerLibraryTable.hits)).limit(MAX_FUZZY_ROWS);
    let best: { id: number; score: number } | null = null;
    for (const r of rows) {
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
