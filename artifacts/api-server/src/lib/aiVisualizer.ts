/**
 * AI Visualizer (v60 — single-screen 3D scene).
 *
 * Turns a student's plain-language prompt about a medical process /
 * relationship into ONE structured, typed JSON "scene" (never executable
 * code). The frontend renders it with three.js: every structure is a 3D node
 * the student can click/drag/orbit, flows between structures are animated
 * links, and everything lives on a single screen — there are no steps.
 *
 * A multi-step mechanism (cardiac cycle, muscle contraction, ...) is
 * expressed as nodes + ordered links: each link carries an optional `order`
 * (1, 2, 3 ...) that the frontend shows as a numbered badge, so the sequence
 * is readable at a glance without any step navigation.
 *
 * Security posture (do not weaken):
 * - The AI only ever produces JSON matching SceneSpec below.
 * - Every string/array field has a `.max()` bound so an oversized or
 *   malformed response is rejected outright, never forwarded.
 * - No `eval`/`new Function` anywhere — the optional calculator formula is a
 *   small AST (FormulaNode) interpreted client-side.
 */

import { z } from "zod";
import { runPrompt, AiNotConfiguredError } from "./aiExplain";

export { AiNotConfiguredError };

// ---------------------------------------------------------------------------
// Schema — the AI may ONLY produce this. Anything else is rejected.
// ---------------------------------------------------------------------------

const SHAPES = ["sphere", "box", "cylinder", "torus", "cone", "capsule", "ellipsoid"] as const;
const LAYOUTS = ["auto", "ring", "line", "layers"] as const;

const SceneNode = z.object({
  id: z.string().min(1).max(40),
  // Short on purpose: labels are drawn next to the 3D object and must never
  // collide with each other. Long explanations belong in `description`.
  label: z.string().min(1).max(32),
  shape: z.enum(SHAPES),
  group: z.string().max(28).optional(),
  color: z.string().max(30).optional(),
  size: z.number().min(0.5).max(3).optional(),
  tag: z.string().max(18).optional(), // e.g. "Day 3", "Phase 2", "Type 1"
  description: z.string().min(1).max(420),
  facts: z.array(z.string().max(140)).max(5).optional(),
  // Optional AI-suggested position on a 0-100 cube. The client re-lays-out
  // when these are missing or crowded, so they are a hint, not a requirement.
  x: z.number().min(0).max(100).optional(),
  y: z.number().min(0).max(100).optional(),
  z: z.number().min(0).max(100).optional(),
});

const SceneLink = z.object({
  fromId: z.string().max(40),
  toId: z.string().max(40),
  label: z.string().max(36).optional(),
  style: z.enum(["solid", "dashed"]).optional(),
  flow: z.boolean().optional(), // false = static connection, no travelling particles
  order: z.number().int().min(1).max(60).optional(),
});

// Formulas are a small AST, never a string to eval().
const FormulaNode: z.ZodType<unknown> = z.lazy(() => z.union([
  z.object({ op: z.enum(["add", "subtract", "multiply", "divide"]), left: FormulaNode, right: FormulaNode }),
  z.object({ var: z.string().max(20) }),
  z.object({ const: z.number() }),
]));

const Calculator = z.object({
  displayFormula: z.string().max(80),
  variables: z.array(z.object({ name: z.string().max(20), label: z.string().max(60), unit: z.string().max(20).optional(), min: z.number(), max: z.number(), default: z.number(), step: z.number().optional() })).min(1).max(6),
  resultLabel: z.string().max(40),
  resultUnit: z.string().max(20).optional(),
  formula: FormulaNode,
});

