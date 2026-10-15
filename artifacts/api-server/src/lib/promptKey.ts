// Pure (no database) prompt normalisation shared by the saved widget library and the visualizer
// topic catalog, so the two always agree on what counts as "the same topic".
export const MAX_KEY_LENGTH = 240;
export const FUZZY_THRESHOLD = 0.8; // Jaccard similarity of the significant words

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

export function jaccard(a: string[], b: string[]): { score: number; shared: number } {
  const B = new Set(b); let shared = 0;
  for (const x of a) if (B.has(x)) shared++;
  const union = a.length + b.length - shared;
  return { score: union ? shared / union : 0, shared };
}
