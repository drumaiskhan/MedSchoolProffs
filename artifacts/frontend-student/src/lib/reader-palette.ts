// Colours + pen sizes for the book reader's Highlighter and Pen.
// Colours are stored on the highlight row as a string: either one of the four
// original names (older highlights) or a "#rrggbb" hex. `colorHex` resolves both.
export type PaletteColor = { id: string; hex: string; label: string };

const LEGACY: Record<string, string> = { yellow: '#ffd93b', green: '#5fd08a', pink: '#ff8fab', blue: '#6fb3ff' };
export const isHex = (c: string): boolean => /^#[0-9a-fA-F]{6}$/.test(c);
export const colorHex = (c: string): string => LEGACY[c] ?? (isHex(c) ? c : LEGACY.yellow);

const p = (id: string, label: string, hex = id): PaletteColor => ({ id, hex, label });

export const HIGHLIGHTER_COLORS: PaletteColor[] = [
  p('yellow', 'Yellow', LEGACY.yellow), p('green', 'Green', LEGACY.green), p('pink', 'Pink', LEGACY.pink), p('blue', 'Blue', LEGACY.blue),
  p('#ff9f45', 'Orange'), p('#b794f6', 'Purple'), p('#4fd6d0', 'Teal'), p('#ff6b6b', 'Red'), p('#c3e84a', 'Lime'), p('#ffb4e6', 'Rose'),
];

export const PEN_COLORS: PaletteColor[] = [
  p('#1f2937', 'Black'), p('#6b7280', 'Grey'), p('#ef4444', 'Red'), p('#f97316', 'Orange'), p('#f59e0b', 'Amber'), p('#facc15', 'Yellow'),
  p('#84cc16', 'Lime'), p('#22c55e', 'Green'), p('#14b8a6', 'Teal'), p('#06b6d4', 'Cyan'), p('#3b82f6', 'Blue'), p('#1d4ed8', 'Navy'),
  p('#6366f1', 'Indigo'), p('#a855f7', 'Purple'), p('#ec4899', 'Pink'), p('#92400e', 'Brown'),
];

// Pen widths as a fraction of the page width, so strokes scale with zoom.
export const PEN_SIZES: Array<{ id: number; w: number; label: string }> = [
  { id: 0, w: 0.0018, label: 'Fine' }, { id: 1, w: 0.0035, label: 'Medium' }, { id: 2, w: 0.007, label: 'Bold' }, { id: 3, w: 0.012, label: 'Marker' },
];

// v106: the pen/marker flyout (same 6 x 5 layout as the Microsoft Edge PDF viewer's pen colours).
export const EDGE_COLORS: PaletteColor[] = [
  p('#111827', 'Black'), p('#4b5563', 'Dark grey'), p('#9ca3af', 'Grey'), p('#d1d5db', 'Light grey'), p('#e5e7eb', 'Silver'), p('#f9fafb', 'White'),
  p('#b91c4c', 'Crimson'), p('#ef4444', 'Red'), p('#fb5a45', 'Coral'), p('#fb923c', 'Orange'), p('#fbbf24', 'Amber'), p('#facc15', 'Yellow'),
  p('#84cc16', 'Lime'), p('#22c55e', 'Green'), p('#15803d', 'Forest'), p('#0e9aa7', 'Teal'), p('#2563eb', 'Blue'), p('#4f46e5', 'Indigo'),
  p('#7c3aed', 'Violet'), p('#7e3d9a', 'Purple'), p('#f0b27a', 'Sand'), p('#c2864a', 'Tan'), p('#9a4a2c', 'Brown'), p('#5b3a2e', 'Dark brown'),
  p('#f472b6', 'Pink'), p('#fdba74', 'Peach'), p('#fde047', 'Lemon'), p('#4ade80', 'Mint'), p('#2dd4bf', 'Aqua'), p('#c4b5fd', 'Lavender'),
];
/** Pen / marker thickness is a continuous fraction of the page width (the slider), stored on each stroke. */
export const PEN_W = { min: 0.0012, max: 0.016, def: 0.0035 };
export const MARKER_W = { min: 0.006, max: 0.03, def: 0.014 };
export const clampW = (v: number, r: { min: number; max: number; def: number }): number => (Number.isFinite(v) ? Math.min(r.max, Math.max(r.min, v)) : r.def);
