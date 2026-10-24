// More dental / oral figures (v105): dentition, tooth germ, TMJ, tongue, salivary glands, mandible.
import type { Figure } from "./data";
import { tube, rng, r1 } from "./kit";

const MAND_PATH = "M30,150 C30,190 52,236 90,254 C140,278 210,282 252,262 C262,254 268,240 270,222 L280,134 C284,110 290,92 296,76 C302,60 300,42 288,38 C278,34 272,44 270,56 C266,76 262,98 248,102 C230,104 216,92 214,70 C214,56 208,44 196,46 C186,50 184,66 186,84 C188,104 190,118 184,128 L150,128 L40,128 C32,128 30,138 30,150 Z";
const MAND_TEETH = `<g stroke="#8b7757" stroke-width="1" fill="#fffaf0">
<rect x="34" y="104" width="9" height="26" rx="3"/><rect x="45" y="102" width="10" height="28" rx="3"/><rect x="57" y="100" width="11" height="30" rx="3"/><rect x="70" y="102" width="13" height="28" rx="4"/><rect x="85" y="102" width="14" height="28" rx="4"/><rect x="101" y="102" width="17" height="26" rx="4"/><rect x="120" y="104" width="17" height="24" rx="4"/><rect x="139" y="106" width="16" height="22" rx="4"/>
</g>`;

// =====================================================================================
// 1. Permanent dentition - occlusal view of both arches with FDI numbers
// =====================================================================================
const TYPE_COL: Record<string, [string, string]> = { I: ["#fbe38a", "#d9b640"], C: ["#f7b27a", "#d4803c"], P: ["#9ed78a", "#5ea34a"], M: ["#8cc0ee", "#4a82c4"] };
// order from the midline outwards: central incisor ... third molar, with width (mm) and depth (buccolingual, mm)
const TEETH: Array<{ n: number; t: string; w: number; d: number }> = [
  { n: 1, t: "I", w: 8.5, d: 7 }, { n: 2, t: "I", w: 6.5, d: 6.4 }, { n: 3, t: "C", w: 7.5, d: 8.2 }, { n: 4, t: "P", w: 7, d: 9 },
  { n: 5, t: "P", w: 7, d: 9 }, { n: 6, t: "M", w: 10, d: 11 }, { n: 7, t: "M", w: 9.2, d: 10.6 }, { n: 8, t: "M", w: 8.6, d: 10 },
];

