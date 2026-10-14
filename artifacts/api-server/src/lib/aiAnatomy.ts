/**
 * AI Visualizer — anatomy "model" mode (v61).
 *
 * The v60 visualizer only knew one thing: a graph of floating nodes joined by
 * links. That is right for processes and comparisons, but for "draw the tibia
 * with its parts labelled" it produced dots and cubes. This module adds a
 * second spec, `type: "model"`: a SOLID, STATIC 3D model assembled from
 * parametric parts (lathe-turned bones, tubes for vessels, super-ellipsoids for
 * organ lobes...) with atlas-style labels. The student only rotates/zooms it.
 *
 * Security posture is unchanged: the AI emits JSON only, every field is
 * bounded, nothing is ever evaluated. Geometry is built client-side from
 * numbers (see frontend-student/.../modelMesh.ts).
 *
 * Routing (generateAny): a plain request for a structure ("tibia", "draw the
 * heart", "labelled kidney") -> model; a process/comparison/formula -> the
 * existing scene generator. The student can also force either mode.
 */

import { z } from "zod";
import { runPrompt } from "./aiExplain";
import { generateWidget, type WidgetSpecT } from "./aiWidget";
import { generateVisualization, InvalidVisualizationError, type VisualizationSpecT } from "./aiVisualizer";
import { findCuratedModel, TIBIA_MODEL } from "./anatomyLibrary";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const FORMS = ["lathe", "tube", "ellipsoid", "sphere", "box", "cylinder", "cone", "torus", "capsule"] as const;
const FINISHES = ["bone", "soft", "glossy", "matte"] as const;

const coord = z.number().min(-400).max(400);
const Vec3 = z.tuple([coord, coord, coord]);

const ModelPart = z.object({
  id: z.string().min(1).max(40),
  label: z.string().min(1).max(32),
  form: z.enum(FORMS),
  group: z.string().max(28).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  finish: z.enum(FINISHES).optional(),
  description: z.string().min(1).max(420),
  facts: z.array(z.string().max(140)).max(5).optional(),
  position: Vec3.optional(),
  rotation: Vec3.optional(),
  scale: Vec3.optional(),
  size: Vec3.optional(),
  profile: z.array(z.tuple([coord, z.number().min(0).max(200)])).min(2).max(24).optional(),
  caps: z.enum(["round", "flat"]).optional(),
  path: z.array(Vec3).min(2).max(16).optional(),
  radii: z.array(z.number().min(0.05).max(100)).min(1).max(16).optional(),
  lobes: z.number().int().min(0).max(6).optional(),
  lobeAmount: z.number().min(0).max(0.6).optional(),
  lobePhase: z.number().min(-360).max(360).optional(),
  twist: z.number().min(-360).max(360).optional(),
  bump: z.number().min(0).max(1).optional(),
  opacity: z.number().min(0.15).max(1).optional(),
  anchor: Vec3.optional(),
  hideLabel: z.boolean().optional(),
});

export const ModelSpec = z.object({
  type: z.literal("model"),
  title: z.string().max(160),
  description: z.string().max(500),
  parts: z.array(ModelPart).min(1).max(30),
});
export type ModelSpecT = z.infer<typeof ModelSpec>;
export type AnyVisualizationT = VisualizationSpecT | ModelSpecT | WidgetSpecT;

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

// A tiny excerpt of the curated tibia so the model sees real, working numbers.
const EXAMPLE_PARTS = JSON.stringify(
  TIBIA_MODEL.parts
    .filter((p) => ["shaft", "med_condyle", "ant_border", "foramen"].includes(p.id))
    .map((p) => ({ ...p, description: p.description.slice(0, 120), facts: (p.facts ?? []).slice(0, 2) })),
);

