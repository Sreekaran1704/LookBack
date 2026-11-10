/**
 * Each year has its own color identity, used for tape, stamps, stickers, tints and album covers.
 * Pure module (no React Native imports) so it can be unit-tested.
 */
export interface YearPalette {
  name: string;
  /** Main color: album cover, stamp ink, tape. */
  primary: string;
  /** Partner color: patterns, stickers. */
  secondary: string;
  /** Very light wash of the color for paper tints. */
  tint: string;
  /** Dark shade for text on the primary color. */
  ink: string;
}

const PALETTES: readonly YearPalette[] = [
  { name: 'coral', primary: '#FF6B5E', secondary: '#FF8FC2', tint: '#FFE3DD', ink: '#5A1610' },
  { name: 'teal', primary: '#13B5A4', secondary: '#38CDEB', tint: '#D7F5F1', ink: '#063F3A' },
  { name: 'amber', primary: '#F5A30B', secondary: '#FB7E3C', tint: '#FFF0CF', ink: '#5A3600' },
  { name: 'violet', primary: '#8B5CF6', secondary: '#6366F1', tint: '#ECE5FF', ink: '#2A1468' },
  { name: 'lime', primary: '#7CC217', secondary: '#22C55E', tint: '#EAF8D2', ink: '#24400A' },
];

/** Extra colors for stickers and tape, beyond the five year colors. */
const EXTRA_PALETTES: readonly YearPalette[] = [
  { name: 'rose', primary: '#F25C8E', secondary: '#FFB3CB', tint: '#FFE4EE', ink: '#5C1230' },
  { name: 'sky', primary: '#3B8FE8', secondary: '#8CC8FF', tint: '#DFF0FF', ink: '#0E2F57' },
];

/** Every color a sticker or tape can be, in picker order. */
export const STYLE_PALETTES: readonly YearPalette[] = [...PALETTES, ...EXTRA_PALETTES];

/** A style palette by its name, or null for unknown names (fall back to the year's color). */
export function paletteByName(name: string | null | undefined): YearPalette | null {
  return STYLE_PALETTES.find((p) => p.name === name) ?? null;
}

/** The year the palette list starts from: 2025 coral, 2024 teal, 2023 amber, 2022 violet, 2021 lime, then repeats. */
const ANCHOR_YEAR = 2025;

export function yearPaletteIndex(year: number): number {
  const n = PALETTES.length;
  return (((ANCHOR_YEAR - year) % n) + n) % n;
}

export function yearPalette(year: number): YearPalette {
  return PALETTES[yearPaletteIndex(year)] ?? (PALETTES[0] as YearPalette);
}

/** Adds alpha to a #RRGGBB color. */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex.slice(0, 7)}${a}`;
}

/** Blends two #RRGGBB colors: t = 0 gives `a`, t = 1 gives `b`. */
export function mixHex(a: string, b: string, t: number): string {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2]
    .map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t).toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase();
}
