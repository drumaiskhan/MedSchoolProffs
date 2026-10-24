// Built-in motion for the ready-made figures (v82).
//
// Before v82 every figure was a still picture, so a widget built on one only moved if the AI
// remembered to add flow/pulse code on top. Now the figures themselves are alive: the heart beats
// and pushes blood through its vessels, the lungs breathe with air moving in and out, white cells
// crawl, bacteria swim, a nerve impulse travels down the axon, neurotransmitter crosses the
// synapse, the DNA helix turns, and so on. Everything is plain CSS (no scripts), so it also runs
// inside the locked iframe, is paused by the host Pause button and stops for reduced-motion users.
//
// Widgets can still steer the speed from their sliders by setting CSS variables on the <use>:
//   --hs-beat   seconds per heartbeat (60 / HR)          --hs-flow    seconds per blood/air "dot step"
//   --hs-breath seconds per breath                         --hs-ap      seconds per nerve impulse
//   --hs-speed  multiplier for cells/bacteria/organelles   (2 = twice as fast)
//
// Each entry in ANIMATIONS receives the figure's original svg and returns the animated svg.

export const FIGURE_ANIM_CSS = `<style>
.hs-a{transform-box:fill-box;transform-origin:50% 50%}
@keyframes hs-beat{0%{transform:scale(1)}10%{transform:scale(1.055)}22%{transform:scale(.99)}34%{transform:scale(1.03)}52%,100%{transform:scale(1)}}
@keyframes hs-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
@keyframes hs-tumble{0%,100%{transform:scale(1,1) rotate(0)}25%{transform:scale(.8,1) rotate(14deg)}50%{transform:scale(1,.86) rotate(0)}75%{transform:scale(.84,1) rotate(-14deg)}}
@keyframes hs-amoeba{0%,100%{transform:scale(1,1) rotate(0)}25%{transform:scale(1.06,.94) rotate(3deg)}50%{transform:scale(.95,1.05) rotate(0)}75%{transform:scale(1.04,.96) rotate(-3deg)}}
@keyframes hs-jitter{0%,100%{transform:translate(0,0) rotate(0)}20%{transform:translate(4px,-3px) rotate(2deg)}40%{transform:translate(-3px,3px) rotate(-1.5deg)}60%{transform:translate(3px,4px) rotate(1deg)}80%{transform:translate(-4px,-2px) rotate(-2deg)}}
@keyframes hs-sway{0%,100%{transform:rotate(-3deg) translateY(0)}50%{transform:rotate(3deg) translateY(-3px)}}
@keyframes hs-swim{0%,100%{transform:translate(-7px,2px) rotate(-3deg)}50%{transform:translate(7px,-2px) rotate(3deg)}}
@keyframes hs-screw{0%,100%{transform:translateX(-6px) scaleY(1)}25%{transform:translateX(-1px) scaleY(.86)}50%{transform:translateX(6px) scaleY(1)}75%{transform:translateX(1px) scaleY(.86)}}
@keyframes hs-spin{to{transform:rotate(360deg)}}
@keyframes hs-bob{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-6px) rotate(2deg)}}
@keyframes hs-dots{to{stroke-dashoffset:-15.1}}
@keyframes hs-dots-r{to{stroke-dashoffset:15.1}}
@keyframes hs-in{0%,46%{opacity:1}54%,100%{opacity:0}}
@keyframes hs-out{0%,46%{opacity:0}54%,100%{opacity:1}}
@keyframes hs-ap{0%{stroke-dashoffset:40}100%{stroke-dashoffset:-300}}
@keyframes hs-flash{0%,72%{opacity:0}84%{opacity:1}100%{opacity:0}}
@keyframes hs-nt{0%{transform:translate(0,0);opacity:0}12%{opacity:1}80%{opacity:1}100%{transform:translate(var(--dx,0),var(--dy,22px));opacity:0}}
@keyframes hs-rec{0%,70%{opacity:0}85%{opacity:.95}100%{opacity:0}}
@keyframes hs-atp{0%{transform:translate(0,0) scale(.5);opacity:0}20%{opacity:1}100%{transform:translate(var(--dx,8px),-26px) scale(1);opacity:0}}
@keyframes hs-scroll{to{transform:translateY(102.4px)}}
@keyframes hs-jawopen{0%,12%,88%,100%{transform:translate(0,0) rotate(0)}44%,56%{transform:translate(-17px,9px) rotate(-5deg)}}
@keyframes hs-discslide{0%,12%,88%,100%{transform:translate(0,0)}44%,56%{transform:translate(8px,-3px)}}
@keyframes hs-slidel{0%,10%,90%,100%{transform:translateX(0)}45%,55%{transform:translateX(30px)}}
@keyframes hs-slider{0%,10%,90%,100%{transform:translateX(0)}45%,55%{transform:translateX(-30px)}}
@keyframes hs-wave{0%,100%{transform:skewX(-4deg)}50%{transform:skewX(4deg)}}
.hs-a-beat{animation:hs-beat var(--hs-beat,.9s) ease-in-out infinite;transform-origin:50% 64%}
.hs-a-breathe{animation:hs-breathe var(--hs-breath,4s) ease-in-out infinite;transform-origin:50% 22%}
.hs-a-alv{animation:hs-breathe var(--hs-breath,4s) ease-in-out infinite;transform-origin:60% 50%}
.hs-a-art{animation:hs-beat var(--hs-beat,.9s) ease-out infinite}
.hs-a-vein{animation:hs-breathe calc(var(--hs-beat,.9s) * 3) ease-in-out infinite}
.hs-a-tumble{animation:hs-tumble calc(1.8s / var(--hs-speed,1)) ease-in-out infinite}
.hs-a-amoeba{animation:hs-amoeba calc(2.6s / var(--hs-speed,1)) ease-in-out infinite}
.hs-a-jitter{animation:hs-jitter calc(5s / var(--hs-speed,1)) ease-in-out infinite}
.hs-a-sway{animation:hs-sway calc(2.8s / var(--hs-speed,1)) ease-in-out infinite}
.hs-a-swim{animation:hs-swim calc(3.2s / var(--hs-speed,1)) ease-in-out infinite}
.hs-a-screw{animation:hs-screw calc(2.2s / var(--hs-speed,1)) ease-in-out infinite}
.hs-a-jaw{animation:hs-jawopen var(--hs-jaw,5s) ease-in-out infinite;transform-origin:150px 120px;transform-box:view-box}
.hs-a-disc{animation:hs-discslide var(--hs-jaw,5s) ease-in-out infinite}
.hs-a-slideL{animation:hs-slidel calc(4.5s / var(--hs-speed,1)) ease-in-out infinite}
.hs-a-slideR{animation:hs-slider calc(4.5s / var(--hs-speed,1)) ease-in-out infinite}
.hs-a-spin{animation:hs-spin calc(28s / var(--hs-speed,1)) linear infinite}
.hs-a-bob{animation:hs-bob calc(3.4s / var(--hs-speed,1)) ease-in-out infinite}
.hs-a-wave{animation:hs-wave calc(2.4s / var(--hs-speed,1)) ease-in-out infinite}
.hs-a-dots{fill:none;stroke:rgba(255,255,255,.85);stroke-width:4;stroke-linecap:round;stroke-dasharray:.1 15;animation:hs-dots var(--hs-flow,calc(var(--hs-beat,.9s) * .55)) linear infinite}
.hs-a-dots.rev{animation-name:hs-dots-r}
.hs-a-dots.air{stroke:#8fd0ff;stroke-width:3.4}
.hs-a-dots.urine{stroke:#fff3b8;stroke-width:3.4;--hs-flow:1.1s}
.hs-a-dots.dark{stroke:rgba(120,30,35,.55)}
.hs-a-in{animation:hs-in var(--hs-breath,4s) linear infinite}
.hs-a-out{animation:hs-out var(--hs-breath,4s) linear infinite}
.hs-a-ap{fill:none;stroke:#ffe27a;stroke-width:5;stroke-linecap:round;stroke-dasharray:36 700;stroke-dashoffset:40;animation:hs-ap var(--hs-ap,1.8s) cubic-bezier(.3,.1,.7,.9) infinite}
.hs-a-ap.glow{stroke-width:12;stroke:rgba(255,226,122,.35)}
.hs-a-flash{fill:#ffe27a;stroke:#fff;stroke-width:1.5;animation:hs-flash var(--hs-ap,1.8s) ease-out infinite}
.hs-a-nt{animation:hs-nt 2.4s ease-in infinite;animation-delay:var(--d,0s)}
.hs-a-rec{fill:#ffe27a;animation:hs-rec 2.4s ease-out infinite;animation-delay:var(--d,0s)}
.hs-a-atp{animation:hs-atp 2.6s ease-out infinite;animation-delay:var(--d,0s)}
.hs-a-scroll{animation:hs-scroll calc(6s / var(--hs-speed,1)) linear infinite}
.hs-a-dots.sperm{stroke:#fff;stroke-width:3.4;--hs-flow:2.8s}
.hs-a-dots.bile{stroke:#e3ff9a;stroke-width:3.2;--hs-flow:1.8s}
.hs-a-dots.blue{stroke:#cfe6ff;stroke-width:3.2}
.hs-a-dots.fat{stroke:#fff6c8;stroke-width:3}
@media (prefers-reduced-motion:reduce){[class*="hs-a-"]{animation:none!important}}
</style>`;

