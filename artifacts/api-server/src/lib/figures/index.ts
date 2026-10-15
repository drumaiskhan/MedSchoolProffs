// Figure registry helpers — see data.ts for how the pieces fit together.
import { FIGURES, SHARED_DEFS, type Figure } from "./data";
import { FIGURE_ANIM_CSS, ANIMATION_NOTES, animateFigure } from "./animate";

const MAX_FIGURES_IN_PROMPT = 4;
const BY_ID = new Map<string, Figure>(FIGURES.map((f) => [f.id, f]));

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Prefix-boundary match so "ventricles" hits tag "ventricle" and "dna" doesn't hit "redundant".
const TAG_RES = new Map<string, RegExp>();
function tagRe(tag: string): RegExp {
  let re = TAG_RES.get(tag);
  if (!re) { re = new RegExp(`(^|[^a-z0-9])${esc(tag)}`, "i"); TAG_RES.set(tag, re); }
  return re;
}

/** The few figures that match the student's prompt, best first (max 4). */
export function selectFigures(prompt: string): Figure[] {
  const text = prompt.toLowerCase();
  const scored: Array<{ f: Figure; score: number }> = [];
  for (const f of FIGURES) {
    let score = 0;
    for (const tag of f.tags) if (tagRe(tag).test(text)) score += tag.includes(" ") ? 2 : 1;
    if (score > 0) scored.push({ f, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, MAX_FIGURES_IN_PROMPT).map((s) => s.f);
}

/** Prompt section describing only the matching figures (empty string when none match). */
export function figureGuide(figs: Figure[]): string {
  if (!figs.length) return "";
  const lines = figs.map((f) => `- #${f.id} — ${f.name}. Size ${f.w}x${f.h}. Colour variables: ${f.vars || "none"}. ${f.notes}${ANIMATION_NOTES[f.id] ? ` ${ANIMATION_NOTES[f.id]}` : ""}`);
  return `\n\nREADY-MADE FIGURES for this topic (detailed, shaded textbook illustrations ALREADY loaded in the page — use them instead of drawing your own; they look far better and save you output):\nPlace one with <svg viewBox="0 0 W H"><use href="#id" width="W" height="H"/> …your labels/arrows in the SAME W x H coordinates… </svg>, or inside a wider viewBox (e.g. "-100 0 500 H") with x/y/width/height on the <use> to position and scale it. A <use> may be repeated many times (e.g. blood cells as flow particles). Recolour parts with CSS variables in the <use> style attribute (style="--hs-xx:#hex") or live from JS with el.style.setProperty(). Put labels OUTSIDE the figure with thin leader lines, never on top of it. Figures marked ALREADY ANIMATED move on their own (beating, flowing, swimming...), so do NOT add msp-pulse/msp-float to them: just steer their speed with the CSS variables named in their line (set from your sliders, e.g. el.style.setProperty('--hs-beat', 60/hr+'s')). Add your own motion (msp-flow dashed paths, requestAnimationFrame shapes) only for the parts the figure does not cover.\n${lines.join("\n")}`;
}

/** Copy only the symbols the finished widget references into its HTML, so it is self-contained. */
export function embedFigures(html: string): string {
  const used = new Set<Figure>();
  for (const m of html.matchAll(/#(hs-[a-z0-9-]+)/g)) {
    const f = BY_ID.get(m[1]);
    if (f) used.add(f);
  }
  if (!used.size) return html;
  const symbols = [...used].map((f) => `<symbol id="${f.id}" viewBox="0 0 ${f.w} ${f.h}">${animateFigure(f.id, f.svg)}</symbol>`).join("");
  return `${FIGURE_ANIM_CSS}<svg width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false"><defs>${SHARED_DEFS}</defs>${symbols}</svg>\n${html}`;
}

export { FIGURES };
