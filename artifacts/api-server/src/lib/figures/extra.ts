// Registry of the v84+ figures added after data.ts (male reproductive system, more organ systems, v105 dental).
import type { Figure } from "./data";
import { EXTRA_DEFS } from "./kit";
import { MALE_FIGURES } from "./male";
import { SYSTEM_FIGURES } from "./systems";
import { DENTAL_FIGURES } from "./dental";
import { DENTAL_FIGURES_2 } from "./dental2";
import { SYSTEM_FIGURES_2 } from "./systems2";

export { EXTRA_DEFS };
export const EXTRA_FIGURES: Figure[] = [...MALE_FIGURES, ...SYSTEM_FIGURES, ...DENTAL_FIGURES, ...DENTAL_FIGURES_2, ...SYSTEM_FIGURES_2];