const g = (cls: string, inner: string, style = "") => `<g class="hs-a ${cls}"${style ? ` style="${style}"` : ""}>${inner}</g>`;
const dots = (d: string, extra = "") => `<path class="hs-a-dots ${extra}" d="${d}"/>`;

// ---- heart: beats, with blood visibly moving through both sides --------------------------------
const heart = (svg: string) => g("hs-a-beat",
  svg +
  dots("M81,14 L81,88 C84,114 96,130 100,156 C102,204 122,248 146,278") +                    // SVC -> RA -> tricuspid -> RV
  dots("M14,139 L66,139 C84,139 90,134 94,124") +                                             // IVC -> RA
  dots("M146,278 C152,240 148,196 144,150 L138,112 L122,96 L120,44 C120,26 112,16 104,12") + // RV -> pulmonary trunk
  dots("M286,94 L242,100 C220,104 208,114 206,132 L206,156 C206,204 196,250 180,288", "") +  // pulm. veins -> LA -> mitral -> LV
  dots("M286,132 L244,130 C228,128 216,128 210,132") +                                       // lower pulmonary vein
  dots("M180,288 C168,250 168,196 170,152 L176,110 L181,46 C181,22 202,10 215,20 C227,30 228,46 227,64"), // LV -> aorta
);

