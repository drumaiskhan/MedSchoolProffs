// Male reproductive system figures (v84). Hand-built, shaded textbook-style SVG.
import type { Figure } from "./data";
import { tube, organ, wave, poly, rng, r1 } from "./kit";

// =====================================================================================
// 1. Male reproductive system - median sagittal section of the pelvis (anterior = left)
// =====================================================================================
function maleSystem(): string {
  const urethra = "M152,138 L152,190 C152,206 140,212 126,222 L116,236 L115,336";
  const cordUp = "M218,226 L218,40 C218,22 200,22 200,40 L200,100";
  const cordScrotal = "M204,346 C228,338 232,302 228,274 C225,254 221,240 218,226";
  return `
<!-- body section (soft tissue) -->
<path d="M30,0 L30,142 C30,170 50,188 74,200 L124,210 L148,228 L232,234 L262,270 C292,264 306,238 306,200 L306,0 Z" fill="url(#hs-skintone)" opacity=".30" stroke="#b98265" stroke-width="1.4" stroke-opacity=".6"/>
<path d="M30,40 L30,142 C30,170 50,188 74,200" fill="none" stroke="#e8c9a0" stroke-width="7" opacity=".5"/>
<!-- rectum and anal canal -->
${tube("M250,0 C254,60 258,120 256,176 C255,204 262,222 266,244", 30, "#e2ac94", "rgba(110,50,40,.55)")}
<path d="M250,0 C254,60 258,120 256,176 C255,204 262,222 266,244" fill="none" stroke="#c98a72" stroke-width="12" stroke-dasharray="2 7" opacity=".55"/>
<ellipse cx="266" cy="252" rx="9" ry="6" fill="#a8574f" stroke="rgba(0,0,0,.4)"/>
<!-- pubic symphysis (bone ends with the fibrocartilage disc between) -->
<path d="M64,126 C70,116 94,118 100,132 L104,180 C102,194 84,198 76,190 C70,172 64,148 64,126 Z" fill="url(#hs-bone-g)" stroke="#8b7757" stroke-width="1.4"/>
<path d="M80,121 C88,142 94,170 90,194" fill="none" stroke="#8fb9cc" stroke-width="6" stroke-linecap="round"/>
<path d="M78,124 C84,146 90,170 86,192" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.6" stroke-linecap="round"/>
<!-- vas deferens: spermatic cord up the canal, arching over the ureter -->
${tube(cordUp, 7, "#f2dcaa", "#8a5f2a")}
<path d="M218,226 L218,44" fill="none" stroke="#c1555a" stroke-width="2.2" transform="translate(8,0)" opacity=".9"/>
<path d="M218,226 L218,44" fill="none" stroke="#5b8fd0" stroke-width="2.6" stroke-dasharray="5 2" transform="translate(-8,0)" opacity=".9"/>
<!-- bladder -->
${organ("M116,84 C116,52 140,40 160,42 C186,44 198,66 196,92 C195,114 184,130 170,138 L134,138 C120,126 116,104 116,84 Z", "url(#hs-organ-g)", { shadow: true })}
<path d="M128,86 C128,62 144,52 160,54 C178,56 186,72 184,92 C183,108 176,120 166,127 L140,127 C132,118 128,102 128,86 Z" fill="url(#hs-urine-g)" stroke="rgba(120,70,30,.5)" stroke-width="1"/>
<path d="M140,66 C150,58 168,60 176,70" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="3" stroke-linecap="round"/>
${tube("M190,10 C192,34 190,58 188,80", 4.4, "#f1d68a", "#8a6a2a")}
<!-- seminal vesicle (lobulated) and the ampulla of the vas -->
<path d="M178,112 C190,104 204,110 208,122 C212,134 206,146 194,148 C184,148 176,140 176,128 C176,122 176,116 178,112 Z" fill="url(#hs-gland-g)" stroke="#8a5420" stroke-width="1.3"/>
<path d="M184,116 C192,120 196,128 192,138 M196,112 C202,120 204,130 198,142 M182,128 C186,134 190,140 188,146" fill="none" stroke="#8a5420" stroke-opacity=".5" stroke-width="1.2"/>
<path d="M178,112 C190,104 204,110 208,122 C212,134 206,146 194,148 C184,148 176,140 176,128 C176,122 176,116 178,112 Z" fill="url(#hs-gloss)" opacity=".5"/>
${tube("M200,98 C197,110 202,120 196,132", 9, "#f2dcaa", "#8a5f2a")}
<!-- prostate -->
<ellipse cx="152" cy="160" rx="29" ry="23" fill="url(#hs-gland-g)" stroke="#8a5420" stroke-width="1.4"/>
<ellipse cx="152" cy="160" rx="29" ry="23" fill="url(#hs-gloss)" opacity=".5"/>
<g fill="none" stroke="#8a5420" stroke-opacity=".4" stroke-width="1.1"><path d="M130,150 C138,146 146,150 148,156 M170,150 C164,146 158,150 156,156 M132,170 C140,174 146,172 148,166 M172,170 C164,174 158,172 156,166 M136,160 C140,158 144,160 146,162 M168,160 C164,158 160,160 158,162"/></g>
<!-- ejaculatory duct -->
${tube("M194,136 C178,146 166,154 156,164", 4, "#f2dcaa", "#8a5f2a")}
<!-- perineal membrane + bulbourethral gland -->
<path d="M96,190 L196,190 L196,197 L96,197 Z" fill="#ecd8a6" stroke="#a88a50" stroke-width="1"/>
<circle cx="168" cy="207" r="6" fill="url(#hs-gland-g)" stroke="#8a5420"/>
<!-- bulb of the penis -->
<path d="M110,208 C110,194 152,192 158,210 C162,226 142,236 122,232 L112,224 Z" fill="url(#hs-erectile-g)" stroke="rgba(0,0,0,.4)" stroke-width="1.3"/>
<path d="M110,208 C110,194 152,192 158,210 C162,226 142,236 122,232 L112,224 Z" fill="url(#hs-gloss)" opacity=".5"/>
<!-- penis: skin, corpus cavernosum (dorsal, left), corpus spongiosum (ventral, right), glans -->
<path d="M80,206 C78,244 77,290 78,314 C68,320 66,340 80,350 C92,358 118,358 130,348 C142,338 138,320 128,314 C128,290 128,246 124,216 L112,206 Z" fill="url(#hs-skintone)" stroke="#a8745a" stroke-width="1.4"/>
<path d="M86,214 C84,250 84,290 85,318 L108,318 C108,290 108,252 108,226 Z" fill="url(#hs-sinus)" stroke="#f3e9cf" stroke-width="3"/>
<path d="M86,214 C84,250 84,290 85,318 L108,318 C108,290 108,252 108,226 Z" fill="url(#hs-tube)" opacity=".7"/>
<path d="M109,228 C111,252 111,290 111,318 L123,318 C123,290 123,254 121,232 Z" fill="url(#hs-erectile-g)" stroke="#f3e9cf" stroke-width="2"/>
<path d="M109,228 C111,252 111,290 111,318 L123,318 C123,290 123,254 121,232 Z" fill="url(#hs-tube)" opacity=".6"/>
<path d="M97,224 C98,260 98,296 97,316" fill="none" stroke="#c0393f" stroke-width="2.4" stroke-linecap="round"/>
<path d="M82,214 C79,250 79,296 80,318" fill="none" stroke="#4f86c6" stroke-width="3.2" stroke-linecap="round"/>
<path d="M84,214 C81,250 81,296 82,318" fill="none" stroke="#c0393f" stroke-width="1.6" stroke-linecap="round" opacity=".9"/>
<path d="M82,318 C72,324 70,342 82,350 C94,358 116,358 128,350 C138,342 136,324 126,318 C114,314 96,314 82,318 Z" fill="url(#hs-erectile-g)" stroke="rgba(0,0,0,.4)" stroke-width="1.3"/>
<path d="M82,318 C72,324 70,342 82,350 C94,358 116,358 128,350 C138,342 136,324 126,318 C114,314 96,314 82,318 Z" fill="url(#hs-gloss)" opacity=".6"/>
<path d="M78,316 C92,324 118,324 130,316" fill="none" stroke="#7a2f36" stroke-width="2.4" stroke-linecap="round"/>
<path d="M76,308 C74,322 84,330 104,330 C124,330 134,322 132,308 C128,316 118,320 104,320 C90,320 80,316 76,308 Z" fill="#f2c6a4" stroke="#a8745a" stroke-width="1.2"/>
<!-- suspensory ligament -->
<path d="M88,192 C86,200 86,208 88,216" fill="none" stroke="#e8d9ac" stroke-width="5" stroke-linecap="round"/>
<!-- urethra along its whole length (bladder neck to external meatus) -->
${tube(urethra, 4.4, "#fff0c0", "#8a6a2a", "hs-mr-urethra")}
<ellipse cx="114" cy="340" rx="4.6" ry="7" fill="#fff0c0" stroke="#8a6a2a" stroke-width="1.2"/>
<!-- scrotum -->
<path d="M148,230 C138,264 136,322 166,348 C196,364 236,356 242,314 C246,284 244,256 234,234 Z" fill="url(#hs-scrotum-g)" stroke="#8d5a46" stroke-width="1.5"/>
<path d="M150,238 C142,268 142,320 168,342 C196,356 232,350 238,314 C242,286 240,258 232,242" fill="none" stroke="#f3d3bd" stroke-width="3.4" opacity=".7"/>
<ellipse cx="186" cy="296" rx="38" ry="52" fill="#f8efc4" opacity=".7" stroke="#b79b52" stroke-width="1" transform="rotate(-6 186 296)"/>
<!-- testis -->
<ellipse cx="180" cy="294" rx="28" ry="42" fill="url(#hs-testis-g)" stroke="#f7efdc" stroke-width="3.2" transform="rotate(-8 180 294)"/>
<ellipse cx="180" cy="294" rx="28" ry="42" fill="url(#hs-gloss)" opacity=".5" transform="rotate(-8 180 294)"/>
<g fill="none" stroke="#a37d35" stroke-opacity=".5" stroke-width="1.2" transform="rotate(-8 180 294)"><path d="M188,262 C174,268 162,276 156,288 M190,284 C176,288 166,296 162,306 M188,306 C176,308 168,316 168,326"/></g>
<!-- cord inside the scrotum: sheath, vas deferens, vessels -->
${tube("M228,274 C225,254 221,240 218,226 L218,214", 15, "#f0c9c6", "#b9807c")}
${tube(cordScrotal, 6, "#f2dcaa", "#8a5f2a", "hs-mr-vas")}
<!-- epididymis: head, body, tail -->
${tube("M182,254 C202,248 220,268 220,298 C220,322 212,338 198,346", 12, "#d9a46a", "#7a5026")}
<path d="M182,254 C202,248 220,268 220,298 C220,322 212,338 198,346" fill="none" stroke="#7a5026" stroke-opacity=".4" stroke-width="11" stroke-dasharray="1.6 3.4"/>
<ellipse cx="188" cy="254" rx="14" ry="9" fill="#d9a46a" stroke="#7a5026" stroke-width="1.2" transform="rotate(-18 188 254)"/>
<ellipse cx="188" cy="254" rx="14" ry="9" fill="url(#hs-gloss)" opacity=".5" transform="rotate(-18 188 254)"/>
<!-- pampiniform plexus around the cord -->
<g fill="none" stroke="#4f86c6" stroke-width="2.2" stroke-linecap="round" opacity=".95">
  <path d="${wave(213, 252, 213, 224, 3.5, 3, 24)}"/><path d="${wave(224, 254, 223, 224, 3, 3.5, 24)}"/>
</g>
`;
}