const MODEL_INSTRUCTIONS = `You are a medical anatomy 3D modeller for MedschoolProffs, an MBBS/BDS exam-prep platform. A student asks to see a body structure (a bone, organ, joint, vessel tree, muscle, brain region, tooth, etc.). You respond with ONLY one valid JSON object — no prose, no markdown fences — describing a SOLID, STATIC, REALISTIC-LOOKING 3D MODEL built from parametric parts. The student will rotate it by hand and tap parts to read about them. It must look like an anatomy-atlas model, NOT a diagram: no floating dots, no boxes joined by lines. Parts must TOUCH and OVERLAP so they read as one continuous object.

ACCURACY RULES (do not violate):
- Standard textbook human anatomy only: correct proportions, correct relative positions, correct sidedness, correct terminology. Do not invent structures.
- Name the labelled parts exactly as an anatomy atlas would (e.g. "Medial malleolus", "Left ventricle", "Ascending aorta").

JSON SHAPE:
{"type":"model","title":"Tibia (right) — anterior view","description":"1-2 sentence overview","parts":[ PART, PART, ... ]}

COORDINATES: +Y is superior (up), +Z is anterior (toward the viewer), +X is the model's left (viewer's right in anterior view). Centre the model near the origin and make its LONGEST dimension about 100 units, so relative proportions are realistic (a tibia is ~100 long and only ~20 wide at its widest).

PART FIELDS:
"id" (short, unique, no spaces), "label" (<=32 chars, atlas name), "form", "group" (short category used for the parts list), "color" (hex like "#e7dcc3"), "finish", "description" (2-4 exam-focused sentences about THIS structure), "facts" (up to 4 short high-yield bullets), plus geometry fields below.
"form" is exactly one of:
- "lathe": a solid of revolution around the part's own Y axis from "profile": [[y,radius],...] (2-24 points, listed bottom to top; the surface is smoothed through them). Use for bone shafts, epiphyses, bottle/flask shapes, teeth, ventricles of revolution. Optional "caps":"round" (default, closed dome ends) or "flat".
- "tube": a rounded tube along "path": [[x,y,z],...] (2-16 points) with "radii":[r,...] (one value = constant; several = tapering evenly along the path). Use for vessels, nerves, ligaments, tendons, ridges, bronchi, ducts, the colon.
- "ellipsoid" / "sphere" / "box" / "cylinder" / "cone" / "capsule" / "torus": a primitive with "size":[width(x),height(y),depth(z)] (full extents; torus = [outer diameter, tube diameter, _]). Use ellipsoids for lobes, chambers, condyles, tubercles, whole organs. Boxes/cylinders have softly rounded edges.
PLACEMENT (all optional): "position":[x,y,z], "rotation":[rx,ry,rz] in DEGREES, "scale":[sx,sy,sz] (use to flatten a lathe into an oval cross-section).
SHAPING (optional): "lobes":3,"lobeAmount":0.16,"lobePhase":90 gives a lathe/tube a 3-sided (or 2/4/5-sided) cross-section — e.g. a triangular bone shaft; "twist" (degrees over the part length); "bump":0-1 adds natural organic surface irregularity (use 0.1-0.35 on organs and bone ends; 0 for smooth glassy parts); "opacity":0.15-1 for translucent structures (membranes, lungs over the heart).
"finish": "bone" (dry, matte-satin), "soft" (organs, muscle — default), "glossy" (cartilage, vessels, wet surfaces), "matte". "hideLabel":true for supporting bulk parts that need no label. "anchor":[x,y,z] (optional) = the exact surface point the label's leader line should touch; omit it and the client finds one.

HOW TO BUILD REALISTIC MODELS:
- Build the main body first as one or a few large smooth parts (a lathe for a long bone, overlapping ellipsoids with bump 0.15-0.3 for an organ), then add every labelled landmark as its own part that is HALF-EMBEDDED in the main surface (centre it on the surface so it protrudes a little): a tubercle = small ellipsoid, a ridge/line/border = thin tube lying on the surface, a foramen/notch/groove = small darker ellipsoid sunk into the surface (darker colour, finish "matte"), an articular surface = thin glossy pale-blue ellipsoid on the joint face.
- Organs: compose from several overlapping ellipsoids/lathes (e.g. heart = 4 chambers as overlapping ellipsoids tilted ~ -30 degrees, plus the great vessels as tubes leaving the base, coronary arteries as thin tubes over the surface). Hollow organs and vessels: tubes with sensible taper and gentle curves.
- Colour realistically: bone #e7dcc3, cartilage #a8cbd8, muscle #b5483f, arteries #c0392b, veins #3b5a9d, nerves #e8d77a, liver #8c3b2e, lung #d9a3a0, brain #d8b4a6, fat #e9d27a, tendon/ligament #e8e2d0. Use contrasting-but-natural colours for adjacent labelled parts so they are distinguishable.
- Use 8-24 parts. Every part needs a non-empty description. Give each important landmark its own part and label.
- Keep numbers plain (no expressions). Keep "profile" and "path" arrays short (<= 12 points is usually enough).

REFERENCE (valid parts from a correct right-tibia model, for format and scale only — do NOT copy them unless asked for the tibia):
${EXAMPLE_PARTS}

Respond with ONLY the JSON object.`;

