// The 3D engine of the AI Visualizer. Raw three.js (no react-three-fiber) so
// the render loop, picking, label collision and cleanup are fully explicit.
//
// What the student can do on ONE screen:
//  - orbit / pan / pinch-zoom the whole scene
//  - hover any structure or link to highlight it and its neighbours
//  - click a structure (or link) to select it; double-click to fly to it
//  - drag a structure to rearrange the scene
//  - toggle labels, flow particles, auto-rotate; re-layout; reset view
//
// Labels are HTML (crisp text) positioned from the projected node positions
// and run through a per-frame collision pass so they never sit on top of each
// other: each label tries a ring of candidate offsets around its node and is
// hidden (until hovered/selected) if there is no free slot.
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { SceneLayout, SceneLink, SceneNode } from './schema';
import { computeLayout, nodeRadius, type V3 } from './layout3d';

export const GROUP_PALETTE = ['#2f9e7a', '#3b82c4', '#d9822b', '#c8553d', '#7c5cbf', '#1f9aa8', '#c2a12e', '#d0527e'];

/** group name -> colour (stable order of first appearance). */
export function buildGroupColors(nodes: SceneNode[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const n of nodes) {
    const g = n.group ?? '';
    if (!m.has(g)) m.set(g, GROUP_PALETTE[m.size % GROUP_PALETTE.length]);
  }
  return m;
}

export function nodeColor(n: SceneNode, groups: Map<string, string>): string {
  // Grouped nodes always use their group colour so the legend matches the scene.
  if (n.group) return groups.get(n.group) ?? GROUP_PALETTE[0];
  if (n.color && /^#[0-9a-fA-F]{6}$/.test(n.color)) return n.color;
  return groups.get('') ?? GROUP_PALETTE[0];
}

export interface Scene3DHandle {
  resetView: () => void;
  relayout: (mode: SceneLayout) => void;
  focusNode: (id: string) => void;
  /** Whole-scene snapshot as a PNG data URL (for "save image"). */
  snapshot: () => string | null;
}

export interface Scene3DProps {
  nodes: SceneNode[];
  links: SceneLink[];
  layout: SceneLayout;
  selectedId: string | null;
  selectedLinkIndex: number | null;
  onSelectNode: (id: string | null) => void;
  onSelectLink: (index: number | null) => void;
  showLabels: boolean;
  showFlow: boolean;
  autoRotate: boolean;
  /** group name currently isolated in the legend (null = all visible). */
  isolatedGroup: string | null;
  onWebglFailed?: () => void;
}

interface NodeObj {
  node: SceneNode; mesh: THREE.Mesh; halo: THREE.Mesh; hit: THREE.Mesh; group: THREE.Group;
  color: THREE.Color; radius: number; target: THREE.Vector3; phase: number;
  label: HTMLDivElement; badge?: HTMLDivElement;
}
interface LinkObj {
  link: SceneLink; index: number; from: NodeObj; to: NodeObj; curve: THREE.QuadraticBezierCurve3;
  tube: THREE.Mesh; arrow: THREE.Mesh; hit: THREE.Mesh; particles: THREE.Mesh[]; label?: HTMLDivElement; offset: number; last: number[];
}

function makeGeometry(shape: SceneNode['shape'], r: number): THREE.BufferGeometry {
  switch (shape) {
    case 'box': return new THREE.BoxGeometry(r * 1.6, r * 1.6, r * 1.6, 1, 1, 1);
    case 'cylinder': return new THREE.CylinderGeometry(r * 0.75, r * 0.75, r * 2, 32);
    case 'torus': return new THREE.TorusGeometry(r * 0.85, r * 0.38, 20, 48);
    case 'cone': return new THREE.ConeGeometry(r * 0.95, r * 2, 32);
    case 'capsule': return new THREE.CapsuleGeometry(r * 0.6, r * 1.1, 8, 20);
    case 'ellipsoid': { const g = new THREE.SphereGeometry(r, 36, 28); g.scale(1.35, 0.85, 1); return g; }
    default: return new THREE.SphereGeometry(r, 36, 28);
  }
}

function disposeObject(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
  });
}

