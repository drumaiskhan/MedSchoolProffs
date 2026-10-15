// Sanity check for the AI Visualizer topic catalog (run: node --experimental-strip-types scripts/check-visualizer-catalog.mjs).
// Fails if the catalog has fewer than 5000 topics or if two topics collapse to the same saved-widget key
// (which would silently shrink the library). Pairs the library's fuzzy matcher would treat as
// "near-identical" are only reported: widgetLibrary.findSavedWidget matches catalog topics exactly, so
// those pairs never share a widget.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// The server sources use extensionless imports (bundled by esbuild); plain Node needs ".ts", so
// check a rewritten temp copy of the two pure modules.
const lib = join(dirname(fileURLToPath(import.meta.url)), "../artifacts/api-server/src/lib");
const tmp = mkdtempSync(join(tmpdir(), "catalog-check-"));
writeFileSync(join(tmp, "promptKey.ts"), readFileSync(join(lib, "promptKey.ts"), "utf8"));
writeFileSync(join(tmp, "visualizerCatalog.ts"), readFileSync(join(lib, "visualizerCatalog.ts"), "utf8").replace('"./promptKey"', '"./promptKey.ts"'));
const { getCatalog } = await import(pathToFileURL(join(tmp, "visualizerCatalog.ts")).href);
const { FUZZY_THRESHOLD, promptTokens, jaccard } = await import(pathToFileURL(join(tmp, "promptKey.ts")).href);

const topics = getCatalog();
const MIN = 5000;
const byKey = new Map();
const exact = [];
for (const t of topics) { const prev = byKey.get(t.key); if (prev) exact.push([prev, t]); else byKey.set(t.key, t); }

const toks = topics.map((t) => ({ t, tok: promptTokens(t.prompt) }));
const inverted = new Map();
toks.forEach((x, i) => x.tok.forEach((w) => { (inverted.get(w) ?? inverted.set(w, []).get(w)).push(i); }));
const fuzzy = [];
for (let i = 0; i < toks.length; i++) {
  const seen = new Set();
  for (const w of toks[i].tok) for (const j of inverted.get(w)) {
    if (j <= i || seen.has(j)) continue; seen.add(j);
    const { score, shared } = jaccard(toks[i].tok, toks[j].tok);
    if (shared >= 2 && score >= FUZZY_THRESHOLD) fuzzy.push([toks[i].t, toks[j].t, score]);
  }
}
const perDiscipline = {};
for (const t of topics) perDiscipline[t.discipline] = (perDiscipline[t.discipline] ?? 0) + 1;
console.log(`topics: ${topics.length}  unique keys: ${byKey.size}  exact collisions: ${exact.length}  fuzzy collisions: ${fuzzy.length}`);
console.log(perDiscipline);
for (const [a, b] of exact.slice(0, 25)) console.log("EXACT:", a.prompt, "<=>", b.prompt);
for (const [a, b, s] of fuzzy.slice(0, 5)) console.log("near-match (kept apart by the exact-only rule):", a.prompt, "<=>", b.prompt, s.toFixed(2));
if (topics.length < MIN || exact.length) { console.error("catalog check FAILED"); process.exit(1); }
console.log("catalog check passed");
