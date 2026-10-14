// Parametric solid-geometry builder for the AI Visualizer's anatomy "model"
// mode. Deliberately has NO three.js import: it turns one ModelPart spec into
// plain typed arrays (positions / normals / indices) so it can be unit-tested
// in Node and so Model3D.tsx only has to wrap the result in a BufferGeometry.
//
// Every solid is a closed "swept ring" surface:
//   lathe      – a radius profile along Y (bone shafts, epiphyses, bottles…)
//   tube       – a rounded tube along a 3D path with a radius per point
//                (vessels, nerves, ligaments, ridges, bronchi…)
//   ellipsoid / sphere / box / cylinder – super-ellipsoids (organ lobes,
//                chambers, condyles, tubercles, blocks)
//   cone / capsule / torus – the remaining primitives
// then optionally given an elliptical/lobed cross-section (lobes), a twist, a
// deterministic organic roughness (bump), and finally scaled / rotated /
// translated into model space. Normals are computed last, smooth and
// seam-free, so lighting looks like a solid object rather than a faceted one.
import type { ModelPart } from './schema';

export interface PartMesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  min: [number, number, number];
  max: [number, number, number];
}

type V3 = [number, number, number];
const EPS = 1e-3;
const DEG = Math.PI / 180;
const SEGS_LATHE = 48;
const SEGS_TUBE = 24;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const finite = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

// ---------------------------------------------------------------------------
// Rings: a ring is a loop of points; a "pole" is a ring with a single point.
// ---------------------------------------------------------------------------
interface Ring { pts: number[] }                     // flat xyz; length 3 => pole
const isPole = (r: Ring) => r.pts.length === 3;

interface Section { lobes: number; amount: number; phase: number; twist: number }

function sectionRadius(sec: Section, theta: number): number {
  if (!sec.lobes || !sec.amount) return 1;
  return 1 + sec.amount * Math.cos(sec.lobes * theta + sec.phase);
}

/** Ring of `segs` points around `center` in the plane spanned by unit axes u,v. */
function circleRing(center: V3, u: V3, v: V3, r: number, segs: number, sec: Section, t: number): Ring {
  if (r < EPS) return { pts: [center[0], center[1], center[2]] };
  const pts: number[] = [];
  const tw = sec.twist * t;
  for (let i = 0; i < segs; i++) {
    const th = (i / segs) * Math.PI * 2;
    const rad = r * sectionRadius(sec, th);
    const a = th + tw;
    const c = Math.cos(a) * rad, s = Math.sin(a) * rad;
    pts.push(center[0] + u[0] * c + v[0] * s, center[1] + u[1] * c + v[1] * s, center[2] + u[2] * c + v[2] * s);
  }
  return { pts };
}

/** Triangulate consecutive rings (poles become fans). */
function rebuildIndices(rings: Ring[], offsets: number[], closedLoop: boolean): number[] {
  const out: number[] = [];
  const pairs = closedLoop ? rings.length : rings.length - 1;
  for (let k = 0; k < pairs; k++) {
    const kb = (k + 1) % rings.length;
    const A = rings[k], B = rings[kb];
    const ca = A.pts.length / 3, cb = B.pts.length / 3;
    if (ca === 1 && cb === 1) continue;
    const ao = offsets[k], bo = offsets[kb];
    const n = Math.max(ca, cb);
    for (let i = 0; i < n; i++) {
      const i1 = (i + 1) % n;
      if (ca === 1) { out.push(ao, bo + i, bo + i1); }
      else if (cb === 1) { out.push(ao + i, bo, ao + i1); }
      else { out.push(ao + i, bo + i, bo + i1, ao + i, bo + i1, ao + i1); }
    }
  }
  return out;
}

function stitchRings(rings: Ring[], closedLoop = false) {
  const positions: number[] = [];
  const offsets: number[] = [];
  for (const r of rings) { offsets.push(positions.length / 3); for (const x of r.pts) positions.push(x); }
  return { positions, indices: rebuildIndices(rings, offsets, closedLoop) };
}

