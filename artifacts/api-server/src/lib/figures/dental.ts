// Dental / oral (BDS) figures (v105). Hand-built, shaded textbook-style SVG, same conventions as
// male.ts and systems.ts: fixed colours, landmark coordinates in `notes` so the AI can label them.
import type { Figure } from "./data";
import { tube, rng, r1 } from "./kit";

// Shared tooth outline pieces (single-rooted tooth, centre line x=150, crown top y=40, CEJ y=176, apex y~380).
const TOOTH_OUT = "M150,40 C170,40 196,52 204,86 C210,112 206,150 190,176 C188,230 176,310 156,372 Q150,384 144,372 C124,310 112,230 110,176 C94,150 90,112 96,86 C104,52 130,40 150,40 Z";
const DENTINE = "M150,54 C166,54 188,64 194,90 C198,112 195,148 182,176 C182,226 172,300 154,360 Q150,368 146,360 C128,300 118,226 118,176 C105,148 102,112 106,90 C112,64 134,54 150,54 Z";
const PULP = "M128,112 C128,98 136,84 140,98 C144,106 146,104 150,100 C154,104 156,106 160,98 C164,84 172,98 172,112 C174,140 166,166 160,184 C158,216 156,280 153,344 L151.6,376 L148.4,376 L147,344 C144,280 142,216 140,184 C134,166 126,140 128,112 Z";
// right-hand soft tissue (gingiva + alveolar mucosa); mirrored for the left side
const GUM = "M202,158 L196,172 L194,184 L189,189 L189,194 L244,204 L244,336 L264,336 L264,196 C248,194 232,188 221,176 C215,166 210,157 202,158 Z";
const ROOT_X: Array<[number, number]> = [[176, 190], [200, 188.8], [230, 186], [260, 182], [290, 177], [320, 171], [350, 163], [372, 155]];
function rootX(y: number): number {
  for (let i = 0; i < ROOT_X.length - 1; i++) {
    const [y0, x0] = ROOT_X[i], [y1, x1] = ROOT_X[i + 1];
    if (y >= y0 && y <= y1) return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
  }
  return 155;
}
const mirror = (inner: string) => `<g transform="translate(300,0) scale(-1,1)">${inner}</g>`;

/** Bone, PDL and gingiva around the root (shared by the tooth, caries and periodontium figures). */
function supportingTissues(opts: { pocket?: boolean } = {}): string {
  const rand = rng(11);
  // cancellous trabeculae
  let trab = "";
  for (let i = 0; i < 70; i++) {
    const x = 72 + rand() * 156, y = 214 + rand() * 188;
    if (Math.abs(x - rootX(Math.min(372, Math.max(190, y))) + 150 - 150) < 0) continue;
    const dx = (rand() - 0.5) * 14, dy = (rand() - 0.5) * 10;
    trab += `M${r1(x)},${r1(y)} l${r1(dx)},${r1(dy)} `;
  }
  const bone = `
<path d="M54,200 C90,196 150,194 150,194 C150,194 210,196 246,200 L248,408 L52,408 Z" fill="#e9d6ad" stroke="#a98f5c" stroke-width="1.4"/>
<path d="${trab}" fill="none" stroke="#b99b63" stroke-width="1.3" stroke-linecap="round" opacity=".75"/>
<path d="M52,206 L66,200 L66,408 L52,408 Z" fill="#f6ecd2" stroke="#a98f5c" stroke-width="1"/>
<path d="M248,206 L234,200 L234,408 L248,408 Z" fill="#f6ecd2" stroke="#a98f5c" stroke-width="1"/>
<path d="M52,206 L248,206" fill="none" stroke="none"/>`;
  // PDL: wide stroke along the root outline, clipped below the bone crest so it hugs the socket
  const pdl = `<clipPath id="hs-tooth-pdlclip"><rect x="0" y="190" width="300" height="230"/></clipPath>
<path d="${TOOTH_OUT}" fill="#e9a7ae" stroke="#d2767f" stroke-width="16" stroke-linejoin="round" clip-path="url(#hs-tooth-pdlclip)"/>`;
  let fibres = "";
  for (let y = 204; y <= 352; y += 9) {
    const xr = rootX(y);
    const oblique = y > 300 ? `l7,6` : `l7,-5`;
    fibres += `M${r1(xr + 0.5)},${y} ${oblique} M${r1(300 - xr - 0.5)},${y} ${y > 300 ? "l-7,6" : "l-7,-5"} `;
  }
  const fibreSvg = `<path d="${fibres}" fill="none" stroke="#9d3d49" stroke-width="1.1" stroke-linecap="round" opacity=".8" clip-path="url(#hs-tooth-pdlclip)"/>`;
  const apical = `<path d="M150,372 L150,376 M148,384 L152,384" stroke="#9d3d49" stroke-width="1"/>`;
  const gumR = `
<path d="${GUM}" fill="#ee9aa6" stroke="#b9525f" stroke-width="1.3" stroke-linejoin="round"/>
<path d="M244,206 L244,336 L264,336 L264,200 C256,200 248,204 244,206 Z" fill="#d9626f" opacity=".55"/>
<path d="M221,176 C232,188 248,194 264,196" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2.4" stroke-linecap="round"/>
<path d="M190.5,187 L193.5,176" stroke="#e0788a" stroke-width="3.4" stroke-linecap="round"/>
<path d="M196,180 C204,184 214,186 226,184 M192,191 C206,190 222,194 240,200 M198,170 C208,176 218,182 232,186" fill="none" stroke="#a94452" stroke-width="1" stroke-linecap="round" opacity=".7"/>
<path d="M244,258 L264,258" stroke="#a94452" stroke-width="1.4" stroke-dasharray="3 3"/>`;
  return `${bone}${pdl}${fibreSvg}${apical}${gumR}${mirror(gumR)}`;
}

