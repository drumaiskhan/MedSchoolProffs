// 3D engine for the AI Visualizer's anatomy "model" mode (v61).
//
// A SOLID, STATIC model: nothing moves, floats or auto-rotates. The student
// orbits it by hand (drag / pinch / scroll), taps a part (or its label) to
// select it, and reads atlas-style labels: each label sits in a tidy column
// to the left or right of the model and is joined to its structure by a
// leader line ending in a dot on the surface. Labels never overlap (they are
// spread vertically per column), and a label whose structure is currently
// hidden behind other parts is drawn dashed/dim; tapping it rotates the model
// to reveal the part.
//
// Raw three.js, same style as Scene3D.tsx. Geometry comes from modelMesh.ts.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ModelFinish, ModelPart } from './schema';
import { buildPartMesh } from './modelMesh';

export type ModelView = 'front' | 'back' | 'left' | 'right' | 'top';

export interface Model3DHandle {
  resetView: () => void;
  setView: (v: ModelView) => void;
  /** Select-and-reveal from outside the canvas (parts list): rotates only if the part is hidden from the current view. */
  revealPart: (id: string) => void;
  snapshot: () => string | null;
}

export interface Model3DProps {
  parts: ModelPart[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  showLabels: boolean;
  xray: boolean;
  hidden: ReadonlySet<string>;
  onWebglFailed?: () => void;
}

/** Natural fallback colours per finish when the AI gives none. */
const FINISH_DEFAULT: Record<ModelFinish, string> = { bone: '#e7dcc3', soft: '#b9645a', glossy: '#a8cbd8', matte: '#b9a98a' };
export const PART_PALETTE = ['#e7dcc3', '#c9786b', '#8fb6c8', '#d9b96a', '#9c8bbf', '#7fb08a', '#d98f8f', '#b7a58a'];

export function partColor(p: ModelPart, index: number): string {
  if (p.color && /^#[0-9a-fA-F]{6}$/.test(p.color)) return p.color;
  return p.finish ? FINISH_DEFAULT[p.finish] : PART_PALETTE[index % PART_PALETTE.length];
}

function makeMaterial(p: ModelPart, color: string): THREE.MeshPhysicalMaterial {
  const c = new THREE.Color(color);
  const base = { color: c, metalness: 0, envMapIntensity: 0.9, emissive: new THREE.Color(0x2f7dff), emissiveIntensity: 0 };
  switch (p.finish) {
    case 'bone': return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.6, clearcoat: 0.12, clearcoatRoughness: 0.55, sheen: 0.25, sheenRoughness: 0.8, sheenColor: new THREE.Color('#fff3d6') });
    case 'glossy': return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.22, clearcoat: 0.75, clearcoatRoughness: 0.18 });
    case 'matte': return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.88, clearcoat: 0 });
    default: return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.46, clearcoat: 0.35, clearcoatRoughness: 0.35, sheen: 0.35, sheenRoughness: 0.5, sheenColor: c.clone().lerp(new THREE.Color('#ffffff'), 0.5) });
  }
}

