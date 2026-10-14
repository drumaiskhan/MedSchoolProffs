// Deterministic 3D layout for the AI Visualizer scene. Pure functions, no
// three.js / DOM, so it is cheap to reason about and unit-test.
//
// Goals: (1) no two structures ever overlap, (2) enough breathing room around
// every node for its text label, (3) groups cluster together, (4) the same
// spec always produces the same picture (seeded RNG — no jitter between
// renders or re-generations).
import type { SceneNode, SceneLink, SceneLayout } from './schema';

export type V3 = [number, number, number];
export type Positions = Map<string, V3>;

/** World-space radius of a node's mesh (size 1 ≈ 0.6 units). */
export function nodeRadius(n: Pick<SceneNode, 'size'>): number {
  return 0.18 + 0.42 * Math.min(3, Math.max(0.5, n.size ?? 1));
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(nodes: SceneNode[]): number {
  let h = 2166136261;
  for (const n of nodes) for (let i = 0; i < n.id.length; i++) h = Math.imul(h ^ n.id.charCodeAt(i), 16777619);
  return h >>> 0;
}

const GAP = 1.5; // minimum empty space between two node surfaces (room for labels)

/** Order nodes by the process sequence (link.order), then by array order. */
export function sequenceOrder(nodes: SceneNode[], links: SceneLink[]): SceneNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const placed = new Set<string>();
  const out: SceneNode[] = [];
  const push = (id: string) => { const n = byId.get(id); if (n && !placed.has(id)) { placed.add(id); out.push(n); } };
  const ordered = links.filter((l) => l.order !== undefined).sort((a, b) => (a.order! - b.order!));
  if (ordered.length) for (const l of ordered) { push(l.fromId); push(l.toId); }
  else for (const l of links) { push(l.fromId); push(l.toId); }
  for (const n of nodes) push(n.id);
  return out;
}

/** Push overlapping nodes apart until every pair respects radius+gap. */
function separate(nodes: SceneNode[], pos: Positions, passes = 60): void {
  const arr = nodes.map((n) => ({ id: n.id, r: nodeRadius(n), p: pos.get(n.id)! }));
  for (let pass = 0; pass < passes; pass++) {
    let moved = false;
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i], b = arr[j];
        let dx = b.p[0] - a.p[0], dy = b.p[1] - a.p[1], dz = b.p[2] - a.p[2];
        let d = Math.hypot(dx, dy, dz);
        const min = a.r + b.r + GAP;
        if (d >= min) continue;
        moved = true;
        if (d < 1e-4) { dx = 1; dy = 0.3 * ((i + j) % 3 - 1); dz = 0.2; d = Math.hypot(dx, dy, dz); }
        const push = (min - d) / 2 + 0.02;
        const ux = dx / d, uy = dy / d, uz = dz / d;
        a.p[0] -= ux * push; a.p[1] -= uy * push; a.p[2] -= uz * push;
        b.p[0] += ux * push; b.p[1] += uy * push; b.p[2] += uz * push;
      }
    }
    if (!moved) break;
  }
}

function recentre(nodes: SceneNode[], pos: Positions): number {
  let cx = 0, cy = 0, cz = 0;
  for (const n of nodes) { const p = pos.get(n.id)!; cx += p[0]; cy += p[1]; cz += p[2]; }
  cx /= nodes.length; cy /= nodes.length; cz /= nodes.length;
  let radius = 1;
  for (const n of nodes) {
    const p = pos.get(n.id)!;
    p[0] -= cx; p[1] -= cy; p[2] -= cz;
    radius = Math.max(radius, Math.hypot(p[0], p[1], p[2]) + nodeRadius(n));
  }
  return radius;
}

function groupOf(n: SceneNode): string { return n.group ?? '·'; }