export function toothSection(opts: { caries?: boolean } = {}): string {
  // dentinal tubules: radiate from the pulp towards the DEJ / root surface, clipped to the dentine
  let tub = "";
  for (let a = -168; a <= -12; a += 8) {
    const t = (a * Math.PI) / 180;
    tub += `M${r1(150 + 22 * Math.cos(t))},${r1(130 + 22 * Math.sin(t))} L${r1(150 + 78 * Math.cos(t))},${r1(130 + 78 * Math.sin(t))} `;
  }
  for (let y = 178; y <= 346; y += 7) {
    const w = Math.max(10, 36 - (y - 178) * 0.15);
    tub += `M${150 - 4},${y} l${-w},${r1(w * 0.18)} M${150 + 4},${y} l${w},${r1(w * 0.18)} `;
  }
  return `
<clipPath id="hs-tooth-crown"><rect x="0" y="0" width="300" height="178"/></clipPath>
<clipPath id="hs-tooth-root"><rect x="0" y="176" width="300" height="240"/></clipPath>
<clipPath id="hs-tooth-dent"><path d="${DENTINE}"/></clipPath>
<linearGradient id="hs-tooth-enamel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7fbff"/><stop offset=".6" stop-color="#dfeaf2"/><stop offset="1" stop-color="#b7c9d6"/></linearGradient>
<linearGradient id="hs-tooth-dentine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e6b2"/><stop offset="1" stop-color="#d9b86d"/></linearGradient>
<radialGradient id="hs-tooth-pulp" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="#ff9aa6"/><stop offset="1" stop-color="#c4424f"/></radialGradient>
${supportingTissues()}
<!-- enamel (crown) and cementum (root) -->
<path d="${TOOTH_OUT}" fill="url(#hs-tooth-enamel)" clip-path="url(#hs-tooth-crown)"/>
<path d="${TOOTH_OUT}" fill="#f0c54f" clip-path="url(#hs-tooth-root)"/>
<!-- dentine -->
<path d="${DENTINE}" fill="url(#hs-tooth-dentine)"/>
<path d="${tub}" fill="none" stroke="#9a7632" stroke-width=".8" opacity=".38" clip-path="url(#hs-tooth-dent)"/>
<!-- pulp with horns, canal and apical foramen; vessels and nerve leave through the apex -->
<path d="${PULP}" fill="url(#hs-tooth-pulp)" stroke="#8c2a35" stroke-width="1.2"/>
<path d="M146,214 C147,250 148,296 149.6,350" fill="none" stroke="#5b8fd0" stroke-width="1.6" opacity=".9"/>
<path d="M154,214 C153,250 152,296 150.4,350" fill="none" stroke="#fff3a8" stroke-width="1.6" opacity=".9"/>
${opts.caries ? "" : `${tube("M150,372 C150,384 146,394 144,404", 2.6, "#d4504b", "#6e1f22")}
${tube("M150,372 C152,384 156,394 158,404", 2.6, "#4f86c6", "#1f3f6e")}
${tube("M150,372 C150,386 150,398 150,406", 2.2, "#f0d56a", "#8a6a1c")}`}
${opts.caries ? "" : `<path class="hs-a-dots blue" d="M150,404 L150,210"/>`}
<!-- outline, enamel/dentine junction and highlights -->
<path d="${TOOTH_OUT}" fill="none" stroke="#6f5a30" stroke-width="1.6" stroke-linejoin="round"/>
<path d="M106,90 C112,64 134,54 150,54 C166,54 188,64 194,90 C198,112 195,148 182,176 M106,90 C102,112 105,148 118,176" fill="none" stroke="#b79a52" stroke-width="1.1" stroke-dasharray="3 2.4"/>
<path d="M120,66 C132,52 150,48 168,52" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="3.4" stroke-linecap="round"/>
<path d="M104,96 C102,116 104,140 112,158" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2.4" stroke-linecap="round"/>
<!-- cementoenamel junction ticks -->
<path d="M186,176 L196,176 M114,176 L104,176" stroke="#7a5a20" stroke-width="1.4"/>${opts.caries ? cariesOverlay() : ""}`;
}

