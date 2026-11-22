/**
 * The diary's paper: the color a person chooses (cream, peach, rose, lemon, mint, sky, lavender), by day and by
 * lamplight (night: a deep shade of the same color, not black). `dots` is the paper's own accent, `accent2` a partner
 * color. Pure module (no React Native imports).
 */
import { mixHex, withAlpha } from './yearColors';

export type PaperTone = 'light' | 'dark';

export interface Paper {
  name: string;
  label: string;
  /** The page in the light tone, and a slightly deeper shade of it. */
  light: string;
  lightDeep: string;
  /** The same paper in the dark tone. */
  dark: string;
  darkDeep: string;
  /** The dot grid printed on the page (light tone; the dark tone uses pale dots). Also the paper's main accent. */
  dots: string;
  /** A partner accent that sits well next to `dots` on this paper (the bar's second tape). */
  accent2: string;
}

export const PAPERS: readonly Paper[] = [
  // Day: the paper itself, a clear color you can tell apart at a glance. Night: the same paper by lamplight, deep.
  { name: 'cream', label: 'Cream', light: '#F4E7C9', lightDeep: '#E8D6AE', dark: '#2A2317', darkDeep: '#1D180F', dots: '#B8893E', accent2: '#B5452E' },
  { name: 'peach', label: 'Peach', light: '#F8CDB0', lightDeep: '#EDB894', dark: '#3A2018', darkDeep: '#28150F', dots: '#D0663E', accent2: '#3E6E8E' },
  { name: 'rose', label: 'Rose', light: '#F4C3CB', lightDeep: '#E8AAB5', dark: '#371A22', darkDeep: '#251117', dots: '#C24D6A', accent2: '#3D7A62' },
  { name: 'lemon', label: 'Lemon', light: '#F6E3A0', lightDeep: '#ECD37C', dark: '#2F2912', darkDeep: '#201C0B', dots: '#B98E1E', accent2: '#4B5FA6' },
  { name: 'mint', label: 'Mint', light: '#C4E7D0', lightDeep: '#A9D9BA', dark: '#13291F', darkDeep: '#0C1C15', dots: '#3E8F67', accent2: '#C2553C' },
  { name: 'sky', label: 'Sky', light: '#C0DAF2', lightDeep: '#A3C6E8', dark: '#122337', darkDeep: '#0B1726', dots: '#3D78B3', accent2: '#D0663E' },
  { name: 'lavender', label: 'Lavender', light: '#D8CBF0', lightDeep: '#C4B2E6', dark: '#221B35', darkDeep: '#171224', dots: '#7357B5', accent2: '#C9A23A' },
];

/** Looks saved before the papers came back named a leather: each becomes the nearest paper. */
const OLD_NAMES: Record<string, string> = { green: 'mint', oxblood: 'rose', navy: 'sky', chestnut: 'peach', black: 'cream' };

export const DEFAULT_PAPER = 'cream';

export interface Look {
  paper: string;
  tone: PaperTone;
}

export const DEFAULT_LOOK: Look = { paper: DEFAULT_PAPER, tone: 'light' };

export function paperByName(name: string | null | undefined): Paper {
  return PAPERS.find((p) => p.name === name) ?? (PAPERS[0] as Paper);
}

/** Reads a stored look, tolerating missing or old values (the old setting was just 'system' | 'light' | 'dark'). */
export function parseLook(raw: string | null | undefined): Look {
  if (!raw) return DEFAULT_LOOK;
  if (raw === 'dark' || raw === 'light') return { paper: DEFAULT_PAPER, tone: raw };
  try {
    const value = JSON.parse(raw) as Partial<Look>;
    const name = typeof value.paper === 'string' ? (OLD_NAMES[value.paper] ?? value.paper) : undefined;
    return {
      paper: PAPERS.some((p) => p.name === name) ? (name as string) : DEFAULT_PAPER,
      tone: value.tone === 'dark' ? 'dark' : 'light',
    };
  } catch {
    return DEFAULT_LOOK;
  }
}

/**
 * Colors for the bottom bar and the action bars: the front edge of a walnut writing table at the foot of the screen (lit
 * oak by day, walnut at night) with ivory keys (dark bakelite at night) set in brass, engraved legends and an amber LED.
 */
export interface NavColors {
  /** The key panels (and the action bars): ivory by day, bakelite at night. */
  strip: string;
  edge: string;
  stitch: string;
  shadow: string;
  /** Legends on the keys. */
  ink: string;
  inkMuted: string;
  /** The lit LED under the page you're on. */
  active: string;
  tape: string;
  tape2: string;
  /** The write button's accent, and a key's face. */
  plus: string;
  rim: string;
  /** The desk: its wood, a darker shade for the grain and front, a lighter one for the lit top edge. */
  wood: string;
  woodDark: string;
  woodLight: string;
  /** Brass bezels and plates. */
  brass: string;
  brassDark: string;
}

const IVORY = '#F1E8D4';
const BAKELITE = '#2A2420';
const ENGRAVED_DAY = '#2A2118';
const ENGRAVED_NIGHT = '#F0E4CC';
const LED = '#F0A23C';
const OAK = '#4E2F18';
const WALNUT = '#2C1A0D';
const BRASS = '#C9A04A';
const BRASS_DARK = '#7E5F22';
const BLACK = '#000000';
const WHITE = '#FFFFFF';

/** The desk is the same wood on every paper; the keys take a whisper of the paper's accent. */
export function navColors(paper: Paper, tone: PaperTone): NavColors {
  const day = tone === 'light';
  const key = day ? mixHex(IVORY, paper.dots, 0.06) : mixHex(BAKELITE, paper.dark, 0.3);
  const wood = day ? OAK : WALNUT;
  return {
    strip: key,
    edge: day ? withAlpha(BLACK, 0.2) : withAlpha(WHITE, 0.08),
    stitch: day ? withAlpha(BLACK, 0.12) : withAlpha(WHITE, 0.08),
    shadow: withAlpha(BLACK, day ? 0.3 : 0.6),
    ink: day ? ENGRAVED_DAY : ENGRAVED_NIGHT,
    inkMuted: day ? mixHex(ENGRAVED_DAY, IVORY, 0.4) : mixHex(ENGRAVED_NIGHT, BAKELITE, 0.35),
    active: LED,
    tape: paper.dots,
    tape2: paper.accent2,
    plus: paper.accent2,
    rim: day ? mixHex(key, WHITE, 0.45) : mixHex(key, WHITE, 0.08),
    wood,
    woodDark: mixHex(wood, BLACK, day ? 0.35 : 0.45),
    woodLight: mixHex(wood, WHITE, day ? 0.3 : 0.15),
    brass: BRASS,
    brassDark: BRASS_DARK,
  };
}