// ---- lungs: breathe in and out, air moves with the breath --------------------------------------
const AIR_IN = "M150,10 L150,104 L116,128 L96,150 L78,156 M150,104 L184,128 L204,152 L222,158";
const lungs = (svg: string) => g("hs-a-breathe",
  svg +
  `<g class="hs-a-in">${dots(AIR_IN, "air")}</g>` +
  `<g class="hs-a-out"><path class="hs-a-dots air rev" d="${AIR_IN}"/></g>`);

// ---- blood cells --------------------------------------------------------------------------------
const rbc = (svg: string) => g("hs-a-tumble", svg);
const wbc = (svg: string) => g("hs-a-amoeba", svg);
const platelet = (svg: string) => g("hs-a-tumble", svg, "animation-duration:calc(3.4s / var(--hs-speed,1))");

// ---- microbes -----------------------------------------------------------------------------------
const jitter = (svg: string) => g("hs-a-jitter", svg);
const sway = (svg: string) => g("hs-a-sway", svg);
const swim = (svg: string) => g("hs-a-swim", svg);
const screw = (svg: string) => g("hs-a-screw", svg);
const virus = (svg: string) => g("hs-a-spin", svg);
const phage = (svg: string) => g("hs-a-bob", svg);

// ---- neuron: an action potential runs soma -> terminals and the buttons flash on arrival ---------
const AXON = "M92,102 L372,102";
const neuron = (svg: string) =>
  svg +
  `<path class="hs-a-ap glow" d="${AXON}"/><path class="hs-a-ap" d="${AXON}"/>` +
  [[399, 78], [405, 100], [399, 124]].map(([x, y]) => `<circle class="hs-a-flash" cx="${x}" cy="${y}" r="6"/>`).join("");