function dentition(): { svg: string; centres: Record<string, [number, number]> } {
  const cx = 170, rx = 104, ry = 118;
  const pt = (phi: number): [number, number] => [cx + rx * Math.sin(phi), -ry * Math.cos(phi)];
  // arc-length table for phi in [0, PHI]
  const PHI = 1.72, N = 600;
  const tab: number[] = [0];
  let prev = pt(0);
  for (let i = 1; i <= N; i++) { const p = pt((PHI * i) / N); tab.push(tab[i - 1] + Math.hypot(p[0] - prev[0], p[1] - prev[1])); prev = p; }
  const total = tab[N];
  const sum = TEETH.reduce((a, t) => a + t.w, 0);
  const k = (total * 0.97) / sum;
  const phiAt = (len: number) => { let i = 0; while (i < N && tab[i] < len) i++; return (PHI * i) / N; };
  const toothShape = (t: (typeof TEETH)[number], label: string): string => {
    const c2 = TYPE_COL[t.t][1];
    const w = t.w * k - 1.6, d = t.d * k * 0.78;
    const gid = `hs-dent-${t.t}`;
    let cusps = "";
    if (t.t === "M") cusps = `<circle cx="${-w * 0.24}" cy="${-d * 0.2}" r="${w * 0.16}" fill="#fff" opacity=".45"/><circle cx="${w * 0.24}" cy="${-d * 0.2}" r="${w * 0.16}" fill="#fff" opacity=".45"/><circle cx="${-w * 0.24}" cy="${d * 0.22}" r="${w * 0.16}" fill="#fff" opacity=".45"/><circle cx="${w * 0.24}" cy="${d * 0.22}" r="${w * 0.16}" fill="#fff" opacity=".45"/><path d="M${-w * 0.38},0 L${w * 0.38},0 M0,${-d * 0.36} L0,${d * 0.36}" stroke="${c2}" stroke-width="1" opacity=".7"/>`;
    else if (t.t === "P") cusps = `<ellipse cx="0" cy="${-d * 0.18}" rx="${w * 0.28}" ry="${d * 0.2}" fill="#fff" opacity=".45"/><ellipse cx="0" cy="${d * 0.2}" rx="${w * 0.24}" ry="${d * 0.18}" fill="#fff" opacity=".35"/><path d="M${-w * 0.34},0 L${w * 0.34},0" stroke="${c2}" stroke-width="1" opacity=".7"/>`;
    else if (t.t === "C") cusps = `<path d="M${-w * 0.3},${d * 0.3} L0,${-d * 0.38} L${w * 0.3},${d * 0.3} Z" fill="#fff" opacity=".4"/>`;
    else cusps = `<rect x="${-w * 0.36}" y="${-d * 0.36}" width="${w * 0.72}" height="${d * 0.18}" rx="2" fill="#fff" opacity=".5"/>`;
    return `<rect x="${r1(-w / 2)}" y="${r1(-d / 2)}" width="${r1(w)}" height="${r1(d)}" rx="${t.t === "M" ? 5 : t.t === "P" ? 4.5 : 3.5}" fill="url(#${gid})" stroke="${c2}" stroke-width="1.2"/>${cusps}`;
  };
  const gradients = Object.entries(TYPE_COL).map(([t, [a, b]]) => `<linearGradient id="hs-dent-${t}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`).join("");
  // simpler, explicit placement: compute centre + rotation for every tooth once, then draw both arches
  type Pl = { label: string; x: number; y: number; rot: number; t: (typeof TEETH)[number] };
  const placements: Pl[] = [];
  for (const side of [-1, 1]) {
    let acc = 0;
    for (const t of TEETH) {
      const mid = acc + (t.w * k) / 2; acc += t.w * k;
      const phi = phiAt(mid);
      const [px, py] = pt(phi);
      // tangent direction of the ellipse at phi
      const tx = rx * Math.cos(phi), ty = ry * Math.sin(phi);
      let rot = (Math.atan2(ty, tx) * 180) / Math.PI; // angle of tangent for the right side (x grows with phi)
      if (side < 0) rot = -rot;
      placements.push({ label: `${side < 0 ? "L" : "R"}${t.n}`, x: cx + side * (px - cx), y: py, rot, t });
    }
  }
  const Y0 = 150; // arch baseline (incisors at the top of the upper arch)
  let svg = `<defs>${gradients}</defs>`;
  // palate / tongue space shading
  svg += `<path d="M${cx - 80},${Y0 - 100} C${cx - 84},${Y0 - 30} ${cx - 56},${Y0 + 2} ${cx},${Y0 + 6} C${cx + 56},${Y0 + 2} ${cx + 84},${Y0 - 30} ${cx + 80},${Y0 - 100} C${cx + 50},${Y0 - 122} ${cx - 50},${Y0 - 122} ${cx - 80},${Y0 - 100} Z" fill="#f3b3ae" opacity=".55" stroke="#c97a76" stroke-width="1"/>`;
  svg += `<path d="M${cx},${Y0 - 112} L${cx},${Y0 + 4}" stroke="#c97a76" stroke-width="1.4" stroke-dasharray="3 3"/>`;
  svg += `<g transform="translate(0,367) scale(1,-1)" opacity=".9"><path d="M${cx - 80},${Y0 - 100} C${cx - 84},${Y0 - 30} ${cx - 56},${Y0 + 2} ${cx},${Y0 + 6} C${cx + 56},${Y0 + 2} ${cx + 84},${Y0 - 30} ${cx + 80},${Y0 - 100} C${cx + 50},${Y0 - 122} ${cx - 50},${Y0 - 122} ${cx - 80},${Y0 - 100} Z" fill="#e58f94" opacity=".55" stroke="#b9525f" stroke-width="1"/></g>`;
  const centres2: Record<string, [number, number]> = {};
  for (const upper of [true, false]) {
    for (const p of placements) {
      const quad = upper ? (p.label[0] === "L" ? 1 : 2) : (p.label[0] === "L" ? 4 : 3);
      const label = `${quad}${p.t.n}`;
      const lowerBase = 335;
      const yy = upper ? Y0 + p.y : lowerBase - (p.y + 118) ;
      const rot = upper ? p.rot : -p.rot;
      const fy = yy;
      centres2[label] = [r1(p.x), r1(fy)];
      svg += `<g transform="translate(${r1(p.x)},${r1(fy)}) rotate(${r1(rot)})">${toothShape(p.t, label)}</g>`;
    }
  }
  // tongue shadow for the lower arch
  // numbers (drawn upright, on top)
  let nums = "";
  for (const [label, [x, y]] of Object.entries(centres2)) nums += `<text x="${x}" y="${r1(y + 3.2)}" text-anchor="middle" font-size="8.6" font-weight="700" fill="#2a2a2a" font-family="system-ui,sans-serif">${label}</text>`;
  svg += nums;
  return { svg, centres: centres2 };
}
const DENT = dentition();

