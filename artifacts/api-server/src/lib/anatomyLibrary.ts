/**
 * Curated anatomy models for the AI Visualizer's "model" mode.
 *
 * These are hand-built, correctly proportioned solid models. They are returned
 * directly (no AI call: instant, free and always accurate) for the requests
 * they cover, and the AI prompt also uses the tibia as its reference for how
 * parts should be composed. Coordinates: +Y superior, +Z anterior (toward the
 * viewer), +X = medial for this RIGHT tibia. Length ~100 units (~38 cm).
 *
 * No server-side three.js: parts are plain data, rendered by the student app.
 */

export type V3 = [number, number, number];

export interface LibPart {
  id: string; label: string;
  form: "lathe" | "tube" | "ellipsoid" | "sphere" | "box" | "cylinder" | "cone" | "torus" | "capsule";
  group?: string; color?: string; finish?: "bone" | "soft" | "glossy" | "matte";
  description: string; facts?: string[];
  position?: V3; rotation?: V3; scale?: V3; size?: V3;
  profile?: Array<[number, number]>; caps?: "round" | "flat";
  path?: V3[]; radii?: number[];
  lobes?: number; lobeAmount?: number; lobePhase?: number; twist?: number;
  bump?: number; opacity?: number; anchor?: V3; hideLabel?: boolean;
}
export interface LibModel { type: "model"; title: string; description: string; parts: LibPart[] }

// ---- tibia geometry helpers -------------------------------------------------
// Shaft radius profile (y -> r). Slender and triangular in section, narrowest at
// the junction of the middle and lower thirds.
const SHAFT: Array<[number, number]> = [[39, 3.0], [34, 3.9], [28, 4.2], [24, 4.15], [14, 3.8], [3, 3.45], [-8, 3.2], [-18, 3.15], [-28, 3.5], [-35, 3.9], [-41, 3.6]];
const LOBE_AMOUNT = 0.16;

function shaftR(y: number): number {
  for (let i = 0; i < SHAFT.length - 1; i++) {
    const [y0, r0] = SHAFT[i], [y1, r1] = SHAFT[i + 1];
    if (y <= y0 && y >= y1) return r0 + ((r1 - r0) * (y0 - y)) / (y0 - y1);
  }
  return SHAFT[SHAFT.length - 1][1];
}
/** Point on the (triangular) shaft surface at height y, angle deg (0 = medial +X, 90 = anterior +Z). */
function surf(y: number, deg: number, out = 1): V3 {
  const th = (deg * Math.PI) / 180;
  const rad = shaftR(y) * (1 + LOBE_AMOUNT * Math.cos(3 * th + Math.PI / 2)) * out;
  return [round(rad * Math.cos(th)), y, round(rad * Math.sin(th))];
}
const round = (n: number) => Math.round(n * 100) / 100;

const BONE = "#e7dcc3";
const BONE_LIGHT = "#efe6cf";
const BONE_DARK = "#8b7757";
const CARTILAGE = "#a8cbd8";

