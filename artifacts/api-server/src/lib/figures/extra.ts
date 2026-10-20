// Registry of the v84 figures added after data.ts (male reproductive system, more organ systems).
import type { Figure } from "./data";
import { EXTRA_DEFS } from "./kit";
import { MALE_FIGURES } from "./male";
import { SYSTEM_FIGURES } from "./systems";

export { EXTRA_DEFS };
export const EXTRA_FIGURES: Figure[] = [...MALE_FIGURES, ...SYSTEM_FIGURES];