function buildModelPrompt(userPrompt: string): string {
  return `${MODEL_INSTRUCTIONS}\n\nStudent's request: "${userPrompt}"\n\nRespond with ONLY the JSON object described above.`;
}

// ---------------------------------------------------------------------------
// Normalisation (defence in depth — never widens the schema)
// ---------------------------------------------------------------------------

const FORM_ALIASES: Record<string, (typeof FORMS)[number]> = {
  revolve: "lathe", revolution: "lathe", surface_of_revolution: "lathe", sweep: "tube", pipe: "tube", vessel: "tube", cable: "tube", curve: "tube",
  oval: "ellipsoid", ellipse: "ellipsoid", blob: "ellipsoid", lobe: "ellipsoid", egg: "ellipsoid", ball: "sphere", orb: "sphere",
  cube: "box", block: "box", rect: "box", rectangle: "box", prism: "box", disc: "cylinder", disk: "cylinder", rod: "capsule", ring: "torus", donut: "torus", pyramid: "cone",
};
const VALID_FORMS = new Set<string>(FORMS);
const FINISH_ALIASES: Record<string, (typeof FINISHES)[number]> = { glass: "glossy", shiny: "glossy", wet: "glossy", wetgloss: "glossy", dry: "bone", organ: "soft", muscle: "soft", flat: "matte", rough: "matte" };

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const cut = (v: unknown, n: number): string | undefined => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : undefined);

function vec3(v: unknown, lo = -400, hi = 400): [number, number, number] | undefined {
  if (!Array.isArray(v) || v.length < 3) return undefined;
  const a = [num(v[0]), num(v[1]), num(v[2])];
  if (a.some((x) => x === undefined)) return undefined;
  return a.map((x) => clamp(x as number, lo, hi)) as [number, number, number];
}

