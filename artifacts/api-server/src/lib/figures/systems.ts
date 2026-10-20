// More hand-built figures (v84): female reproductive tract, stomach, liver/biliary tree/pancreas,
// brain, eye, nephron, skin, small-intestine villus. Same conventions as data.ts / male.ts.
import type { Figure } from "./data";
import { tube, organ, wave, poly, smooth, rng, r1 } from "./kit";

// ---------- female reproductive tract (coronal, anterior view; patient's right = viewer's left) -------------
function femaleRepro(): string {
  const side = `
<path d="M112,92 C82,70 14,92 14,142 C14,200 58,236 114,204 Z" fill="#f6d9cf" opacity=".42" stroke="#d7a99a" stroke-width="1"/>
<path d="M92,160 L116,118" stroke="#e8d7a6" stroke-width="4" stroke-linecap="round"/>
${tube("M118,88 C104,78 88,74 76,78", 6, "#e9a49b", "#8a3f3f")}
${tube("M76,78 C58,80 46,92 42,108", 11, "#eeb0a6", "#8a3f3f")}
<g stroke="#c8656a" stroke-width="2.4" stroke-linecap="round" fill="none"><path d="M42,112 L28,124 M42,114 L32,134 M44,116 L40,140 M46,114 L50,140 M40,110 L24,114"/></g>
<g transform="rotate(-10 62 160)">
  <ellipse cx="62" cy="160" rx="26" ry="36" fill="#eab9a2" stroke="#9a5a45" stroke-width="1.4"/>
  <ellipse cx="62" cy="160" rx="26" ry="36" fill="url(#hs-gloss)" opacity=".55"/>
  <circle cx="52" cy="140" r="3" fill="#fff6e8" stroke="#b58a6a" stroke-width=".8"/><circle cx="70" cy="146" r="2.4" fill="#fff6e8" stroke="#b58a6a" stroke-width=".8"/>
  <circle cx="48" cy="164" r="9.5" fill="#dcecf7" stroke="#8aa7bd" stroke-width="1.1"/><circle cx="48" cy="164" r="4.2" fill="#fff" stroke="#8aa7bd" stroke-width=".8"/><circle cx="48" cy="164" r="1.8" fill="#e9b24e"/>
  <circle cx="72" cy="170" r="11" fill="#f1c84b" stroke="#a87a10" stroke-width="1.2"/><circle cx="72" cy="170" r="4" fill="#d9a21f"/>
  <circle cx="60" cy="184" r="5" fill="#f4f0e6" stroke="#9c9486" stroke-width="1"/>
</g>`;
  const mirror = `<g transform="translate(320,0) scale(-1,1)">${side}</g>`;
  return `
${side}
${mirror}
<!-- vagina -->
<path d="M108,204 C102,246 108,292 126,324 L194,324 C212,292 218,246 212,204 C198,222 180,230 160,230 C140,230 122,222 108,204 Z" fill="url(#hs-gut-g)" stroke="#8a4a3a" stroke-width="1.4"/>
<g fill="none" stroke="#a8604e" stroke-opacity=".6" stroke-width="1.6" stroke-linecap="round"><path d="M126,262 C144,268 176,268 194,262 M128,284 C146,290 174,290 192,284 M132,304 C148,309 172,309 188,304"/></g>
<path d="M150,246 L150,322 M170,246 L170,322" stroke="#fff" stroke-opacity=".28" stroke-width="5"/>
<!-- uterus: perimetrium/myometrium, endometrium, cervix -->
${organ("M160,62 C198,58 216,80 214,114 C212,152 198,178 190,202 L130,202 C122,178 108,152 106,114 C104,80 122,58 160,62 Z", "url(#hs-organ-g)", { shadow: true })}
<path d="M160,92 C178,90 192,98 190,120 C188,148 174,172 168,198 L152,198 C146,172 132,148 130,120 C128,98 142,90 160,92 Z" fill="#b8434c" stroke="#6e1f28" stroke-width="1.4"/>
<path d="M160,102 C170,102 178,108 176,122 C174,146 166,168 162,192 L158,192 C154,168 146,146 144,122 C142,108 150,102 160,102 Z" fill="#f2b2b0" opacity=".75"/>
<path d="M130,202 C130,222 142,232 160,232 C178,232 190,222 190,202 Z" fill="url(#hs-organ-g)" stroke="rgba(0,0,0,.42)" stroke-width="1.4"/>
<path d="M155,196 L155,224 M165,196 L165,224" stroke="#6e1f28" stroke-width="1.4"/>
<ellipse cx="160" cy="230" rx="5" ry="3" fill="#6e1f28"/>
`;
}