function buildTibia(): LibModel {
  const antBorder: V3[] = [];
  for (const y of [34, 24, 12, 0, -12, -24, -34]) {
    const p = surf(y, 88 - (34 - y) * 0.06, 0.985);
    antBorder.push([round(p[0] + (34 - y) * 0.035), p[1], p[2]]);
  }
  const interosseous: V3[] = [];
  for (const y of [32, 20, 8, -4, -16, -28, -36]) interosseous.push(surf(y, 207 - (y > 20 ? 18 : 0), 0.985));
  const soleal: V3[] = [surf(31.5, 212, 1.0), surf(27, 240, 1.0), surf(22.5, 265, 1.0), surf(18.5, 300, 1.0)];
  const foramen = surf(20.5, 268, 0.97);

  return {
    type: "model",
    title: "Tibia (right) — anterior view",
    description: "Solid model of the right tibia with its main landmarks. Drag to rotate; tap a label or the bone to read about that part.",
    parts: [
      {
        id: "shaft", label: "Shaft (diaphysis)", form: "lathe", group: "Shaft", color: BONE, finish: "bone", caps: "round",
        profile: SHAFT.map(([y, r]) => [y, r] as [number, number]).reverse(),
        lobes: 3, lobeAmount: LOBE_AMOUNT, lobePhase: 90, bump: 0.1,
        description: "The tibial shaft is triangular in cross-section, with three borders (anterior, medial, interosseous) and three surfaces (medial, lateral, posterior). It is narrowest at the junction of the middle and lower thirds.",
        facts: ["Medial surface is subcutaneous (palpable)", "Weakest point: junction of middle and lower thirds", "Tibia is the main weight-bearing bone of the leg"],
      },
      {
        id: "prox_epi", label: "Proximal epiphysis", form: "lathe", group: "Knee end", color: BONE, finish: "bone", caps: "flat",
        profile: [[20, 3.1], [26, 3.9], [30, 4.8], [34, 5.8], [37.5, 7.2], [41, 8.6], [44.5, 9.1], [46, 8.4], [46.8, 6]],
        scale: [1.15, 1, 0.95], bump: 0.12,
        description: "The expanded upper end of the tibia, wider than the shaft to spread the load of the femur across the knee. It carries the two condyles and the tibial tuberosity.",
        facts: ["Secondary ossification centre appears around birth", "Growth plate here contributes most to tibial length", "Spreads body weight onto the menisci and condyles"],
      },
      {
        id: "med_condyle", label: "Medial condyle", form: "ellipsoid", group: "Knee end", color: BONE_LIGHT, finish: "bone",
        position: [5.4, 44.8, -0.3], size: [10.8, 5.2, 14.2], bump: 0.1,
        description: "The larger, flatter-topped medial condyle articulates with the medial femoral condyle through the medial meniscus. Its upper surface is slightly concave; the semimembranosus groove lies on its posterior aspect.",
        facts: ["Larger than the lateral condyle", "Bears more of the load across the knee", "Semimembranosus attaches posteriorly"],
      },
      {
        id: "lat_condyle", label: "Lateral condyle", form: "ellipsoid", group: "Knee end", color: BONE_LIGHT, finish: "bone",
        position: [-5.4, 45.0, -0.5], size: [10.2, 4.8, 13.2], bump: 0.1,
        description: "The lateral condyle articulates with the lateral femoral condyle via the lateral meniscus. Its posteroinferior aspect carries the circular facet for the head of the fibula (superior tibiofibular joint).",
        facts: ["Gerdy's tubercle on its anterolateral side gives attachment to the iliotibial tract", "Has a facet for the fibular head", "Slightly smaller and more convex than the medial condyle"],
      },
      {
        id: "eminence", label: "Intercondylar eminence", form: "ellipsoid", group: "Knee end", color: BONE_LIGHT, finish: "bone",
        position: [0, 47.3, -0.6], size: [4.4, 3.4, 3.8], bump: 0.15,
        description: "The raised area between the two condyles, formed by the medial and lateral intercondylar tubercles. The cruciate ligaments and menisci attach to the areas in front of and behind it.",
        facts: ["ACL attaches to the anterior intercondylar area", "PCL attaches to the posterior intercondylar area", "Tubercles fit into the intercondylar notch of the femur"],
      },
      {
        id: "tuberosity", label: "Tibial tuberosity", form: "ellipsoid", group: "Shaft features", color: BONE_LIGHT, finish: "bone",
        position: [0.6, 34.5, 5.2], size: [4.6, 7.2, 3.4], bump: 0.3,
        description: "A rough elevation on the upper anterior surface of the tibia where the patellar ligament inserts. It is the lowest point of the extensor mechanism of the knee.",
        facts: ["Patellar ligament inserts here", "Traction apophysitis here = Osgood–Schlatter disease", "Easily palpable below the patella"],
      },
      {
        id: "ant_border", label: "Anterior border", form: "tube", group: "Shaft features", color: BONE_LIGHT, finish: "bone",
        path: antBorder, radii: [0.5, 0.48, 0.45, 0.42, 0.42, 0.45, 0.5], bump: 0.2,
        description: "The sharp anterior crest of the shaft, running from the tibial tuberosity down towards the medial malleolus. It lies directly under the skin, which is why it is felt as the “shin”.",
        facts: ["Subcutaneous along its whole length", "Starts at the tibial tuberosity", "Bruises and fractures here are easily felt or seen"],
      },
      {
        id: "interosseous", label: "Interosseous border", form: "tube", group: "Shaft features", color: BONE_LIGHT, finish: "bone",
        path: interosseous, radii: [0.48, 0.48, 0.45, 0.42, 0.42, 0.45, 0.48], bump: 0.15,
        description: "The sharp lateral border of the shaft, facing the fibula. The interosseous membrane of the leg attaches to it, binding the tibia and fibula together.",
        facts: ["Interosseous membrane attaches along it", "Separates the lateral and posterior surfaces", "Faces the fibula across the interosseous space"],
      },
      {
        id: "soleal", label: "Soleal line", form: "tube", group: "Shaft features", color: BONE_LIGHT, finish: "bone",
        path: soleal, radii: [0.6, 0.55, 0.5, 0.45], bump: 0.15,
        description: "An oblique ridge on the upper posterior surface running downwards and medially. The soleus and the popliteal fascia attach to it, and the triangular area above it receives the popliteus.",
        facts: ["Soleus and the popliteal fascia attach to it", "Runs obliquely down and medially", "Popliteus inserts on the triangular area above the line"],
      },
      {
        id: "foramen", label: "Nutrient foramen", form: "ellipsoid", group: "Shaft features", color: BONE_DARK, finish: "matte",
        position: foramen, size: [1.8, 2.8, 1.3], hideLabel: false,
        description: "The opening of the nutrient canal on the posterior surface just below the soleal line. The nutrient artery (from the posterior tibial artery) passes through it, running distally.",
        facts: ["Largest nutrient foramen of any bone", "Canal runs away from the knee (distally)", "Supplied by a branch of the posterior tibial artery"],
      },
      {
        id: "distal_epi", label: "Distal epiphysis", form: "lathe", group: "Ankle end", color: BONE, finish: "bone", caps: "flat",
        profile: [[-50, 4.1], [-49, 5.2], [-46.5, 5.8], [-43, 5.6], [-39, 4.9], [-35, 4.1], [-30, 3.3]],
        scale: [1.18, 1, 0.98], bump: 0.12,
        description: "The expanded lower end of the tibia. It forms the roof of the ankle mortise and carries the medial malleolus and the fibular notch.",
        facts: ["Secondary ossification centre appears in early childhood", "Forms the superior part of the ankle (talocrural) joint", "Bears weight transmitted down through the shaft"],
      },
      {
        id: "med_malleolus", label: "Medial malleolus", form: "ellipsoid", group: "Ankle end", color: BONE_LIGHT, finish: "bone",
        position: [5.0, -47.0, -0.3], size: [3.6, 8.0, 6.2], rotation: [0, 0, -6], bump: 0.15,
        description: "The bony projection on the medial side of the ankle. Its lateral surface articulates with the talus; the deltoid ligament attaches to it, and the tendon of tibialis posterior grooves its posterior aspect.",
        facts: ["Deltoid (medial) ligament attaches here", "Articulates with the medial surface of the talus", "Tibialis posterior tendon runs in a groove behind it"],
      },
      {
        id: "fib_notch", label: "Fibular notch", form: "ellipsoid", group: "Ankle end", color: BONE_DARK, finish: "matte",
        position: [-5.7, -43.5, 0.3], size: [2.0, 6.8, 5.4],
        description: "A rough, concave notch on the lateral side of the distal tibia that receives the lower end of the fibula, forming the distal tibiofibular syndesmosis.",
        facts: ["Joint is a syndesmosis (fibrous), held by anterior and posterior tibiofibular ligaments", "Allows slight fibular movement during dorsiflexion", "Injury here = ‘high ankle sprain’"],
      },
      {
        id: "art_surface", label: "Inferior articular surface", form: "ellipsoid", group: "Ankle end", color: CARTILAGE, finish: "glossy",
        position: [-0.3, -50.25, 0.2], size: [10.4, 1.7, 8.6],
        description: "The smooth, slightly concave undersurface of the distal tibia, covered with hyaline cartilage. It articulates with the trochlea (dome) of the talus, forming the roof of the ankle joint.",
        facts: ["Covered by hyaline cartilage", "Articulates with the trochlea of the talus", "Together with both malleoli forms the ankle mortise"],
      },
    ],
  };
}

export const TIBIA_MODEL: LibModel = buildTibia();

interface LibEntry { pattern: RegExp; model: LibModel }
const LIBRARY: LibEntry[] = [
  // "tibia" on its own; not a comparison/process question about several bones.
  { pattern: /\b(tibia|tibial\s+(?:bone|plateau|shaft))\b/i, model: TIBIA_MODEL },
];

/** Returns a curated model if the prompt is a plain request for one. */
export function findCuratedModel(prompt: string): LibModel | null {
  const p = prompt.trim();
  if (/\b(compare|versus|vs\.?|fracture\s+classification|pathway|mechanism)\b/i.test(p)) return null;
  for (const e of LIBRARY) if (e.pattern.test(p)) return e.model;
  return null;
}