// =====================================================================================
// 2. Tooth germ - bell stage (enamel organ, dental papilla, dental follicle)
// =====================================================================================
function toothGerm(): string {
  const rand = rng(5);
  const outer = "M64,246 C54,170 74,104 150,92 C226,104 246,170 236,246";
  const inner = "M92,246 C86,190 102,150 150,140 C198,150 214,190 208,246";
  let stars = "";
  for (let i = 0; i < 150; i++) {
    const x = 84 + rand() * 132, y = 102 + rand() * 100;
    // keep inside the dome band between the outer and inner arcs
    const dx = (x - 150) / 76;
    const top = 96 + (1 - Math.min(1, dx * dx)) * 0 + dx * dx * 60;
    const bot = 140 + dx * dx * 60;
    if (y < top + 6 || y > bot - 10) continue;
    stars += `M${r1(x)},${r1(y)} l5,-4 M${r1(x)},${r1(y)} l-5,-3 M${r1(x)},${r1(y)} l3,5 M${r1(x)},${r1(y)} l-4,4 `;
  }
  let nuc = "";
  const r2 = rng(9);
  for (let i = 0; i < 70; i++) {
    const x = 100 + r2() * 100, y = 160 + r2() * 128;
    if (y < 150 + Math.pow((x - 150) / 60, 2) * 34) continue;
    nuc += `<circle cx="${r1(x)}" cy="${r1(y)}" r="1.9"/>`;
  }
  return `
<!-- oral epithelium and dental lamina -->
<path d="M0,0 L320,0 L320,38 C290,46 260,34 230,42 C200,48 176,46 168,56 C166,70 164,82 160,94 L140,94 C136,82 134,70 132,56 C124,46 100,48 70,42 C40,34 20,44 0,38 Z" fill="#c9a0d8" stroke="#7a4a8a" stroke-width="1.4"/>
<path d="M0,16 C40,22 80,10 120,18 M200,18 C240,10 280,22 320,16" stroke="#7a4a8a" stroke-width="1" fill="none" opacity=".5"/>
<!-- dental follicle (sac) -->
<path d="M44,252 C34,166 58,78 150,66 C242,78 266,166 256,252 L256,306 C210,320 90,320 44,306 Z" fill="#f6dff0" stroke="#9d6bb0" stroke-width="1.6" stroke-dasharray="5 3"/>
<!-- enamel organ: stellate reticulum -->
<path d="${outer} L208,246 C214,190 198,150 150,140 C102,150 86,190 92,246 Z" fill="#dcebf7" stroke="none"/>
<path d="${stars}" stroke="#5b87b0" stroke-width="1" fill="none" opacity=".7"/>
<!-- outer enamel epithelium -->
<path d="${outer}" fill="none" stroke="#6b3d88" stroke-width="3.4" stroke-linecap="round"/>
<path d="${outer}" fill="none" stroke="#d8b8e8" stroke-width="1" stroke-dasharray="1 5" stroke-linecap="round" transform="translate(0,1.4)"/>
<!-- stratum intermedium (flattened) and inner enamel epithelium (columnar, palisade) -->
<path d="M90,246 C84,188 100,146 150,136 C200,146 216,188 210,246" fill="none" stroke="#e9a5c7" stroke-width="6"/>
<path d="${inner}" fill="none" stroke="#7a3f9a" stroke-width="7" stroke-linecap="round"/>
<path d="${inner}" fill="none" stroke="#f4e6fa" stroke-width="7" stroke-dasharray="1.6 3.4" stroke-linecap="round"/>
<!-- dental papilla (condensed mesenchyme) -->
<path d="${inner} L208,296 C190,308 110,308 92,296 Z" fill="#f2a8bf" stroke="#b95b7e" stroke-width="1.4"/>
<g fill="#9d3a63" opacity=".8">${nuc}</g>
<!-- odontoblast layer, dentine and enamel at the cusp tip -->
<path d="M122,152 C132,146 142,144 150,144 C158,144 168,146 178,152" fill="none" stroke="#c46a95" stroke-width="3.4" stroke-linecap="round"/>
<path d="M126,147 C136,141 144,139 150,139 C156,139 164,141 174,147" fill="none" stroke="#f4d98c" stroke-width="3" stroke-linecap="round"/>
<path d="M130,142 C138,136 145,134 150,134 C155,134 162,136 170,142" fill="none" stroke="#bfe0f4" stroke-width="2.6" stroke-linecap="round"/>
<!-- cervical loops: where outer and inner enamel epithelium meet (Hertwig sheath grows from here) -->
<circle cx="78" cy="248" r="9" fill="#b98ad0" stroke="#6b3d88" stroke-width="1.6"/>
<circle cx="222" cy="248" r="9" fill="#b98ad0" stroke="#6b3d88" stroke-width="1.6"/>
<path d="M0,0" />`;
}