// ---------- stomach (cut-away) ----------------------------------------------------------------------------
function stomach(): string {
  const outer = "M86,66 C60,36 30,62 28,112 C26,178 50,244 112,280 C162,304 216,294 238,270 L254,248 C266,238 262,220 248,220 L226,226 C200,244 172,238 152,214 C130,190 126,150 124,116 C122,92 106,78 86,66 Z";
  const inner = "M88,80 C70,60 48,76 46,114 C44,170 64,230 118,262 C160,284 206,276 224,258 L240,242 L232,238 L222,244 C196,258 164,252 142,226 C118,198 114,156 112,118 C110,98 100,88 88,80 Z";
  // rugal folds: wavy curves following the long axis (fundus -> antrum)
  const bez = (t: number): [number, number] => {
    const u = 1 - t, P = [[72, 104], [66, 190], [124, 252], [214, 262]];
    return [u * u * u * P[0][0] + 3 * u * u * t * P[1][0] + 3 * u * t * t * P[2][0] + t * t * t * P[3][0], u * u * u * P[0][1] + 3 * u * u * t * P[1][1] + 3 * u * t * t * P[2][1] + t * t * t * P[3][1]];
  };
  let rug = "";
  for (let kk = -3; kk <= 3; kk++) {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 44; i++) {
      const t = i / 44, [x, y] = bez(t), [x2, y2] = bez(Math.min(1, t + 0.01)), [x1, y1] = bez(Math.max(0, t - 0.01));
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
      const off = kk * 9 * (1 - 0.42 * t) + Math.sin(t * 15 + kk * 1.7) * 2.6;
      pts.push([x - (dy / L) * off, y + (dx / L) * off]);
    }
    rug += `<path d="${smooth(pts)}" fill="none" stroke="#a8473f" stroke-width="5" stroke-linecap="round" opacity=".5"/><path d="${smooth(pts)}" fill="none" stroke="#e79a8c" stroke-width="2.2" stroke-linecap="round" opacity=".75" transform="translate(-1,-1)"/>`;
  }
  return `
<defs><clipPath id="hs-st-clip"><path d="${inner}"/></clipPath></defs>
${tube("M64,0 C66,24 80,48 92,70", 22, "#e3a58f", "#7a4636")}
<g filter="url(#hs-shadow)"><path d="${outer}" fill="url(#hs-muscle-g)" stroke="#6e2a2c" stroke-width="1.6"/></g>
<path d="M44,116 C46,190 70,246 130,276" fill="none" stroke="#ffffff" stroke-opacity=".18" stroke-width="5" stroke-linecap="round"/>
<path d="${inner}" fill="#f0b9a8" stroke="#a8554b" stroke-width="1.4"/>
<g clip-path="url(#hs-st-clip)">${rug}</g>
<path d="${inner}" fill="url(#hs-gloss)" opacity=".4"/>
<ellipse cx="92" cy="72" rx="15" ry="8" fill="#a84f4f" stroke="#5e1f22" stroke-width="1.3" transform="rotate(34 92 72)"/>
${tube("M246,232 C272,228 282,252 272,276 C266,292 246,298 228,292", 24, "#e3a58f", "#7a4636")}
<ellipse cx="238" cy="236" rx="14" ry="22" fill="url(#hs-muscle-g)" stroke="#5e1f22" stroke-width="1.5" transform="rotate(-18 238 236)"/>
<ellipse cx="246" cy="232" rx="5" ry="9" fill="#2a0f12" transform="rotate(-18 246 232)"/>
`;
}

// ---------- liver, gallbladder, bile ducts, pancreas, duodenum --------------------------------------------
function hepatobiliary(): string {
  return `
<!-- duodenum C-loop and pancreas -->
${tube("M150,200 C96,200 86,266 150,278 C190,284 232,278 262,268", 20, "#e3a58f", "#7a4636")}
<path d="M150,224 C176,210 232,218 272,200 C288,196 294,212 280,224 C242,248 190,260 156,252 Z" fill="url(#hs-gland-g)" stroke="#8a5420" stroke-width="1.4"/>
<path d="M150,224 C176,210 232,218 272,200 C288,196 294,212 280,224 C242,248 190,260 156,252 Z" fill="url(#hs-gloss)" opacity=".45"/>
<path d="M270,208 C240,226 198,232 162,236" fill="none" stroke="#fff3c8" stroke-width="2.4" stroke-linecap="round"/>
<!-- portal vein -->
${tube("M236,232 C226,190 206,150 176,126", 9, "#4f86c6", "#1f3f6e")}
<!-- liver -->
<g filter="url(#hs-shadow)"><path d="M18,70 C36,28 132,6 224,28 C276,40 296,72 274,102 C224,134 156,140 124,162 C78,172 28,150 18,70 Z" fill="url(#hs-liver-g)" stroke="#4e1c1f" stroke-width="1.6"/></g>
<path d="M150,16 C156,56 164,98 170,132" fill="none" stroke="#f0d9b4" stroke-width="5" stroke-linecap="round"/>
<path d="M18,70 C36,28 132,6 224,28 C276,40 296,72 274,102 C224,134 156,140 124,162 C78,172 28,150 18,70 Z" fill="url(#hs-gloss)" opacity=".55"/>
<path d="M44,60 C74,40 110,34 140,36" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="5" stroke-linecap="round"/>
<!-- bile ducts: right/left hepatic -> common hepatic -> common bile duct -->
${tube("M118,132 C136,126 150,130 160,144", 5, "#7fc58a", "#2c6b38")}
${tube("M206,128 C190,128 174,134 162,146", 5, "#7fc58a", "#2c6b38")}
${tube("M160,144 L152,182", 6, "#7fc58a", "#2c6b38")}
<!-- gallbladder + cystic duct -->
${tube("M122,160 C132,164 142,172 152,182", 4, "#7fc58a", "#2c6b38")}
<path d="M98,156 C84,174 90,204 112,212 C134,208 138,176 124,156 Z" fill="#5faa6e" stroke="#2c6b38" stroke-width="1.5"/>
<path d="M98,156 C84,174 90,204 112,212 C134,208 138,176 124,156 Z" fill="url(#hs-gloss)" opacity=".6"/>
${tube("M152,182 C154,206 166,226 190,246", 7, "#7fc58a", "#2c6b38")}
<circle cx="192" cy="248" r="5.4" fill="#e9c97a" stroke="#8a6a1c" stroke-width="1.3"/>
`;
}