function normalizeModel(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  const rec = { ...(parsed as Record<string, unknown>) };
  if (!Array.isArray(rec.parts)) return rec;

  const seen = new Set<string>();
  const parts: Record<string, unknown>[] = [];
  for (const raw of rec.parts) {
    if (!raw || typeof raw !== "object") continue;
    const p = { ...(raw as Record<string, unknown>) };
    let id = cut(p.id, 40)?.replace(/\s+/g, "_");
    if (!id) continue;
    if (seen.has(id)) { let k = 2; while (seen.has(`${id.slice(0, 36)}_${k}`)) k++; id = `${id.slice(0, 36)}_${k}`; }
    seen.add(id);
    const out: Record<string, unknown> = { id };
    out.label = cut(p.label, 32) ?? id;
    const form = typeof p.form === "string" ? p.form.toLowerCase().replace(/[\s-]+/g, "_") : "";
    out.form = VALID_FORMS.has(form) ? form : FORM_ALIASES[form] ?? "ellipsoid";
    out.description = cut(p.description, 420) ?? String(out.label);
    const group = cut(p.group, 28); if (group) out.group = group;
    if (typeof p.color === "string") { const c = p.color.trim(); if (/^#[0-9a-fA-F]{6}$/.test(c)) out.color = c; else if (/^#[0-9a-fA-F]{3}$/.test(c)) out.color = `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`; }
    if (typeof p.finish === "string") { const f = p.finish.toLowerCase(); const fin = (FINISHES as readonly string[]).includes(f) ? f : FINISH_ALIASES[f]; if (fin) out.finish = fin; }
    if (Array.isArray(p.facts)) { const f = p.facts.filter((x) => typeof x === "string" && x.trim()).slice(0, 5).map((x) => (x as string).slice(0, 140)); if (f.length) out.facts = f; }
    for (const k of ["position", "rotation", "scale", "size", "anchor"] as const) {
      const lim = k === "scale" ? [0.05, 20] : k === "size" ? [0.2, 400] : k === "rotation" ? [-720, 720] : [-400, 400];
      const v = vec3(p[k], lim[0], lim[1]); if (v) out[k] = v;
    }
    if (Array.isArray(p.profile)) {
      const pr = p.profile.map((q) => (Array.isArray(q) && q.length >= 2 && num(q[0]) !== undefined && num(q[1]) !== undefined ? [clamp(q[0] as number, -400, 400), clamp(q[1] as number, 0, 200)] : null)).filter(Boolean).slice(0, 24);
      if (pr.length >= 2) out.profile = pr;
    }
    if (p.caps === "flat" || p.caps === "round") out.caps = p.caps;
    if (Array.isArray(p.path)) {
      const path = p.path.map((q) => vec3(q)).filter(Boolean).slice(0, 16);
      if (path.length >= 2) out.path = path;
    }
    if (Array.isArray(p.radii)) {
      const radii = p.radii.map(num).filter((r): r is number => r !== undefined && r > 0).slice(0, 16).map((r) => clamp(r, 0.05, 100));
      if (radii.length) out.radii = radii;
    } else if (num(p.radii) !== undefined && (p.radii as number) > 0) out.radii = [clamp(p.radii as number, 0.05, 100)];
    // A lathe/tube without its geometry would render as a stub — fall back to a primitive.
    if (out.form === "lathe" && !out.profile) out.form = "ellipsoid";
    if (out.form === "tube" && !out.path) out.form = "capsule";
    const lobes = num(p.lobes); if (lobes !== undefined) out.lobes = clamp(Math.round(lobes), 0, 6);
    const la = num(p.lobeAmount); if (la !== undefined) out.lobeAmount = clamp(la, 0, 0.6);
    const lp = num(p.lobePhase); if (lp !== undefined) out.lobePhase = clamp(lp, -360, 360);
    const tw = num(p.twist); if (tw !== undefined) out.twist = clamp(tw, -360, 360);
    const bump = num(p.bump); if (bump !== undefined) out.bump = clamp(bump, 0, 1);
    const op = num(p.opacity); if (op !== undefined) out.opacity = clamp(op, 0.15, 1);
    if (typeof p.hideLabel === "boolean") out.hideLabel = p.hideLabel;
    parts.push(out);
  }
  rec.parts = parts.slice(0, 30);
  rec.type = "model";
  if (typeof rec.title !== "string") rec.title = "Anatomy model";
  if (typeof rec.description !== "string") rec.description = "";
  return rec;
}

// ---------------------------------------------------------------------------
// Generation (same retry/time-budget pattern as the scene generator)
// ---------------------------------------------------------------------------

const MAX_PROMPT_LENGTH = 500;
const MODEL_MAX_TOKENS = 6500;
const MODEL_RETRY_MAX_TOKENS = 8000;
const MAX_TOTAL_GENERATION_MS = 30_000;

const stripFences = (raw: string) => raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
const looksTruncated = (cleaned: string) => { const t = cleaned.trimEnd(); return t.length > 0 && !t.endsWith("}"); };
function tryParse(cleaned: string): unknown | undefined {
  try { return JSON.parse(cleaned); } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return undefined;
    try { return JSON.parse(match[0]); } catch { return undefined; }
  }
}

async function attempt(prompt: string, maxTokens: number): Promise<{ raw: string; spec?: ModelSpecT; truncated: boolean; issues?: string }> {
  const raw = await runPrompt(prompt, maxTokens, "object");
  const cleaned = stripFences(raw);
  const json = tryParse(cleaned);
  if (json === undefined) return { raw, truncated: looksTruncated(cleaned), issues: "Response was not valid JSON" };
  const result = ModelSpec.safeParse(normalizeModel(json));
  if (!result.success) return { raw, truncated: looksTruncated(cleaned), issues: result.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  return { raw, spec: result.data, truncated: false };
}

export async function generateModel(userPrompt: string): Promise<ModelSpecT> {
  const trimmed = userPrompt.trim().slice(0, MAX_PROMPT_LENGTH);
  if (!trimmed) throw new InvalidVisualizationError("Prompt was empty");

  const startedAt = Date.now();
  const first = await attempt(buildModelPrompt(trimmed), MODEL_MAX_TOKENS);
  if (first.spec) return first.spec;

  if (Date.now() - startedAt > MAX_TOTAL_GENERATION_MS * 0.5) {
    throw new InvalidVisualizationError(
      first.truncated ? "Response was too long to complete in time — try a simpler or more specific prompt." : (first.issues ?? "Response was not valid JSON"),
      first.raw,
    );
  }
  const retryPrompt = first.truncated
    ? `${buildModelPrompt(trimmed)}\n\nIMPORTANT: Your previous response was cut off. Use at most 12 parts, keep every description under 220 characters, at most 2 facts per part, keep profile/path arrays under 8 points, and close every object and array.`
    : `${buildModelPrompt(trimmed)}\n\nIMPORTANT: Your previous response had these validation errors: ${first.issues}. Fix them and return complete, valid JSON matching the schema exactly (form must be one of ${FORMS.join(", ")}; label at most 32 characters; colours as #rrggbb).`;
  const second = await attempt(retryPrompt, first.truncated ? MODEL_RETRY_MAX_TOKENS : MODEL_MAX_TOKENS);
  if (second.spec) return second.spec;
  throw new InvalidVisualizationError(second.issues ?? "Response was not valid JSON", second.raw);
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

export type VisualizerMode = "auto" | "model" | "scene" | "widget";

const PROCESS_RE = /\b(cycle|mechanism|pathway|process|pathophysiolog\w*|sequence|steps?|compare|comparison|versus|vs\.?|differences?|regulation|cascade|formula|equation|calculat\w*|cardiac output|action potential|contraction|filtration|reabsorption|secretion|synthesis|metabolism|feedback|reflex|conduction|transmission|clotting|coagulation|inflammation|flow of|how does|how do)\b/i;
const ANATOMY_RE = /\b(anatom\w*|bones?|tibia|fibula|femur|humerus|radius|ulna|skull|cranium|mandible|vertebra\w*|spine|scapula|clavicle|pelvi\w*|ribs?|ribcage|sternum|patella|talus|calcaneus|carpal|tarsal|heart|lungs?|liver|kidneys?|brain|cerebell\w*|stomach|intestine|colon|bladder|uterus|ovary|spleen|pancreas|thyroid|eyeball|eye|ear|larynx|trachea|bronch\w*|tooth|teeth|molar|muscle|joint|knee|shoulder|hip|ankle|elbow|wrist|hand|foot|aorta|artery|arteries|vein|veins|nerve|labell?ed|parts of|structure of|model of|draw|diagram of)\b/i;
const FORCE_MODEL_RE = /\b(labell?ed|label the|draw|model of|parts of|anatomy of|real|realistic|3d model)\b/i;

export function pickMode(prompt: string, mode: VisualizerMode = "auto"): "model" | "scene" | "widget" {
  // v69: flat interactive 2D widgets are the default for everything. The 3D
  // model / scene generators remain reachable only by explicitly forcing them.
  if (mode === "model") return "model";
  if (mode === "scene") return "scene";
  if (mode === "widget" || mode === "auto") return "widget";
  const process = PROCESS_RE.test(prompt);
  const anatomy = ANATOMY_RE.test(prompt);
  if (anatomy && (!process || FORCE_MODEL_RE.test(prompt))) return "model";
  return "scene";
}

export async function generateAny(userPrompt: string, mode: VisualizerMode = "auto"): Promise<AnyVisualizationT> {
  const chosen = pickMode(userPrompt, mode);
  if (chosen === "widget") return generateWidget(userPrompt);
  if (chosen === "model") {
    const curated = findCuratedModel(userPrompt);
    if (curated) return ModelSpec.parse(curated);
    return generateModel(userPrompt);
  }
  return generateVisualization(userPrompt);
}
