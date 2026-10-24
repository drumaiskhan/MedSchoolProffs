// More organ-system figures (v105): muscle, ear, lymphoid, endocrine, bone, spinal reflex.
import type { Figure } from "./data";
import { tube, smooth, rng, r1 } from "./kit";

// =====================================================================================
// 1. Sarcomere (relaxed state; the thin filaments slide inwards when animated)
// =====================================================================================
function sarcomere(): string {
  const rowsThin = [58, 98, 138, 178], rowsThick = [78, 118, 158];
  const actin = (x0: number, x1: number, y: number) =>
    `<path d="M${x0},${y} L${x1},${y}" stroke="#b0392f" stroke-width="2" stroke-linecap="round"/><path d="M${x0},${y} L${x1},${y}" stroke="#f0867a" stroke-width="5.4" stroke-linecap="round" stroke-dasharray="0.1 5.8"/>`;
  const myosin = (y: number) => {
    let heads = "";
    for (let x = 118; x <= 244; x += 8) {
      if (x > 166 && x < 194) continue; // bare zone around the M line
      const up = Math.floor(x / 8) % 2 === 0 ? -1 : 1;
      heads += `<path d="M${x},${y} l${x < 180 ? 4 : -4},${up * 8}" stroke="#2e8b6e" stroke-width="2.4" stroke-linecap="round"/><circle cx="${x + (x < 180 ? 4 : -4)}" cy="${y + up * 8.4}" r="2.4" fill="#4fc3a1" stroke="#1d6b52" stroke-width=".8"/>`;
    }
    return `<rect x="110" y="${y - 5}" width="140" height="10" rx="5" fill="#2e8b6e" stroke="#1d6b52" stroke-width="1.2"/><rect x="114" y="${y - 3.4}" width="132" height="3" rx="1.5" fill="#fff" opacity=".35"/>${heads}`;
  };
  const zdisc = (x: number) => `<path d="M${x - 5},34 l5,6 l5,-6 l0,0 L${x + 5},206 l-5,-6 l-5,6 Z" fill="#4a4a55" stroke="#222" stroke-width="1.2"/><path d="M${x},40 L${x},200" stroke="#9a9aa8" stroke-width="1" stroke-dasharray="2 3"/>`;
  const titin = (x: number, xe: number, y: number) => `<path d="M${x},${y} C${(x + xe) / 2},${y + 6} ${(x + xe) / 2},${y - 6} ${xe},${y}" fill="none" stroke="#e6b84a" stroke-width="1.4"/>`;
  const left = `<g class="hs-a hs-a-slideL">${zdisc(40)}${rowsThin.map((y) => actin(46, 150, y)).join("")}</g>`;
  const right = `<g class="hs-a hs-a-slideR">${zdisc(320)}${rowsThin.map((y) => actin(314, 210, y)).join("")}</g>`;
  return `
<rect x="6" y="22" width="348" height="196" rx="14" fill="#fbeceb" stroke="#d9a7a4" stroke-width="1.2" opacity=".7"/>
${rowsThick.map(myosin).join("")}
${rowsThick.map((y) => titin(46, 110, y - 20) + titin(314, 250, y - 20)).join("").replace(/<path[^>]+C[^>]+\/>/g, (m) => m)}
<!-- M line -->
<path d="M180,40 L180,198" stroke="#444" stroke-width="2" stroke-dasharray="1.5 3"/>
${left}${right}`;
}