// =====================================================================================
// 2. Testis and epididymis - sectioned (posterior border to the right)
// =====================================================================================
function testisSection(): string {
  const cx = 106, cy = 192, rx = 76, ry = 98;
  const mx = 158, my = 176; // mediastinum testis / rete testis
  const R = rng(7);
  let tub = "";
  const sectors = 14;
  for (let i = 0; i < sectors; i++) {
    const phi = (-78 + (156 * i) / (sectors - 1)) * (Math.PI / 180); // fan towards the left of the mediastinum
    const ux = -Math.cos(phi), uy = Math.sin(phi);
    // distance from mediastinum to the capsule along (ux,uy)
    let t = 8;
    for (; t < 200; t += 1) { const px = mx + ux * t, py = my + uy * t; if (((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 > 0.80) break; }
    const px = -uy, py = ux;
    const pts: Array<[number, number]> = [];
    const cycles = 6 + Math.floor(R() * 2), amp = 4 + R() * 1.6;
    for (let k = 0; k <= 46; k++) {
      const s = k / 46, d = 14 + (t - 14) * s;
      const a = Math.sin(s * cycles * Math.PI * 2 + i) * amp * Math.min(1, s * 3.2);
      pts.push([mx + ux * d + px * a, my + uy * d + py * a]);
    }
    tub += `<path d="${poly(pts)}" fill="none" stroke="#a9852f" stroke-width="4.8" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>` +
      `<path d="${poly(pts)}" fill="none" stroke="#f6e49a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  let septa = "";
  for (let i = 0; i < sectors - 1; i++) {
    const phi = (-78 + (156 * (i + 0.5)) / (sectors - 1)) * (Math.PI / 180);
    const ux = -Math.cos(phi), uy = Math.sin(phi);
    let t = 8;
    for (; t < 200; t += 1) { const px = mx + ux * t, py = my + uy * t; if (((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 > 0.93) break; }
    septa += `M${r1(mx + ux * 10)},${r1(my + uy * 10)} L${r1(mx + ux * t)},${r1(my + uy * t)} `;
  }
  const cord = "M146,300 C186,320 218,266 216,196 C214,150 212,110 200,76 C196,60 194,30 194,-8";
  return `
<!-- tunica vaginalis (serous sac) -->
<ellipse cx="${cx + 6}" cy="${cy}" rx="${rx + 22}" ry="${ry + 18}" fill="#fbf1cf" opacity=".65" stroke="#c9b06a" stroke-width="1.4"/>
<ellipse cx="${cx + 6}" cy="${cy}" rx="${rx + 15}" ry="${ry + 11}" fill="none" stroke="#d9c58a" stroke-width="1" stroke-dasharray="3 3"/>
<!-- spermatic cord -->
${tube("M192,-8 C192,40 182,70 170,98", 40, "#f4d2cf", "#b9807c")}
${tube(cord, 6, "#f2dcaa", "#8a5f2a")}
<path d="M182,-4 C182,40 174,70 164,96" fill="none" stroke="#c0393f" stroke-width="3" stroke-linecap="round"/>
<g fill="none" stroke="#4f86c6" stroke-width="2.4" stroke-linecap="round"><path d="${wave(198, 0, 180, 96, 4.5, 5, 40)}"/><path d="${wave(206, 0, 188, 92, 4, 4.5, 40)}"/><path d="${wave(190, 0, 172, 92, 4, 5.5, 40)}"/></g>
<path d="M176,0 L162,92" fill="none" stroke="#f0c04a" stroke-width="2" stroke-dasharray="1 3"/>
<!-- testis parenchyma -->
<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#hs-testis-g)" stroke="#f7efdc" stroke-width="6"/>
<ellipse cx="${cx}" cy="${cy}" rx="${rx + 3}" ry="${ry + 3}" fill="none" stroke="#9c8247" stroke-width="1"/>
<g stroke="#f3e7c3" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".95"><path d="${septa}"/></g>
${tub}
<!-- mediastinum testis and rete testis (network of channels) -->
<path d="M150,126 C158,134 166,156 168,180 C168,210 162,236 154,248 L150,240 C156,220 160,200 160,178 C160,156 156,140 148,130 Z" fill="#f7efdc" stroke="#9c8247" stroke-width="1"/>
<g fill="none" stroke="#c98a2a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M154,140 L163,156 L154,172 L163,188 L154,204 L162,220 M163,140 L154,156 L163,172 L154,188 L163,204 L154,220"/></g>
<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#hs-gloss)" opacity=".42"/>
<!-- efferent ductules to the head of the epididymis -->
<g fill="none" stroke="#c98a2a" stroke-width="2.6" stroke-linecap="round"><path d="M158,130 C160,118 156,108 150,100 M164,140 C170,124 168,110 160,98 M170,152 C180,134 178,114 168,98 M172,164 C186,146 188,122 176,100"/></g>
<!-- epididymis -->
${tube("M142,98 C180,86 208,124 208,196 C208,252 192,288 146,298", 22, "#d9a46a", "#7a5026")}
<path d="M142,98 C180,86 208,124 208,196 C208,252 192,288 146,298" fill="none" stroke="#7a5026" stroke-opacity=".55" stroke-width="20" stroke-dasharray="2.4 3.2"/>
<ellipse cx="152" cy="100" rx="30" ry="16" fill="#d9a46a" stroke="#7a5026" stroke-width="1.4" transform="rotate(-14 152 100)"/>
<ellipse cx="152" cy="100" rx="30" ry="16" fill="url(#hs-gloss)" opacity=".55" transform="rotate(-14 152 100)"/>
<ellipse cx="148" cy="298" rx="22" ry="13" fill="#d9a46a" stroke="#7a5026" stroke-width="1.4" transform="rotate(8 148 298)"/>
<g fill="none" stroke="#7a5026" stroke-opacity=".5" stroke-width="1.3"><path d="M136,96 C146,92 156,94 164,100 M140,106 C150,102 158,104 166,110"/></g>
`;
}

// =====================================================================================
// 3. Seminiferous tubule - cross-section with Sertoli cells, germ cells and Leydig cells
// =====================================================================================
function seminiferous(): string {
  const cx = 140, cy = 124, Rout = 96;
  const R = rng(21);
  const pol = (r: number, a: number): [number, number] => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  let s = "";
  // interstitium (background), capillary and Leydig cells
  s += `<rect x="0" y="0" width="280" height="250" rx="14" fill="#f4d9d4" opacity=".55"/>`;
  s += `<circle cx="140" cy="124" r="${Rout + 7}" fill="#e9c4bd" stroke="rgba(0,0,0,.25)"/>`;
  s += `<circle cx="140" cy="124" r="${Rout + 2}" fill="#fff6e6" stroke="#8d6e63" stroke-width="2.6"/>`; // basement membrane + myoid layer
  s += `<circle cx="140" cy="124" r="${Rout - 2}" fill="url(#hs-brain-g)" opacity=".5"/>`;
  // Sertoli cells: tall columns from the base to the lumen
  const NS = 11;
  for (let i = 0; i < NS; i++) {
    const a0 = (i / NS) * Math.PI * 2, aw = (Math.PI * 2) / NS * 0.42;
    const [bx1, by1] = pol(Rout - 3, a0 - aw), [bx2, by2] = pol(Rout - 3, a0 + aw);
    const [tx1, ty1] = pol(34, a0 - aw * 0.18), [tx2, ty2] = pol(34, a0 + aw * 0.18);
    const [mx, my] = pol(Rout - 14, a0);
    s += `<path d="M${r1(bx1)},${r1(by1)} C${r1(bx1 + (cx - bx1) * 0.1)},${r1(by1 + (cy - by1) * 0.1)} ${r1(tx1)},${r1(ty1)} ${r1(tx1)},${r1(ty1)} L${r1(tx2)},${r1(ty2)} C${r1(tx2)},${r1(ty2)} ${r1(bx2 + (cx - bx2) * 0.1)},${r1(by2 + (cy - by2) * 0.1)} ${r1(bx2)},${r1(by2)} Z" fill="#f7cdb2" fill-opacity=".72" stroke="#c98a6a" stroke-width="1"/>`;
    s += `<ellipse cx="${r1(mx)}" cy="${r1(my)}" rx="6.4" ry="9.6" fill="#f5e6f0" stroke="#7a4f88" stroke-width="1.1" transform="rotate(${r1((a0 * 180) / Math.PI + 90)} ${r1(mx)} ${r1(my)})"/><circle cx="${r1(mx)}" cy="${r1(my)}" r="1.9" fill="#5b2f6e"/>`;
  }
  // germ cell ring by stage: spermatogonia (base) -> spermatocytes -> spermatids -> spermatozoa (lumen)
  for (let i = 0; i < 22; i++) { // spermatogonia: small dark cells on the basement membrane
    const a = ((i + R() * 0.4) / 22) * Math.PI * 2, [x, y] = pol(Rout - 9, a);
    s += `<circle cx="${r1(x)}" cy="${r1(y)}" r="5.4" fill="#8a63b8" stroke="#3f2a63" stroke-width="1"/><circle cx="${r1(x - 1.4)}" cy="${r1(y - 1.4)}" r="1.5" fill="#fff" opacity=".5"/>`;
  }
  for (let i = 0; i < 17; i++) { // primary spermatocytes: big, condensed chromosomes
    const a = ((i + 0.35 + R() * 0.3) / 17) * Math.PI * 2, [x, y] = pol(Rout - 29, a);
    s += `<circle cx="${r1(x)}" cy="${r1(y)}" r="9.6" fill="#c9a8e6" stroke="#3f2a63" stroke-width="1.1"/><path d="M${r1(x - 4)},${r1(y - 3)} q3,-3 5,0 q2,3 4,0 M${r1(x - 5)},${r1(y + 2)} q3,3 5,0 q3,-3 6,1" fill="none" stroke="#3f2a63" stroke-width="1.5" stroke-linecap="round"/>`;
  }
  for (let i = 0; i < 20; i++) { // round spermatids
    const a = ((i + 0.2 + R() * 0.5) / 20) * Math.PI * 2, [x, y] = pol(Rout - 48, a);
    s += `<circle cx="${r1(x)}" cy="${r1(y)}" r="5.6" fill="#e0c9f3" stroke="#5b3f86" stroke-width="1"/><circle cx="${r1(x + 1)}" cy="${r1(y)}" r="2" fill="#7a54a8"/>`;
  }
  for (let i = 0; i < 16; i++) { // elongating spermatids / sperm heads pointing at the lumen with tails
    const a = ((i + 0.6) / 16) * Math.PI * 2 + 0.1, [x, y] = pol(Rout - 63, a);
    const [x2, y2] = pol(14 + R() * 8, a + (R() - 0.5) * 0.5);
    s += `<path d="M${r1(x)},${r1(y)} Q${r1((x + x2) / 2 + (R() - 0.5) * 10)},${r1((y + y2) / 2 + (R() - 0.5) * 10)} ${r1(x2)},${r1(y2)}" fill="none" stroke="#6b4a98" stroke-width="1.1" opacity=".85"/>`;
    s += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="3.4" ry="5.2" fill="#6b4a98" stroke="#2f1f4d" stroke-width=".9" transform="rotate(${r1((a * 180) / Math.PI + 90)} ${r1(x)} ${r1(y)})"/>`;
  }
  // blood-testis barrier (tight junctions between Sertoli cells)
  s += `<circle cx="140" cy="124" r="${Rout - 17}" fill="none" stroke="#ff9d3a" stroke-width="2.4" stroke-dasharray="1.5 5" stroke-linecap="round"/>`;
  // lumen
  s += `<circle cx="140" cy="124" r="20" fill="#fbf3e6" stroke="rgba(0,0,0,.25)"/>`;
  // interstitial Leydig cells with lipid droplets + capillary
  const ley: Array<[number, number]> = [[18, 238], [38, 228], [30, 246], [250, 236], [266, 224], [244, 246], [262, 246]];
  for (const [x, y] of ley) s += `<path d="M${x - 9},${y} l4,-8 h10 l5,8 -5,8 h-10 Z" fill="#f2b269" stroke="#8a5420" stroke-width="1"/><circle cx="${x}" cy="${y - 1}" r="2.2" fill="#8a5420"/><circle cx="${x + 5}" cy="${y + 3}" r="1.2" fill="#fff" opacity=".8"/>`;
  s += `<ellipse cx="22" cy="50" rx="14" ry="8" fill="#c6504f" stroke="#7a2a2a" stroke-width="1.2" transform="rotate(-24 22 50)"/><ellipse cx="22" cy="50" rx="8" ry="3.4" fill="#f7a2a0" transform="rotate(-24 22 50)"/>`;
  s += `<ellipse cx="262" cy="52" rx="13" ry="7" fill="#4f86c6" stroke="#22406b" stroke-width="1.2" transform="rotate(24 262 52)"/><ellipse cx="262" cy="52" rx="7" ry="3" fill="#b7d3f2" transform="rotate(24 262 52)"/>`;
  return s;
}

// =====================================================================================
// 4. Spermatozoon
// =====================================================================================
function spermCell(): string {
  const wv = (a: number, ph: number) => {
    const pts: Array<[number, number]> = [];
    for (let k = 0; k <= 60; k++) { const t = k / 60, x = 58 + t * 232; pts.push([x, 55 + Math.sin(t * 7.4 + ph) * a * (0.18 + t * 0.82)]); }
    return poly(pts);
  };
  const p1 = wv(10, 0), p2 = wv(10, 2.1), p3 = wv(10, 4.2);
  const anim = `<animate attributeName="d" dur="1.1s" repeatCount="indefinite" values="${p1};${p2};${p3};${p1}"/>`;
  const seg = (clip: string, w: number, stroke: string, extra = "") =>
    `<g clip-path="url(#${clip})"><path d="${p1}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" ${extra}>${anim}</path></g>`;
  return `
<defs>
  <clipPath id="hs-sp-mid"><rect x="56" y="30" width="58" height="50"/></clipPath>
  <clipPath id="hs-sp-prin"><rect x="114" y="30" width="130" height="50"/></clipPath>
  <clipPath id="hs-sp-end"><rect x="244" y="30" width="60" height="50"/></clipPath>
  <radialGradient id="hs-sp-head" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#9ab9e6"/><stop offset=".6" stop-color="#5a7fc0"/><stop offset="1" stop-color="#30508a"/></radialGradient>
</defs>
${seg("hs-sp-mid", 10.5, "rgba(80,50,10,.55)")}
${seg("hs-sp-mid", 9, "#e2a43c")}
${seg("hs-sp-mid", 9, "#7a4a0c", 'stroke-linecap="butt" stroke-dasharray="1.4 3.4"').replace('stroke-linecap="round" stroke-linecap="butt"', 'stroke-linecap="butt"')}
${seg("hs-sp-prin", 6.2, "rgba(40,50,70,.5)")}
${seg("hs-sp-prin", 4.6, "#b9c6dc")}
${seg("hs-sp-end", 2.8, "#8d9bb4")}
<ellipse cx="38" cy="55" rx="27" ry="17" fill="url(#hs-sp-head)" stroke="#1f3560" stroke-width="1.5"/>
<path d="M12,55 C12,43 22,37 34,38 C25,44 21,50 21,55 C21,60 25,66 34,72 C22,73 12,67 12,55 Z" fill="#f2d98a" stroke="#8a6a1c" stroke-width="1.2"/>
<path d="M15,50 C17,44 24,41 30,41" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.6" stroke-linecap="round"/>
<ellipse cx="52" cy="55" rx="5" ry="8" fill="#e3b04c" stroke="#8a5a10" stroke-width="1"/>
<circle cx="58" cy="55" r="3.6" fill="#c9852a" stroke="#6b430c"/>
`;
}

// =====================================================================================
// 5. Penis - cross-section of the shaft
// =====================================================================================
function penisSection(): string {
  const bucks = "M120,16 C56,14 22,56 30,98 C36,130 70,140 96,138 C104,152 100,180 120,182 C140,180 136,152 144,138 C170,140 204,130 210,98 C218,56 184,14 120,16 Z";
  return `
<g filter="url(#hs-shadow)"><ellipse cx="120" cy="102" rx="112" ry="92" fill="url(#hs-skintone)" stroke="#a8745a" stroke-width="2"/></g>
<ellipse cx="120" cy="102" rx="106" ry="86" fill="#f1c4a0" stroke="#d29b78" stroke-width="1.4"/>
<ellipse cx="120" cy="102" rx="100" ry="80" fill="#f6dfa8" stroke="#d9be72" stroke-width="1.2"/>
<path d="${bucks}" fill="#fbf4dc" stroke="#e9cf7c" stroke-width="4"/>
<!-- corpora cavernosa (erectile sinusoids) -->
<g class="hs-a hs-a-breathe" style="animation-duration:3.4s;transform-origin:50% 45%">
<path d="M120,42 C120,32 102,28 84,34 C58,42 46,66 52,90 C58,116 90,126 116,116 C118,100 120,70 120,42 Z" fill="url(#hs-sinus)" stroke="#fffaf0" stroke-width="5"/>
<path d="M120,42 C120,32 138,28 156,34 C182,42 194,66 188,90 C182,116 150,126 124,116 C122,100 120,70 120,42 Z" fill="url(#hs-sinus)" stroke="#fffaf0" stroke-width="5"/>
<path d="M120,44 C119,72 121,96 121,116" fill="none" stroke="#fffaf0" stroke-width="4"/>
<path d="M120,42 C120,32 102,28 84,34 C58,42 46,66 52,90 C58,116 90,126 116,116 C118,100 120,70 120,42 Z" fill="url(#hs-gloss)" opacity=".45"/>
<path d="M120,42 C120,32 138,28 156,34 C182,42 194,66 188,90 C182,116 150,126 124,116 C122,100 120,70 120,42 Z" fill="url(#hs-gloss)" opacity=".45"/>
</g>
<!-- deep (cavernosal) arteries -->
<circle cx="90" cy="84" r="6.4" fill="#d4504b" stroke="#6e1f22" stroke-width="1.4"/><circle cx="90" cy="84" r="2.8" fill="#fbd0cd"/>
<circle cx="150" cy="84" r="6.4" fill="#d4504b" stroke="#6e1f22" stroke-width="1.4"/><circle cx="150" cy="84" r="2.8" fill="#fbd0cd"/>
<!-- corpus spongiosum with the urethra -->
<ellipse cx="120" cy="156" rx="30" ry="22" fill="url(#hs-erectile-g)" stroke="#fffaf0" stroke-width="4"/>
<ellipse cx="120" cy="156" rx="30" ry="22" fill="url(#hs-gloss)" opacity=".5"/>
<path d="M102,156 C110,150 130,150 138,156 C130,162 110,162 102,156 Z" fill="#fff0c0" stroke="#8a6a2a" stroke-width="1.6"/>
<!-- dorsal neurovascular bundle (deep to Buck's fascia) -->
<circle cx="120" cy="26" r="7.4" fill="#4f86c6" stroke="#1f3f6e" stroke-width="1.6"/><circle cx="120" cy="26" r="3.4" fill="#cfe2f7"/>
<circle cx="105" cy="23" r="3.8" fill="#d4504b" stroke="#6e1f22" stroke-width="1.2"/><circle cx="135" cy="23" r="3.8" fill="#d4504b" stroke="#6e1f22" stroke-width="1.2"/>
<circle cx="92" cy="26" r="3" fill="#f0c04a" stroke="#8a6a1c"/><circle cx="148" cy="26" r="3" fill="#f0c04a" stroke="#8a6a1c"/>
`;
}

export const MALE_FIGURES: Figure[] = [
  {
    id: "hs-male-repro",
    name: "Male reproductive system (median sagittal section of the pelvis)",
    tags: ["male reproductive", "male genital", "male genitalia", "male sex organ", "male sex organs", "male reproductive system", "testis", "testes", "testicle", "testicular", "scrotum", "scrotal", "penis", "penile", "prostate", "prostatic", "prostatitis", "bph", "benign prostatic hyperplasia", "seminal vesicle", "vas deferens", "vasectomy", "ejaculatory duct", "ejaculation", "emission", "erection", "erectile", "erectile dysfunction", "bulbourethral", "cowper", "male urethra", "hypospadias", "epispadias", "phimosis", "paraphimosis", "priapism", "peyronie", "undescended", "cryptorchidism", "inguinal canal", "semen", "seminal fluid", "andrology", "male infertility", "urethral stricture"],
    w: 340, h: 380,
    vars: "(fixed colours; tissue shades)",
    notes: "Median sagittal section, ANTERIOR = LEFT. Landmarks (x,y): pubic symphysis (84,160); bladder (156,90) with ureter entering (190,28)->(188,72); bladder neck (152,138); prostate (152,160) around the prostatic urethra; seminal vesicle (192,128); ejaculatory duct (192,140)->(156,164); membranous urethra (152,190) through the perineal membrane (y~193); bulbourethral gland (168,206); bulb of the penis (136,214); penis shaft x 76-126, y 210-322 (dorsal side LEFT with deep dorsal vein, corpus cavernosum x 86-108, corpus spongiosum x 108-124, urethra x~115); glans (104,336), external meatus (105,354); scrotum (190,300); testis (182,294); epididymis head (190,254) body (224,298) tail (200,346); vas deferens rises in the spermatic cord at x~218 (y 226->40), arches over the ureter at (209,30) and descends behind the bladder at x~200 to the seminal vesicle; rectum x 235-265 with anal canal ending (266,252). The urethra is an <path id=\"hs-mr-urethra\"> you can animate along (M152,138 L152,190 ... L115,334).",
    svg: maleSystem(),
  },
  {
    id: "hs-testis",
    name: "Testis and epididymis (sectioned: lobules, rete testis, spermatic cord)",
    tags: ["testis", "testes", "testicle", "testicular", "epididymis", "epididymal", "epididymitis", "epididymo-orchitis", "orchitis", "rete testis", "seminiferous", "tunica albuginea", "tunica vaginalis", "hydrocele", "varicocele", "spermatocele", "testicular torsion", "torsion", "spermatic cord", "pampiniform", "mediastinum testis", "cremaster", "cryptorchidism", "undescended testis", "testicular cancer", "seminoma", "germ cell tumour", "spermatogenesis", "sperm transport", "sperm maturation", "vas deferens", "vasectomy", "male infertility", "scrotum"],
    w: 250, h: 330,
    vars: "(fixed colours)",
    notes: "Upright testis, posterior border to the RIGHT. Landmarks (x,y): spermatic cord (vas, testicular artery, pampiniform plexus) enters at top (168-212, 0-92); tunica vaginalis cavity ring around the testis; tunica albuginea = pale rim; testis centre (106,192); 9 lobules with coiled seminiferous tubules fan to the mediastinum/rete testis (158,176); 4 efferent ductules go to the epididymis head (152,100); body runs down the right side (208,196); tail (148,298); the vas deferens leaves the tail and ascends right (216,196) into the cord. Sperm path = tubules -> straight tubules -> rete testis -> efferent ductules -> head -> body -> tail -> vas.",
    svg: testisSection(),
  },
  {
    id: "hs-seminiferous",
    name: "Seminiferous tubule in cross-section (spermatogenesis, Sertoli and Leydig cells)",
    tags: ["seminiferous", "spermatogenesis", "spermiogenesis", "spermiation", "spermatogonia", "spermatogonium", "spermatocyte", "spermatid", "spermatozoa", "sertoli", "leydig", "interstitial cells", "blood-testis barrier", "blood testis barrier", "inhibin", "androgen binding protein", "testosterone", "fsh", "lh", "meiosis", "testicular histology", "testis histology", "male infertility", "azoospermia", "oligospermia", "germ cell"],
    w: 280, h: 250,
    vars: "(fixed colours)",
    notes: "Tubule centre (140,124), outer radius ~98. From the BASEMENT MEMBRANE (outer ring, with peritubular myoid cells) inwards: spermatogonia (dark small cells, r~87), primary spermatocytes (large, r~67), round spermatids (r~48), elongating spermatids/sperm heads with tails (r~33) and the LUMEN (centre, r~20). 11 tall Sertoli cells (peach columns with pale nuclei at r~82) span base to lumen; the orange dotted ring at r~76 is the blood-testis barrier (Sertoli tight junctions: basal compartment outside it, adluminal inside). Leydig cells with lipid droplets lie in the interstitium at the bottom corners (18-38,228-246) and (244-266,224-246); capillaries top-left (22,50) and top-right (262,52).",
    svg: seminiferous(),
  },
  {
    id: "hs-sperm",
    name: "Spermatozoon (head, acrosome, midpiece, tail)",
    tags: ["sperm", "spermatozoon", "spermatozoa", "acrosome", "acrosomal reaction", "capacitation", "fertilisation", "fertilization", "semen analysis", "sperm motility", "midpiece", "flagellum", "kartagener", "immotile cilia", "asthenozoospermia", "teratozoospermia", "oligospermia", "azoospermia", "sperm count"],
    w: 300, h: 110,
    vars: "(fixed colours)",
    notes: "Head at the LEFT (acrosomal cap at the front-left x~14-44, haploid nucleus x~28-60, centre (38,55)), neck (~56,55), mitochondrial MIDPIECE x 58-114 (gold helix), principal piece x 114-244 (fibrous sheath), end piece x 244-290. The tail beats on its own (SMIL animation). Overall length 290 units ~ 60 micrometres.",
    svg: spermCell(),
  },
  {
    id: "hs-penis-section",
    name: "Penis - cross-section of the shaft (corpora cavernosa, corpus spongiosum, urethra)",
    tags: ["penis", "penile", "erection", "erectile", "erectile dysfunction", "corpus cavernosum", "corpora cavernosa", "corpus spongiosum", "bucks fascia", "buck's fascia", "tunica albuginea", "penile fracture", "priapism", "peyronie", "dorsal vein", "deep dorsal vein", "cavernosal artery", "helicine", "sildenafil", "pde5", "nitric oxide", "hypospadias", "epispadias", "urethral injury", "penile anatomy", "penile cross section"],
    w: 240, h: 200,
    vars: "(fixed colours)",
    notes: "Transverse section, DORSAL = TOP. Layers from the outside in: skin (outer ring) -> dartos/superficial fascia (yellow ring) -> Buck's (deep) fascia (pale cream envelope that encloses all three corpora and the dorsal bundle) -> tunica albuginea (white rims of each corpus). Two corpora cavernosa (sinusoidal tissue, separated by an incomplete septum, centres (88,80) and (152,80)) each with a deep (cavernosal) artery (90,84) and (150,84); corpus spongiosum ventral (120,156) containing the urethra (slit at (120,156)); dorsal neurovascular bundle deep to Buck's fascia: deep dorsal vein (120,26), two dorsal arteries (105,23) and (135,23), dorsal nerves (92,26) and (148,26). The corpora cavernosa already swell gently (engorgement) on their own.",
    svg: penisSection(),
  },
];