// ---------------------------------------------------------------------------
// Profile smoothing (uniform Catmull-Rom through [y, r] control points)
// ---------------------------------------------------------------------------
function smoothProfile(pts: Array<[number, number]>, per = 6): Array<[number, number]> {
  if (pts.length < 3) return pts.map(([y, r]) => [y, Math.max(0, r)]);
  const out: Array<[number, number]> = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < per; s++) {
      const t = s / per, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), Math.max(0, f(p0[1], p1[1], p2[1], p3[1]))]);
    }
  }
  const last = pts[pts.length - 1];
  out.push([last[0], Math.max(0, last[1])]);
  return out;
}

// ---------------------------------------------------------------------------
// Ring generators per form
// ---------------------------------------------------------------------------
const X: V3 = [1, 0, 0], Y: V3 = [0, 1, 0], Z: V3 = [0, 0, 1];

function latheRings(profile: Array<[number, number]>, caps: 'round' | 'flat', sec: Section, segs: number): Ring[] {
  const rings: Ring[] = [];
  const n = profile.length;
  const first = profile[0], last = profile[n - 1];
  const dirStart = profile[1][0] >= first[0] ? -1 : 1;       // outward direction at the first end
  const dirEnd = -dirStart;

  const cap = (end: [number, number], dir: number, tEnd: number): Ring[] => {
    const [y, r] = end;
    if (r < EPS) return [];
    if (caps === 'flat') return [{ pts: [0, y, 0] }];
    const h = r * 0.5;
    return [
      circleRing([0, y + dir * h * Math.sin(35 * DEG), 0], X, Z, r * Math.cos(35 * DEG), segs, sec, tEnd),
      circleRing([0, y + dir * h * Math.sin(65 * DEG), 0], X, Z, r * Math.cos(65 * DEG), segs, sec, tEnd),
      { pts: [0, y + dir * h, 0] },
    ];
  };

  if (first[1] >= EPS) rings.push(...cap(first, dirStart, 0).reverse());
  profile.forEach(([y, r], i) => rings.push(circleRing([0, y, 0], X, Z, r, segs, sec, n > 1 ? i / (n - 1) : 0)));
  if (last[1] >= EPS) rings.push(...cap(last, dirEnd, 1));
  return rings;
}

function sampleCatmull(path: V3[], per: number): V3[] {
  if (path.length < 3) {
    const [a, b] = [path[0], path[path.length - 1]];
    const out: V3[] = [];
    for (let s = 0; s <= per; s++) { const t = s / per; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); }
    return out;
  }
  const out: V3[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const p0 = path[Math.max(0, i - 1)], p1 = path[i], p2 = path[i + 1], p3 = path[Math.min(path.length - 1, i + 2)];
    for (let s = 0; s < per; s++) {
      const t = s / per, t2 = t * t, t3 = t2 * t;
      const pt: V3 = [0, 0, 0];
      for (let k = 0; k < 3; k++) {
        pt[k] = 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      }
      out.push(pt);
    }
  }
  out.push(path[path.length - 1]);
  return out;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

function tubeRings(path: V3[], radii: number[], sec: Section, segs: number): Ring[] {
  const pts = sampleCatmull(path, 10);
  const n = pts.length;
  const radiusAt = (i: number) => {
    if (radii.length === 1) return radii[0];
    const f = (i / (n - 1)) * (radii.length - 1);
    const a = Math.floor(f), b = Math.min(radii.length - 1, a + 1);
    return radii[a] + (radii[b] - radii[a]) * (f - a);
  };
  const tang: V3[] = pts.map((p, i) => norm(sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)])));
  // Rotation-minimising frames so the tube never twists or flips.
  let u: V3 = Math.abs(tang[0][1]) < 0.9 ? norm(cross(tang[0], Y)) : norm(cross(tang[0], X));
  const rings: Ring[] = [];
  const frames: Array<{ u: V3; v: V3 }> = [];
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      const proj = sub(u, [tang[i][0] * dot(u, tang[i]), tang[i][1] * dot(u, tang[i]), tang[i][2] * dot(u, tang[i])]);
      u = len(proj) > 1e-6 ? norm(proj) : u;
    }
    frames.push({ u, v: norm(cross(tang[i], u)) });
  }
  const capRings = (idx: number, dirSign: number): Ring[] => {
    const r = radiusAt(idx), c = pts[idx], t = tang[idx], f = frames[idx];
    const out: Ring[] = [];
    for (const phi of [35, 65]) {
      const off = dirSign * r * Math.sin(phi * DEG);
      out.push(circleRing([c[0] + t[0] * off, c[1] + t[1] * off, c[2] + t[2] * off], f.u, f.v, r * Math.cos(phi * DEG), segs, sec, idx / (n - 1)));
    }
    out.push({ pts: [c[0] + t[0] * dirSign * r, c[1] + t[1] * dirSign * r, c[2] + t[2] * dirSign * r] });
    return out;
  };
  rings.push(...capRings(0, -1).reverse());
  for (let i = 0; i < n; i++) rings.push(circleRing(pts[i], frames[i].u, frames[i].v, radiusAt(i), segs, sec, i / (n - 1)));
  rings.push(...capRings(n - 1, 1));
  return rings;
}

