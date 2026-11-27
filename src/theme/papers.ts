/**
 * The diary's paper: the color a person chooses, by day and by lamplight. Premium means quiet: by day a pale sheet
 * clearly in the color; by lamplight a deep jewel shade of it (as deep as the navy, never a muddy brown). The
 * color stays on surfaces; lettering is deep ink by day and one antique gold by lamplight (navy keeps its steel blue).
 * `dots` is the paper's own muted accent (dot grid, tape, widget glow), `accent2` a partner color.
 * Pure module (no React Native imports).
 */
import { DEFAULT_CASSETTE, isCassetteStyleId, type CassetteStyleId } from './cassettes';
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
  /** Tooling by day (rules, outlines, washes) and the deep ink titles are lettered in. */
  giltDay: string;
  titleDay: string;
  /** Tooling by lamplight, and the brighter shade titles are lettered in. */
  giltNight: string;
  titleNight: string;
}

/** One antique gold for every paper but navy, so the diary has a single accent whatever its color. */
const GOLD_DAY = '#9C7A3C';
const GOLD_NIGHT = '#C3A060';
const GOLD_TITLE_NIGHT = '#DCC28E';
const gold = { giltDay: GOLD_DAY, giltNight: GOLD_NIGHT, titleNight: GOLD_TITLE_NIGHT };

export const PAPERS: readonly Paper[] = [
  { name: 'ivory', label: 'Ivory', light: '#F3EBDB', lightDeep: '#E6DCC6', dark: '#1F1A14', darkDeep: '#15110C', dots: '#A88B5C', accent2: '#7A2E2E', titleDay: '#2A2118', ...gold },
  { name: 'tobacco', label: 'Tobacco', light: '#EEDDC8', lightDeep: '#E0CCB2', dark: '#26190F', darkDeep: '#1A110A', dots: '#8E6A48', accent2: '#3F5A4A', titleDay: '#3A2414', ...gold },
  { name: 'oxblood', label: 'Oxblood', light: '#F0DCD9', lightDeep: '#E3C9C5', dark: '#2B1418', darkDeep: '#1D0D10', dots: '#8E4450', accent2: '#A8833F', titleDay: '#4A1A22', ...gold },
  { name: 'ink', label: 'Ink', light: '#E2E5E9', lightDeep: '#D2D6DC', dark: '#16191E', darkDeep: '#0E1014', dots: '#6B717B', accent2: '#A8833F', titleDay: '#1C2026', ...gold },
  { name: 'bottle', label: 'Bottle', light: '#DBE7DA', lightDeep: '#C9D9C7', dark: '#10241B', darkDeep: '#0A1812', dots: '#4E7A62', accent2: '#A8833F', titleDay: '#173326', ...gold },
  // The navy by lamplight is the look everything else is measured against: it keeps its own steel-blue lettering.
  { name: 'navy', label: 'Navy', light: '#D9E4F0', lightDeep: '#C6D5E6', dark: '#122337', darkDeep: '#0B1726', dots: '#3D78B3', accent2: '#C2804A', titleDay: '#16263D', giltDay: '#3D6E9E', giltNight: '#5A8CBE', titleNight: '#8BAED1' },
  { name: 'plum', label: 'Plum', light: '#E5DDEE', lightDeep: '#D5CAE2', dark: '#211830', darkDeep: '#160F21', dots: '#76608F', accent2: '#A8833F', titleDay: '#2E2142', ...gold },
];

/** Looks saved by earlier versions (the pastel papers, and before them the leathers) become the nearest paper. */
const OLD_NAMES: Record<string, string> = {
  cream: 'ivory', peach: 'tobacco', rose: 'oxblood', lemon: 'ivory', mint: 'bottle', sky: 'navy', lavender: 'plum',
  green: 'bottle', chestnut: 'tobacco', black: 'ink',
};

export const DEFAULT_PAPER = 'ivory';

export interface Look {
  paper: string;
  tone: PaperTone;
  /** The cassette (app icon and every cassette in the app), see cassettes.ts. */
  cassette: CassetteStyleId;
  /** The person picked the cassette themselves in You → Look (so a new default never replaces it). */
  cassetteChosen?: boolean;
}

export const DEFAULT_LOOK: Look = { paper: DEFAULT_PAPER, tone: 'light', cassette: DEFAULT_CASSETTE };

export function paperByName(name: string | null | undefined): Paper {
  return PAPERS.find((p) => p.name === name) ?? (PAPERS[0] as Paper);
}

/** Reads a stored look, tolerating missing or old values (the old setting was just 'system' | 'light' | 'dark'). */
export function parseLook(raw: string | null | undefined): Look {
  if (!raw) return DEFAULT_LOOK;
  if (raw === 'dark' || raw === 'light') return { paper: DEFAULT_PAPER, tone: raw, cassette: DEFAULT_CASSETTE };
  try {
    const value = JSON.parse(raw) as Partial<Look>;
    const name = typeof value.paper === 'string' ? (OLD_NAMES[value.paper] ?? value.paper) : undefined;
    return {
      paper: PAPERS.some((p) => p.name === name) ? (name as string) : DEFAULT_PAPER,
      tone: value.tone === 'dark' ? 'dark' : 'light',
      // Clear was the default before 1.3.3 and was saved with every look, picked or not: unless the person picked a
      // cassette themselves, they move to the new default (metal).
      cassette: isCassetteStyleId(value.cassette) && (value.cassetteChosen === true || value.cassette !== 'clear') ? value.cassette : DEFAULT_CASSETTE,
      ...(value.cassetteChosen === true ? { cassetteChosen: true } : {}),
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

const BAKELITE = '#2A2420';
const ENGRAVED_DAY = '#2A2118';
const ENGRAVED_NIGHT = '#F0E4CC';
/** How much of the paper's deep shade the bakelite keys take at night. */
const NIGHT_KEY_TINT = 0.75;
const LED = '#F0A23C';
const OAK = '#4E2F18';
const WALNUT = '#2C1A0D';
const BRASS = '#C9A04A';
const BRASS_DARK = '#7E5F22';
const BLACK = '#000000';
/** How much brighter than the page a card (and the bar) is by day. */
export const DAY_CARD_LIFT = 0.3;
const WHITE = '#FFFFFF';

/** The desk is the same wood on every paper; the keys take a whisper of the paper's accent. */
export function navColors(paper: Paper, tone: PaperTone): NavColors {
  const day = tone === 'light';
  // By day the keys are a brighter sheet of the chosen paper (the same as the cards), so the bar matches the page.
  const key = day ? mixHex(paper.light, WHITE, DAY_CARD_LIFT) : mixHex(mixHex(BAKELITE, paper.dark, NIGHT_KEY_TINT), WHITE, 0.05);
  const wood = day ? OAK : WALNUT;
  return {
    strip: key,
    edge: day ? withAlpha(BLACK, 0.2) : withAlpha(WHITE, 0.08),
    stitch: day ? withAlpha(BLACK, 0.12) : withAlpha(WHITE, 0.08),
    shadow: withAlpha(BLACK, day ? 0.3 : 0.6),
    ink: day ? ENGRAVED_DAY : ENGRAVED_NIGHT,
    inkMuted: day ? mixHex(ENGRAVED_DAY, key, 0.4) : mixHex(ENGRAVED_NIGHT, BAKELITE, 0.35),
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
