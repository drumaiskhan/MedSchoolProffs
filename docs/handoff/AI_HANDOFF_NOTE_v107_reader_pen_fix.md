# v107 - reader pen fix + free-book speed

- BookReader.tsx PageViewBase: `const inking = inking || ...` referenced itself, so Pen mode was never recognised (strokes fell into area-select while touch-action:none blocked scrolling). Now `mode === 'pen' || mode === 'marker'`.
- Finger in Pen/Marker/Eraser: 'Auto' now scrolls with a finger (stylus/mouse write); 'Draw' makes a finger write. Removed stylus auto-detection (it re-rendered every page mid-stroke).
- Current-page tracking on scroll is a binary search (was getBoundingClientRect on every page every frame).
- FREE books: page pictures have no per-student watermark, are rendered once and shared by all students (server cache key "free:..."), read ahead 2 pages, and are browser-cacheable (`?v=<fileKey>`, max-age 7 days). Paid books are unchanged (watermarked, per-user, no-store).