// =====================================================================================
// 2. Ear (coronal section of the right ear: external, middle, inner)
// =====================================================================================
function ear(): string {
  const spiral: Array<[number, number]> = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60, a = t * Math.PI * 5.0 + 0.4, rad = 30 - t * 22;
    spiral.push([212 + rad * Math.cos(a), 186 + rad * Math.sin(a) * 0.95]);
  }
  const sp = smooth(spiral);
  return `
<linearGradient id="hs-ear-bone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4ead0"/><stop offset="1" stop-color="#d8c79a"/></linearGradient>
<!-- temporal bone (petrous part) around the middle and inner ear -->
<path d="M100,0 L360,0 L360,262 L190,262 C150,250 118,208 112,176 L112,100 Z" fill="url(#hs-ear-bone)" stroke="#8b7757" stroke-width="1.4"/>
<path d="M120,22 C170,14 250,22 340,30 M130,236 C170,244 230,248 300,244" fill="none" stroke="#c4b180" stroke-width="1.2" opacity=".6"/>
<!-- pinna and external acoustic meatus -->
<path d="M0,86 C-4,56 22,34 40,48 C52,58 46,76 40,90 L40,150 C46,164 52,182 40,194 C22,206 -2,184 0,154 Z" fill="#edbfa4" stroke="#9c6a54" stroke-width="1.4"/>
<path d="M10,96 C8,78 22,64 32,72 M10,146 C8,166 22,180 32,172" fill="none" stroke="#b98568" stroke-width="1.4"/>
<path d="M40,106 L112,104 L112,140 L40,138 Z" fill="#f6d9c8" stroke="#9c6a54" stroke-width="1.4"/>
<path d="M44,122 L108,122" stroke="#fff" stroke-opacity=".6" stroke-width="3"/>
<path class="hs-a-dots air" d="M8,122 L108,122"/>
<!-- middle-ear cavity (air) -->
<path d="M114,92 C128,76 168,74 178,92 C186,110 186,148 174,168 C160,180 134,178 120,162 C112,148 112,110 114,92 Z" fill="#dff1fb" stroke="#6aa5c4" stroke-width="1.4"/>
<!-- tympanic membrane (slightly oblique, cone-shaped) -->
<path d="M112,104 C116,114 116,128 112,140" fill="none" stroke="#c9a98f" stroke-width="5" stroke-linecap="round"/>
<path d="M113,106 C117,115 117,127 113,138" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.6" stroke-linecap="round"/>
<!-- ossicles: malleus (handle on the drum), incus, stapes to the oval window -->
<path d="M116,112 C122,106 130,100 138,92 C142,86 148,86 150,92 C152,98 146,102 142,102 C136,108 130,118 124,126" fill="#f7efe0" stroke="#7a6a4c" stroke-width="1.3" stroke-linejoin="round"/>
<path d="M148,96 C158,92 164,100 160,108 C158,114 156,122 156,128 C156,134 160,136 162,134" fill="#f1e6d0" stroke="#7a6a4c" stroke-width="1.3" stroke-linejoin="round"/>
<path d="M162,134 C168,130 172,126 176,124 M170,116 C176,126 176,134 170,138 C168,132 168,124 170,116 Z" fill="#f7efe0" stroke="#7a6a4c" stroke-width="1.2"/>
<path d="M176,110 L176,138" stroke="#a74b52" stroke-width="3" stroke-linecap="round"/>
<!-- Eustachian (pharyngotympanic) tube to the nasopharynx -->
${tube("M164,170 C176,196 200,222 244,248 L270,262", 11, "#c9e8f7", "#6aa5c4")}
<!-- inner ear: semicircular canals, vestibule, cochlea (cut) -->
<path d="M196,92 C190,60 214,38 242,46 C262,54 262,84 250,98" fill="none" stroke="#6b3d88" stroke-width="9" stroke-linecap="round"/>
<path d="M196,92 C190,60 214,38 242,46 C262,54 262,84 250,98" fill="none" stroke="#d8b8e8" stroke-width="5" stroke-linecap="round"/>
<path d="M232,112 C252,112 276,100 284,76 C290,58 276,50 266,60" fill="none" stroke="#6b3d88" stroke-width="9" stroke-linecap="round"/>
<path d="M232,112 C252,112 276,100 284,76 C290,58 276,50 266,60" fill="none" stroke="#d8b8e8" stroke-width="5" stroke-linecap="round"/>
<path d="M200,118 C214,100 250,96 270,112 C282,124 270,138 248,134" fill="none" stroke="#6b3d88" stroke-width="9" stroke-linecap="round"/>
<path d="M200,118 C214,100 250,96 270,112 C282,124 270,138 248,134" fill="none" stroke="#d8b8e8" stroke-width="5" stroke-linecap="round"/>
<ellipse cx="206" cy="126" rx="19" ry="24" fill="#d8b8e8" stroke="#6b3d88" stroke-width="2"/>
<ellipse cx="206" cy="120" rx="8" ry="6" fill="#fff" opacity=".45"/>
<path d="${sp}" fill="none" stroke="#a8742c" stroke-width="11" stroke-linecap="round"/>
<path d="${sp}" fill="none" stroke="#f1cf88" stroke-width="6.4" stroke-linecap="round"/>
<path d="${sp}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.4" stroke-linecap="round"/>
<path class="hs-a-dots blue" d="${sp}"/>
<circle cx="184" cy="154" r="4" fill="#a74b52" stroke="#6e1f22" stroke-width="1"/>
<!-- vestibulocochlear nerve (yellow) and facial nerve towards the brainstem -->
${tube("M236,170 C262,172 300,166 356,150", 6, "#f4dc78", "#8a6a1c")}
${tube("M226,138 C262,140 296,128 356,112", 4.4, "#f0c04a", "#8a6a1c")}
<circle cx="252" cy="164" r="3" fill="#d9a63a"/>
<path d="M0,0" />`;
}