/** Super-ellipsoid (e = 1 round, small e = boxy). Half-extents a,b,c. */
function superRings(a: number, b: number, c: number, eV: number, eU: number, segs: number, rowsHalf: number): Ring[] {
  const sp = (w: number, e: number) => Math.sign(w) * Math.pow(Math.abs(w), e);
  const rings: Ring[] = [];
  const rows = rowsHalf * 2;
  for (let j = 0; j <= rows; j++) {
    const v = -Math.PI / 2 + (j / rows) * Math.PI;
    if (j === 0 || j === rows) { rings.push({ pts: [0, (j === 0 ? -b : b), 0] }); continue; }
    const cv = sp(Math.cos(v), eV), sv = sp(Math.sin(v), eV);
    const pts: number[] = [];
    for (let i = 0; i < segs; i++) {
      const u = (i / segs) * Math.PI * 2;
      pts.push(a * cv * sp(Math.cos(u), eU), b * sv, c * cv * sp(Math.sin(u), eU));
    }
    rings.push({ pts });
  }
  return rings;
}

function torusRings(R: number, r: number, segsMajor: number, segsMinor: number): Ring[] {
  const rings: Ring[] = [];
  for (let i = 0; i < segsMajor; i++) {
    const a = (i / segsMajor) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const pts: number[] = [];
    for (let j = 0; j < segsMinor; j++) {
      const b = (j / segsMinor) * Math.PI * 2;
      const rr = R + r * Math.cos(b);
      pts.push(rr * ca, r * Math.sin(b), rr * sa);
    }
    rings.push({ pts });
  }
  return rings;
}

// ---------------------------------------------------------------------------
// Noise (deterministic) for organic surface roughness
// ---------------------------------------------------------------------------
function hash3(ix: number, iy: number, iz: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(iz, 2147483647) ^ Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967295) * 2 - 1;
}
const smooth = (t: number) => t * t * (3 - 2 * t);
function valueNoise(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = smooth(x - ix), fy = smooth(y - iy), fz = smooth(z - iz);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash3(ix + dx, iy + dy, iz + dz, seed);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), fx), l(c(0, 1, 0), c(1, 1, 0), fx), fy),
    l(l(c(0, 0, 1), c(1, 0, 1), fx), l(c(0, 1, 1), c(1, 1, 1), fx), fy), fz);
}
export function seedFrom(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h | 0;
}

// ---------------------------------------------------------------------------
// Normals + orientation
// ---------------------------------------------------------------------------
function computeNormals(pos: Float32Array, idx: Uint32Array): Float32Array {
  const nrm = new Float32Array(pos.length);
  for (let f = 0; f < idx.length; f += 3) {
    const a = idx[f] * 3, b = idx[f + 1] * 3, c = idx[f + 2] * 3;
    const e1x = pos[b] - pos[a], e1y = pos[b + 1] - pos[a + 1], e1z = pos[b + 2] - pos[a + 2];
    const e2x = pos[c] - pos[a], e2y = pos[c + 1] - pos[a + 1], e2z = pos[c + 2] - pos[a + 2];
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    for (const o of [a, b, c]) { nrm[o] += nx; nrm[o + 1] += ny; nrm[o + 2] += nz; }
  }
  for (let i = 0; i < nrm.length; i += 3) {
    const l = Math.hypot(nrm[i], nrm[i + 1], nrm[i + 2]) || 1;
    nrm[i] /= l; nrm[i + 1] /= l; nrm[i + 2] /= l;
  }
  return nrm;
}