export const Scene3D = forwardRef<Scene3DHandle, Scene3DProps>(function Scene3D(props, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelLayerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  // Live props read from inside the render loop without re-creating the scene.
  const live = useRef(props);
  live.current = props;

  const groupColors = useMemo(() => buildGroupColors(props.nodes), [props.nodes]);
  const api = useRef<Scene3DHandle>({ resetView: () => {}, relayout: () => {}, focusNode: () => {}, snapshot: () => null });
  useImperativeHandle(ref, () => ({
    resetView: () => api.current.resetView(),
    relayout: (m) => api.current.relayout(m),
    focusNode: (id) => api.current.focusNode(id),
    snapshot: () => api.current.snapshot(),
  }), []);

  // Hover is internal (it changes per frame, no React re-render needed).
  const hover = useRef<{ node: string | null; link: number | null }>({ node: null, link: null });

  useEffect(() => {
    const host = hostRef.current;
    const labelLayer = labelLayerRef.current;
    if (!host || !labelLayer) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      setFailed(true); live.current.onWebglFailed?.();
      return;
    }
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = renderer.domElement;
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none;';
    canvas.setAttribute('data-testid', 'canvas-visualizer-3d');
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', '3D visualization. Drag to rotate, scroll or pinch to zoom, click a structure to select it.');
    host.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
    camera.position.set(0, 4, 18);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8892a6, 1.05));
    const key = new THREE.DirectionalLight(0xffffff, 1.7); key.position.set(6, 10, 8); scene.add(key);
    const rim = new THREE.DirectionalLight(0xa9c7ff, 0.8); rim.position.set(-8, -3, -6); scene.add(rim);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.8; controls.zoomSpeed = 0.9; controls.panSpeed = 0.8;
    controls.minDistance = 2.5; controls.maxDistance = 120;
    controls.autoRotateSpeed = 0.9;

    const nodes = live.current.nodes;
    const links = live.current.links;
    const world = new THREE.Group(); scene.add(world);

    // ---- ambient dust (depth cue) ------------------------------------------------
    const dustN = 220;
    const dustPos = new Float32Array(dustN * 3);
    for (let i = 0; i < dustN; i++) {
      const r = 14 + Math.random() * 40, a = Math.random() * Math.PI * 2, b = Math.acos(2 * Math.random() - 1);
      dustPos[i * 3] = r * Math.sin(b) * Math.cos(a); dustPos[i * 3 + 1] = r * Math.cos(b); dustPos[i * 3 + 2] = r * Math.sin(b) * Math.sin(a);
    }
    const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0x8aa0b8, size: 0.09, transparent: true, opacity: 0.5, depthWrite: false }));
    scene.add(dust);

    // ---- layout ---------------------------------------------------------------------
    const initial = computeLayout(nodes, links, live.current.layout);
    let sceneRadius = initial.radius;

    // ---- nodes ----------------------------------------------------------------------
    const nodeObjs = new Map<string, NodeObj>();
    const pickables: THREE.Object3D[] = [];
    nodes.forEach((node, i) => {
      const color = new THREE.Color(nodeColor(node, groupColors));
      const r = nodeRadius(node);
      const group = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.12, emissive: color, emissiveIntensity: 0.12, transparent: true });
      const mesh = new THREE.Mesh(makeGeometry(node.shape, r), mat);
      const haloMat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, transparent: true, opacity: 0 });
      const halo = new THREE.Mesh(makeGeometry(node.shape, r * 1.0), haloMat); halo.scale.setScalar(1.14);
      const hit = new THREE.Mesh(new THREE.SphereGeometry(Math.max(r * 1.45, 0.85), 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
      group.add(halo, mesh, hit);
      const p = initial.positions.get(node.id)!;
      group.position.set(p[0], p[1], p[2]);
      world.add(group);
      hit.userData = { kind: 'node', id: node.id };
      pickables.push(hit);

      const label = document.createElement('div');
      label.className = 'viz3d-label';
      label.setAttribute('data-testid', `label-viz-${node.id}`);
      const name = document.createElement('span'); name.className = 'viz3d-label__name'; name.textContent = node.label;
      label.appendChild(name);
      if (node.tag) { const t = document.createElement('span'); t.className = 'viz3d-label__tag'; t.textContent = node.tag; label.appendChild(t); }
      label.style.setProperty('--viz-dot', `#${color.getHexString()}`);
      labelLayer.appendChild(label);

      nodeObjs.set(node.id, { node, mesh, halo, hit, group, color, radius: r, target: new THREE.Vector3(p[0], p[1], p[2]), phase: i * 1.7, label });
    });

    // ---- links ----------------------------------------------------------------------
    const linkObjs: LinkObj[] = [];
    const pairCount = new Map<string, number>();
    links.forEach((link, index) => {
      const from = nodeObjs.get(link.fromId), to = nodeObjs.get(link.toId);
      if (!from || !to) return;
      const key2 = [link.fromId, link.toId].sort().join('|');
      const k = pairCount.get(key2) ?? 0; pairCount.set(key2, k + 1);
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3());
      const col = from.color.clone().lerp(to.color, 0.5);
      const dashed = link.style === 'dashed';
      const tube = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: col, roughness: 0.6, transparent: true, opacity: dashed ? 0.55 : 0.85 }));
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 14), new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, transparent: true }));
      const hit = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ visible: false }));
      hit.userData = { kind: 'link', index };
      world.add(tube, arrow, hit);
      pickables.push(hit);
      const particles: THREE.Mesh[] = [];
      if (link.flow !== false) {
        const count = 2;
        for (let q = 0; q < count; q++) {
          const pm = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
          pm.userData.t0 = q / count; world.add(pm); particles.push(pm);
        }
      }
      let label: HTMLDivElement | undefined;
      if (link.label || link.order !== undefined) {
        label = document.createElement('div');
        label.className = 'viz3d-label viz3d-label--link';
        if (link.order !== undefined) { const o = document.createElement('span'); o.className = 'viz3d-label__order'; o.textContent = String(link.order); label.appendChild(o); }
        if (link.label) { const t = document.createElement('span'); t.className = 'viz3d-label__name'; t.textContent = link.label; label.appendChild(t); }
        labelLayer.appendChild(label);
      }
      linkObjs.push({ link, index, from, to, curve, tube, arrow, hit, particles, label, offset: k, last: [NaN, 0, 0, 0, 0, 0] });
    });

    // Rebuild every link's curve/tube from the current node positions. Called
    // each frame while nodes are moving (layout tween / drag) — cheap at ≤80 links.
    const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpDir = new THREE.Vector3(), tmpMid = new THREE.Vector3(), tmpN = new THREE.Vector3();
    const UP = new THREE.Vector3(0, 1, 0);
    function rebuildLink(L: LinkObj) {
      const fp = L.from.group.position, tp = L.to.group.position;
      const l = L.last;
      if (Math.abs(l[0] - fp.x) + Math.abs(l[1] - fp.y) + Math.abs(l[2] - fp.z) + Math.abs(l[3] - tp.x) + Math.abs(l[4] - tp.y) + Math.abs(l[5] - tp.z) < 1e-4) return;
      l[0] = fp.x; l[1] = fp.y; l[2] = fp.z; l[3] = tp.x; l[4] = tp.y; l[5] = tp.z;
      tmpA.copy(fp); tmpB.copy(tp);
      tmpDir.subVectors(tmpB, tmpA);
      const dist = tmpDir.length() || 1e-3; tmpDir.divideScalar(dist);
      const start = tmpA.clone().addScaledVector(tmpDir, L.from.radius * 0.95);
      const end = tmpB.clone().addScaledVector(tmpDir, -(L.to.radius * 0.95 + 0.42));
      tmpMid.addVectors(start, end).multiplyScalar(0.5);
      // Curve out of the straight line (more for parallel/duplicate links) so
      // links bend around rather than slicing through other nodes.
      tmpN.crossVectors(tmpDir, UP); if (tmpN.lengthSq() < 1e-4) tmpN.set(1, 0, 0); tmpN.normalize();
      const bend = Math.min(1.6, dist * 0.12) * (1 + L.offset * 1.4) * (L.offset % 2 === 0 ? 1 : -1);
      const ctrl = tmpMid.clone().addScaledVector(tmpN, bend).addScaledVector(UP, Math.min(0.9, dist * 0.05));
      L.curve.v0.copy(start); L.curve.v1.copy(ctrl); L.curve.v2.copy(end);
      L.curve.updateArcLengths();
      L.tube.geometry.dispose(); L.hit.geometry.dispose();
      if (L.link.style === 'dashed') {
        const len = L.curve.getLength();
        const n = Math.min(40, Math.max(6, Math.round(len * 1.6)));
        const parts: THREE.BufferGeometry[] = [];
        for (let i = 0; i < n; i++) {
          const a0 = L.curve.getPoint(i / n), a1 = L.curve.getPoint((i + 0.55) / n);
          parts.push(new THREE.TubeGeometry(new THREE.LineCurve3(a0, a1), 1, 0.05, 6, false));
        }
        L.tube.geometry = mergeGeometries(parts) ?? new THREE.BufferGeometry();
        parts.forEach((g) => g.dispose());
      } else L.tube.geometry = new THREE.TubeGeometry(L.curve, 28, 0.055, 8, false);
      L.hit.geometry = new THREE.TubeGeometry(L.curve, 14, 0.3, 6, false);
      const tip = L.curve.getPoint(1), tan = L.curve.getTangent(1);
      L.arrow.quaternion.setFromUnitVectors(UP, tan);
      L.arrow.position.copy(tip).addScaledVector(tan, 0.2);
    }

    // ---- camera helpers ---------------------------------------------------------------
    const camGoal = { pos: new THREE.Vector3(), target: new THREE.Vector3(), active: false, t: 0, fromPos: new THREE.Vector3(), fromTarget: new THREE.Vector3() };
    function fitDistance() {
      const vFov = (camera.fov * Math.PI) / 180;
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
      const limiting = Math.min(vFov, hFov);
      return Math.max(8, (sceneRadius * 1.25) / Math.sin(limiting / 2));
    }
    function flyTo(pos: THREE.Vector3, target: THREE.Vector3) {
      camGoal.fromPos.copy(camera.position); camGoal.fromTarget.copy(controls.target);
      camGoal.pos.copy(pos); camGoal.target.copy(target); camGoal.t = 0; camGoal.active = !reduceMotion;
      if (reduceMotion) { camera.position.copy(pos); controls.target.copy(target); }
    }
    function resetView(instant = false) {
      const d = fitDistance();
      const dir = new THREE.Vector3(0.18, 0.32, 1).normalize();
      const pos = dir.multiplyScalar(d), target = new THREE.Vector3();
      if (instant) { camera.position.copy(pos); controls.target.copy(target); camGoal.active = false; } else flyTo(pos, target);
    }
    function focusNode(id: string) {
      const n = nodeObjs.get(id); if (!n) return;
      const target = n.group.position.clone();
      const dirFromTarget = camera.position.clone().sub(controls.target).normalize();
      const dist = Math.max(6, Math.min(fitDistance() * 0.55, 16));
      flyTo(target.clone().addScaledVector(dirFromTarget, dist), target);
    }

    // ---- sizing -----------------------------------------------------------------------
    function resize() {
      const w = Math.max(1, host!.clientWidth), h = Math.max(1, host!.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    resize();
    resetView(true);
    let userMoved = false;
    controls.addEventListener('start', () => { userMoved = true; });
    const ro = new ResizeObserver(() => { resize(); if (!userMoved && !camGoal.active) resetView(true); });
    ro.observe(host);

    // ---- picking / interaction ----------------------------------------------------------
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    function pick(clientX: number, clientY: number): { kind: 'node'; id: string } | { kind: 'link'; index: number } | null {
      const rect = canvas.getBoundingClientRect();
      ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -(((clientY - rect.top) / rect.height) * 2 - 1));
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(pickables, false);
      // Prefer a node over a link when both are under the pointer.
      const nodeHit = hits.find((h) => h.object.userData.kind === 'node');
      if (nodeHit) return { kind: 'node', id: nodeHit.object.userData.id };
      const linkHit = hits.find((h) => h.object.userData.kind === 'link');
      if (linkHit) return { kind: 'link', index: linkHit.object.userData.index };
      return null;
    }

    let downX = 0, downY = 0, downAt = 0, pressedNode: NodeObj | null = null, dragging = false, pointerActive = false;
    const activePointers = new Set<number>();
    let multiTouch = false;
    const dragPlane = new THREE.Plane(), dragOffset = new THREE.Vector3(), dragPoint = new THREE.Vector3();
    let lastTap = 0, lastTapId: string | null = null;

    // Capture phase: runs before OrbitControls so pressing a node can disable
    // orbiting for this gesture (node press = drag the node; empty space = orbit).
    const onPointerDown = (e: PointerEvent) => {
      activePointers.add(e.pointerId);
      if (activePointers.size > 1) { multiTouch = true; pressedNode = null; dragging = false; controls.enabled = true; return; }
      multiTouch = false; pointerActive = true;
      downX = e.clientX; downY = e.clientY; downAt = performance.now(); dragging = false;
      const hit = pick(e.clientX, e.clientY);
      pressedNode = hit && hit.kind === 'node' ? nodeObjs.get(hit.id) ?? null : null;
      if (pressedNode) {
        controls.enabled = false;
        // Plane facing the camera through the node: dragging slides it in that plane.
        const camDir = camera.getWorldDirection(new THREE.Vector3());
        dragPlane.setFromNormalAndCoplanarPoint(camDir, pressedNode.group.position);
        raycaster.setFromCamera(ndc, camera);
        if (raycaster.ray.intersectPlane(dragPlane, dragPoint)) dragOffset.subVectors(pressedNode.group.position, dragPoint);
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.buttons === 0) {
        if (e.pointerType !== 'mouse') return;
        const hit = pick(e.clientX, e.clientY);
        hover.current = { node: hit?.kind === 'node' ? hit.id : null, link: hit?.kind === 'link' ? hit.index : null };
        canvas.style.cursor = hit ? 'pointer' : 'grab';
        return;
      }
      if (!pressedNode || multiTouch) return;
      const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (dragging || moved > 6) {
        if (!dragging) { dragging = true; canvas.style.cursor = 'grabbing'; }
        const rect = canvas.getBoundingClientRect();
        ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -(((e.clientY - rect.top) / rect.height) * 2 - 1));
        raycaster.setFromCamera(ndc, camera);
        if (raycaster.ray.intersectPlane(dragPlane, dragPoint)) {
          pressedNode.group.position.copy(dragPoint.add(dragOffset));
          pressedNode.target.copy(pressedNode.group.position);
        }
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      activePointers.delete(e.pointerId);
      if (!pointerActive) return;
      if (activePointers.size > 0) return;
      pointerActive = false;
      const wasDrag = dragging, wasMulti = multiTouch;
      dragging = false; multiTouch = false; controls.enabled = true; canvas.style.cursor = 'grab';
      const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
      pressedNode = null;
      if (wasDrag || wasMulti || moved > 6 || performance.now() - downAt > 600) return;
      const hit = pick(e.clientX, e.clientY);
      const cb = live.current;
      if (hit?.kind === 'node') {
        const now = performance.now();
        if (lastTapId === hit.id && now - lastTap < 350) focusNode(hit.id);
        lastTap = now; lastTapId = hit.id;
        cb.onSelectNode(hit.id);
      } else if (hit?.kind === 'link') cb.onSelectLink(hit.index);
      else { cb.onSelectNode(null); cb.onSelectLink(null); }
    };
    const onLeave = () => { hover.current = { node: null, link: null }; };
    canvas.addEventListener('pointerdown', onPointerDown, { capture: true });
    canvas.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onLeave);
    // Keyboard: Escape clears the selection.
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { live.current.onSelectNode(null); live.current.onSelectLink(null); } };
    canvas.addEventListener('keydown', onKey);
    const onContextLost = (e: Event) => { e.preventDefault(); setFailed(true); live.current.onWebglFailed?.(); };
    canvas.addEventListener('webglcontextlost', onContextLost);

    // ---- API for the toolbar ----------------------------------------------------------------
    api.current = {
      resetView: () => resetView(false),
      focusNode,
      relayout: (mode) => {
        const res = computeLayout(nodes, links, mode);
        sceneRadius = res.radius;
        nodeObjs.forEach((o, id) => { const p = res.positions.get(id) as V3; o.target.set(p[0], p[1], p[2]); });
        resetView(false);
      },
      snapshot: () => { try { renderer.render(scene, camera); return canvas.toDataURL('image/png'); } catch { return null; } },
    };

    // ---- label pass ------------------------------------------------------------------------------
    // Cache label sizes (offsetWidth forces layout — measure once, re-measure on resize).
    const sizes = new Map<HTMLElement, { w: number; h: number }>();
    const measure = (el: HTMLElement) => {
      let s = sizes.get(el);
      if (!s) { s = { w: el.offsetWidth || 80, h: el.offsetHeight || 22 }; sizes.set(el, s); }
      return s;
    };
    const roClear = new ResizeObserver(() => sizes.clear()); roClear.observe(host);
    document.fonts?.ready.then(() => sizes.clear()).catch(() => {});

    const proj = new THREE.Vector3();
    const camPos = new THREE.Vector3();
    function placeLabels(related: Set<string>, selId: string | null, hovId: string | null, showLabels: boolean) {
      const W = host!.clientWidth, H = host!.clientHeight;
      type Cand = { el: HTMLElement; x: number; y: number; r: number; depth: number; prio: number; dim: boolean; isLink: boolean; bias: number };
      const cands: Cand[] = [];
      camera.getWorldPosition(camPos);
      nodeObjs.forEach((o, id) => {
        proj.copy(o.group.position).project(camera);
        const visible = proj.z > -1 && proj.z < 1;
        const x = (proj.x * 0.5 + 0.5) * W, y = (-proj.y * 0.5 + 0.5) * H;
        // Screen-space radius of the node, so the label clears the mesh.
        const dist = camPos.distanceTo(o.group.position) || 1;
        const sr = (o.radius / (Math.tan((camera.fov * Math.PI) / 360) * dist)) * (H / 2);
        const isSel = id === selId, isHov = id === hovId;
        const prio = isSel ? 0 : isHov ? 1 : related.has(id) ? 2 : 3;
        const dim = !!live.current.isolatedGroup && (o.node.group ?? '') !== live.current.isolatedGroup;
        if (!visible || (!showLabels && prio > 1) || dim) { o.label.style.opacity = '0'; o.label.style.visibility = 'hidden'; return; }
        cands.push({ el: o.label, x, y, r: sr, depth: proj.z, prio, dim, isLink: false, bias: 0 });
      });
      if (showLabels) {
        for (const L of linkObjs) {
          if (!L.label) continue;
          const hidden = !!live.current.isolatedGroup && ((L.from.node.group ?? '') !== live.current.isolatedGroup || (L.to.node.group ?? '') !== live.current.isolatedGroup);
          const mid = L.curve.getPoint(0.5).project(camera);
          if (hidden || mid.z < -1 || mid.z > 1) { L.label.style.visibility = 'hidden'; continue; }
          const isRel = (selId && (L.link.fromId === selId || L.link.toId === selId)) || hover.current.link === L.index;
          cands.push({ el: L.label, x: (mid.x * 0.5 + 0.5) * W, y: (-mid.y * 0.5 + 0.5) * H, r: 3, depth: mid.z, prio: isRel ? 2 : 4, dim: false, isLink: true, bias: 0 });
        }
      } else for (const L of linkObjs) if (L.label) L.label.style.visibility = 'hidden';

      // Highest priority first; ties resolved nearest-to-camera first.
      cands.sort((a, b) => a.prio - b.prio || a.depth - b.depth);
      const placed: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
      // Node bodies are obstacles too: a label must never cover another node.
      const bodies = cands.filter((c) => !c.isLink).map((c) => ({ x0: c.x - c.r, y0: c.y - c.r, x1: c.x + c.r, y1: c.y + c.r }));
      const overlaps = (a: { x0: number; y0: number; x1: number; y1: number }, b: { x0: number; y0: number; x1: number; y1: number }) => a.x0 < b.x1 + 3 && a.x1 > b.x0 - 3 && a.y0 < b.y1 + 2 && a.y1 > b.y0 - 2;
      const pad = 6;
      for (const c of cands) {
        const { w, h } = measure(c.el);
        // Candidate anchors around the node, nearest first.
        const g = c.r + 6;
        const options: Array<[number, number]> = c.isLink
          ? [[-w / 2, -h / 2], [-w / 2, -h - 6], [-w / 2, 6], [6, -h / 2], [-w - 6, -h / 2]]
          : [[-w / 2, -g - h], [-w / 2, g], [g, -h / 2], [-g - w, -h / 2], [g * 0.7, -g * 0.7 - h], [-g * 0.7 - w, -g * 0.7 - h], [g * 0.7, g * 0.7], [-g * 0.7 - w, g * 0.7], [-w / 2, -g * 2 - h], [-w / 2, g * 2]];
        let chosen: { x0: number; y0: number; x1: number; y1: number } | null = null;
        for (const [ox, oy] of options) {
          const x0 = c.x + ox, y0 = c.y + oy;
          const box = { x0, y0, x1: x0 + w, y1: y0 + h };
          if (box.x0 < pad || box.y0 < pad || box.x1 > W - pad || box.y1 > H - pad) continue;
          if (placed.some((p) => overlaps(box, p))) continue;
          // Don't cover another node's body (own body is skipped by distance check).
          if (bodies.some((b) => !(Math.abs((b.x0 + b.x1) / 2 - c.x) < 0.5 && Math.abs((b.y0 + b.y1) / 2 - c.y) < 0.5) && overlaps(box, b))) continue;
          chosen = box; break;
        }
        const forced = c.prio <= 1; // selected / hovered always shown
        if (!chosen && forced) {
          const x0 = Math.min(W - w - pad, Math.max(pad, c.x - w / 2)), y0 = Math.min(H - h - pad, Math.max(pad, c.y - c.r - h - 6));
          chosen = { x0, y0, x1: x0 + w, y1: y0 + h };
        }
        if (!chosen) { c.el.style.visibility = 'hidden'; c.el.style.opacity = '0'; continue; }
        placed.push(chosen);
        const fade = c.isLink ? 0.95 : Math.max(0.55, 1 - Math.max(0, c.depth - 0.9) * 8);
        c.el.style.visibility = 'visible';
        c.el.style.opacity = String(c.prio === 3 && !!selId ? Math.min(fade, 0.55) : fade);
        c.el.style.transform = `translate3d(${Math.round(chosen.x0)}px, ${Math.round(chosen.y0)}px, 0)`;
        c.el.style.zIndex = String(1000 - c.prio * 100 + Math.round((1 - c.depth) * 50));
        c.el.classList.toggle('is-selected', c.prio === 0 && !c.isLink);
        c.el.classList.toggle('is-hover', c.prio === 1 && !c.isLink);
      }
    }

    // ---- render loop ---------------------------------------------------------------------------------
    const clock = new THREE.Clock();
    let raf = 0;
    const tmpC = new THREE.Color();
    const WHITE = new THREE.Color(0xffffff);
    function frame() {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, clock.getDelta());
      const time = clock.elapsedTime;
      const p = live.current;

      // Layout tween (also runs while dragging).
      nodeObjs.forEach((o) => {
        if (dragging && pressedNode === o) return;
        if (o.group.position.distanceTo(o.target) > 0.002) o.group.position.lerp(o.target, 1 - Math.pow(0.0008, dt));
      });
      for (const L of linkObjs) rebuildLink(L);

      // Camera fly-to.
      if (camGoal.active) {
        camGoal.t = Math.min(1, camGoal.t + dt / 0.75);
        const e = 1 - Math.pow(1 - camGoal.t, 3);
        camera.position.lerpVectors(camGoal.fromPos, camGoal.pos, e);
        controls.target.lerpVectors(camGoal.fromTarget, camGoal.target, e);
        if (camGoal.t >= 1) camGoal.active = false;
      }
      controls.autoRotate = p.autoRotate && !reduceMotion && !dragging && p.selectedId === null && hover.current.node === null;
      controls.update();

      // Highlight state: selected / hovered node + everything connected to it.
      const focusId = p.selectedId ?? hover.current.node;
      const related = new Set<string>();
      const focusLink = p.selectedLinkIndex ?? hover.current.link;
      if (focusId) { related.add(focusId); for (const L of linkObjs) { if (L.link.fromId === focusId) related.add(L.link.toId); if (L.link.toId === focusId) related.add(L.link.fromId); } }
      if (focusLink !== null && focusLink !== undefined) { const L = linkObjs.find((x) => x.index === focusLink); if (L) { related.add(L.link.fromId); related.add(L.link.toId); } }
      const anyFocus = !!focusId || (focusLink !== null && focusLink !== undefined);
      const iso = p.isolatedGroup;

      nodeObjs.forEach((o, id) => {
        const inIso = iso === null || (o.node.group ?? '') === iso;
        const isRel = related.has(id);
        const isSel = id === p.selectedId, isHov = id === hover.current.node;
        const bob = reduceMotion ? 0 : Math.sin(time * 0.9 + o.phase) * 0.06;
        o.mesh.position.y = bob; o.halo.position.y = bob;
        if (o.node.shape === 'torus') o.mesh.rotation.y += dt * 0.35; else o.mesh.rotation.y += dt * (isSel ? 0.9 : 0.12);
        o.halo.rotation.copy(o.mesh.rotation);
        const mat = o.mesh.material as THREE.MeshStandardMaterial;
        const targetOpacity = !inIso ? 0.08 : anyFocus && !isRel ? 0.22 : 1;
        mat.opacity += (targetOpacity - mat.opacity) * Math.min(1, dt * 9);
        const targetEm = isSel ? 0.55 : isHov ? 0.4 : isRel && anyFocus ? 0.25 : 0.12;
        mat.emissiveIntensity += (targetEm - mat.emissiveIntensity) * Math.min(1, dt * 9);
        const hm = o.halo.material as THREE.MeshBasicMaterial;
        const targetHalo = isSel ? 0.5 : isHov ? 0.32 : 0;
        hm.opacity += (targetHalo - hm.opacity) * Math.min(1, dt * 9);
        const sc = isSel ? 1.12 : isHov ? 1.07 : 1;
        o.mesh.scale.x += (sc - o.mesh.scale.x) * Math.min(1, dt * 10); o.mesh.scale.y = o.mesh.scale.z = o.mesh.scale.x;
        o.halo.scale.setScalar(o.mesh.scale.x * 1.14);
        o.group.visible = true;
        o.label.classList.toggle('is-dim', anyFocus && !isRel);
      });

      for (const L of linkObjs) {
        const inIso = iso === null || ((L.from.node.group ?? '') === iso && (L.to.node.group ?? '') === iso);
        const isFocus = (focusId && (L.link.fromId === focusId || L.link.toId === focusId)) || focusLink === L.index;
        const tm = L.tube.material as THREE.MeshStandardMaterial;
        const am = L.arrow.material as THREE.MeshStandardMaterial;
        const base = L.link.style === 'dashed' ? 0.5 : 0.85;
        const to = !inIso ? 0.05 : anyFocus ? (isFocus ? 1 : 0.1) : base;
        tm.opacity += (to - tm.opacity) * Math.min(1, dt * 9); am.opacity = tm.opacity;
        tm.emissive.copy(tm.color).multiplyScalar(isFocus ? 0.6 : 0);
        L.arrow.visible = L.tube.visible = tm.opacity > 0.03;
        const showP = p.showFlow && !reduceMotion && inIso && (!anyFocus || isFocus);
        for (const pm of L.particles) {
          pm.visible = showP;
          if (!showP) continue;
          const speed = isFocus ? 0.42 : 0.26;
          const t = (((pm.userData.t0 as number) + time * speed * (1 / Math.max(1, L.curve.getLength() / 6))) % 1 + 1) % 1;
          L.curve.getPoint(t, pm.position);
          const pmat = pm.material as THREE.MeshBasicMaterial;
          pmat.opacity = Math.sin(Math.PI * t) * (isFocus ? 1 : 0.8);
          tmpC.copy(L.from.color).lerp(L.to.color, t).lerp(WHITE, 0.35); pmat.color.copy(tmpC);
          pm.scale.setScalar(isFocus ? 1.35 : 1);
        }
      }
      dust.rotation.y += dt * 0.01;
      placeLabels(related, p.selectedId, hover.current.node, p.showLabels);
      renderer.render(scene, camera);
    }
    frame();

    // Pause rendering while the tab is hidden (saves battery on phones).
    const onVis = () => { if (document.hidden) cancelAnimationFrame(raf); else { clock.getDelta(); cancelAnimationFrame(raf); frame(); } };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
      ro.disconnect(); roClear.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown, { capture: true });
      canvas.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('keydown', onKey);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      controls.dispose();
      disposeObject(world); disposeObject(dust);
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
      if (canvas.parentNode === host) host.removeChild(canvas);
      labelLayer.replaceChildren();
      api.current = { resetView: () => {}, relayout: () => {}, focusNode: () => {}, snapshot: () => null };
    };
    // The scene is rebuilt only when the spec itself changes; everything
    // interactive (selection, toggles) is read through `live`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.nodes, props.links]);

  if (failed) return null;
  return (
    <div ref={hostRef} className="absolute inset-0" data-testid="viz3d-host">
      <div ref={labelLayerRef} className="viz3d-label-layer pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" />
    </div>
  );
});
