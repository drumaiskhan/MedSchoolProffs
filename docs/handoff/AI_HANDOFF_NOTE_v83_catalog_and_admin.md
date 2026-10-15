# v83 - topic library, AI MCQ hierarchy, admin Visualizer tabs

See the v83 entry at the top of CHANGES.md.

Key files
- api-server/src/lib/visualizerCatalog.ts - the 6,780-topic catalog (data + builder + key set)
- api-server/src/lib/promptKey.ts - pure prompt normalisation shared with widgetLibrary.ts
- api-server/src/lib/widgetLibrary.ts - catalog topics are matched exactly (no fuzzy merge)
- api-server/src/routes/ai-visualizer.ts - /ai/visualizer/catalog, /admin/ai-visualizer-catalog, filterable /admin/ai-visualizer-library
- api-server/src/routes/medschool.ts - GET /admin/mcqs now returns `path` per row
- frontend-admin/src/components/AiMcqReviewPanel.tsx, pages/AdminAiVisualizerLogs.tsx, lib/shared-parts/bank.tsx (McqPathCrumb)
- frontend-student/src/components/visualizer/TopicCatalog.tsx, pages/AiVisualizer.tsx
- scripts/check-visualizer-catalog.mjs (pnpm run check:visualizer-catalog)

Not verified in the authoring environment: typecheck, vite build, on-device pass.
