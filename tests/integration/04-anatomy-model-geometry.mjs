// Offline check (no server/DB needed) for the AI Visualizer anatomy mode (v61).
// Needs Node >= 22.18 (runs .ts directly). Run from this folder: node 04-anatomy-model-geometry.mjs
import assert from 'node:assert/strict';
import { buildPartMesh } from '../../artifacts/frontend-student/src/components/visualizer/modelMesh.ts';
import { TIBIA_MODEL, findCuratedModel } from '../../artifacts/api-server/src/lib/anatomyLibrary.ts';

const closed = (m) => {
  const e = new Map();
  for (let f = 0; f < m.indices.length; f += 3) for (let k = 0; k < 3; k++) {
    const a = m.indices[f + k], b = m.indices[f + (k + 1) % 3], key = a < b ? `${a}_${b}` : `${b}_${a}`;
    e.set(key, (e.get(key) || 0) + 1);
  }
  return [...e.values()].every((c) => c === 2);
};
for (const p of TIBIA_MODEL.parts) {
  const m = buildPartMesh(p);
  assert.ok(!m.positions.some(Number.isNaN) && !m.normals.some(Number.isNaN), `${p.id}: NaN`);
  assert.ok(closed(m), `${p.id}: mesh is not a closed surface`);
}
for (const form of ['sphere', 'ellipsoid', 'box', 'cylinder', 'cone', 'capsule', 'torus']) {
  assert.ok(closed(buildPartMesh({ id: 't', label: 't', form, description: 'x', size: [10, 16, 12], bump: 0.5 })), form);
}
assert.ok(findCuratedModel('Draw the tibia with parts labelled'));
assert.equal(findCuratedModel('compare tibia and fibula'), null);
console.log('anatomy geometry OK');