// =====================================================================================
// 3. Temporomandibular joint - sagittal section (anterior = LEFT)
// =====================================================================================
function tmj(): string {
  return `
<linearGradient id="hs-tmj-bone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6efd8"/><stop offset="1" stop-color="#d4c394"/></linearGradient>
<!-- temporal bone: articular eminence (left), glenoid fossa, postglenoid tubercle, tympanic plate -->
<path d="M0,0 L340,0 L340,106 L240,106 C222,106 212,104 206,96 C200,84 192,76 176,74 C152,70 128,72 114,80 C104,88 100,98 90,98 C76,98 64,84 36,82 L0,82 Z" fill="url(#hs-tmj-bone)" stroke="#8b7757" stroke-width="1.5"/>
<path d="M20,30 C60,20 100,24 130,34 M180,24 C220,18 270,26 320,30 M30,58 C70,52 100,56 120,62" stroke="#c4b180" stroke-width="1.2" fill="none" opacity=".6"/>
<ellipse cx="274" cy="126" rx="16" ry="10" fill="#7b4c4c" stroke="#4a2a2a" stroke-width="1.2"/>
<!-- jaw (condyle + ramus) moves as one in the animation -->
<g class="hs-a hs-a-jaw">
<path d="M120,124 C120,104 140,96 160,96 C182,96 196,108 192,126 L204,306 L130,306 L136,140 C126,136 120,132 120,124 Z" fill="url(#hs-tmj-bone)" stroke="#8b7757" stroke-width="1.5"/>
<path d="M136,108 C148,100 172,100 184,108" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="3" stroke-linecap="round"/>
<path d="M152,160 C152,210 154,260 152,298 M178,160 C180,210 182,260 182,298" stroke="#c4b180" stroke-width="1.2" fill="none" opacity=".6"/>
<!-- articular disc (bow-tie) travelling with the condyle, with retrodiscal tissue behind -->
<g class="hs-a hs-a-disc">
<path d="M106,96 C108,88 118,84 128,84 C140,80 160,80 172,78 C182,74 190,72 198,78 C208,86 208,100 204,108 C200,114 192,114 186,108 C180,98 172,95 160,95 C148,95 136,98 128,106 C120,112 108,108 106,96 Z" fill="#8fd0d3" stroke="#2f7f86" stroke-width="1.5"/>
<path d="M120,90 C136,86 156,86 172,84" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/>
<path d="M200,80 C210,80 218,90 218,104 L194,136 C204,120 206,100 200,80 Z" fill="#d9626f" stroke="#8c2a35" stroke-width="1.2"/>
</g>
</g>
<!-- joint spaces (synovial cavities): upper above the disc, lower below it -->
<path d="M112,80 C128,72 152,70 174,74 C186,76 196,82 204,92" fill="none" stroke="#7cc6f0" stroke-width="3" stroke-linecap="round" opacity=".9"/>
<path d="M120,106 C138,99 160,97 184,104" fill="none" stroke="#7cc6f0" stroke-width="2.4" stroke-linecap="round" opacity=".9"/>
<!-- lateral pterygoid muscle pulling the condyle neck and disc forwards -->
${tube("M8,204 C40,180 82,146 124,116", 14, "#c0554f", "#6e1f22")}
<path d="M14,200 C46,176 86,142 122,114 M10,210 C42,188 84,154 124,124" stroke="#f0a29a" stroke-width="1" fill="none" opacity=".7"/>
<!-- capsule line -->
<path d="M100,92 C98,108 110,120 120,126 M222,100 C224,114 212,128 198,136" fill="none" stroke="#2f7f86" stroke-width="1.4" stroke-dasharray="3 2"/>`;
}