// ---------- brain (lateral view) ---------------------------------------------------------------------------
function brain(): string {
  const outline = "M52,128 C38,66 88,22 160,18 C232,14 296,48 298,108 C300,142 282,158 262,160 C248,162 238,172 214,178 C190,182 160,172 140,178 C110,186 84,180 70,164 C58,154 54,142 52,128 Z";
  const R = rng(33);
  let gy = "";
  for (let i = 0; i < 78; i++) {
    let x = 40 + R() * 270, y = 14 + R() * 170, a = R() * Math.PI * 2;
    const pts: Array<[number, number]> = [[x, y]];
    const nn = 6 + Math.floor(R() * 6);
    for (let kk = 0; kk < nn; kk++) { a += (R() - 0.5) * 2.4; x += Math.cos(a) * 7.5; y += Math.sin(a) * 7.5; pts.push([x, y]); }
    const d = smooth(pts);
    gy += `<path d="${d}" fill="none" stroke="rgba(112,38,56,.55)" stroke-width="3" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.1" stroke-linecap="round" transform="translate(1.2,-1.2)"/>`;
  }
  return `
<defs><clipPath id="hs-br-clip"><path d="${outline}"/></clipPath></defs>
${tube("M184,160 C190,190 196,214 198,238", 24, "#e8b3aa", "#8a4a4a")}
<ellipse cx="190" cy="196" rx="20" ry="13" fill="#e8b3aa" stroke="#8a4a4a" stroke-width="1.2"/>
<path d="M196,166 C226,160 292,164 296,198 C298,226 262,226 236,222 C212,220 196,208 196,166 Z" fill="#d79c96" stroke="#8a4a4a" stroke-width="1.5"/>
<g fill="none" stroke="rgba(110,40,50,.5)" stroke-width="1.8" stroke-linecap="round"><path d="M214,176 C246,172 278,176 290,186 M208,188 C240,186 280,190 292,200 M210,200 C242,200 276,204 288,212 M218,212 C242,214 262,214 276,218 M226,168 C250,166 272,168 286,176"/></g>
<g clip-path="url(#hs-br-clip)">
  <rect x="0" y="0" width="320" height="240" fill="var(--hs-frontal,#f0b8b4)"/>
  <path d="M170,0 C178,50 186,90 192,126 L110,160 L110,260 L330,260 L330,0 Z" fill="var(--hs-parietal,#f3d4a2)"/>
  <path d="M236,0 C246,40 256,80 262,120 L330,130 L330,0 Z" fill="var(--hs-occipital,#a9c8ec)"/>
  <path d="M96,160 C140,150 200,136 262,124 L330,130 L330,260 L96,260 Z" fill="var(--hs-temporal,#b7dcb0)"/>
  <rect x="0" y="0" width="320" height="240" fill="url(#hs-gloss)" opacity=".5"/>
  ${gy}
</g>
<path d="${outline}" fill="none" stroke="#8a4a4a" stroke-width="2"/>
<path d="M170,18 C180,56 186,92 192,128" fill="none" stroke="#6a2433" stroke-width="3.6" stroke-linecap="round"/>
<path d="M98,158 C140,148 200,134 262,122" fill="none" stroke="#6a2433" stroke-width="3.6" stroke-linecap="round"/>
<path d="M236,22 C246,56 256,92 262,122" fill="none" stroke="#6a2433" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="1 5"/>
`;
}

// ---------- eye (horizontal section, cornea on the left) ---------------------------------------------------
function eye(): string {
  const cx = 160, cy = 115, R = 88;
  const mir = (inner: string) => `${inner}<g transform="translate(0,230) scale(1,-1)">${inner}</g>`;
  return `
<defs><clipPath id="hs-eye-clip"><circle cx="${cx}" cy="${cy}" r="${R - 9}"/></clipPath></defs>
${tube("M244,132 C262,136 282,142 300,152", 26, "#f3ecdc", "#8c7a58")}
${tube("M244,132 C262,136 282,142 300,152", 14, "#f8e08a", "#b99a38")}
<g filter="url(#hs-shadow)"><circle cx="${cx}" cy="${cy}" r="${R}" fill="#f6f1e8" stroke="#8c7a58" stroke-width="2"/></g>
<circle cx="${cx}" cy="${cy}" r="${R - 7}" fill="#5a3a2c"/>
<circle cx="${cx}" cy="${cy}" r="${R - 11}" fill="#e9a08a"/>
<circle cx="${cx}" cy="${cy}" r="${R - 14}" fill="#dfeef7" stroke="rgba(0,0,0,.2)"/>
<g clip-path="url(#hs-eye-clip)"><g fill="none" stroke="#9fc0d6" stroke-width="1.2" opacity=".75"><path d="M140,66 C168,86 196,78 230,96 M136,118 C170,112 204,126 236,122 M142,164 C170,152 204,160 226,150"/></g></g>
<!-- retinal vessels, optic disc, macula and fovea -->
<g fill="none" stroke="#c0393f" stroke-width="1.8" stroke-linecap="round"><path d="M240,142 C224,122 210,92 194,70 M240,146 C220,164 208,180 194,198"/></g>
<path d="M236,130 L244,130 L244,154 L236,154 Z" fill="#f7e19a" stroke="#a8861c" stroke-width="1.2"/>
<ellipse cx="238" cy="112" rx="4.4" ry="8" fill="#f3b24a" stroke="#a8861c" stroke-width="1"/><ellipse cx="240" cy="112" rx="1.6" ry="3" fill="#b8741c"/>
<!-- cornea (transparent dome), anterior chamber, ciliary body, iris, lens, zonules -->
<path d="M90,62 C60,74 50,100 50,115 C50,130 60,156 90,168 L100,150 C80,142 72,128 72,115 C72,102 80,88 100,80 Z" fill="#bfe0f2" stroke="#6b95ae" stroke-width="1.6"/>
<path d="M100,80 C80,88 72,102 72,115 C72,128 80,142 100,150 L110,150 L110,80 Z" fill="#eaf6fb"/>
${mir(`<path d="M92,62 L122,72 L118,92 L98,82 Z" fill="#c99a7a" stroke="#6e4a34" stroke-width="1.2"/><path d="M104,76 L116,86 M110,74 L120,88" stroke="#8a5a3e" stroke-width="1"/><path d="M98,64 L114,68 L112,100 L106,98 Z" fill="#8a6a42" stroke="#4a3418" stroke-width="1.1"/><path d="M118,90 L124,98" stroke="#8c7a58" stroke-opacity=".8" stroke-width="1"/>`)}
<ellipse cx="128" cy="115" rx="14" ry="29" fill="url(#hs-lens-g)" stroke="#a8944a" stroke-width="1.4"/>
<ellipse cx="128" cy="115" rx="14" ry="29" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2" transform="translate(-2,-2)"/>
`;
}