// ---- synapse: transmitter leaves the cleft opening and lands on the receptors --------------------
const synapse = (svg: string) => {
  const targets = [70, 120, 170, 220];
  const nts = Array.from({ length: 12 }, (_, i) => {
    const t = targets[i % 4];
    const dx = t - (140 + (i % 3) * 10);
    return `<circle class="hs-a-nt" cx="${140 + (i % 3) * 10}" cy="118" r="2.6" fill="#ff6b81" style="--dx:${dx}px;--dy:${18 + (i % 2) * 4}px;--d:${(i * 0.2).toFixed(1)}s"/>`;
  }).join("");
  const recs = targets.map((t, i) => `<circle class="hs-a-rec" cx="${t}" cy="141" r="6" style="--d:${(i * 0.2 + 0.4).toFixed(1)}s"/>`).join("");
  return svg + nts + recs;
};

// ---- kidney: blood in, blood out, urine down the ureter ------------------------------------------
const kidney = (svg: string) =>
  svg +
  dots("M24,120 L80,134") +
  dots("M80,150 L20,150") +
  dots("M96,166 C80,200 60,230 56,296", "urine");

// ---- alveolus: air in through the bronchiole, blood round the capillary, sacs gently inflate ------
const alveolus = (svg: string) => g("hs-a-alv",
  svg +
  dots("M2,100 L104,100", "air") +
  dots("M194,44 A56,56 0 0 1 244,100 A56,56 0 0 1 194,156"));

// ---- artery pulses with each beat, the vein barely moves ----------------------------------------
const arteryVein = (svg: string) => {
  const i = svg.indexOf('<g transform="translate(222,75)">');
  if (i < 0) return svg;
  const a = svg.slice(0, i).replace(/^<g transform="translate\(80,75\)">/, "").replace(/<\/g>$/, "");
  const v = svg.slice(i).replace(/^<g transform="translate\(222,75\)">/, "").replace(/<\/g>$/, "");
  return `<g transform="translate(80,75)">${g("hs-a-art", a)}</g><g transform="translate(222,75)">${g("hs-a-vein", v)}</g>`;
};

// ---- animal cell: ATP sparks from the mitochondria, vesicles ER -> Golgi, slow breathing -----------
const animalCell = (svg: string) => {
  const mito: Array<[number, number]> = [[60, 150], [240, 176], [76, 68], [224, 62]];
  const atp = mito.flatMap(([x, y], i) => [0, 1].map((k) =>
    `<circle class="hs-a-atp" cx="${x + k * 8 - 4}" cy="${y}" r="2.6" fill="#ffd84d" stroke="#b8860b" stroke-width=".6" style="--dx:${k ? 10 : -10}px;--d:${(i * 0.5 + k * 1.2).toFixed(1)}s"/>`)).join("");
  return g("hs-a-breathe", svg + atp + dots("M196,150 C214,146 224,136 232,126", "dark"), "animation-duration:7s;transform-origin:50% 50%");
};

