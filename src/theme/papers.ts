/**
 * The page colors a person can choose for their notebook, each in a light and a dark tone. Dark is the
 * same paper by lamplight (a deep shade of the same color), not black. Paper objects (notes, polaroids,
 * panels) stay light on either tone. Pure module (no React Native imports) so it can be unit-tested.
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
  { name: 'cream', label: 'Cream', light: '#FBF5E6', lightDeep: '#ECE2CA', dark: '#2A251E', darkDeep: '#1B1814', dots: '#5B8CC9', accent2: '#E8A23B' },
  { name: 'peach', label: 'Peach', light: '#FFE9E1', lightDeep: '#F6D3C6', dark: '#3B2722', darkDeep: '#261915', dots: '#F29A86', accent2: '#6FB59B' },
  { name: 'rose', label: 'Rose', light: '#FCE4EC', lightDeep: '#F3CCDA', dark: '#3A2030', darkDeep: '#25141F', dots: '#E57BA2', accent2: '#9C7BD9' },
  { name: 'lemon', label: 'Lemon', light: '#FBF3CC', lightDeep: '#F0E3A8', dark: '#35301A', darkDeep: '#221E10', dots: '#D9A521', accent2: '#6FA8DC' },
  { name: 'mint', label: 'Mint', light: '#E2F5EA', lightDeep: '#C9EAD7', dark: '#1D3429', darkDeep: '#12221A', dots: '#3FAF7C', accent2: '#F29A86' },
  { name: 'sky', label: 'Sky', light: '#E1EEFB', lightDeep: '#C8DDF4', dark: '#1C2B3E', darkDeep: '#111B28', dots: '#4D8DD6', accent2: '#F2B33D' },
  { name: 'lavender', label: 'Lavender', light: '#ECE6FA', lightDeep: '#DAD0F3', dark: '#2A2440', darkDeep: '#1B172A', dots: '#8B6FD9', accent2: '#E57BA2' },
];

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
    return {
      paper: PAPERS.some((p) => p.name === value.paper) ? (value.paper as string) : DEFAULT_PAPER,
      tone: value.tone === 'dark' ? 'dark' : 'light',
    };
  } catch {
    return DEFAULT_LOOK;
  }
}

/** Colors for the bottom bar, picked to sit on this paper in this tone (instead of a fixed cream strip). */
export interface NavColors {
  strip: string;
  edge: string;
  stitch: string;
  shadow: string;
  ink: string;
  inkMuted: string;
  /** Soft pill behind the page you're on. */
  active: string;
  tape: string;
  tape2: string;
  /** The + sticker (before today is written) and its white rim. */
  plus: string;
  rim: string;
}

const INK = '#2A2118';
const INK_MUTED = '#7A6A58';
const WHITE = '#FFFFFF';
const BLACK = '#000000';

/**
 * The bar is a strip of the same paper: a brighter sheet of it in the light tone, a lamp-lit sheet
 * (the dark paper warmed with its own accent) in the dark tone, with the paper's two accents as tape.
 */
export function navColors(paper: Paper, tone: PaperTone): NavColors {
  if (tone === 'light') {
    return {
      strip: mixHex(paper.light, WHITE, 0.55),
      edge: withAlpha(paper.dots, 0.35),
      stitch: withAlpha(paper.dots, 0.6),
      shadow: withAlpha(paper.darkDeep, 0.2),
      ink: INK,
      inkMuted: mixHex(INK_MUTED, paper.dots, 0.2),
      active: withAlpha(paper.dots, 0.24),
      tape: paper.dots,
      tape2: paper.accent2,
      plus: paper.dots,
      rim: '#FFFDF8',
    };
  }
  return {
    strip: mixHex(paper.dark, paper.dots, 0.2),
    edge: withAlpha(paper.dots, 0.45),
    stitch: withAlpha(mixHex(paper.dots, WHITE, 0.25), 0.7),
    shadow: withAlpha(BLACK, 0.55),
    ink: mixHex(paper.light, WHITE, 0.3),
    inkMuted: withAlpha(paper.light, 0.62),
    active: withAlpha(paper.dots, 0.4),
    tape: mixHex(paper.dots, paper.dark, 0.15),
    tape2: mixHex(paper.accent2, paper.dark, 0.2),
    plus: paper.dots,
    rim: mixHex(paper.light, paper.dark, 0.08),
  };
}