// ---------- nephron -----------------------------------------------------------------------------------------
function nephron(): string {
  const pct = (() => {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 60; i++) { const t = i / 60; pts.push([92 + t * 36 + Math.sin(t * 22) * 9, 62 + t * 38 + Math.cos(t * 22) * 7]); }
    return poly(pts);
  })();
  const dct = (() => {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 44; i++) { const t = i / 44; pts.push([104 + t * 66 + Math.sin(t * 18) * 7, 34 - t * 4 + Math.cos(t * 18) * 6]); }
    return poly(pts);
  })();
  return `
<!-- cortex / medulla backdrop -->
<rect x="0" y="0" width="240" height="130" fill="#f2c9bf" opacity=".5"/>
<rect x="0" y="130" width="240" height="200" fill="#d9a3a0" opacity=".42"/>
<path d="M0,130 L240,130" stroke="#a8605c" stroke-width="1.2" stroke-dasharray="5 4"/>
<!-- afferent / efferent arterioles and glomerulus -->
${tube("M10,40 C26,46 40,52 52,56", 7, "#d4504b", "#6e1f22")}
${tube("M72,84 C84,100 80,112 62,116", 6, "#e0716c", "#6e1f22")}
<circle cx="64" cy="66" r="30" fill="#fbeedd" stroke="#8a6a4a" stroke-width="2.4"/>
<circle cx="64" cy="66" r="24" fill="#f6dfc8" stroke="#c9a77c" stroke-width="1"/>
<g fill="none" stroke="#c0393f" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M52,56 C44,64 54,74 62,66 C70,58 78,70 70,78 C62,86 52,80 56,70"/></g>
<g fill="none" stroke="#ffb0ab" stroke-width="1.6" stroke-linecap="round"><path d="M52,56 C44,64 54,74 62,66 C70,58 78,70 70,78 C62,86 52,80 56,70"/></g>
<!-- proximal convoluted tubule (cortex) -->
<path d="${pct}" fill="none" stroke="rgba(100,60,10,.55)" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
<path d="${pct}" fill="none" stroke="#e8a04a" stroke-width="8.6" stroke-linecap="round" stroke-linejoin="round"/>
<path d="${pct}" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
<!-- loop of Henle: thin descending limb, thin then thick ascending limb -->
${tube("M128,100 L128,138 L128,300", 7, "#f4dc92", "#8a7022", "hs-nf-desc")}
${tube("M128,300 C128,322 150,322 150,300", 7, "#f4dc92", "#8a7022")}
${tube("M150,300 L150,252", 7, "#9ad0c8", "#2f6e66")}
${tube("M150,252 L150,150 C150,118 130,88 100,76", 10, "#3fae9c", "#1f5e54")}
<!-- distal convoluted tubule -->
<path d="${dct}" fill="none" stroke="rgba(60,40,100,.55)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="${dct}" fill="none" stroke="#a98bd6" stroke-width="7.6" stroke-linecap="round" stroke-linejoin="round"/>
<path d="${dct}" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="2" stroke-linecap="round"/>
<!-- collecting duct down to the papilla -->
${tube("M176,36 C196,40 204,60 204,90 L204,300 L204,326", 12, "#d9696f", "#7a2f36", "hs-nf-cd")}
<circle cx="97" cy="76" r="4.2" fill="#2a6a60" stroke="#fff" stroke-width="1"/>
`;
}