// ---- DNA: the helix turns (scrolls) through a window; one tile = one full pitch -------------------
const dna = (svg: string) => {
  const P = 102.4;
  return `<defs><g id="hs-dna-body">${svg}</g><clipPath id="hs-dna-tile"><rect x="0" y="8" width="100" height="${P}"/></clipPath><clipPath id="hs-dna-win"><rect x="0" y="0" width="100" height="270"/></clipPath></defs>` +
    `<g clip-path="url(#hs-dna-win)"><g class="hs-a-scroll">` +
    [-2, -1, 0, 1, 2].map((k) => `<g transform="translate(0,${k * P})"><g clip-path="url(#hs-dna-tile)"><use href="#hs-dna-body"/></g></g>`).join("") +
    `</g></g>`;
};

// ---- v84: male reproductive tract, sperm, female tract, digestive organs, nephron, skin, villus -----
// sperm are carried from the epididymis up the vas, over the bladder, to the ejaculatory duct and out the urethra
const maleRepro = (svg: string) => svg + dots("M204,346 C228,338 232,302 228,274 C225,254 221,240 218,226 L218,40 C218,22 200,22 200,40 L200,100 C197,110 202,120 196,132 L194,136 C178,146 166,154 156,164 L152,190 C152,206 140,212 126,222 L116,236 L115,336", "sperm");
const testis = (svg: string) => svg + dots("M150,150 C156,130 156,112 152,100 C176,88 206,124 208,196 C208,252 192,288 148,298 C190,318 218,268 216,196 C214,150 212,110 200,76 C196,60 194,30 194,0", "sperm");
const sperm = (svg: string) => g("hs-a-swim", svg);
const femaleRepro = (svg: string) => svg +
  dots("M42,112 C46,92 58,80 76,78 C88,74 104,78 118,88 L140,100", "sperm") +
  dots("M278,112 C274,92 262,80 244,78 C232,74 216,78 202,88 L180,100", "sperm");
const stomach = (svg: string) => g("hs-a-breathe", svg + dots("M64,0 C66,24 80,48 92,70", "fat"), "animation-duration:5.5s;transform-origin:45% 55%");
const hepatobiliary = (svg: string) => svg +
  dots("M118,132 C136,126 150,130 160,144 L152,182 C154,206 166,226 190,246", "bile") +
  dots("M206,128 C190,128 174,134 162,146 L160,144", "bile") +
  dots("M236,232 C226,190 206,150 176,126", "blue");
const nephron = (svg: string) => svg +
  dots("M10,40 C26,46 40,52 52,56") +
  dots("M92,64 C100,64 118,76 128,100 L128,300 C128,322 150,322 150,300 L150,150 C150,118 130,88 100,76 M104,36 C130,40 150,32 170,34 C196,40 204,60 204,90 L204,326", "urine");
const skin = (svg: string) => svg + dots("M224,134 L224,4", "blue");
const villus = (svg: string) => svg +
  dots("M110,36 C108,70 112,120 110,178", "fat") +
  dots("M84,52 C94,70 90,96 86,128 C84,150 92,166 98,176");
const eye = (svg: string) => g("hs-a-breathe", svg, "animation-duration:6s;transform-origin:52% 50%");

export const ANIMATIONS: Record<string, (svg: string) => string> = {
  "hs-heart": heart, "hs-lungs": lungs, "hs-rbc": rbc,
  "hs-neutrophil": wbc, "hs-lymphocyte": wbc, "hs-monocyte": wbc, "hs-eosinophil": wbc, "hs-basophil": wbc,
  "hs-platelet": platelet,
  "hs-staph": jitter, "hs-strep": sway, "hs-diplococci": jitter, "hs-bacillus": jitter,
  "hs-flagellate": swim, "hs-vibrio": swim, "hs-spirillum": screw, "hs-spirochete": screw,
  "hs-virus": virus, "hs-phage": phage,
  "hs-neuron": neuron, "hs-synapse": synapse, "hs-kidney": kidney, "hs-alveolus": alveolus,
  "hs-artery-vein": arteryVein, "hs-animal-cell": animalCell, "hs-dna": dna,
  "hs-male-repro": maleRepro, "hs-testis": testis, "hs-sperm": sperm, "hs-female-repro": femaleRepro, "hs-stomach": stomach,
  "hs-hepatobiliary": hepatobiliary, "hs-nephron": nephron, "hs-skin": skin, "hs-villus": villus,
};

