# v60 — 3D AI Visualizer + free-plan signup

See the v60 entry at the top of CHANGES.md.

Key files
- api-server/src/lib/aiVisualizer.ts — scene schema (Zod), prompt, normaliser
- frontend-student/src/components/visualizer/Scene3D.tsx — three.js engine (picking, drag, label collision, flow particles)
- .../layout3d.ts — deterministic force/ring/line/layers layout, no node overlaps
- .../VisualizerStage.tsx — one-screen UI (toolbar, legend, side panel)
- frontend-student/src/pages/AiVisualizer.tsx — prompt screen + lazy-loaded stage

Not verified in the authoring environment (no network / node_modules): typecheck, vite build, and an on-device visual pass. First things to check: `pnpm install`, `pnpm run typecheck`, then open /ai-visualizer and try "cardiac cycle" and "Compare Type 1 and Type 2 diabetes".