function signedVolume(pos: Float32Array, idx: Uint32Array): number {
  let v = 0;
  for (let f = 0; f < idx.length; f += 3) {
    const a = idx[f] * 3, b = idx[f + 1] * 3, c = idx[f + 2] * 3;
    v += pos[a] * (pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1])
      - pos[a + 1] * (pos[b] * pos[c + 2] - pos[b + 2] * pos[c])
      + pos[a + 2] * (pos[b] * pos[c + 1] - pos[b + 1] * pos[c]);
  }
  return v / 6;
}

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------
const v3 = (v: unknown, d: V3): V3 => (Array.isArray(v) && v.length >= 3 ? [finite(v[0], d[0]), finite(v[1], d[1]), finite(v[2], d[2])] : d);

export function buildPartMesh(part: ModelPart): PartMesh {
  const sec: Section = {
    lobes: Math.round(clamp(finite(part.lobes, 0), 0, 6)),
    amount: clamp(finite(part.lobeAmount, 0), 0, 0.6),
    phase: finite(part.lobePhase, 0) * DEG,
    twist: finite(part.twist, 0) * DEG,
  };
  const size = v3(part.size, [10, 10, 10]).map((s) => Math.max(0.2, Math.abs(s))) as V3;
  const [hx, hy, hz] = [size[0] / 2, size[1] / 2, size[2] / 2];

  let rings: Ring[];
  let closedLoop = false;

  switch (part.form) {
    case 'lathe': {
      const raw = (part.profile ?? []).filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])) as Array<[number, number]>;
      const profile = raw.length >= 2 ? raw : [[-hy, hx * 0.8], [hy, hx * 0.8]] as Array<[number, number]>;
      rings = latheRings(smoothProfile(profile), part.caps === 'flat' ? 'flat' : 'round', sec, SEGS_LATHE);
      break;
    }
    case 'tube': {
      const path = (part.path ?? []).filter((p) => Array.isArray(p) && p.length >= 3).map((p) => v3(p, [0, 0, 0]));
      const base: V3[] = path.length >= 2 ? path : [[0, -hy, 0], [0, hy, 0]];
      const radii = (part.radii ?? []).filter((r) => Number.isFinite(r) && r > 0);
      rings = tubeRings(base, radii.length ? radii : [Math.max(0.3, Math.min(hx, hz))], sec, SEGS_TUBE);
      break;
    }
    case 'box': rings = superRings(hx, hy, hz, 0.18, 0.18, 32, 10); break;
    case 'cylinder': rings = superRings(hx, hy, hz, 0.14, 1, 40, 12); break;
    case 'cone': {
      const dense: Array<[number, number]> = [];
      for (let s = 0; s <= 12; s++) dense.push([-hy + (s / 12) * size[1], hx * (1 - s / 12)]);
      rings = latheRings(dense, 'flat', sec, 40).map((r) => ({ pts: r.pts.map((x, i) => (i % 3 === 2 ? x * (hz / (hx || 1)) : x)) }));
      break;
    }
    case 'capsule': {
      const r = Math.min(hx, hz), straight = Math.max(0, hy - r);
      const dense: Array<[number, number]> = [];
      for (let k = 0; k <= 8; k++) { const a = (k / 8) * (Math.PI / 2); dense.push([-straight - r * Math.cos(a), r * Math.sin(a)]); }
      dense.sort((a, b) => a[0] - b[0]);
      const top: Array<[number, number]> = [];
      for (let k = 8; k >= 0; k--) { const a = (k / 8) * (Math.PI / 2); top.push([straight + r * Math.cos(a), r * Math.sin(a)]); }
      const prof = [...dense, ...top].filter((p, i, arr) => i === 0 || Math.abs(p[0] - arr[i - 1][0]) > 1e-6 || Math.abs(p[1] - arr[i - 1][1]) > 1e-6);
      prof[0][1] = 0; prof[prof.length - 1][1] = 0;
      rings = latheRings(prof, 'flat', sec, 36).map((rg) => ({ pts: rg.pts.map((x, i) => (i % 3 === 0 ? x * (hx / (r || 1)) : i % 3 === 2 ? x * (hz / (r || 1)) : x)) }));
      break;
    }
    case 'torus': {
      const tube = Math.max(0.3, Math.min(size[1] / 2, size[0] / 4));
      rings = torusRings(Math.max(tube * 1.2, size[0] / 2 - tube), tube, 48, 18);
      closedLoop = true;
      break;
    }
    case 'sphere':
    case 'ellipsoid':
    default:
      rings = superRings(hx, hy, hz, 1, 1, 44, 14);
  }

  const built = stitchRings(rings, closedLoop);
  let positions = new Float32Array(built.positions);
  let indices = new Uint32Array(built.indices);
  if (signedVolume(positions, indices) < 0) {
    for (let i = 0; i < indices.length; i += 3) { const t = indices[i + 1]; indices[i + 1] = indices[i + 2]; indices[i + 2] = t; }
  }

  // Organic roughness along the smooth normals.
  const bump = clamp(finite(part.bump, 0), 0, 1);
  if (bump > 0) {
    const nrm = computeNormals(positions, indices);
    let mn: V3 = [Infinity, Infinity, Infinity], mx: V3 = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], positions[i + k]); mx[k] = Math.max(mx[k], positions[i + k]); }
    const ext = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]].sort((a, b) => a - b);
    const scaleRef = Math.max(ext[0], ext[1] * 0.5, 0.5);
    const amp = bump * 0.09 * scaleRef, freq = 1.8 / scaleRef, seed = seedFrom(part.id);
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i] * freq, y = positions[i + 1] * freq, z = positions[i + 2] * freq;
      const nz = valueNoise(x, y, z, seed) * 0.65 + valueNoise(x * 2.3, y * 2.3, z * 2.3, seed + 7) * 0.35;
      positions[i] += nrm[i] * nz * amp; positions[i + 1] += nrm[i + 1] * nz * amp; positions[i + 2] += nrm[i + 2] * nz * amp;
    }
  }

  // Bake scale -> rotation (XYZ, degrees) -> position into model space.
  const sc = v3(part.scale, [1, 1, 1]).map((s) => clamp(Math.abs(s) || 1, 0.05, 20)) as V3;
  const rot = v3(part.rotation, [0, 0, 0]).map((d) => d * DEG) as V3;
  const pos = v3(part.position, [0, 0, 0]);
  const cx = Math.cos(rot[0]), sx = Math.sin(rot[0]), cy = Math.cos(rot[1]), sy = Math.sin(rot[1]), cz = Math.cos(rot[2]), sz = Math.sin(rot[2]);
  const min: V3 = [Infinity, Infinity, Infinity], max: V3 = [-Infinity, -Infinity, -Infinity];
  positions = positions.slice();
  for (let i = 0; i < positions.length; i += 3) {
    let x = positions[i] * sc[0], y = positions[i + 1] * sc[1], z = positions[i + 2] * sc[2];
    // Rx
    let y1 = y * cx - z * sx, z1 = y * sx + z * cx; y = y1; z = z1;
    // Ry
    const x2 = x * cy + z * sy, z2 = -x * sy + z * cy; x = x2; z = z2;
    // Rz
    const x3 = x * cz - y * sz, y3 = x * sz + y * cz; x = x3; y = y3;
    x += pos[0]; y += pos[1]; z += pos[2];
    positions[i] = x; positions[i + 1] = y; positions[i + 2] = z;
    if (x < min[0]) min[0] = x; if (y < min[1]) min[1] = y; if (z < min[2]) min[2] = z;
    if (x > max[0]) max[0] = x; if (y > max[1]) max[1] = y; if (z > max[2]) max[2] = z;
  }
  return { positions, normals: computeNormals(positions, indices), indices, min, max };
}