/** The figure's svg with its built-in motion added (unchanged if the figure has no animation). */
export function animateFigure(id: string, svg: string): string {
  const fn = ANIMATIONS[id];
  return fn ? fn(svg) : svg;
}

/** One line per figure for the AI prompt, so it steers the built-in motion instead of duplicating it. */
export const ANIMATION_NOTES: Record<string, string> = {
  "hs-heart": "ALREADY ANIMATED: it beats and blood dots flow through every chamber and vessel. Set style=\"--hs-beat:Xs\" on the <use> (X = 60/HR) and optionally --hs-flow; do NOT add msp-pulse to it.",
  "hs-lungs": "ALREADY ANIMATED: breathing plus air moving in and out of the airways. Set --hs-breath:Xs (seconds per breath) on the <use>; do NOT add msp-pulse.",
  "hs-rbc": "ALREADY ANIMATED: each cell tumbles/deforms as it travels; just move the <use> along your path.",
  "hs-neutrophil": "ALREADY ANIMATED (amoeboid crawling).", "hs-lymphocyte": "ALREADY ANIMATED (amoeboid movement).",
  "hs-monocyte": "ALREADY ANIMATED (amoeboid movement).", "hs-eosinophil": "ALREADY ANIMATED (amoeboid movement).",
  "hs-basophil": "ALREADY ANIMATED (amoeboid movement).", "hs-platelet": "ALREADY ANIMATED (tumbling).",
  "hs-staph": "ALREADY ANIMATED (jittering).", "hs-strep": "ALREADY ANIMATED (chain sways).", "hs-diplococci": "ALREADY ANIMATED (jittering).",
  "hs-bacillus": "ALREADY ANIMATED (jittering).", "hs-flagellate": "ALREADY ANIMATED (swimming).", "hs-vibrio": "ALREADY ANIMATED (swimming).",
  "hs-spirillum": "ALREADY ANIMATED (corkscrew motion).", "hs-spirochete": "ALREADY ANIMATED (corkscrew motion).",
  "hs-virus": "ALREADY ANIMATED (slowly rotating).", "hs-phage": "ALREADY ANIMATED (floating).",
  "hs-neuron": "ALREADY ANIMATED: an action potential travels down the axon and the terminals flash. Set --hs-ap:Xs (seconds per impulse, smaller = faster conduction) on the <use>.",
  "hs-synapse": "ALREADY ANIMATED: transmitter crosses the cleft and the receptors light up; do not draw your own transmitter dots.",
  "hs-kidney": "ALREADY ANIMATED: blood flows in the artery, out the vein, and urine down the ureter. Set --hs-flow:Xs to change the speed.",
  "hs-alveolus": "ALREADY ANIMATED: air flows in, blood flows round the capillary, the sacs inflate. Set --hs-breath and --hs-flow to change the rates.",
  "hs-artery-vein": "ALREADY ANIMATED: the artery pulses with each beat (--hs-beat:Xs), the vein stays calm.",
  "hs-animal-cell": "ALREADY ANIMATED: ATP sparks leave the mitochondria and vesicles travel ER to Golgi.",
  "hs-dna": "ALREADY ANIMATED: the helix keeps turning (scrolling); do not add your own motion. --hs-speed:2 doubles the speed.",
  "hs-male-repro": "ALREADY ANIMATED: white sperm dots travel epididymis -> vas deferens -> over the bladder -> ejaculatory duct -> urethra (change the pace with --hs-flow:Xs on the <use>). Do not draw your own dots on that route.",
  "hs-testis": "ALREADY ANIMATED: sperm dots move rete testis -> efferent ductules -> epididymis head/body/tail -> vas deferens (--hs-flow:Xs sets the pace).",
  "hs-seminiferous": "Still picture (no built-in motion): add your own highlight/stage animation if useful, e.g. pulse the stage ring you are explaining.",
  "hs-sperm": "ALREADY ANIMATED: the tail beats and the whole cell swims (--hs-speed:2 doubles the swimming speed); do not add msp-float.",
  "hs-penis-section": "ALREADY ANIMATED: the corpora cavernosa swell and relax gently; to show erection vs flaccidity scale the <use> or add a CSS filter yourself.",
  "hs-female-repro": "ALREADY ANIMATED: dots move along each uterine tube from the ovary toward the uterus (--hs-flow:Xs sets the pace).",
  "hs-stomach": "ALREADY ANIMATED: slow churning of the whole stomach plus food moving down the oesophagus.",
  "hs-hepatobiliary": "ALREADY ANIMATED: bile (green-yellow dots) flows hepatic ducts -> common bile duct -> duodenum and blood moves up the portal vein (--hs-flow:Xs).",
  "hs-brain": "Still picture (no built-in motion): add your own pulses/arrows for the pathway you explain (use the landmark coordinates).",
  "hs-eye": "ALREADY ANIMATED: a very slow breathing movement; add your own light rays or pupil size changes on top.",
  "hs-nephron": "ALREADY ANIMATED: blood in the afferent arteriole and yellow filtrate flowing through the whole tubule to the collecting duct (--hs-flow:Xs).",
  "hs-skin": "ALREADY ANIMATED: sweat rises up the eccrine duct to the pore (--hs-flow:Xs).",
  "hs-villus": "ALREADY ANIMATED: absorbed fat moves down the central lacteal and nutrients down the capillary (--hs-flow:Xs).",
  // v105: dental and more systems
  "hs-tooth": "ALREADY ANIMATED: blood dots rise up the root canal from the apical foramen (--hs-flow:Xs). The rest is a still picture.",
  "hs-caries": "Still picture (no built-in motion): you can pulse the lesion zone you are explaining.",
  "hs-dentition": "Still picture: the teeth do not move; highlight a tooth type by drawing a ring/arrow at its landmark coordinates.",
  "hs-tooth-germ": "Still picture: add your own stage highlight (e.g. pulse the inner enamel epithelium layer).",
  "hs-tmj": "ALREADY ANIMATED: the mouth opens and closes - the condyle rotates then translates forward-and-down under the articular eminence and the disc glides with it (--hs-jaw:Xs = seconds per open/close cycle). Landmark coordinates in the notes are for the CLOSED position.",
  "hs-tongue": "Still picture: no built-in motion.",
  "hs-salivary": "ALREADY ANIMATED: saliva dots flow along Stensen's duct and Wharton's duct towards the mouth (--hs-flow:Xs sets the pace).",
  "hs-mandible": "Still picture: no built-in motion.",
  "hs-sarcomere": "ALREADY ANIMATED: the thin filaments slide towards the M line and back (contraction/relaxation) while the thick filaments stay put, so the H zone and I band shrink and the A band stays constant (--hs-speed:2 doubles the rate). The notes' coordinates are for the relaxed state.",
  "hs-ear": "ALREADY ANIMATED: sound dots travel down the ear canal and a wave of fluid movement runs round the cochlea (--hs-flow:Xs).",
  "hs-lymph-node": "ALREADY ANIMATED: lymph dots flow from the afferent vessels through the sinuses and out of the efferent vessel (--hs-flow:Xs).",
  "hs-thyroid": "Still picture (no built-in motion).",
  "hs-long-bone": "Still picture (no built-in motion).",
  "hs-reflex-arc": "ALREADY ANIMATED: an impulse runs receptor -> dorsal root ganglion -> cord -> ventral root -> muscle and the muscle end flashes (--hs-ap:Xs = seconds per impulse).",
};