// =====================================================================================
// 3. Lymph node
// =====================================================================================
function lymphNode(): string {
  const NODE = "M44,122 C44,54 110,22 170,26 C238,30 268,72 262,122 C258,160 240,190 202,196 C178,198 168,176 152,176 C134,176 124,198 98,196 C60,190 44,170 44,122 Z";
  const follicles: Array<[number, number]> = [[78, 102], [90, 66], [122, 46], [162, 40], [202, 50], [236, 80], [242, 122], [72, 142]];
  return `
<linearGradient id="hs-ln-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7d9de"/><stop offset="1" stop-color="#e3a2b3"/></linearGradient>
<!-- afferent lymphatics with valves (3, entering the convex side) -->
${[[104, 34], [154, 26], [206, 38]].map(([x, y]) => `${tube(`M${x},0 L${x},${y + 2}`, 9, "#cfeaf5", "#4f93b5")}<path d="M${x - 4},${y - 14} l4,7 l4,-7" fill="#4f93b5"/>`).join("")}
<!-- efferent lymphatic, artery and vein at the hilum -->
${tube("M152,176 L152,240", 11, "#cfeaf5", "#4f93b5")}
${tube("M130,186 C126,208 118,224 106,240", 4, "#d4504b", "#6e1f22")}
${tube("M176,186 C180,208 190,224 202,240", 4.6, "#4f86c6", "#1f3f6e")}
<!-- capsule, cortex, paracortex, medulla -->
<path d="${NODE}" fill="url(#hs-ln-g)" stroke="#7a3f56" stroke-width="3.4"/>
<path d="${NODE}" fill="none" stroke="#8fd0ea" stroke-width="7" opacity=".85" transform="translate(150,110) scale(.92) translate(-150,-110)"/>
<path d="${NODE}" fill="#f2b7c6" opacity=".75" transform="translate(150,114) scale(.7) translate(-150,-114)"/>
<g fill="#9d3a63" opacity=".55">${(() => { const r = rng(7); let o = ""; for (let i = 0; i < 70; i++) { const x = 100 + r() * 100, y = 90 + r() * 70; o += `<circle cx="${r1(x)}" cy="${r1(y)}" r="1.5"/>`; } return o; })()}</g>
<!-- B-cell follicles with pale germinal centres in the cortex -->
${follicles.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="15" fill="#b57ac8" stroke="#6b3d88" stroke-width="1.4"/><circle cx="${x}" cy="${y}" r="8.4" fill="#f4e6fa" stroke="#9d6bb0" stroke-width="1"/>`).join("")}
<path class="hs-a-dots blue" d="M104,0 L104,30 C90,60 86,104 104,142 C122,168 142,172 152,192 L152,240"/><path class="hs-a-dots blue" d="M206,0 L206,34 C228,70 240,112 214,152 C196,172 170,176 152,196"/>
<!-- trabeculae -->
<path d="M120,34 C122,56 122,70 126,84 M190,40 C186,60 186,74 182,88 M60,120 C80,118 92,120 100,126" fill="none" stroke="#7a3f56" stroke-width="2"/>
<!-- medullary cords and sinuses -->
<path d="M112,152 C120,166 134,160 140,172 M196,152 C188,166 172,160 166,172 M124,140 C136,152 150,146 152,166 M182,140 C170,152 156,146 154,166" fill="none" stroke="#9d3a63" stroke-width="5" stroke-linecap="round" opacity=".7"/>
<path d="M118,146 C128,160 142,152 146,170 M190,146 C180,160 166,152 160,170" fill="none" stroke="#8fd0ea" stroke-width="3" stroke-linecap="round"/>
<path d="M0,0" />`;
}

// =====================================================================================
// 4. Thyroid and parathyroid glands (anterior view) + follicle histology inset
// =====================================================================================
function thyroid(): string {
  let rings = "";
  for (let y = 112; y < 320; y += 17) rings += `<path d="M126,${y} C126,${y - 6} 174,${y - 6} 174,${y} L174,${y + 10} C174,${y + 16} 126,${y + 16} 126,${y + 10} Z" fill="#cfe3ee" stroke="#6b93aa" stroke-width="1.2"/>`;
  const lobeR = "M178,104 C204,98 226,116 228,150 C230,184 214,214 190,218 C176,216 172,196 172,170 Z";
  const lobeL = "M122,104 C96,98 74,116 72,150 C70,184 86,214 110,218 C124,216 128,196 128,170 Z";
  const follicles = [[236, 292, 17], [266, 280, 13], [270, 308, 14], [248, 316, 11]];
  return `