// ---------- skin ----------------------------------------------------------------------------------------------
function skin(): string {
  const R = rng(11);
  let epi = "";
  // wavy dermo-epidermal junction
  const junction = (x: number) => 24 + Math.sin(x / 9) * 3.2;
  let up = "M0,0 L280,0 L280,", dn = "";
  const pts: Array<[number, number]> = [];
  for (let x = 0; x <= 280; x += 4) pts.push([x, junction(x)]);
  const jpath = poly(pts);
  let fat = "";
  for (let i = 0; i < 60; i++) { const x = 8 + (i % 12) * 23 + (Math.floor(i / 12) % 2) * 11, y = 136 + Math.floor(i / 12) * 20; fat += `<ellipse cx="${x}" cy="${y}" rx="11" ry="9" fill="url(#hs-fat-g)" stroke="#d6b04a" stroke-width="1"/>`; }
  let corn = "";
  for (let i = 0; i < 28; i++) corn += `<rect x="${i * 10}" y="${i % 2 ? 1 : 3}" width="10" height="${i % 2 ? 4 : 4}" rx="1.5" fill="#f7dccb" stroke="#c9967c" stroke-width=".7"/>`;
  let basal = "";
  for (let x = 2; x < 280; x += 7) { const y = junction(x); basal += `<ellipse cx="${x + 3}" cy="${y - 4.5}" rx="3" ry="5" fill="#7a4f88" stroke="#3f2a63" stroke-width=".7"/>`; }
  let spin = "";
  for (let r = 0; r < 2; r++) for (let x = 4; x < 280; x += 9) spin += `<ellipse cx="${x + (r ? 4 : 0)}" cy="${19 - r * 6 - Math.sin(x / 9) * 1.2}" rx="4.4" ry="3.2" fill="#e6c2dc" stroke="#9a5f8a" stroke-width=".7"/>`;
  let gran = "";
  for (let x = 3; x < 280; x += 9) gran += `<ellipse cx="${x + 3}" cy="${8.5}" rx="4.4" ry="1.8" fill="#c9a0c4" stroke="#8a5f86" stroke-width=".6"/><circle cx="${x + 3}" cy="8.5" r=".9" fill="#5a3a58"/>`;
  let coll = "";
  for (let i = 0; i < 16; i++) { const y = 42 + R() * 78, x = R() * 240; coll += `<path d="M${r1(x)},${r1(y)} q18,-6 36,0 q18,6 34,-2" fill="none" stroke="#e7b9ae" stroke-width="2" stroke-linecap="round" opacity=".8"/>`; }
  let pac = "";
  for (let i = 5; i >= 1; i--) pac += `<ellipse cx="52" cy="206" rx="${6 + i * 4.4}" ry="${4 + i * 3.4}" fill="${i % 2 ? "#f4e6c4" : "#e8d29c"}" stroke="#9a8450" stroke-width=".9"/>`;
  return `
<rect x="0" y="120" width="280" height="120" fill="#fbe9a8" stroke="#d6b04a" stroke-width="1"/>
${fat}
<path d="${jpath} L280,124 L0,124 Z" fill="#f2b5ae" stroke="#c97c76" stroke-width="1.2"/>
<path d="M0,124 C60,112 120,130 190,118 C230,112 260,122 280,118" fill="none" stroke="#c97c76" stroke-width="1.2" stroke-dasharray="4 3"/>
${coll}
<path d="${jpath} L280,0 L0,0 Z" fill="#f0cdbf" stroke="#a8745a" stroke-width="1.2"/>
${corn}${gran}${spin}${basal}
<!-- hair follicle, shaft, sebaceous gland, arrector pili -->
<path d="M146,0 L148,0 L150,40 L152,100 L154,150 L158,150 L158,100 L160,40 L162,0 Z" fill="#4a3426" stroke="#2a1d14" stroke-width=".8" opacity="0"/>
<path d="M148,-4 L146,34" stroke="#3a2a1e" stroke-width="5" stroke-linecap="round"/>
<path d="M140,20 C140,60 144,110 148,140 C140,154 146,172 160,172 C174,172 178,154 170,140 C170,110 172,60 172,20 Z" fill="#f6e3b4" stroke="#a8861c" stroke-width="1.2"/>
<path d="M150,22 C150,70 152,112 154,142" fill="none" stroke="#3a2a1e" stroke-width="5" stroke-linecap="round"/>
<ellipse cx="160" cy="158" rx="12" ry="11" fill="#d7a35a" stroke="#6e4a1c"/>
<ellipse cx="160" cy="160" rx="6" ry="6" fill="#f6e8c9"/>
<g fill="#f8e07a" stroke="#c9a31c" stroke-width="1.1"><ellipse cx="184" cy="64" rx="13" ry="9"/><ellipse cx="190" cy="82" rx="11" ry="8"/><ellipse cx="180" cy="96" rx="10" ry="7"/></g>
<path d="M172,76 C176,70 178,66 176,64" fill="none" stroke="#c9a31c" stroke-width="2.2"/>
<path d="M142,100 C120,92 98,70 92,38" fill="none" stroke="#b8434c" stroke-width="5.4" stroke-linecap="round"/>
<!-- eccrine sweat gland, duct and pore -->
<path d="${wave(224, 6, 224, 130, 7, 7, 64)}" fill="none" stroke="#8aaed6" stroke-width="3.6" stroke-linecap="round"/>
<path d="M210,136 C208,126 226,124 236,130 C246,138 244,152 232,158 C220,164 206,158 208,148 C210,140 224,138 228,146 C232,152 222,154 220,148" fill="none" stroke="#6f95c4" stroke-width="7" stroke-linecap="round"/>
<path d="M210,136 C208,126 226,124 236,130 C246,138 244,152 232,158 C220,164 206,158 208,148 C210,140 224,138 228,146" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/>
<ellipse cx="224" cy="1" rx="3" ry="1.4" fill="#2a3f66"/>
<!-- Meissner corpuscle in a dermal papilla, capillary loop, Pacinian corpuscle -->
<ellipse cx="62" cy="32" rx="6" ry="9" fill="#f1d6a0" stroke="#8a6a1c" stroke-width="1"/><path d="M58,28 h8 M58,32 h8 M58,36 h8" stroke="#8a6a1c" stroke-width=".8"/>
<path d="M104,44 C100,34 104,28 108,34 C112,28 116,34 112,44" fill="none" stroke="#d4504b" stroke-width="2.6" stroke-linecap="round"/>
${pac}
<ellipse cx="52" cy="206" rx="4" ry="9" fill="#f0c04a" stroke="#8a6a1c" stroke-width=".8"/>
<path d="M52,178 L52,150" stroke="#f0c04a" stroke-width="2.6"/>
<path d="M0,150 C70,142 130,160 190,146 C230,138 260,150 280,146" fill="none" stroke="#c0393f" stroke-width="3" opacity=".8"/>
<path d="M0,156 C70,150 130,168 190,154 C230,146 260,158 280,154" fill="none" stroke="#4f86c6" stroke-width="3" opacity=".8"/>
`;
}