// =====================================================================================
// 4. Tongue - dorsal view with papillae and taste regions
// =====================================================================================
function tongue(): string {
  const rand = rng(21);
  let filiform = "";
  for (let i = 0; i < 340; i++) {
    const x = 70 + rand() * 180, y = 130 + rand() * 250;
    // inside the tongue silhouette (anterior 2/3 only)
    const half = 62 + Math.sin(Math.min(1, (y - 120) / 250) * Math.PI * 0.62) * 22;
    if (Math.abs(x - 160) > half - 6 || y > 372) continue;
    filiform += `M${r1(x)},${r1(y)} l0.9,-2.6 `;
  }
  const fungi: Array<[number, number]> = [];
  const r2 = rng(44);
  while (fungi.length < 22) {
    const x = 90 + r2() * 140, y = 150 + r2() * 215;
    const half = 62 + Math.sin(Math.min(1, (y - 120) / 250) * Math.PI * 0.62) * 22;
    if (Math.abs(x - 160) < half - 10 && !(Math.abs(x - 160) < 8)) fungi.push([r1(x), r1(y)]);
  }
  const cv: Array<[number, number]> = [[116, 172], [130, 160], [145, 151], [175, 151], [190, 160], [204, 172]];
  return `
<linearGradient id="hs-tongue-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e48f93"/><stop offset="1" stop-color="#c4636e"/></linearGradient>
<!-- posterior third: pharyngeal part with lingual tonsil and the epiglottis behind -->
<path d="M96,96 C110,60 210,60 224,96 L224,128 L96,128 Z" fill="#e8a9ab" stroke="#9c4a52" stroke-width="1.4"/>
<path d="M126,70 C140,50 180,50 194,70 C190,80 130,80 126,70 Z" fill="#d8c27a" stroke="#8a6a1c" stroke-width="1.2"/>
<g fill="#f6cdd0" stroke="#b9525f" stroke-width=".8"><circle cx="118" cy="86" r="5"/><circle cx="132" cy="92" r="5"/><circle cx="148" cy="88" r="5"/><circle cx="164" cy="90" r="5"/><circle cx="180" cy="88" r="5"/><circle cx="196" cy="92" r="5"/><circle cx="208" cy="86" r="5"/></g>
<!-- anterior two-thirds: oral part -->
<path d="M78,132 C74,200 92,300 128,360 C146,386 174,386 192,360 C228,300 246,200 242,132 C200,124 120,124 78,132 Z" fill="url(#hs-tongue-g)" stroke="#8c3d48" stroke-width="1.6"/>
<path d="${filiform}" stroke="#f6dcdc" stroke-width="1" stroke-linecap="round" opacity=".8"/>
<!-- median sulcus -->
<path d="M160,134 C161,210 160,300 160,372" fill="none" stroke="#8c3d48" stroke-width="2" stroke-linecap="round"/>
<!-- sulcus terminalis (V) with the foramen caecum at its apex -->
<path d="M84,176 C106,168 134,150 160,138 M236,176 C214,168 186,150 160,138" fill="none" stroke="#7a2f3a" stroke-width="3" stroke-linecap="round"/>
<circle cx="160" cy="140" r="4" fill="#4a1a22"/>
<!-- circumvallate papillae (8-12 in a V in front of the sulcus terminalis) -->
${cv.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="#d9707a" stroke="#6e2a33" stroke-width="1.4"/><circle cx="${x}" cy="${y}" r="9.6" fill="none" stroke="#6e2a33" stroke-width="1"/><circle cx="${x - 2}" cy="${y - 2}" r="2.2" fill="#fff" opacity=".6"/>`).join("")}
<!-- fungiform papillae (red dots, mostly on the tip and sides) -->
${fungi.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2" fill="#c0303f" stroke="#7a1a24" stroke-width=".8"/><circle cx="${x - 1}" cy="${y - 1}" r=".9" fill="#fff" opacity=".7"/>`).join("")}
<!-- foliate papillae (parallel folds on the posterolateral edges) -->
<path d="M80,146 l12,2 M80,152 l13,2 M80,158 l12,2 M80,164 l11,2 M80,170 l10,2 M240,146 l-12,2 M240,152 l-13,2 M240,158 l-12,2 M240,164 l-11,2 M240,170 l-10,2" stroke="#6e2a33" stroke-width="2" stroke-linecap="round"/>
<!-- taste-bud regions: sweet tip, salt sides front, sour sides back, bitter back -->
<path d="M0,0" />`;
}

// =====================================================================================
// 5. Major salivary glands (lateral view of the face, anterior = LEFT)
// =====================================================================================
function salivary(): string {
  const rand = rng(33);
  const lobules = (cx: number, cy: number, n: number, rad: number, col: string, edge: string): string => {
    let out = "";
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * rad;
      out += `<circle cx="${r1(cx + Math.cos(a) * r * 1.15)}" cy="${r1(cy + Math.sin(a) * r)}" r="${r1(5 + rand() * 4)}" fill="${col}" stroke="${edge}" stroke-width="1"/>`;
    }
    return out;
  };
  return `
<linearGradient id="hs-sal-par" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3c987"/><stop offset="1" stop-color="#d79a42"/></linearGradient>
<linearGradient id="hs-sal-sub" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9a6c4"/><stop offset="1" stop-color="#c46c96"/></linearGradient>
<linearGradient id="hs-sal-sl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b7dcb0"/><stop offset="1" stop-color="#6fae78"/></linearGradient>
<!-- mandible (outline) and lower teeth -->
<path d="${MAND_PATH}" fill="#f1e7cc" stroke="#8b7757" stroke-width="1.4" stroke-linejoin="round"/>
${MAND_TEETH}
<!-- ear -->
<path d="M314,70 C334,64 346,84 344,112 C342,134 328,146 316,138 Z" fill="#e8b79e" stroke="#9c6a54" stroke-width="1.4"/>
<!-- parotid gland: wraps the ramus in front of the ear; Stensen duct runs forwards across masseter -->
<path d="M262,62 C282,48 306,62 310,92 C314,124 300,150 280,158 C260,160 252,138 254,112 C254,90 252,72 262,62 Z" fill="url(#hs-sal-par)" stroke="#8a5a1a" stroke-width="1.6"/>
${lobules(282, 108, 14, 22, "#f9dc9f", "#b27a2c")}
${tube("M262,104 C226,90 188,88 150,92 C134,94 124,94 116,94", 3.6, "#f6e3a2", "#8a6a1c")}
<path class="hs-a-dots fat" d="M262,104 C226,90 188,88 150,92 C134,94 124,94 116,94"/>
<circle cx="116" cy="94" r="3.4" fill="#fff" stroke="#8a6a1c" stroke-width="1"/>
<!-- masseter muscle (transparent outline) -->
<path d="M228,84 C244,96 252,130 244,170 C228,176 210,170 200,150 C196,122 208,98 228,84 Z" fill="#c0554f" opacity=".35" stroke="#8a2f35" stroke-width="1" stroke-dasharray="4 3"/>
<!-- submandibular gland below the angle of the mandible; Wharton duct runs forwards under the tongue -->
<path d="M218,258 C238,248 262,256 266,276 C268,296 248,310 226,306 C206,302 198,274 218,258 Z" fill="url(#hs-sal-sub)" stroke="#7a2f55" stroke-width="1.6"/>
${lobules(234, 280, 9, 17, "#f2c1d8", "#9c4a75")}
${tube("M206,274 C176,270 146,250 124,214 C112,194 102,172 94,146", 3, "#f6e3a2", "#8a6a1c")}
<path class="hs-a-dots fat" d="M206,274 C176,270 146,250 124,214 C112,194 102,172 94,146"/>
<!-- sublingual gland: floor of mouth, many small ducts -->
<path d="M80,150 C96,142 124,146 134,160 C138,174 118,184 98,180 C80,176 72,160 80,150 Z" fill="url(#hs-sal-sl)" stroke="#3f7a48" stroke-width="1.6"/>
${lobules(106, 164, 6, 12, "#cfe9c9", "#3f7a48")}
<path d="M88,146 l-2,-14 M98,144 l-1,-16 M108,144 l0,-16 M118,148 l2,-14" stroke="#5d9a66" stroke-width="1.3" stroke-linecap="round"/>
<path d="M0,0" />`;
}

// =====================================================================================
// 6. Mandible - lateral view (right side, anterior = LEFT)
// =====================================================================================
function mandible(): string {
  return `
<linearGradient id="hs-man-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f8f0da"/><stop offset="1" stop-color="#cdbb90"/></linearGradient>
<path d="${MAND_PATH}" fill="url(#hs-man-g)" stroke="#8b7757" stroke-width="1.6" stroke-linejoin="round"/>
<!-- alveolar process with the lower teeth sockets -->
${MAND_TEETH}
<!-- condyle head and coronoid process highlights -->
<ellipse cx="288" cy="44" rx="12" ry="8" fill="#f8f0da" stroke="#8b7757" stroke-width="1.2" transform="rotate(-24 288 44)"/>
<path d="M196,52 C202,60 204,80 202,96" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="3" stroke-linecap="round"/>
<!-- mental foramen -->
<ellipse cx="96" cy="170" rx="5.5" ry="4" fill="#5a4630" stroke="#2f2418" stroke-width="1"/>
<!-- oblique line -->
<path d="M180,132 C160,146 130,156 104,160" fill="none" stroke="#a58d5e" stroke-width="2.4" stroke-linecap="round"/>
<!-- masseteric tuberosity near the angle -->
<path d="M236,232 C246,226 258,224 266,224 M232,244 C244,238 256,236 266,236" fill="none" stroke="#a58d5e" stroke-width="2" stroke-linecap="round"/>
<!-- inferior alveolar canal (dashed) from the mandibular foramen to the mental foramen -->
<path d="M236,100 C214,128 176,150 130,160 C114,164 104,168 98,170" fill="none" stroke="#7a4a2f" stroke-width="3.4" stroke-dasharray="5 4" stroke-linecap="round" opacity=".75"/>
<circle cx="238" cy="98" r="3.6" fill="#fff" stroke="#7a4a2f" stroke-width="1.2"/>
<!-- lingula (tongue-like spine guarding the mandibular foramen, seen through the notch) -->
<path d="M0,0" />`;
}

export const DENTAL_FIGURES_2: Figure[] = [
  {
    id: "hs-dentition", name: "Permanent dentition: upper and lower arches (occlusal view) with FDI tooth numbers",
    tags: ["first molar", "second molar", "molar tooth", "dental occlusion", "molars", "dentition", "permanent dentition", "teeth numbering", "tooth numbering", "fdi", "fdi notation", "universal numbering", "palmer notation", "dental arch", "dental arches", "arch form", "upper arch", "lower arch", "maxillary arch", "mandibular arch", "incisor", "incisors", "canine", "canines", "premolar", "premolars", "molars", "wisdom tooth", "third molar", "tooth types", "types of teeth", "tooth eruption", "eruption sequence", "dental formula", "tooth morphology", "angle classification", "malocclusion", "dental charting", "dental chart", "odontogram", "space analysis"],
    w: 340, h: 365, vars: "(fixed colours: incisors yellow, canines orange, premolars green, molars blue)",
    notes: "Occlusal views. UPPER arch at the top (incisors at the top edge, y~35; molars lower, y~155-210), LOWER arch below (incisors at the bottom edge, y~335; molars higher, y~215-280); midline x=170; patient's RIGHT = viewer's LEFT. Each tooth carries its FDI number (quadrant 1 = upper right, 2 = upper left, 3 = lower left, 4 = lower right; second digit 1 = central incisor ... 8 = third molar). Colour code: incisors yellow (x 1-2), canines orange (3), premolars green (4-5), molars blue (6-8). Centres (x,y): " + Object.entries(DENT.centres).filter(([k]) => ["11", "13", "16", "18", "21", "23", "26", "28", "41", "43", "46", "48", "31", "33", "36", "38"].includes(k)).map(([k, [x, y]]) => `${k} (${x},${y})`).join(", ") + ". Deciduous dentition uses quadrants 5-8 with 5 teeth per quadrant (A-E / 51-55).",
    svg: DENT.svg,
  },
  {
    id: "hs-tooth-germ", name: "Tooth germ at the bell stage (enamel organ, dental papilla, follicle) - histology",
    tags: ["tooth germ", "tooth bud", "tooth development", "odontogenesis", "bud stage", "cap stage", "bell stage", "enamel organ", "dental lamina", "dental papilla", "dental follicle", "dental sac", "stellate reticulum", "stratum intermedium", "inner enamel epithelium", "outer enamel epithelium", "cervical loop", "ameloblast", "ameloblasts", "amelogenesis", "odontoblast differentiation", "dentinogenesis", "hertwig", "epithelial root sheath", "enamel knot", "histodifferentiation", "morphodifferentiation", "apposition", "dental development", "oral histology", "oral embryology", "tooth formation", "anodontia", "natal teeth"],
    w: 320, h: 330, vars: "(fixed colours)",
    notes: "Frontal histological section, oral cavity at the TOP. Oral epithelium (purple band, y 0-46) with the dental lamina descending (150,70) to the enamel organ. ENAMEL ORGAN = bell: outer enamel epithelium (dark purple line over the dome, (150,92)); stellate reticulum (pale blue star-shaped cells, (150,118)); stratum intermedium (pink thin layer, (150,134)); inner enamel epithelium (columnar palisade, (150,142)); cervical loops at the rims (78,248) and (222,248) where inner and outer epithelium meet. DENTAL PAPILLA (pink dense mesenchyme, (150,215)) fills the concavity below the inner epithelium -> becomes pulp and dentine. DENTAL FOLLICLE/SAC = dashed purple envelope around everything ((50,200), (256,200)) -> cementum, PDL, alveolar bone. At the cusp tip (150,134-150): ameloblast layer, thin enamel (blue, y~134), dentine (yellow, y~139) and odontoblasts (y~145).",
    svg: toothGerm(),
  },
  {
    id: "hs-tmj", name: "Temporomandibular joint (sagittal section: condyle, articular disc, fossa, lateral pterygoid)",
    tags: ["tmj", "temporomandibular", "temporomandibular joint", "tmd", "temporomandibular disorder", "jaw joint", "condyle", "mandibular condyle", "articular disc", "articular eminence", "glenoid fossa", "mandibular fossa", "lateral pterygoid", "retrodiscal", "bilaminar zone", "disc displacement", "clicking", "jaw opening", "mouth opening", "mandibular movements", "hinge movement", "dislocation of the jaw", "jaw dislocation", "ankylosis", "synovial", "upper joint space", "lower joint space", "mastication"],
    w: 340, h: 310, vars: "(fixed colours)",
    notes: "Sagittal section through the right TMJ, ANTERIOR = LEFT. Temporal bone (beige, top): articular eminence (anterior bulge, (70,84)), glenoid/mandibular fossa (thin roof, (150,66)), postglenoid tubercle (204,96), external acoustic meatus (dark oval, (270,124)). Mandibular condyle (head (150,116)) continuing as the ramus down to (170,300); the jaw group moves forward-and-down on opening. ARTICULAR DISC (teal bow-tie, (150,98)): anterior band (116,94), thin intermediate zone (150,98) over the condyle, posterior band (190,84); retrodiscal tissue / bilaminar zone (red, (206,98)). Joint spaces (blue): upper (discotemporal, translation) arc (150,64) and lower (discomandibular, hinge) arc (160,108). Lateral pterygoid (red muscle) enters from the left (60,170) to the condyle neck and disc (122,116). Capsule = dashed teal line.",
    svg: tmj(),
  },
  {
    id: "hs-tongue", name: "Tongue (dorsal view: papillae, sulcus terminalis, foramen caecum, lingual tonsil)",
    tags: ["tongue papillae", "lingual papillae", "tongue", "lingual", "glossitis", "circumvallate", "fungiform", "filiform", "foliate", "taste bud", "taste buds", "taste", "gustatory", "gustation", "sulcus terminalis", "foramen caecum", "lingual tonsil", "median sulcus", "geographic tongue", "macroglossia", "ankyloglossia", "tongue tie", "hypoglossal", "chorda tympani", "taste pathway", "oral cavity", "thyroglossal", "glossopharyngeal", "tongue cancer", "furrowed tongue", "hairy tongue", "burning mouth"],
    w: 320, h: 400, vars: "(fixed colours)",
    notes: "Dorsal view, tip at the BOTTOM, root/pharynx at the TOP, symmetrical about x=160. Anterior 2/3 (oral part, pink, y 130-385) is separated from the posterior 1/3 (pharyngeal part, y 60-128, with lingual tonsil nodules (118-208,88)) by the V-shaped sulcus terminalis (arms from (84,176) and (236,176) meeting at the apex, which points BACKWARDS/up) whose apex carries the foramen caecum (160,140). Circumvallate papillae: a row of large circled papillae in a V just in front of the sulcus (116,172), (130,160), (145,151), (175,151), (190,160), (204,172). Foliate papillae: parallel folds on the posterolateral margins (86,158) and (234,158) (just behind the end of the sulcus arms). Fungiform papillae: red dots scattered, densest at the tip and sides (160,360)/(100,300). Filiform papillae: tiny pale spikes over the whole anterior surface. Median sulcus (160,134)->(160,372). Epiglottis (yellow, (160,64)).",
    svg: tongue(),
  },
  {
    id: "hs-salivary", name: "Major salivary glands (parotid, submandibular, sublingual) with their ducts",
    tags: ["salivary", "salivary gland", "salivary glands", "saliva", "parotid", "parotid gland", "parotitis", "mumps", "stensen", "stensen's duct", "parotid duct", "submandibular", "submandibular gland", "wharton", "wharton's duct", "sublingual", "sublingual gland", "bartholin duct", "rivinus", "sialolithiasis", "sialolith", "salivary calculus", "sialadenitis", "pleomorphic adenoma", "mucocele", "ranula", "xerostomia", "dry mouth", "sjogren", "sjogren's", "salivation", "salivary secretion", "frey syndrome", "facial nerve parotid", "mucoepidermoid"],
    w: 350, h: 320, vars: "(fixed colours)",
    notes: "Lateral view of the right side of the face, ANTERIOR = LEFT: mandible (beige) with lower teeth (white, (34-155,102-130)), ear (right, (330,104)). PAROTID (golden, lobulated, (282,108)) wraps the ramus in front of the ear; STENSEN'S DUCT (yellow tube) runs forward over the masseter (dashed red outline (225,130)) to open opposite the upper 2nd molar at the buccal papilla (116,94). SUBMANDIBULAR gland (pink, (234,280)) below the angle/body of the mandible; WHARTON'S DUCT runs forward from (206,274) along the floor of the mouth to open beside the lingual frenulum (94,146). SUBLINGUAL gland (green, (106,164)) in the floor of the mouth with many small ducts (Rivinus) and the main duct of Bartholin.",
    svg: salivary(),
  },
  {
    id: "hs-mandible", name: "Mandible (lateral view: condyle, coronoid, ramus, angle, body, mental foramen, alveolar process)",
    tags: ["mandible", "mandibular", "lower jaw", "jaw bone", "jawbone", "ramus", "angle of the mandible", "mandibular angle", "body of the mandible", "condylar process", "coronoid process", "mandibular notch", "sigmoid notch", "mental foramen", "mandibular foramen", "inferior alveolar canal", "inferior alveolar nerve", "inferior alveolar nerve block", "mental nerve", "oblique line", "mylohyoid line", "alveolar process", "alveolar ridge", "symphysis menti", "genial tubercle", "mandibular fracture", "fracture of the mandible", "condylar fracture", "mandibular movements", "lingula", "masseteric", "gonial angle", "alveolar bone", "pterygoid"],
    w: 330, h: 300, vars: "(fixed colours)",
    notes: "Lateral view of the RIGHT mandible, ANTERIOR = LEFT. Body (bottom (150,262)); alveolar process with the lower tooth sockets/teeth along the top of the body ((34-155,100-130)); mental foramen (96,170) (below the premolars); oblique line ridge (180,132)->(104,160); angle of the mandible (250,266); ramus = the upright plate on the right ((240,150)) with masseteric tuberosity (250,232); mandibular notch (sigmoid notch) between the two processes ((242,90)); coronoid process (anterior, pointed, (196,60)); condylar process with the condyle head (288,44) (articulates in the TMJ). Dashed brown line = inferior alveolar canal from the mandibular foramen (238,98) to the mental foramen (98,170); the inferior alveolar nerve block is given just above the mandibular foramen (238,92).",
    svg: mandible(),
  },
];
