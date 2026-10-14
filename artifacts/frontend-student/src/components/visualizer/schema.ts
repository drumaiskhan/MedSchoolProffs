// Frontend types for the AI Visualizer's 3D scene. The single source of truth
// is lib/api.ts (mirrors the backend Zod schema in
// api-server/src/lib/aiVisualizer.ts); re-exported here for the components.
export type {
  SceneShape, SceneLayout, SceneNode, SceneLink, SceneCalculator, FormulaNode, VisualizationSpec,
} from '@/lib/api';