// ---------- small-intestine villus ------------------------------------------------------------------------
function villus(): string {
  const cells = (side: number) => {
    let s = "";
    for (let i = 0; i < 9; i++) {
      const y = 36 + i * 14, x = side < 0 ? 78 - Math.sin(i / 8 * Math.PI) * 0 : 142;
      s += `<rect x="${side < 0 ? 66 : 142}" y="${y}" width="12" height="12" rx="2.4" fill="#f2c9b0" stroke="#b27a60" stroke-width=".9"/>`;
      s += `<ellipse cx="${side < 0 ? 70 : 150}" cy="${y + 6}" rx="2.2" ry="3.6" fill="#7a4f88"/>`;
      s += `<g stroke="#8a6a52" stroke-width=".9">${[0, 1, 2, 3, 4].map((k) => `<path d="M${side < 0 ? 66 : 154} ${y + 1.6 + k * 2.2} h${side < 0 ? -4 : 4}"/>`).join("")}</g>`;
    }
    return s;
  };
  return `
<!-- lamina propria core + crypts + muscularis mucosae -->
<path d="M0,176 L220,176 L220,280 L0,280 Z" fill="#f6d2c8" stroke="#c98a80" stroke-width="1"/>
<path d="M66,176 L66,40 C66,12 154,12 154,40 L154,176 Z" fill="#f9e0d4" stroke="#b27a60" stroke-width="1.4"/>
${cells(-1)}${cells(1)}
<path d="M66,40 C66,12 154,12 154,40" fill="none" stroke="#b27a60" stroke-width="1.4"/>
<g stroke="#8a6a52" stroke-width=".9">${Array.from({ length: 13 }, (_, k) => `<path d="M${72 + k * 6},24 v-5"/>`).join("")}</g>
<!-- goblet cell -->
<path d="M122,60 C112,60 110,76 118,84 C124,90 134,86 134,76 C134,68 130,60 122,60 Z" fill="#cfe6f2" stroke="#5d8ea8" stroke-width="1.2" transform="translate(-4,10)"/>
<!-- central lacteal and capillary network -->
${tube("M110,34 C108,70 112,120 110,178", 14, "#fff1b8", "#b8941c")}
<path d="M110,40 C110,80 110,130 110,176" fill="none" stroke="#e7cf79" stroke-width="2" stroke-dasharray="1.5 5"/>
<path d="M84,52 C94,70 90,96 86,128 C84,150 92,166 98,176" fill="none" stroke="#c0393f" stroke-width="3.2" stroke-linecap="round"/>
<path d="M136,52 C126,70 130,96 134,128 C136,150 128,166 122,176" fill="none" stroke="#4f86c6" stroke-width="3.2" stroke-linecap="round"/>
<path d="M84,70 C94,74 100,74 108,72 M136,84 C126,86 120,86 114,84 M86,108 C96,112 104,112 108,110 M134,120 C124,124 118,124 114,122" fill="none" stroke="#c0393f" stroke-width="1.6" stroke-opacity=".8"/>
<!-- smooth-muscle strand -->
<path d="M110,100 L100,96 M110,120 L120,116" stroke="#b8434c" stroke-width="2" stroke-linecap="round"/>
<!-- crypts of Lieberkuhn with Paneth cells -->
<path d="M32,176 L32,230 C32,248 64,248 64,230 L64,176" fill="#f6dcd0" stroke="#b27a60" stroke-width="1.3"/>
<path d="M156,176 L156,230 C156,248 188,248 188,230 L188,176" fill="#f6dcd0" stroke="#b27a60" stroke-width="1.3"/>
<g fill="#f0a24a" stroke="#8a5420" stroke-width=".9"><circle cx="38" cy="236" r="4.4"/><circle cx="58" cy="236" r="4.4"/><circle cx="162" cy="236" r="4.4"/><circle cx="182" cy="236" r="4.4"/></g>
<g fill="#7a4f88"><circle cx="44" cy="224" r="2.6"/><circle cx="52" cy="214" r="2.6"/><circle cx="168" cy="224" r="2.6"/><circle cx="176" cy="214" r="2.6"/></g>
<rect x="0" y="262" width="220" height="18" fill="url(#hs-muscle-g)" stroke="#6e2a2c" stroke-width="1" opacity=".9"/>
<path d="M0,176 L220,176" stroke="#b8434c" stroke-width="3" stroke-dasharray="14 3"/>
`;
}