export const VisualizationSpec = z.object({
  type: z.literal("scene"),
  title: z.string().max(160),
  description: z.string().max(500),
  layout: z.enum(LAYOUTS).optional(),
  cycle: z.boolean().optional(), // true when the sequence loops back to its start
  nodes: z.array(SceneNode).min(2).max(40),
  links: z.array(SceneLink).max(80),
  calculator: Calculator.optional(),
});
export type VisualizationSpecT = z.infer<typeof VisualizationSpec>;

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const SYSTEM_INSTRUCTIONS = `You are a medical education visualization generator for MedschoolProffs, an MBBS/BDS exam-prep platform. A student describes a physiological, anatomical, pharmacological, or biochemical process or relationship. You respond with ONLY one valid JSON object — no prose, no markdown fences — describing a SINGLE interactive 3D SCENE that is shown on ONE screen. There are no steps and no pages: the student sees every structure at once, rotates the scene, clicks any structure to read about it, and watches particles flow along the links.

MEDICAL ACCURACY RULES (do not violate):
- Standard textbook physiology/anatomy/pharmacology only. Do not invent mechanisms, structures, or sequences.
- Preserve the correct physiological sequence exactly (use link "order" for sequences).
- Use correct standard terminology (audience: medical students).
- If something is genuinely debated, say so briefly in that node's description.

JSON SHAPE (use these field names verbatim; add nothing else):
{
 "type":"scene",
 "title":"...", "description":"1-2 sentence overview",
 "layout":"auto"|"ring"|"line"|"layers",
 "cycle":false,
 "nodes":[{"id":"sr","label":"Sarcoplasmic reticulum","shape":"sphere","group":"Organelles","color":"#3b82f6","size":1.4,"tag":"Phase 1","description":"2-4 exam-focused sentences about this structure and its role.","facts":["Short high-yield fact","Another fact"],"x":20,"y":60,"z":40}],
 "links":[{"fromId":"sr","toId":"troponin","label":"Ca2+ release","style":"solid","flow":true,"order":1}],
 "calculator":{"displayFormula":"CO = HR x SV","variables":[{"name":"HR","label":"Heart Rate","unit":"bpm","min":40,"max":180,"default":70,"step":1}],"resultLabel":"Cardiac Output","resultUnit":"L/min","formula":{"op":"multiply","left":{"var":"HR"},"right":{"var":"SV"}}}
}

NODE RULES:
- Between 4 and 24 nodes is ideal (hard max 40). Each node is ONE structure, molecule, event, phase, drug, organ, or item being compared.
- "id": unique, short, no spaces. "label": SHORT — at most 3 words / 32 characters. The label is drawn beside the 3D object, so long labels cause clutter; put detail in "description" and "facts" instead.
- "shape" must be EXACTLY one of: sphere, box, cylinder, torus, cone, capsule, ellipsoid. Choose meaningfully: sphere = cell/molecule/ion/compartment, ellipsoid = organ/chamber, box = barrier/tissue/table cell, cylinder = vessel/duct/tubule/filament, torus = ring/channel/pore/receptor, cone = direction/outflow/drug, capsule = rod-like structure/neuron/bacterium.
- "group": a short category (e.g. "Ions", "Proteins", "Phase 1", "Type 1 DM"). Nodes of the same group get the same colour and cluster together, and the groups become a clickable legend. Use 2-6 groups. For a COMPARISON, make one group per compared item and make every item list the same kinds of nodes (e.g. Onset, Mechanism, Treatment) so they line up.
- "size" 0.5-3 (importance; default 1). "tag" optional short badge (a time point, phase name).
- "facts": up to 5 short high-yield bullet facts per node (each under 140 characters).
- "x","y","z" optional (0-100 cube). If you give positions, spread nodes across the whole cube with at least 15 units between any two nodes; if unsure, omit them — the client lays the scene out automatically.

LINK RULES:
- A link is a directed relationship or flow from one node to another (movement, activation, inhibition, causation, next phase). fromId/toId must be existing node ids.
- "label": at most 3 words / 36 characters, or omit. "order": 1,2,3... for the sequence of a process (every link of a sequential process should have an order; omit for non-sequential relationships). "flow": true (default) shows travelling particles; false for static anatomical connections. "style": "solid" or "dashed" (dashed = indirect/inhibitory/weak).
- At most about 2 links per node on average; do not connect everything to everything.

LAYOUT CHOICE: "ring" for cycles (set "cycle":true), "line" for timelines/linear pathways, "layers" for comparisons or hierarchies (one layer per group), otherwise "auto".

CALCULATOR (optional): include ONLY when the request is about a quantitative relationship the student should explore (e.g. "cardiac output", "Fick principle", "how preload affects stroke volume"). Variables are sliders; formula is an operation tree made ONLY of {"op":"add"|"subtract"|"multiply"|"divide","left":<node>,"right":<node>}, {"var":"NAME"} (must match a variable name), {"const":number}. Never a string expression. The scene itself must still be a meaningful diagram of the structures involved. Omit "calculator" otherwise.

For graphs/timelines/comparisons: represent each time point / compared item as nodes (use "tag" for time or value, "group" for series/item) — do not invent another structure.

Respond with ONLY the JSON object.`;