/** Smooth-surface caries on the right of the crown, pulpitis and a periapical abscess (drawn over the tooth). */
function cariesOverlay(): string {
  return `
<clipPath id="hs-tooth-lesion"><path d="${TOOTH_OUT}"/></clipPath>
<g clip-path="url(#hs-tooth-lesion)">
<!-- 1 enamel: cone with its base on the surface and apex at the DEJ (white-spot / demineralised) -->
<path d="M214,92 L196,108 L214,140 Z" fill="#fff" opacity=".85" stroke="#c9d6df" stroke-width="1"/>
<!-- 2 dentine: cone with its base at the DEJ and apex towards the pulp; zones from the pulp side outwards -->
<path d="M198,86 C182,102 174,114 172,122 C176,132 186,144 198,152 Z" fill="#d9c28a" opacity=".9"/>
<path d="M198,92 C186,104 180,114 179,122 C182,130 190,140 198,147 Z" fill="#b99a5c" opacity=".95"/>
<path d="M198,98 C190,106 186,114 185,122 C188,128 193,135 198,141 Z" fill="#6f4b25"/>
<!-- 3 cavity opening on the surface (infected, destroyed enamel and dentine) -->
<path d="M214,102 C206,106 200,112 197,118 C200,124 206,130 214,134 Z" fill="#2c1b10"/>
</g>
<!-- reparative (tertiary) dentine on the pulpal wall opposite the lesion + inflamed, hyperaemic pulp -->
<path d="M168,104 C164,112 164,124 168,134" fill="none" stroke="#e8c26c" stroke-width="3.4" stroke-linecap="round"/>
<path d="${PULP}" fill="#ff5a68" opacity=".35"/>
<!-- periapical abscess / granuloma around the apex -->
<ellipse cx="150" cy="394" rx="34" ry="22" fill="#e6df7a" stroke="#b44b52" stroke-width="3"/>
<ellipse cx="150" cy="394" rx="25" ry="14" fill="#f6f2a4" opacity=".9"/>
<g fill="#fff" opacity=".7"><circle cx="138" cy="392" r="2.4"/><circle cx="152" cy="398" r="2"/><circle cx="162" cy="390" r="2.6"/></g>
<path d="${TOOTH_OUT}" fill="none" stroke="#6f5a30" stroke-width="1.6" stroke-linejoin="round" clip-path="url(#hs-tooth-root)"/>`;
}