<linearGradient id="hs-thy-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e0937a"/><stop offset="1" stop-color="#a8503f"/></linearGradient>
<!-- trachea rings -->
<path d="M126,94 L126,330 L174,330 L174,94 Z" fill="#a9d3e6" stroke="#6b93aa" stroke-width="1.4"/>
${rings}
<!-- thyroid and cricoid cartilages -->
<path d="M100,10 C110,6 140,18 150,40 C160,18 190,6 200,10 L196,58 C186,76 166,84 150,86 C134,84 114,76 104,58 Z" fill="#dce9f0" stroke="#6b93aa" stroke-width="1.6"/>
<path d="M150,18 L150,84" stroke="#6b93aa" stroke-width="1.4" stroke-dasharray="3 2"/>
<path d="M120,90 C120,86 180,86 180,90 L180,106 C180,110 120,110 120,106 Z" fill="#cfe3ee" stroke="#6b93aa" stroke-width="1.4"/>
<!-- pyramidal lobe, lobes and isthmus -->
<path d="M148,140 C148,124 152,108 156,92 L162,92 C160,108 158,126 156,142 Z" fill="url(#hs-thy-g)" stroke="#6e2f22" stroke-width="1.2"/>
<path d="${lobeR}" fill="url(#hs-thy-g)" stroke="#6e2f22" stroke-width="1.6"/>
<path d="${lobeL}" fill="url(#hs-thy-g)" stroke="#6e2f22" stroke-width="1.6"/>
<path d="M118,140 C140,132 160,132 182,140 L182,158 C160,150 140,150 118,158 Z" fill="url(#hs-thy-g)" stroke="#6e2f22" stroke-width="1.6"/>
<path d="${lobeR}" fill="url(#hs-gloss)" opacity=".5"/><path d="${lobeL}" fill="url(#hs-gloss)" opacity=".5"/>
<!-- arteries: superior and inferior thyroid -->
${tube("M246,30 C240,60 226,90 210,112", 5.4, "#d4504b", "#6e1f22")}
${tube("M54,30 C60,60 74,90 90,112", 5.4, "#d4504b", "#6e1f22")}
${tube("M270,250 C262,214 236,196 204,200", 5, "#d4504b", "#6e1f22")}
${tube("M30,250 C38,214 64,196 96,200", 5, "#d4504b", "#6e1f22")}
<!-- recurrent laryngeal nerves in the tracheo-oesophageal groove -->
${tube("M132,330 L132,232 C134,214 136,190 134,160", 3.4, "#f4dc78", "#8a6a1c")}
${tube("M168,330 L168,232 C166,214 164,190 166,160", 3.4, "#f4dc78", "#8a6a1c")}
<!-- parathyroid glands: posterior surface, seen through the lobes (dashed) -->
<g fill="#f0c04a" stroke="#8a6a1c" stroke-width="1.4" stroke-dasharray="3 2"><ellipse cx="206" cy="132" rx="7" ry="5"/><ellipse cx="204" cy="190" rx="7" ry="5"/><ellipse cx="94" cy="132" rx="7" ry="5"/><ellipse cx="96" cy="190" rx="7" ry="5"/></g>
<!-- histology inset: thyroid follicles with colloid, follicular cells and a parafollicular (C) cell -->
<rect x="200" y="256" width="96" height="70" rx="10" fill="#f6dcee" stroke="#9d6bb0" stroke-width="1.4"/>
${follicles.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#f6a8c4" stroke="#8a3a66" stroke-width="1.4"/><circle cx="${x}" cy="${y}" r="${r - 4.5}" fill="#fbe0ea" stroke="#c4709a" stroke-width=".8"/>`).join("")}
<circle cx="250" cy="298" r="3.4" fill="#fff" stroke="#6b3d88" stroke-width="1.2"/>
<path d="M0,0" />`;
}

// =====================================================================================
// 5. Long bone (longitudinal section)
// =====================================================================================
function longBone(): string {
  const OUT = "M70,40 C70,18 96,10 120,10 C146,10 172,18 172,40 C172,62 160,84 156,100 L158,262 C160,282 174,300 174,322 C174,346 148,352 122,352 C96,352 68,346 68,322 C68,300 82,282 84,262 L86,100 C82,84 70,62 70,40 Z";
  const CAV = "M100,108 L100,258 C100,264 142,264 142,258 L142,108 C142,102 100,102 100,108 Z";
  const r = rng(3);
  let trab = "";
  const spongy = (y0: number, y1: number, x0: number, x1: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0);
      trab += `M${r1(x)},${r1(y)} l${r1((r() - 0.5) * 16)},${r1((r() - 0.5) * 16)} `;
    }
  };
  spongy(24, 92, 84, 160, 70); spongy(272, 340, 84, 156, 70);
  return `
<clipPath id="hs-lb-clip"><path d="${OUT}"/></clipPath>
<linearGradient id="hs-lb-g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d8c79a"/><stop offset=".4" stop-color="#f6eed6"/><stop offset="1" stop-color="#cdbb90"/></linearGradient>
<!-- periosteum (outer fibrous sheath) -->
<path d="${OUT}" fill="none" stroke="#e8a0a8" stroke-width="7" stroke-linejoin="round" clip-path="url(#hs-lb-clip)" opacity="0"/>
<path d="${OUT}" fill="url(#hs-lb-g)" stroke="#8b7757" stroke-width="2"/>
<path d="M86,100 C84,92 80,86 76,78 M156,100 C158,92 162,86 166,78" fill="none" stroke="#e29aa2" stroke-width="3.4" stroke-linecap="round"/>
<path d="M86,104 L84,262 M156,104 L158,262" fill="none" stroke="#e29aa2" stroke-width="3.4"/>
<!-- spongy (cancellous) bone in both epiphyses -->
<g clip-path="url(#hs-lb-clip)"><path d="${trab}" fill="none" stroke="#a58d5e" stroke-width="2" stroke-linecap="round"/>
<rect x="60" y="22" width="120" height="70" fill="#e9d6ad" opacity=".45"/><rect x="60" y="272" width="120" height="70" fill="#e9d6ad" opacity=".45"/></g>
<!-- medullary cavity with yellow marrow and endosteum -->
<path d="${CAV}" fill="#f6dd7a" stroke="#c4a22c" stroke-width="2"/>
<path d="M106,122 C112,140 108,160 112,180 M130,130 C134,150 130,176 134,204" fill="none" stroke="#e6b84a" stroke-width="1.4" opacity=".8"/>
<!-- epiphyseal (growth) plates and metaphyses -->
<path d="M76,96 C100,104 140,104 164,96 M76,268 C100,260 140,260 164,268" fill="none" stroke="#5aa6c8" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 7"/>
<!-- articular cartilage -->
<path d="M74,34 C78,18 100,12 120,12 C140,12 164,18 168,34" fill="none" stroke="#7cc6e8" stroke-width="7" stroke-linecap="round"/>
<path d="M72,330 C76,346 98,350 120,350 C142,350 166,346 170,330" fill="none" stroke="#7cc6e8" stroke-width="7" stroke-linecap="round"/>
<!-- nutrient artery through the nutrient foramen -->
${tube("M232,170 C204,172 182,176 160,180 C146,182 134,190 126,200", 4.6, "#d4504b", "#6e1f22")}
<path d="M0,0" />`;
}

// =====================================================================================
// 6. Spinal cord cross-section with the stretch (monosynaptic) reflex arc
// =====================================================================================
function reflexArc(): string {
  const half = "M200,116 C214,114 232,104 240,70 C244,58 256,58 258,72 C262,100 248,128 238,140 C262,142 284,152 286,172 C290,196 270,216 246,214 C226,212 214,198 212,180 L200,180 Z";
  return `
<linearGradient id="hs-sc-w" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f8f2e2"/><stop offset="1" stop-color="#e2d6b4"/></linearGradient>
<!-- white matter, grey matter butterfly, central canal -->
<ellipse cx="200" cy="146" rx="116" ry="104" fill="url(#hs-sc-w)" stroke="#9c8a5c" stroke-width="2"/>
<path d="M200,40 L200,252" stroke="#c9b98c" stroke-width="1.6" stroke-dasharray="3 3"/>
<path d="${half}" fill="#bdb6cf" stroke="#6f6890" stroke-width="1.6"/>
<g transform="translate(400,0) scale(-1,1)"><path d="${half}" fill="#bdb6cf" stroke="#6f6890" stroke-width="1.6"/></g>
<rect x="190" y="112" width="20" height="68" fill="#bdb6cf"/>
<circle cx="200" cy="148" r="5" fill="#cfeaf5" stroke="#4f93b5" stroke-width="1.4"/>
<!-- sensory (afferent) neuron: muscle spindle -> peripheral nerve -> dorsal root ganglion -> dorsal root -> dorsal horn (same side) -->
<ellipse cx="30" cy="40" rx="20" ry="9" fill="#d98a8a" stroke="#8a2f35" stroke-width="1.4"/>
<path d="M14,40 C24,36 36,44 46,40" fill="none" stroke="#fff3a8" stroke-width="2"/>
${tube("M46,40 C70,44 86,50 100,52", 3.4, "#f4dc78", "#8a6a1c")}
<ellipse cx="112" cy="55" rx="15" ry="11" fill="#e8c2e8" stroke="#6b3d88" stroke-width="1.6"/><circle cx="112" cy="55" r="5" fill="#9b6bb0"/>
${tube("M126,58 C142,60 152,64 156,78 C158,92 152,106 150,124 C150,134 148,140 146,146", 3.4, "#f4dc78", "#8a6a1c")}
<!-- synapse in the ventral horn: afferent terminal on the alpha motor neuron -->
<circle cx="146" cy="152" r="5.4" fill="#ff6b81" stroke="#8a2f35" stroke-width="1"/>
<circle cx="146" cy="184" r="11" fill="#7ab8c8" stroke="#2f7f86" stroke-width="2"/><circle cx="146" cy="184" r="4.4" fill="#2f7f86"/>
<path d="M146,160 C144,168 142,174 142,174" fill="none" stroke="#7ab8c8" stroke-width="3"/>
<path d="M156,172 C164,166 170,160 172,152 M136,176 C128,170 124,162 124,154" fill="none" stroke="#2f7f86" stroke-width="2.2" stroke-linecap="round"/>
<!-- motor (efferent) fibre: ventral horn -> ventral root -> muscle -->
${tube("M142,196 C134,222 100,254 60,262", 3.4, "#e8b04a", "#8a5a1c")}
<ellipse cx="34" cy="262" rx="26" ry="12" fill="#c25a58" stroke="#6e1f22" stroke-width="1.6"/>
<path d="M14,258 C24,254 40,266 54,262 M12,266 C24,262 40,272 52,268" fill="none" stroke="#f0a29a" stroke-width="1.2"/>
<path class="hs-a-ap glow" d="M46,40 C70,44 86,50 100,52 L126,58 C142,60 152,64 156,78 C158,92 152,106 150,124 L146,146 L146,172 L142,196 C134,222 100,254 60,262"/><path class="hs-a-ap" d="M46,40 C70,44 86,50 100,52 L126,58 C142,60 152,64 156,78 C158,92 152,106 150,124 L146,146 L146,172 L142,196 C134,222 100,254 60,262"/><circle class="hs-a-flash" cx="34" cy="262" r="8"/>
<!-- inhibitory interneuron (to the antagonist) and the ascending branch to the brain -->
<circle cx="184" cy="108" r="4.4" fill="#4f86c6" stroke="#1f3f6e" stroke-width="1"/>
<path d="M150,124 C158,112 176,110 182,108" fill="none" stroke="#4f86c6" stroke-width="2" stroke-dasharray="3 2"/>
<path d="M156,70 C164,52 176,32 186,14 l-8,2 m8,-2 l2,9" fill="none" stroke="#6f6890" stroke-width="2.4" stroke-linecap="round"/>
<path d="M0,0" />`;
}

export const SYSTEM_FIGURES_2: Figure[] = [
  {
    id: "hs-sarcomere", name: "Sarcomere (Z discs, thin actin and thick myosin filaments, A/I/H bands, M line)",
    tags: ["excitation-contraction", "excitation contraction", "actin filament", "actin filaments", "sarcomere", "sarcomeres", "myofibril", "myofilament", "myosin", "sliding filament", "sliding filament theory", "cross bridge", "cross-bridge", "cross bridge cycle", "muscle contraction", "skeletal muscle", "muscle fibre", "muscle fiber", "z disc", "z line", "m line", "a band", "i band", "h zone", "titin", "tropomyosin", "troponin", "excitation contraction coupling", "rigor mortis", "length tension", "length-tension", "striated muscle", "myology", "muscle physiology", "muscle histology"],
    w: 360, h: 240, vars: "(fixed colours: actin red beads, myosin green, Z discs dark)",
    notes: "RELAXED sarcomere, Z disc to Z disc (left Z (40,40-200), right Z (320,40-200)). THICK filaments (myosin, green, 3 rows y=78,118,158) span x 110-250 with heads pointing away from the BARE ZONE at the M line (x=180). THIN filaments (actin, red beads, 4 rows y=58,98,138,178) are anchored on each Z disc and reach x=150 (left) and x=210 (right), leaving the H zone (150-210). Bands (relaxed): A band = length of the thick filaments (110-250); I band = Z disc to the edge of the A band (40-110 and 250-320; contains only thin filaments); H zone = centre of the A band with only thick filaments (150-210). Titin (gold springs) links Z disc to the thick filaments (46-110). ALREADY ANIMATED: both thin-filament groups slide inwards and back (contraction), so the I band and H zone narrow while the A band stays the same; speed via --hs-speed.",
    svg: sarcomere(),
  },
  {
    id: "hs-ear", name: "Ear (coronal section: external, middle and inner ear, ossicles, cochlea, Eustachian tube)",
    tags: ["outer ear", "ear anatomy", "ear drum", "hearing", "auditory", "audition", "cochlea", "cochlear", "organ of corti", "tympanic membrane", "eardrum", "ear drum", "ossicle", "ossicles", "malleus", "incus", "stapes", "oval window", "round window", "semicircular canal", "semicircular canals", "vestibule", "vestibular", "eustachian", "eustachian tube", "pharyngotympanic", "otitis", "otitis media", "otitis externa", "otosclerosis", "meniere", "vertigo", "deafness", "hearing loss", "conductive hearing loss", "sensorineural", "auricle", "pinna", "external auditory canal", "middle ear", "inner ear", "vestibulocochlear", "cholesteatoma", "tinnitus", "sound transmission", "rinne", "weber"],
    w: 360, h: 262, vars: "(fixed colours)",
    notes: "Coronal section of the RIGHT ear, lateral = LEFT, medial (brain) = RIGHT. Pinna (0-46,40-200); external acoustic meatus (skin-lined tube, (40-112,106-140)); TYMPANIC MEMBRANE (112,122) at its end; MIDDLE EAR cavity (air, pale blue, (150,125)) with the ossicles: malleus handle on the drum (118,114), head (142,92); incus body (152,98), long process (158,120); stapes footplate in the OVAL WINDOW (176,124) (red bar); ROUND WINDOW (184,154); EUSTACHIAN TUBE runs down and medially from the middle ear (166,172) to the nasopharynx (268,260). INNER EAR (bony labyrinth, purple/gold): vestibule (206,126), three SEMICIRCULAR CANALS (superior (222,50), posterior (270,70), lateral (250,110)), COCHLEA (gold spiral, (212,186)). Vestibulocochlear nerve (yellow) leaves at (236,170) to the right; facial nerve (226,138). ALREADY ANIMATED: sound dots travel down the meatus and a pressure wave runs round the cochlea.",
    svg: ear(),
  },
  {
    id: "hs-lymph-node", name: "Lymph node (capsule, cortex follicles, paracortex, medulla, afferent and efferent lymphatics)",
    tags: ["lymphoid follicle", "lymph node", "lymph nodes", "lymphatic", "lymphatics", "lymphatic system", "lymphadenopathy", "lymphadenitis", "lymph flow", "afferent lymphatic", "efferent lymphatic", "germinal centre", "germinal center", "paracortex", "medullary cords", "subcapsular sinus", "high endothelial venule", "hev", "cervical lymph nodes", "lymphoid", "lymphoid tissue", "secondary lymphoid", "sentinel node", "metastasis lymph", "immune response", "b cell", "t cell", "lymphoma", "reactive lymphadenopathy", "cervical lymphadenopathy"],
    w: 300, h: 242, vars: "(fixed colours)",
    notes: "Bean-shaped node, convex side TOP, hilum at the BOTTOM (152,176). Three AFFERENT lymphatics with valves enter the capsule at the top ((104,20), (154,14), (206,24)); EFFERENT lymphatic leaves the hilum ((152,210)); artery (red, (122,215)) and vein (blue, (190,215)) at the hilum. Capsule = thick dark outline; SUBCAPSULAR SINUS = pale-blue ring just inside it; trabeculae = thin dark lines (122,60), (186,64). CORTEX (outer): B-cell FOLLICLES = purple circles with a pale GERMINAL CENTRE ((78,102), (90,66), (122,46), (162,40), (202,50), (236,80), (242,122)); PARACORTEX (deep cortex, T-cell zone, dotted pink, (150,110)); MEDULLA near the hilum: medullary cords (dark pink, (126,160)) and medullary sinuses (blue, (150,166)). ALREADY ANIMATED: lymph dots flow afferent -> subcapsular sinus -> medullary sinus -> efferent (--hs-flow).",
    svg: lymphNode(),
  },
  {
    id: "hs-thyroid", name: "Thyroid and parathyroid glands (anterior view, nerves, arteries) with follicle histology inset",
    tags: ["thyroid follicle", "thyroid", "thyroid gland", "thyroidectomy", "goitre", "goiter", "hyperthyroidism", "hypothyroidism", "graves", "graves disease", "hashimoto", "thyroiditis", "thyroid nodule", "thyroid cancer", "thyroid hormone", "thyroxine", "follicular cell", "parafollicular", "c cell", "calcitonin", "parathyroid", "parathyroid gland", "parathyroid hormone", "pth", "hyperparathyroidism", "hypoparathyroidism", "hypocalcaemia", "recurrent laryngeal nerve", "superior thyroid artery", "inferior thyroid artery", "pyramidal lobe", "neck anatomy", "endocrine neck", "thyroglossal duct"],
    w: 300, h: 332, vars: "(fixed colours)",
    notes: "Anterior view of the neck, centre line x=150. Thyroid cartilage (shield, (150,40)) and cricoid (150,98) above the TRACHEA (rings, x 126-174, y 112-330). THYROID GLAND (red-brown): right lobe viewer-left (100,160), left lobe (200,160), ISTHMUS across trachea rings 2-4 ((150,148)), small PYRAMIDAL LOBE rising from the isthmus (156,116). Arteries (red): superior thyroid artery from the external carotid (246,30)->(210,112) and (54,30)->(90,112); inferior thyroid artery (from thyrocervical trunk) (270,250)->(204,200) and (30,250)->(96,200). RECURRENT LAryngeal NERVES (yellow) ascend in the tracheo-oesophageal groove (132,230) and (168,230) close to the inferior thyroid artery. FOUR PARATHYROID GLANDS (gold dashed ovals on the POSTERIOR surface, seen through): superior (206,132), (94,132); inferior (204,190), (96,190). Inset (bottom right, (200-296,256-326)): thyroid follicles = pink rings of cuboidal follicular cells around colloid (236,292); parafollicular C cell (white, (250,298)).",
    svg: thyroid(),
  },
  {
    id: "hs-long-bone", name: "Long bone in longitudinal section (epiphysis, metaphysis, diaphysis, marrow cavity, periosteum, growth plate)",
    tags: ["long bone", "bone structure", "femur", "humerus", "tibia", "diaphysis", "epiphysis", "metaphysis", "epiphyseal plate", "growth plate", "physis", "medullary cavity", "bone marrow", "yellow marrow", "red marrow", "periosteum", "endosteum", "articular cartilage", "compact bone", "cortical bone", "spongy bone", "cancellous bone", "trabecular bone", "nutrient artery", "nutrient foramen", "osteoporosis", "fracture healing", "rickets", "achondroplasia", "ossification", "endochondral ossification", "osteomyelitis", "salter harris", "bone growth", "bone anatomy"],
    w: 240, h: 360, vars: "(fixed colours)",
    notes: "Longitudinal section of a long bone, proximal end UP, centre x=120. Proximal EPIPHYSIS (y 10-96) with SPONGY (cancellous) bone (120,60) and a blue ARTICULAR CARTILAGE cap on top (120,12); EPIPHYSEAL (growth) PLATE = dotted blue line (120,100); METAPHYSIS just below it (120,120); DIAPHYSIS (shaft, y 104-262) with thick COMPACT (cortical) bone (92,180) and (150,180) around the MEDULLARY CAVITY filled with yellow marrow (121,180) lined by the ENDOSTEUM (100,180); PERIOSTEUM = pink outer sheath along the shaft (85,180) and (157,180); NUTRIENT ARTERY (red) entering the shaft through the nutrient foramen from the right ((160,180) <- (232,170)); distal metaphysis (120,248) and epiphysis (y 272-352) with spongy bone (120,310), growth plate (120,266), articular cartilage (120,350).",
    svg: longBone(),
  },
  {
    id: "hs-reflex-arc", name: "Spinal cord cross-section with the stretch reflex arc (afferent, synapse, motor neuron, muscle)",
    tags: ["afferent neuron", "afferent fibre", "reflex", "reflex arc", "stretch reflex", "knee jerk", "knee jerk reflex", "patellar reflex", "monosynaptic", "monosynaptic reflex", "polysynaptic", "withdrawal reflex", "muscle spindle", "golgi tendon", "spinal cord", "spinal cord cross section", "grey matter", "gray matter", "white matter", "dorsal horn", "ventral horn", "anterior horn", "dorsal root", "dorsal root ganglion", "ventral root", "alpha motor neuron", "lower motor neuron", "upper motor neuron", "hyperreflexia", "areflexia", "hyporeflexia", "clonus", "babinski", "reciprocal inhibition", "spinal nerve", "central canal", "neurology exam", "deep tendon reflex", "dtr"],
    w: 340, h: 290, vars: "(fixed colours)",
    notes: "Transverse section of the spinal cord, DORSAL = TOP, centre (200,146). White matter (cream ellipse) around the butterfly-shaped GREY MATTER: dorsal (posterior) horns pointing up ((246,76), (154,76)), ventral (anterior) horns down ((256,190), (144,190)), CENTRAL CANAL (200,148). The whole reflex is drawn on the viewer-LEFT (same side): muscle SPINDLE (receptor, (30,40)) -> afferent (sensory) fibre in the peripheral nerve (46,40)->(100,52) -> DORSAL ROOT GANGLION (cell body, purple, (112,55)) -> dorsal root entering the dorsal horn ((156,78)) -> SYNAPSE (red dot, (146,152)) -> alpha MOTOR NEURON in the ventral horn (blue-green cell, (146,184)) -> efferent fibre out through the VENTRAL ROOT (142,196)->(60,262) -> EFFECTOR muscle (red, (34,262)). Inhibitory interneuron to the antagonist motor neuron (blue dot, (184,108)); ascending branch to the brain (grey arrow, (170,40)). ALREADY ANIMATED: an impulse (yellow) travels receptor -> cord -> muscle (--hs-ap sets the time).",
    svg: reflexArc(),
  },
];
