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