function forceLayout(nodes: SceneNode[], links: SceneLink[], init: Positions | null): Positions {
  const rand = mulberry32(hashSeed(nodes));
  const n = nodes.length;
  const scale = Math.max(3, Math.cbrt(n) * 2.4);
  const pos: Positions = new Map();
  nodes.forEach((node, i) => {
    const seeded = init?.get(node.id);
    if (seeded) { pos.set(node.id, [...seeded] as V3); return; }
    // Fibonacci sphere start — evenly spread, so the sim converges cleanly.
    const k = (i + 0.5) / n;
    const phi = Math.acos(1 - 2 * k);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const r = scale * (0.7 + rand() * 0.3);
    pos.set(node.id, [r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta)]);
  });

  const idx = new Map(nodes.map((nd, i) => [nd.id, i]));
  const edges = links.map((l) => [idx.get(l.fromId), idx.get(l.toId)] as const).filter((e): e is [number, number] => e[0] !== undefined && e[1] !== undefined);
  const groups = new Map<string, number[]>();
  nodes.forEach((nd, i) => { const g = groupOf(nd); if (!groups.has(g)) groups.set(g, []); groups.get(g)!.push(i); });
  const P = nodes.map((nd) => pos.get(nd.id)!);
  const R = nodes.map(nodeRadius);
  const linkLen = 2.8 + scale * 0.2;
  const ITER = n > 28 ? 220 : 320;

  for (let it = 0; it < ITER; it++) {
    const cool = 1 - it / ITER;
    const step = 0.35 * cool + 0.04;
    const F = P.map(() => [0, 0, 0] as V3);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = P[j][0] - P[i][0], dy = P[j][1] - P[i][1], dz = P[j][2] - P[i][2];
        let d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 1e-4) { dx = rand() - 0.5; dy = rand() - 0.5; dz = rand() - 0.5; d2 = dx * dx + dy * dy + dz * dz + 1e-3; }
        const d = Math.sqrt(d2);
        const f = (7 + (R[i] + R[j]) * 3) / d2; // inverse-square repulsion
        const fx = (dx / d) * f, fy = (dy / d) * f, fz = (dz / d) * f;
        F[i][0] -= fx; F[i][1] -= fy; F[i][2] -= fz;
        F[j][0] += fx; F[j][1] += fy; F[j][2] += fz;
      }
    }
    for (const [a, b] of edges) {
      const dx = P[b][0] - P[a][0], dy = P[b][1] - P[a][1], dz = P[b][2] - P[a][2];
      const d = Math.hypot(dx, dy, dz) || 1e-3;
      const f = 0.08 * (d - linkLen);
      const fx = (dx / d) * f, fy = (dy / d) * f, fz = (dz / d) * f;
      F[a][0] += fx; F[a][1] += fy; F[a][2] += fz;
      F[b][0] -= fx; F[b][1] -= fy; F[b][2] -= fz;
    }
    if (groups.size > 1) {
      for (const members of groups.values()) {
        if (members.length < 2) continue;
        let cx = 0, cy = 0, cz = 0;
        for (const i of members) { cx += P[i][0]; cy += P[i][1]; cz += P[i][2]; }
        cx /= members.length; cy /= members.length; cz /= members.length;
        for (const i of members) { F[i][0] += (cx - P[i][0]) * 0.03; F[i][1] += (cy - P[i][1]) * 0.03; F[i][2] += (cz - P[i][2]) * 0.03; }
      }
    }
    for (let i = 0; i < n; i++) {
      // Gentle pull to the origin keeps disconnected components together.
      F[i][0] -= P[i][0] * 0.012; F[i][1] -= P[i][1] * 0.012; F[i][2] -= P[i][2] * 0.012;
      const mag = Math.hypot(F[i][0], F[i][1], F[i][2]);
      const cap = 1.2;
      const k = mag > cap ? cap / mag : 1;
      P[i][0] += F[i][0] * k * step * 3; P[i][1] += F[i][1] * k * step * 3; P[i][2] += F[i][2] * k * step * 3;
    }
  }
  return pos;
}