function buildPrompt(userPrompt: string): string {
  return `${SYSTEM_INSTRUCTIONS}\n\nStudent's request: "${userPrompt}"\n\nRespond with ONLY the JSON object described above.`;
}

function stripFences(raw: string): string {
  return raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
}

export class InvalidVisualizationError extends Error {
  // `raw` carries the offending text so callers can log it for admin diagnosis
  // (routes/ai-visualizer.ts writes it into aiVisualizerLogsTable.rawResponse).
  constructor(public issues: string, public raw?: string) { super(`AI returned an invalid visualization: ${issues}`); this.name = "InvalidVisualizationError"; }
}

const MAX_PROMPT_LENGTH = 500;
// A 3D scene with ~20 nodes (each with description + facts) is smaller than
// the old 20-step process JSON, so the previous budgets are plenty. The API
// sits behind a reverse proxy with its own timeout, so the retry only runs
// when there's realistically time left (see MAX_TOTAL_GENERATION_MS).
const VISUALIZATION_MAX_TOKENS = 4500;
const VISUALIZATION_RETRY_MAX_TOKENS = 6000;
const MAX_TOTAL_GENERATION_MS = 22_000;

function looksTruncated(cleaned: string): boolean {
  const t = cleaned.trimEnd();
  return t.length > 0 && !t.endsWith("}");
}

function tryParse(cleaned: string): unknown | undefined {
  try { return JSON.parse(cleaned); } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return undefined;
    try { return JSON.parse(match[0]); } catch { return undefined; }
  }
}

// ---------------------------------------------------------------------------
// Normalisation — defence in depth for what the prompt doesn't guarantee.
// Only normalises enum aliases, clamps numbers, de-duplicates ids and drops
// dangling links. It never widens the schema or adds capability.
// ---------------------------------------------------------------------------

const SHAPE_ALIASES: Record<string, (typeof SHAPES)[number]> = {
  circle: "sphere", ball: "sphere", cell: "sphere", orb: "sphere", oval: "ellipsoid", ellipse: "ellipsoid", egg: "ellipsoid",
  rect: "box", square: "box", cube: "box", rectangle: "box", diamond: "box",
  tube: "cylinder", pipe: "cylinder", vessel: "cylinder", line: "cylinder", rod: "capsule",
  ring: "torus", donut: "torus", doughnut: "torus", triangle: "cone", pyramid: "cone", arrow: "cone",
  polygon: "box", path: "cylinder", star: "cone", hexagon: "box", pentagon: "box",
};
const VALID_SHAPES = new Set<string>(SHAPES);

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const cut = (v: unknown, n: number): string | undefined => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : undefined);

function normalizeScene(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  const rec = { ...(parsed as Record<string, unknown>) };
  if (!Array.isArray(rec.nodes)) return rec;

  const seen = new Set<string>();
  const nodes: Record<string, unknown>[] = [];
  for (const raw of rec.nodes) {
    if (!raw || typeof raw !== "object") continue;
    const n = { ...(raw as Record<string, unknown>) };
    let id = cut(n.id, 40)?.replace(/\s+/g, "_");
    if (!id) continue;
    if (seen.has(id)) { let k = 2; while (seen.has(`${id.slice(0, 36)}_${k}`)) k++; id = `${id.slice(0, 36)}_${k}`; }
    seen.add(id);
    n.id = id;
    n.label = cut(n.label, 32) ?? id;
    const shape = typeof n.shape === "string" ? n.shape.toLowerCase() : "";
    n.shape = VALID_SHAPES.has(shape) ? shape : SHAPE_ALIASES[shape] ?? "sphere";
    n.description = cut(n.description, 420) ?? n.label;
    if (n.group !== undefined) n.group = cut(n.group, 28);
    if (n.tag !== undefined) n.tag = cut(n.tag, 18);
    if (n.color !== undefined) n.color = cut(n.color, 30);
    const size = num(n.size); n.size = size === undefined ? undefined : clamp(size, 0.5, 3);
    for (const k of ["x", "y", "z"] as const) { const v = num(n[k]); n[k] = v === undefined ? undefined : clamp(v, 0, 100); }
    if (Array.isArray(n.facts)) n.facts = n.facts.filter((f) => typeof f === "string" && f.trim()).slice(0, 5).map((f) => (f as string).slice(0, 140));
    else delete n.facts;
    nodes.push(n);
  }
  rec.nodes = nodes.slice(0, 40);

  const ids = new Set(nodes.map((n) => n.id as string));
  rec.links = (Array.isArray(rec.links) ? rec.links : [])
    .filter((l): l is Record<string, unknown> => !!l && typeof l === "object")
    .map((l) => {
      const out = { ...l };
      if (typeof out.label === "string") out.label = out.label.slice(0, 36);
      const order = num(out.order); out.order = order === undefined ? undefined : clamp(Math.round(order), 1, 60);
      return out;
    })
    .filter((l) => typeof l.fromId === "string" && typeof l.toId === "string" && ids.has(l.fromId as string) && ids.has(l.toId as string) && l.fromId !== l.toId)
    .slice(0, 80);

  rec.type = "scene";
  return rec;
}

