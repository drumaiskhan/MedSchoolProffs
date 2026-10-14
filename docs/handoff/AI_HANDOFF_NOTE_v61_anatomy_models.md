# v61 — anatomy models in the AI Visualizer
See the v61 entry at the top of CHANGES.md.

Key files
- api-server/src/lib/anatomyLibrary.ts — curated models (tibia) + findCuratedModel
- api-server/src/lib/aiAnatomy.ts — ModelSpec schema, prompt, normaliser, pickMode/generateAny
- frontend-student/.../visualizer/modelMesh.ts — pure parametric geometry (lathe/tube/super-ellipsoid), unit-testable in Node
- .../Model3D.tsx — three.js engine, anchors, occlusion, leader-line label layout
- .../ModelStage.tsx — UI (toolbar, parts list, details)

Not verified here: typecheck with real three types, vite build, on-device visual pass.
Known limits: AI-built organs are approximations composed of primitives (quality varies by prompt); add curated models for high-traffic structures.