function ringLayout(nodes: SceneNode[], links: SceneLink[]): Positions {
  const seq = sequenceOrder(nodes, links);
  const avgD = seq.reduce((s, nd) => s + nodeRadius(nd) * 2, 0) / seq.length;
  const radius = Math.max(4, (seq.length * (avgD + GAP + 0.8)) / (2 * Math.PI));
  const pos: Positions = new Map();
  seq.forEach((nd, i) => {
    const a = (i / seq.length) * Math.PI * 2 - Math.PI / 2;
    // Alternate a small height offset so the ring reads as 3D and neighbours
    // never sit on exactly the same plane.
    pos.set(nd.id, [Math.cos(a) * radius, (i % 2 === 0 ? 0.55 : -0.55), Math.sin(a) * radius]);
  });
  return pos;
}

function lineLayout(nodes: SceneNode[], links: SceneLink[]): Positions {
  const seq = sequenceOrder(nodes, links);
  const spacing = Math.max(3.4, seq.reduce((s, nd) => s + nodeRadius(nd) * 2, 0) / seq.length + GAP + 1.2);
  const pos: Positions = new Map();
  // Long sequences snake across rows (8 per row) instead of becoming one
  // enormous line that has to be zoomed far out to fit the screen.
  const cols = seq.length > 10 ? 8 : seq.length;
  const rows = Math.ceil(seq.length / cols);
  seq.forEach((nd, i) => {
    const row = Math.floor(i / cols);
    const c = i % cols;
    const col = row % 2 === 0 ? c : cols - 1 - c;
    const x = (col - (cols - 1) / 2) * spacing;
    const y = ((rows - 1) / 2 - row) * 4.2 + Math.sin(i * 0.95) * 0.9;
    pos.set(nd.id, [x, y, Math.cos(i * 0.7) * 1.6]);
  });
  return pos;
}

function layersLayout(nodes: SceneNode[]): Positions {
  const groups = new Map<string, SceneNode[]>();
  for (const nd of nodes) { const g = groupOf(nd); if (!groups.has(g)) groups.set(g, []); groups.get(g)!.push(nd); }
  const pos: Positions = new Map();
  const layerGap = 4.4;
  let li = 0;
  const total = groups.size;
  for (const members of groups.values()) {
    const y = ((total - 1) / 2 - li) * layerGap;
    const avgD = members.reduce((s, nd) => s + nodeRadius(nd) * 2, 0) / members.length;
    const radius = members.length === 1 ? 0 : Math.max(2.6, (members.length * (avgD + GAP + 0.6)) / (2 * Math.PI));
    members.forEach((nd, i) => {
      const a = (i / members.length) * Math.PI * 2 + li * 0.5;
      pos.set(nd.id, [Math.cos(a) * radius, y, Math.sin(a) * radius]);
    });
    li++;
  }
  return pos;
}

/** True when the model supplied usable x/y/z hints for (nearly) every node. */
function hasHints(nodes: SceneNode[]): boolean {
  const withXYZ = nodes.filter((n) => n.x !== undefined && n.y !== undefined && n.z !== undefined).length;
  return withXYZ >= Math.ceil(nodes.length * 0.7);
}

export interface LayoutResult { positions: Positions; radius: number }

export function computeLayout(nodes: SceneNode[], links: SceneLink[], mode: SceneLayout = 'auto'): LayoutResult {
  let positions: Positions;
  if (mode === 'ring') positions = ringLayout(nodes, links);
  else if (mode === 'line') positions = lineLayout(nodes, links);
  else if (mode === 'layers') positions = layersLayout(nodes);
  else if (hasHints(nodes)) {
    // Trust the model's composition, then just resolve overlaps.
    const S = Math.max(5, Math.cbrt(nodes.length) * 3.6);
    const hint: Positions = new Map();
    nodes.forEach((n, i) => {
      const f = (v: number | undefined, fallback: number) => (((v ?? fallback) - 50) / 50) * S;
      hint.set(n.id, [f(n.x, 50), f(n.y, 50), f(n.z, 50 + ((i % 5) - 2) * 6)]);
    });
    positions = forceLayout(nodes, links, hint);
  } else positions = forceLayout(nodes, links, null);

  separate(nodes, positions);
  const radius = recentre(nodes, positions);
  return { positions, radius };
}