async function attemptGeneration(prompt: string, maxTokens: number): Promise<{ raw: string; spec?: VisualizationSpecT; truncated: boolean; issues?: string }> {
  const raw = await runPrompt(prompt, maxTokens, "object");
  const cleaned = stripFences(raw);
  const parsedJson = tryParse(cleaned);
  if (parsedJson === undefined) return { raw, truncated: looksTruncated(cleaned), issues: "Response was not valid JSON" };
  const result = VisualizationSpec.safeParse(normalizeScene(parsedJson));
  if (!result.success) {
    return { raw, truncated: looksTruncated(cleaned), issues: result.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  return { raw, spec: result.data, truncated: false };
}

export async function generateVisualization(userPrompt: string): Promise<VisualizationSpecT> {
  const trimmed = userPrompt.trim().slice(0, MAX_PROMPT_LENGTH);
  if (!trimmed) throw new InvalidVisualizationError("Prompt was empty");

  const startedAt = Date.now();
  const first = await attemptGeneration(buildPrompt(trimmed), VISUALIZATION_MAX_TOKENS);
  if (first.spec) return first.spec;

  // Fail fast if the first attempt already used most of the proxy-safe budget.
  const elapsed = Date.now() - startedAt;
  if (elapsed > MAX_TOTAL_GENERATION_MS * 0.5) {
    throw new InvalidVisualizationError(
      first.truncated ? "Response was too long to complete in time — try a simpler or more specific prompt." : (first.issues ?? "Response was not valid JSON"),
      first.raw,
    );
  }

  const retryPrompt = first.truncated
    ? `${buildPrompt(trimmed)}\n\nIMPORTANT: Your previous response was cut off before it was valid JSON. Use at most 14 nodes, keep every description under 250 characters, at most 2 facts per node, and close every object and array.`
    : `${buildPrompt(trimmed)}\n\nIMPORTANT: Your previous response had these validation errors: ${first.issues}. Fix them and return complete, valid JSON matching the schema exactly (shape must be one of sphere, box, cylinder, torus, cone, capsule, ellipsoid; label at most 32 characters).`;
  const second = await attemptGeneration(retryPrompt, first.truncated ? VISUALIZATION_RETRY_MAX_TOKENS : VISUALIZATION_MAX_TOKENS);
  if (second.spec) return second.spec;
  throw new InvalidVisualizationError(second.issues ?? "Response was not valid JSON", second.raw);
}

// Optional "Explain deeper" button on a selected part — a short, ephemeral
// text explanation (same pattern as generateExplanation), not a new scene.
// Kept under its original name/signature so the route + client contract
// (/ai/visualizer/explain-step) did not change.
export async function explainStep(stepTitle: string, stepDescription: string, overallTitle: string): Promise<string> {
  const prompt = [
    `You are helping a medical student understand one part of an interactive 3D visualization titled "${overallTitle}".`,
    `The part is: "${stepTitle}" — ${stepDescription}`,
    "Explain this specific part in more depth, in under 120 words, at MBBS/BDS level. Use correct medical terminology. Do not use markdown headers.",
  ].join("\n");
  return runPrompt(prompt, 400);
}