export const DENTAL_FIGURES: Figure[] = [
  {
    id: "hs-tooth", name: "Tooth in longitudinal section (enamel, dentine, pulp, cementum, PDL, alveolar bone, gingiva)",
    tags: ["gingivitis", "periodontitis", "periodontal", "periodontium", "periodontal pocket", "periodontal disease", "attachment loss", "junctional epithelium", "sharpey", "dentine hypersensitivity", "tooth", "teeth", "dental", "dentistry", "enamel", "dentine", "dentin", "dentinal tubule", "dentinal tubules", "odontoblast", "pulp", "dental pulp", "pulp chamber", "root canal", "apical foramen", "cementum", "periodontal ligament", "pdl", "alveolar bone", "gingiva", "gum", "gingival sulcus", "cementoenamel junction", "cej", "dej", "dental anatomy", "oral histology", "dental histology", "tooth structure", "parts of a tooth", "hydrodynamic theory", "endodontic", "endodontics", "root canal treatment", "pulpotomy", "pulp capping", "pulp stone", "reparative dentine", "tertiary dentine", "sclerotic dentine", "pulpitis"],
    w: 300, h: 420, vars: "(fixed colours)",
    notes: "Generic single-rooted tooth, labio-lingual section, crown UP, centre line x=150, symmetrical. Landmarks (x,y): enamel = pale blue-white cap over the crown (cusp tip (150,44), side (204,100)); DEJ = dashed line just inside it ((150,56), (196,100)); dentine (yellow, fine tubules radiating from the pulp) (176,140) and in the root (172,260); pulp chamber with two pulp horns (150,130), horns (136,92) and (164,92); root canal (150,170)->(150,350) carrying a vein (blue) and nerve (yellow); apical foramen (150,374) where artery, vein and nerve enter; cementum = thin yellow layer on the root (186,260); CEJ = cervical line (190,176) / (110,176); periodontal ligament = pink band around the root with oblique fibres (192,260), apical fibres (150,388); alveolar bone = beige socket (cortical plates x 52-66 and 234-248, cancellous between) crest at (192,194); gingiva (pink) right (222,184): free gingival margin (202,158), gingival sulcus (197,172) between tooth and gum, junctional epithelium (192,184), attached gingiva (254,230), alveolar mucosa darker red (254,300) below the dashed mucogingival line (254,258). Left side mirrors the right.",
    svg: toothSection(),
  },
  {
    id: "hs-caries", name: "Dental caries progression: enamel, dentine, pulpitis and periapical abscess",
    tags: ["caries", "dental caries", "tooth decay", "carious", "pulpitis", "irreversible pulpitis", "reversible pulpitis", "periapical abscess", "dental abscess", "periapical granuloma", "periapical", "apical periodontitis", "radicular cyst", "acute apical abscess", "streptococcus mutans", "s mutans", "demineralisation", "demineralization", "remineralisation", "remineralization", "white spot", "white spot lesion", "stephan curve", "reparative dentine", "tertiary dentine", "zones of caries", "toothache", "necrotic pulp", "pulp necrosis", "sequelae of caries"],
    w: 300, h: 420, vars: "(fixed colours)",
    notes: "Same tooth geometry as #hs-tooth (centre x=150) with a smooth-surface lesion on the RIGHT crown. Landmarks (x,y): enamel lesion = white cone, base on the surface (214,100-140), apex at the DEJ (198,110); dentine lesion = cone whose base is the DEJ (198,90-150): outer pale zone = sclerotic/translucent dentine (178,122), middle brown = demineralised (186,122), dark brown = infected/destroyed zone (192,120); black cavity open to the mouth (206,118); reparative (tertiary) dentine = yellow line on the pulp wall (166,118); inflamed red pulp (150,140) (pulpitis, pulp horns (136,92),(164,92)); yellow-white periapical abscess with red inflammatory halo at the apex (150,394). Bone, PDL and gingiva as in #hs-tooth.",
    svg: toothSection({ caries: true }),
  },
];
