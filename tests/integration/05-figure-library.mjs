// v105: sanity checks for the ready-made figure library (dental + more body systems).
// Run: node tests/integration/05-figure-library.mjs
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const src = join(dirname(fileURLToPath(import.meta.url)), "../../artifacts/api-server/src/lib/figures");
const tmp = mkdtempSync(join(tmpdir(), "figs-"));
for (const f of readdirSync(src).filter((x) => x.endsWith(".ts"))) {
  writeFileSync(join(tmp, f), readFileSync(join(src, f), "utf8").replace(/from "\.\/([a-z0-9]+)"/g, 'from "./$1.ts"'));
}
const { FIGURES, selectFigures } = await import(pathToFileURL(join(tmp, "index.ts")).href);

let failed = 0;
const check = (ok, msg) => { if (!ok) { failed++; console.error("FAIL:", msg); } };

const NEW = new Set(["hs-tooth","hs-caries","hs-dentition","hs-tooth-germ","hs-tmj","hs-tongue","hs-salivary","hs-mandible","hs-sarcomere","hs-ear","hs-lymph-node","hs-thyroid","hs-long-bone","hs-reflex-arc"]);
check([...NEW].every((id) => FIGURES.some((f) => f.id === id)), "all v105 figures must be registered");
const ids = FIGURES.map((f) => f.id);
check(new Set(ids).size === ids.length, "figure ids must be unique");
for (const f of FIGURES) {
  check(/^hs-[a-z0-9-]+$/.test(f.id), `${f.id}: bad id`);
  if (NEW.has(f.id)) {
    check(f.tags.length >= 5, `${f.id}: needs at least 5 tags`);
    check(typeof f.notes === "string" && f.notes.length > 80, `${f.id}: needs landmark notes`);
  }
  check(f.w > 50 && f.h > 50, `${f.id}: bad size`);
  const opens = (f.svg.match(/<g[\s>]/g) || []).length, closes = (f.svg.match(/<\/g>/g) || []).length;
  check(opens === closes, `${f.id}: unbalanced <g> (${opens}/${closes})`);
  check(!/NaN|undefined/.test(f.svg), `${f.id}: NaN/undefined in svg`);
  check(!/<script|onclick|javascript:/i.test(f.svg), `${f.id}: unsafe content`);
  if (NEW.has(f.id)) for (const m of f.svg.matchAll(/url\(#([\w-]+)\)/g)) {
    const id = m[1];
    if (id.startsWith("hs-") && !/^hs-(gloss|shadow)/.test(id) && !f.svg.includes(`id="${id}"`)) check(false, `${f.id}: url(#${id}) has no definition`);
  }
}

const expect = {
  "Dental caries: pathogenesis": "hs-caries",
  "Periodontal ligament": "hs-tooth",
  "Tooth numbering systems": "hs-dentition",
  "Odontogenesis stages": "hs-tooth-germ",
  "Temporomandibular joint dislocation": "hs-tmj",
  "Parotid gland": "hs-salivary",
  "Inferior alveolar nerve block": "hs-mandible",
  "Tongue: taste pathway": "hs-tongue",
  "Sliding filament theory": "hs-sarcomere",
  "Cochlear mechanics": "hs-ear",
  "Lymph node structure": "hs-lymph-node",
  "Thyroid hormone synthesis": "hs-thyroid",
  "Rickets": "hs-long-bone",
  "Stretch reflex": "hs-reflex-arc",
};
for (const [prompt, id] of Object.entries(expect)) check(selectFigures(prompt).some((f) => f.id === id), `"${prompt}" should select ${id}`);
// generic words must not drag in the new figures
for (const prompt of ["Early diagnosis of cancer", "Action potential", "Hypersensitivity type I: mechanism", "Right upper quadrant pain", "Molarity of a buffer"]) {
  const bad = selectFigures(prompt).filter((f) => ["hs-ear", "hs-sarcomere", "hs-tooth", "hs-caries", "hs-dentition", "hs-tmj"].includes(f.id));
  check(bad.length === 0, `"${prompt}" wrongly selected ${bad.map((f) => f.id)}`);
}
console.log(failed ? `figure library check FAILED (${failed})` : `figure library check passed (${FIGURES.length} figures)`);
process.exit(failed ? 1 : 0);
