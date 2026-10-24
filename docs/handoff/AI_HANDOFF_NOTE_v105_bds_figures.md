# v105 - BDS figures and more systems for the AI Visualizer

The live visualizer is 2D: the AI writes a widget and embeds ready-made SVG figures from `artifacts/api-server/src/lib/figures/` (`selectFigures` by tags, then `figureGuide` puts each figure's `notes` landmark coordinates in the prompt). The old 3D anatomy models (`anatomyLibrary.ts`) are dormant since v73.

Added: dental.ts (hs-tooth, hs-caries), dental2.ts (dentition, tooth germ, TMJ, tongue, salivary, mandible), systems2.ts (sarcomere, ear, lymph node, thyroid, long bone, reflex arc). Rules followed: fixed colours, landmark coords in `notes`, motion via classes (`hs-a-dots`, `hs-a-ap`, new `hs-a-jaw/disc/slideL/slideR`) so no ANIMATIONS entry needed; tags kept specific (selection is prefix-based: avoid words like "ear", "actin", "cavity", "root").
To add a figure: write it in a figures file, add to the exported array, add 5+ specific tags and notes, add a prompt->figure line in tests/integration/05-figure-library.mjs.