interface PartObj {
  part: ModelPart; index: number; mesh: THREE.Mesh; mat: THREE.MeshPhysicalMaterial; baseOpacity: number;
  // label
  el?: HTMLButtonElement; line?: SVGPathElement; dot?: SVGCircleElement; dotRing?: SVGCircleElement;
  anchor: THREE.Vector3; viewDir: THREE.Vector3; // direction (from model centre) from which the anchor is visible
  side?: 'L' | 'R'; behind: boolean; w: number; h: number; lastTransform: string;
  shown: boolean;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const ACCENT_SEL = 0.38, ACCENT_HOVER = 0.16;

function slerpDir(a: THREE.Vector3, b: THREE.Vector3, t: number): THREE.Vector3 {
  const d = THREE.MathUtils.clamp(a.dot(b), -1, 1);
  const ang = Math.acos(d);
  if (ang < 1e-4) return b.clone();
  if (Math.PI - ang < 1e-3) {
    // opposite directions: swing through a perpendicular so the path is defined
    const perp = new THREE.Vector3().crossVectors(a, Math.abs(a.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
    return t < 0.5 ? slerpDir(a, perp, t * 2) : slerpDir(perp, b, t * 2 - 1);
  }
  const s = Math.sin(ang);
  return a.clone().multiplyScalar(Math.sin((1 - t) * ang) / s).addScaledVector(b, Math.sin(t * ang) / s);
}
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const Model3D = forwardRef<Model3DHandle, Model3DProps>(function Model3D(props, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelLayerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  const live = useRef(props);
  live.current = props;
  const api = useRef<Model3DHandle>({ resetView: () => {}, setView: () => {}, revealPart: () => {}, snapshot: () => null });
  useImperativeHandle(ref, () => ({
    resetView: () => api.current.resetView(),
    setView: (v) => api.current.setView(v),
    revealPart: (id) => api.current.revealPart(id),
    snapshot: () => api.current.snapshot(),
  }), []);

  useEffect(() => {
    const host = hostRef.current, layer = labelLayerRef.current;
    if (!host || !layer) return;

    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); }
    catch { setFailed(true); live.current.onWebglFailed?.(); return; }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const canvas = renderer.domElement;
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none;';
    canvas.setAttribute('data-testid', 'canvas-anatomy-3d');
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', '3D anatomy model. Drag to rotate, scroll or pinch to zoom, tap a structure to select it.');
    host.insertBefore(canvas, layer);

    // ---- scene, lighting (image-based, so bone/organ surfaces look physical) ----
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new RoomEnvironment();
    const envRT = pmrem.fromScene(envScene, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.95;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa3b5, 0.35));
    const key = new THREE.DirectionalLight(0xffffff, 1.25); scene.add(key, key.target);
    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.45); scene.add(fill, fill.target);

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 2000);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.09;
    controls.rotateSpeed = 0.9; controls.zoomSpeed = 0.9; controls.panSpeed = 0.7;
    controls.screenSpacePanning = true;

    // ---- build the solid parts ---------------------------------------------------
    const objs: PartObj[] = [];
    const byId = new Map<string, PartObj>();
    const meshes: THREE.Mesh[] = [];
    const world = new THREE.Group(); scene.add(world);
    const bounds = new THREE.Box3();
    live.current.parts.forEach((part, index) => {
      const data = buildPartMesh(part);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
      geo.setIndex(new THREE.BufferAttribute(data.indices, 1));
      geo.computeBoundingBox(); geo.computeBoundingSphere();
      const mat = makeMaterial(part, partColor(part, index));
      const baseOpacity = part.opacity ?? 1;
      if (baseOpacity < 0.999) { mat.transparent = true; mat.opacity = baseOpacity; mat.depthWrite = false; }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.partId = part.id;
      if (baseOpacity < 0.999) mesh.renderOrder = 2;
      world.add(mesh); meshes.push(mesh);
      bounds.expandByObject(mesh);
      const o: PartObj = { part, index, mesh, mat, baseOpacity, anchor: new THREE.Vector3(), viewDir: new THREE.Vector3(0, 0, 1), behind: false, w: 0, h: 0, lastTransform: '', shown: false };
      objs.push(o); byId.set(part.id, o);
    });
    world.updateMatrixWorld(true);

    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const radius = Math.max(size.length() / 2, 1);
    key.position.copy(center).add(new THREE.Vector3(0.7, 1.0, 1.2).multiplyScalar(radius * 2));
    key.target.position.copy(center);
    fill.position.copy(center).add(new THREE.Vector3(-1.2, -0.3, -0.6).multiplyScalar(radius * 2));
    fill.target.position.copy(center);

    // ---- anchors: a surface point on each part that is visible from some direction ----
    const ray = new THREE.Raycaster();
    const candidates = (c: THREE.Vector3): THREE.Vector3[] => {
      const side = c.x >= center.x ? 1 : -1;
      return [new THREE.Vector3(0, 0, 1), new THREE.Vector3(side, 0, 0), new THREE.Vector3(-side, 0, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0)];
    };
    const far = radius * 6;
    objs.forEach((o) => {
      const box = new THREE.Box3().setFromObject(o.mesh);
      const c = box.getCenter(new THREE.Vector3());
      let picked = false;
      if (o.part.anchor) {
        o.anchor.set(o.part.anchor[0], o.part.anchor[1], o.part.anchor[2]);
        // face direction = from the model centre through the anchor, snapped to the dominant axis
        const d = o.anchor.clone().sub(center);
        const ax = Math.abs(d.x) > Math.abs(d.z) ? new THREE.Vector3(Math.sign(d.x) || 1, 0, 0) : new THREE.Vector3(0, 0, Math.sign(d.z) || 1);
        o.viewDir.copy(ax); picked = true;
      }
      if (!picked) {
        let fallback: { p: THREE.Vector3; d: THREE.Vector3 } | null = null;
        for (const dir of candidates(c)) {
          const origin = c.clone().addScaledVector(dir, far);
          ray.set(origin, dir.clone().negate()); ray.far = far * 2;
          const own = ray.intersectObject(o.mesh, false)[0];
          if (!own) continue;
          if (!fallback) fallback = { p: own.point.clone(), d: dir.clone() };
          const all = ray.intersectObjects(meshes.filter((m) => !(m.material as THREE.Material).transparent || m === o.mesh), false)[0];
          if (all && all.object === o.mesh) { o.anchor.copy(own.point); o.viewDir.copy(dir); picked = true; break; }
        }
        if (!picked && fallback) { o.anchor.copy(fallback.p); o.viewDir.copy(fallback.d); picked = true; }
        if (!picked) {
          // no clean ray (e.g. a curved tube): use the vertex closest to the centre
          const pos = o.mesh.geometry.getAttribute('position');
          let best = Infinity; const v = new THREE.Vector3();
          for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); const d = v.distanceToSquared(c); if (d < best) { best = d; o.anchor.copy(v); } }
          o.viewDir.copy(o.anchor).sub(center).normalize();
          if (o.viewDir.lengthSq() < 1e-6) o.viewDir.set(0, 0, 1);
        }
      }
    });

    // ---- label overlay (SVG leader lines + HTML chips) ------------------------------
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'atlas-lines');
    layer.appendChild(svg);
    objs.forEach((o) => {
      if (o.part.hideLabel) return;
      const line = document.createElementNS(SVG_NS, 'path'); line.setAttribute('class', 'atlas-line');
      const ring = document.createElementNS(SVG_NS, 'circle'); ring.setAttribute('class', 'atlas-dot-ring'); ring.setAttribute('r', '5');
      const dot = document.createElementNS(SVG_NS, 'circle'); dot.setAttribute('class', 'atlas-dot'); dot.setAttribute('r', '2.6');
      svg.append(line, ring, dot);
      const el = document.createElement('button');
      el.type = 'button'; el.className = 'atlas-label';
      el.setAttribute('data-testid', `label-anatomy-${o.part.id}`);
      const sw = document.createElement('span'); sw.className = 'atlas-label__swatch'; sw.style.background = `#${o.mat.color.getHexString()}`;
      const name = document.createElement('span'); name.className = 'atlas-label__name'; name.textContent = o.part.label;
      el.append(sw, name);
      el.addEventListener('click', (e) => { e.stopPropagation(); live.current.onSelect(o.part.id); if (o.behind) flyTo(o.viewDir); });
      el.addEventListener('pointerenter', () => { hoverId = o.part.id; stateDirty = true; });
      el.addEventListener('pointerleave', () => { if (hoverId === o.part.id) { hoverId = null; stateDirty = true; } });
      layer.appendChild(el);
      o.el = el; o.line = line; o.dot = dot; o.dotRing = ring;
    });

    // ---- camera framing / animation --------------------------------------------------
    let hoverId: string | null = null;
    let stateDirty = true, labelsDirty = true, occDirty = true, lastMove = 0, lastKey = '';
    let anim: null | { t0: number; dur: number; from: THREE.Vector3; to: THREE.Vector3; d0: number; d1: number } = null;
    const homeDir = new THREE.Vector3(0.3, 0.14, 1).normalize();
    let homeDist = 1, framed = false;

    const fitDistance = () => {
      const vFov = THREE.MathUtils.degToRad(camera.fov);
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
      const dY = (size.y / 2 * 1.14) / Math.tan(vFov / 2);
      const dX = (Math.max(size.x, size.z) / 2 * 2.3) / Math.tan(hFov / 2); // leave room for the label columns
      return Math.max(dY, dX, radius * 0.9) + Math.max(size.z, size.x) / 2;
    };
    const frame = (resetPose: boolean) => {
      homeDist = fitDistance();
      controls.minDistance = homeDist * 0.22; controls.maxDistance = homeDist * 2.6;
      camera.near = Math.max(0.1, homeDist / 200); camera.far = homeDist * 8; camera.updateProjectionMatrix();
      if (resetPose) { controls.target.copy(center); camera.position.copy(center).addScaledVector(homeDir, homeDist); camera.up.set(0, 1, 0); controls.update(); }
    };
    const flyTo = (dir: THREE.Vector3, distance?: number) => {
      const cur = camera.position.clone().sub(controls.target);
      const d0 = cur.length();
      anim = { t0: performance.now(), dur: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 1 : 520, from: cur.normalize(), to: dir.clone().normalize(), d0, d1: distance ?? d0 };
    };
    const resetView = () => { anim = null; controls.target.copy(center); flyTo(homeDir, homeDist); };
    const VIEWS: Record<ModelView, THREE.Vector3> = {
      front: new THREE.Vector3(0, 0.04, 1), back: new THREE.Vector3(0, 0.04, -1), left: new THREE.Vector3(-1, 0.04, 0.001), right: new THREE.Vector3(1, 0.04, 0.001), top: new THREE.Vector3(0.001, 1, 0.12),
    };
    api.current = {
      resetView,
      setView: (v) => { controls.target.copy(center); flyTo(VIEWS[v]); },
      revealPart: (id) => { const o = byId.get(id); if (!o) return; computeBehind(); if (o.behind || !o.el) flyTo(o.viewDir); },
      snapshot: () => { renderer.render(scene, camera); return canvas.toDataURL('image/png'); },
    };

    // ---- selection / hover -------------------------------------------------------
    const pointer = new THREE.Vector2();
    const pick = (clientX: number, clientY: number): string | null => {
      const r = canvas.getBoundingClientRect();
      pointer.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(pointer, camera); ray.far = Infinity;
      const visible = meshes.filter((m) => m.visible);
      const hit = ray.intersectObjects(visible, false)[0];
      return hit ? (hit.object.userData.partId as string) : null;
    };
    let down: { x: number; y: number; t: number } | null = null;
    const onDown = (e: PointerEvent) => {
      if (!e.isPrimary) { down = null; return; } // second finger of a pinch: never a tap
      down = { x: e.clientX, y: e.clientY, t: performance.now() }; anim = null;
    };
    const onUp = (e: PointerEvent) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t;
      down = null;
      if (moved < 6 && dt < 700) live.current.onSelect(pick(e.clientX, e.clientY));
    };
    let hoverPending = false;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.buttons || hoverPending) return;
      hoverPending = true;
      requestAnimationFrame(() => {
        hoverPending = false;
        const id = pick(e.clientX, e.clientY);
        if (id !== hoverId) { hoverId = id; stateDirty = true; canvas.style.cursor = id ? 'pointer' : 'grab'; }
      });
    };
    const onLeave = () => { if (hoverId) { hoverId = null; stateDirty = true; } };
    canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerleave', onLeave);
    controls.addEventListener('start', () => { anim = null; });

    // ---- per-state material styling (selection, hover, ghosting, x-ray, hidden) ------
    const applyState = () => {
      const { selectedId, xray, hidden } = live.current;
      for (const o of objs) {
        const vis = !hidden.has(o.part.id);
        o.mesh.visible = vis;
        const sel = o.part.id === selectedId, hov = o.part.id === hoverId;
        const ghost = (!!selectedId && !sel) || (xray && !sel);
        const target = o.baseOpacity * (ghost ? (selectedId && !xray ? 0.2 : 0.3) : 1);
        const wasTransparent = o.mat.transparent;
        const transparent = target < 0.999;
        o.mat.opacity = target;
        o.mat.transparent = transparent;
        o.mat.depthWrite = !transparent;
        if (wasTransparent !== transparent) o.mat.needsUpdate = true;
        o.mat.emissiveIntensity = sel ? ACCENT_SEL : hov ? ACCENT_HOVER : 0;
        o.mesh.renderOrder = transparent ? 2 : 0;
      }
    };

    // ---- occlusion (is each anchor visible from the current camera?) -----------------
    const tmpDir = new THREE.Vector3();
    function computeBehind() {
      const eps = radius * 0.02;
      const targets = meshes.filter((m) => m.visible && !(m.material as THREE.Material).transparent);
      for (const o of objs) {
        if (!o.el) continue;
        tmpDir.copy(o.anchor).sub(camera.position);
        const dist = tmpDir.length();
        tmpDir.divideScalar(dist || 1);
        ray.set(camera.position, tmpDir); ray.far = dist;
        const hit = ray.intersectObjects(targets, false)[0];
        o.behind = !!hit && hit.distance < dist - eps;
      }
      labelsDirty = true;
    }

    // ---- label layout (per frame while the view changes) ----------------------------
    const corners: THREE.Vector3[] = [];
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) corners.push(new THREE.Vector3(x, y, z));
    const tmp = new THREE.Vector3();
    const GAP = 5, PAD = 8;

    const layoutLabels = () => {
      const W = host.clientWidth, H = host.clientHeight;
      if (!W || !H) return;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const { showLabels, selectedId } = live.current;

      let minX = Infinity, maxX = -Infinity;
      for (const c of corners) { tmp.copy(c).project(camera); const sx = (tmp.x * 0.5 + 0.5) * W; if (sx < minX) minX = sx; if (sx > maxX) maxX = sx; }
      tmp.copy(center).project(camera);
      const cx = (tmp.x * 0.5 + 0.5) * W;

      const cols: Record<'L' | 'R', Array<{ o: PartObj; sx: number; sy: number; y: number }>> = { L: [], R: [] };
      for (const o of objs) {
        if (!o.el) continue;
        const wanted = (showLabels || o.part.id === selectedId || o.part.id === hoverId) && !live.current.hidden.has(o.part.id);
        if (!wanted) { if (o.shown) { o.el.style.visibility = 'hidden'; o.line!.style.display = 'none'; o.dot!.style.display = 'none'; o.dotRing!.style.display = 'none'; o.shown = false; } continue; }
        tmp.copy(o.anchor).project(camera);
        const sx = (tmp.x * 0.5 + 0.5) * W, sy = (-tmp.y * 0.5 + 0.5) * H;
        if (!o.w) { o.w = o.el.offsetWidth; o.h = o.el.offsetHeight; }
        if (!o.side) o.side = sx < cx ? 'L' : 'R';
        else if (o.side === 'L' && sx > cx + 26) o.side = 'R';
        else if (o.side === 'R' && sx < cx - 26) o.side = 'L';
        cols[o.side].push({ o, sx, sy, y: sy });
      }

      // Balance: never more labels in a column than fit its height.
      const cap = Math.max(3, Math.floor((H - PAD * 2) / 29));
      while (cols.L.length > cap && cols.R.length < cap) { cols.L.sort((a, b) => a.sx - b.sx); const m = cols.L.pop()!; m.o.side = 'R'; cols.R.push(m); }
      while (cols.R.length > cap && cols.L.length < cap) { cols.R.sort((a, b) => a.sx - b.sx); const m = cols.R.shift()!; m.o.side = 'L'; cols.L.push(m); }

      const place = (side: 'L' | 'R') => {
        const items = cols[side].sort((a, b) => a.sy - b.sy);
        if (!items.length) return;
        const rowH = Math.max(...items.map((i) => i.o.h || 24)) + GAP;
        const top = PAD + rowH / 2, bottom = H - PAD - rowH / 2;
        let y = -Infinity;
        for (const it of items) { it.y = Math.max(it.sy, y + rowH); y = it.y; }
        const over = items[items.length - 1].y - bottom;
        if (over > 0) { let next = bottom + rowH; for (let i = items.length - 1; i >= 0; i--) { items[i].y = Math.min(items[i].y, next - rowH); next = items[i].y; } }
        y = top - rowH;
        for (const it of items) { it.y = Math.max(it.y, y + rowH); y = it.y; }
        const maxW = Math.max(...items.map((i) => i.o.w || 90));
        const edge = side === 'L' ? Math.max(minX - 20, maxW + PAD) : Math.min(maxX + 20, W - maxW - PAD);
        for (const it of items) {
          const { o } = it;
          const x = side === 'L' ? edge - o.w : edge;
          const tf = `translate(${Math.round(x)}px,${Math.round(it.y - o.h / 2)}px)`;
          if (tf !== o.lastTransform) { o.el!.style.transform = tf; o.lastTransform = tf; }
          const dir = side === 'L' ? 1 : -1, ex = edge;
          o.line!.setAttribute('d', `M${ex.toFixed(1)} ${it.y.toFixed(1)} H${(ex + dir * 14).toFixed(1)} L${it.sx.toFixed(1)} ${it.sy.toFixed(1)}`);
          o.dot!.setAttribute('cx', it.sx.toFixed(1)); o.dot!.setAttribute('cy', it.sy.toFixed(1));
          o.dotRing!.setAttribute('cx', it.sx.toFixed(1)); o.dotRing!.setAttribute('cy', it.sy.toFixed(1));
          if (!o.shown) { o.el!.style.visibility = 'visible'; o.line!.style.display = ''; o.dot!.style.display = ''; o.dotRing!.style.display = ''; o.shown = true; }
          const sel = o.part.id === selectedId, hov = o.part.id === hoverId;
          o.el!.classList.toggle('is-selected', sel); o.el!.classList.toggle('is-hover', hov && !sel);
          o.el!.classList.toggle('is-behind', o.behind); o.el!.classList.toggle('is-dim', !!selectedId && !sel);
          for (const n of [o.line!, o.dot!, o.dotRing!]) { n.classList.toggle('is-behind', o.behind); n.classList.toggle('is-selected', sel); n.classList.toggle('is-dim', !!selectedId && !sel); }
        }
      };
      place('L'); place('R');
    };

    // ---- resize + loop ----------------------------------------------------------------
    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      const first = !framed; framed = true;
      frame(first);
      labelsDirty = true; occDirty = true; lastMove = performance.now();
    };
    const ro = new ResizeObserver(resize); ro.observe(host);
    resize();
    // Labels measure their own text once fonts are ready.
    (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready.then(() => { objs.forEach((o) => { o.w = 0; }); labelsDirty = true; });

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      let moved = false;
      if (anim) {
        const t = Math.min(1, (performance.now() - anim.t0) / anim.dur), e = ease(t);
        const dir = slerpDir(anim.from, anim.to, e), d = anim.d0 + (anim.d1 - anim.d0) * e;
        camera.position.copy(controls.target).addScaledVector(dir, d);
        camera.lookAt(controls.target);
        if (t >= 1) anim = null;
        moved = true;
      }
      if (controls.update()) moved = true;
      const k = `${live.current.selectedId}|${hoverId}|${live.current.xray}|${[...live.current.hidden].join(',')}|${live.current.showLabels}`;
      if (k !== lastKey) { lastKey = k; stateDirty = true; labelsDirty = true; occDirty = true; lastMove = performance.now(); }
      if (stateDirty) { applyState(); stateDirty = false; moved = true; }
      if (moved) { renderer.render(scene, camera); labelsDirty = true; occDirty = true; lastMove = performance.now(); }
      if (occDirty && performance.now() - lastMove > 90) { computeBehind(); occDirty = false; }
      if (labelsDirty) { layoutLabels(); labelsDirty = false; }
    };
    renderer.render(scene, camera);
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerleave', onLeave);
      controls.dispose();
      objs.forEach((o) => { o.mesh.geometry.dispose(); o.mat.dispose(); o.el?.remove(); });
      svg.remove();
      envRT.dispose(); pmrem.dispose(); envScene.traverse((c) => { const m = c as THREE.Mesh; m.geometry?.dispose?.(); const mt = m.material as THREE.Material | undefined; mt?.dispose?.(); });
      renderer.dispose();
      canvas.remove();
      api.current = { resetView: () => {}, setView: () => {}, revealPart: () => {}, snapshot: () => null };
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (failed) return null;
  return (
    <div ref={hostRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" data-testid="anatomy-3d-host">
      <div ref={labelLayerRef} className="atlas-layer pointer-events-none absolute inset-0 overflow-hidden" />
    </div>
  );
});