export const SYSTEM_FIGURES: Figure[] = [
  {
    id: "hs-female-repro", name: "Female reproductive tract (coronal: uterus, tubes, ovaries, vagina)",
    tags: ["female reproductive", "female genital", "female genital tract", "female reproductive system", "uterus", "uterine", "womb", "fallopian", "uterine tube", "oviduct", "salpingitis", "ovary", "ovaries", "ovarian", "ovulation", "follicle", "corpus luteum", "menstrual", "menstruation", "menstrual cycle", "endometrium", "endometrial", "endometriosis", "myometrium", "fibroid", "leiomyoma", "cervix", "cervical", "vagina", "vaginal", "ectopic pregnancy", "ectopic", "pcos", "polycystic ovary", "ovarian cyst", "fertilisation", "fertilization", "implantation", "pid", "pelvic inflammatory", "hysterectomy", "gynaecology", "gynecology"],
    w: 320, h: 330, vars: "(fixed colours)",
    notes: "Anterior view, patient's right = viewer's left, symmetrical about x=160. Uterus (160,130): fundus top (160,62), endometrial cavity (160,92-198, red), myometrium around it, cervix (160,214) with cervical canal and external os (160,230); vagina below (y 222-324). Uterine tubes: isthmus near the uterus corners (118,88)/(202,88), ampulla (60,80)/(260,80), fimbriae at (30,118)/(290,118). Ovaries (62,160) and (258,160) each show a primordial follicle, a growing antral follicle with oocyte (48,164), a yellow corpus luteum (72,170) and a corpus albicans (60,184); ovarian ligament joins each ovary to the uterus; broad ligament = pale sheet behind. Ovarian side: left ovary mirror is right.",
    svg: femaleRepro(),
  },
  {
    id: "hs-stomach", name: "Stomach (cut-away with rugae, oesophagus, pylorus, duodenum)",
    tags: ["stomach", "gastric", "gastritis", "peptic ulcer", "ulcer", "gastric ulcer", "duodenal ulcer", "h pylori", "helicobacter", "gerd", "reflux", "oesophagus", "esophagus", "cardia", "fundus", "pylorus", "pyloric", "pyloric stenosis", "gastric acid", "hcl", "parietal cell", "chief cell", "intrinsic factor", "gastrin", "gastric cancer", "rugae", "greater curvature", "lesser curvature", "gastric emptying", "digestion", "vomiting", "gastroparesis", "zollinger"],
    w: 290, h: 320, vars: "(fixed colours)",
    notes: "Anterior wall cut away to show the mucosa with rugal folds. Oesophagus enters top-left (64,0)->(92,70); gastro-oesophageal junction / cardia (92,72); fundus = dome at top-left (60,70); body = large central part (80,170); greater curvature = the long outer left/bottom edge, lesser curvature = short inner right edge ((124,116)->(152,214)->(226,226)); antrum (190,250); pyloric sphincter (238,236); duodenum (276,262) continues round the bottom right.",
    svg: stomach(),
  },
  {
    id: "hs-hepatobiliary", name: "Liver, gallbladder, bile ducts, pancreas and duodenum (anterior view)",
    tags: ["liver", "hepatic", "hepatitis", "cirrhosis", "hepatocellular", "gallbladder", "gall bladder", "cholecystitis", "cholelithiasis", "gallstone", "gallstones", "biliary", "bile", "bile duct", "common bile duct", "cholangitis", "cholestasis", "obstructive jaundice", "jaundice", "bilirubin", "portal vein", "portal hypertension", "pancreas", "pancreatic", "pancreatitis", "pancreatic cancer", "duodenum", "ampulla of vater", "sphincter of oddi", "ercp", "hepatobiliary", "hepatic ducts", "courvoisier", "choledocholithiasis"],
    w: 310, h: 300, vars: "(fixed colours)",
    notes: "Anterior view, patient's right = viewer's left. Liver (150,80): right lobe left of the falciform ligament (150,16)->(170,132), left lobe to the right; right and left hepatic ducts leave the hilum (118,132)/(206,128) and join as the common hepatic duct (160,144); gallbladder (112,184) with cystic duct (122,160)->(152,182); common bile duct (152,182)->(190,246) enters the duodenum at the ampulla of Vater (192,248); portal vein (blue) runs (236,232)->(176,126); pancreas head in the duodenal C-loop (150,236), body/tail to the right (270,206), pancreatic duct = pale line along it.",
    svg: hepatobiliary(),
  },
  {
    id: "hs-brain", name: "Brain (lateral view: lobes, cerebellum, brainstem)",
    tags: ["brain", "cerebrum", "cerebral cortex", "cortex", "lobe", "lobes", "frontal lobe", "parietal lobe", "temporal lobe", "occipital lobe", "cerebellum", "cerebellar", "brainstem", "brain stem", "pons", "medulla oblongata", "midbrain", "gyrus", "sulcus", "central sulcus", "sylvian", "lateral fissure", "broca", "wernicke", "aphasia", "motor cortex", "sensory cortex", "homunculus", "stroke", "mca", "neglect", "agnosia", "apraxia", "hemispheres", "neuroanatomy", "cerebral"],
    w: 320, h: 244, vars: "--hs-frontal --hs-parietal --hs-temporal --hs-occipital (lobe colours)",
    notes: "Left lateral view, ANTERIOR = LEFT. Frontal lobe (pink, left, e.g. (100,80)), parietal (amber, (225,60)), occipital (blue, (285,90)), temporal (green, below the lateral fissure, (190,160)); central sulcus (170,18)->(192,128); lateral (Sylvian) fissure (98,158)->(262,122); parieto-occipital sulcus dotted (236,22)->(262,122); cerebellum (250,196); brainstem: midbrain (186,170), pons bulge (190,196), medulla (198,232). Precentral gyrus = strip just anterior (left) of the central sulcus, postcentral just behind it. Broca ~ (110,110) (inferior frontal), Wernicke ~ (232,130) (posterior superior temporal).",
    svg: brain(),
  },
  {
    id: "hs-eye", name: "Eye (horizontal section: cornea, lens, iris, retina, optic nerve)",
    tags: ["eye", "eyeball", "ocular", "ophthalmology", "vision", "visual", "cornea", "lens", "cataract", "iris", "pupil", "retina", "retinal", "macula", "macular degeneration", "fovea", "optic disc", "optic nerve", "papilloedema", "papilledema", "glaucoma", "aqueous humour", "aqueous humor", "vitreous", "choroid", "sclera", "ciliary body", "accommodation", "myopia", "hypermetropia", "presbyopia", "retinal detachment", "diabetic retinopathy", "uveitis", "light reflex", "refraction", "photoreceptor", "rods", "cones"],
    w: 310, h: 232, vars: "(fixed colours)",
    notes: "Horizontal section, cornea at the LEFT (front), optic nerve at the RIGHT (back). Cornea (50,115); anterior chamber (85,115) filled with aqueous; iris (106,82) and (106,148) with the pupil between them (110,115); lens (128,115) with zonules to the ciliary body (108,76)/(108,154); vitreous = large pale chamber (180,115); retina = inner pink ring, choroid = dark ring, sclera = outer white ring; macula/fovea (238,112); optic disc (240,142) where the optic nerve leaves (244,132)->(300,152).",
    svg: eye(),
  },
  {
    id: "hs-nephron", name: "Nephron (glomerulus, PCT, loop of Henle, DCT, collecting duct)",
    tags: ["nephron", "glomerulus", "glomerular", "bowman", "bowman's capsule", "proximal tubule", "proximal convoluted tubule", "pct", "loop of henle", "henle", "thick ascending limb", "distal tubule", "distal convoluted tubule", "dct", "collecting duct", "juxtaglomerular", "macula densa", "afferent arteriole", "efferent arteriole", "tubular reabsorption", "tubular secretion", "countercurrent", "furosemide", "loop diuretic", "thiazide", "spironolactone", "acetazolamide", "sglt2", "aquaporin", "renal physiology", "gfr", "filtration", "urine concentration", "adh", "aldosterone", "raas", "renin"],
    w: 240, h: 330, vars: "(fixed colours: PCT orange, descending thin limb yellow, thin ascending teal-grey, thick ascending green, DCT purple, collecting duct red)",
    notes: "Cortex (top, pale) / medulla (bottom) divided at y=130. Afferent arteriole enters (10,40)->(52,56), glomerulus + Bowman's capsule (64,66), efferent arteriole leaves (72,84)->(62,116); PCT coils (92..128, 62..100); descending thin limb straight down x=128 (y 100->300); hairpin at the bottom (139,314); thin ascending limb x=150 (y 300->252) then thick ascending limb up x=150 to the macula densa (97,76) beside the glomerulus; DCT coils (104..170, 34); collecting duct on the right (176,36)->(204,326) down to the papilla. Paths with ids: filtrate flow runs PCT -> descending -> ascending -> DCT -> collecting duct.",
    svg: nephron(),
  },
  {
    id: "hs-skin", name: "Skin (epidermis, dermis, hypodermis, hair follicle, glands, receptors)",
    tags: ["skin", "cutaneous", "dermatology", "epidermis", "epidermal", "stratum corneum", "stratum basale", "stratum granulosum", "stratum spinosum", "stratum lucidum", "dermis", "dermal", "hypodermis", "subcutaneous", "keratinocyte", "melanocyte", "melanin", "langerhans", "merkel", "hair follicle", "hair", "sebaceous", "sebaceous gland", "sweat gland", "eccrine", "apocrine", "arrector pili", "pacinian", "meissner", "psoriasis", "eczema", "acne", "melanoma", "burns", "wound healing", "pemphigus", "pemphigoid", "basal cell carcinoma", "squamous cell carcinoma", "thermoregulation"],
    w: 280, h: 240, vars: "(fixed colours)",
    notes: "Vertical section, surface at the top. Epidermis y 0-24: stratum corneum (flat scales, top), granulosum, spinosum, basale (purple columnar cells on the wavy junction y~24). Dermis y 24-124: papillary layer (loose, capillary loop (108,40), Meissner corpuscle (62,32)), reticular layer (collagen bundles); hair follicle (160,100) with shaft (150,-4 to 140), bulb/papilla (160,158), sebaceous gland (184,76) yellow lobes, arrector pili muscle red (142,100)->(92,38); eccrine sweat gland coil (226,146) with duct spiral up to the pore (224,1). Hypodermis y 124-240: fat cells (yellow), vessels (red artery y~150, blue vein y~156), Pacinian corpuscle (52,206).",
    svg: skin(),
  },
  {
    id: "hs-villus", name: "Small-intestine villus and crypt (brush border, lacteal, capillaries)",
    tags: ["villus", "villi", "microvilli", "brush border", "small intestine", "jejunum", "ileum", "absorption", "malabsorption", "coeliac", "celiac", "coeliac disease", "gluten", "lacteal", "chylomicron", "crypt", "crypts of lieberkuhn", "crypt of lieberkuhn", "paneth", "goblet cell", "enterocyte", "intestinal epithelium", "intestinal histology", "lactose intolerance", "lactase", "fat absorption", "carbohydrate absorption", "protein absorption", "sprue", "tropical sprue", "whipple", "intestinal absorption", "gut histology", "enteroendocrine"],
    w: 220, h: 280, vars: "(fixed colours)",
    notes: "One villus (centre, x 66-154, y 12-176) on the muscularis mucosae. Columnar enterocytes with a striated brush border line both sides (left x 66-78, right x 142-154); goblet cell (118,76); lamina propria core with a capillary loop (arteriole red left (86,100), venule blue right (134,100)) and the central lacteal (110,34)->(110,178) in yellow; smooth-muscle strands (110,100)/(110,120). Two crypts of Lieberkuhn at the base ((48,230) and (172,230)) with orange Paneth cells at the bottom and purple stem cells above; muscularis mucosae = red band at the very bottom (y 262-280).",
    svg: villus(),
  },
];
