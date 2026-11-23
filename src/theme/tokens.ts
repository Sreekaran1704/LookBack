import type { TextStyle } from 'react-native';
import { withAlpha } from './yearColors';

/**
 * Scrapbook design tokens: a cutesy paper journal (cream desk, taped paper, stickers, handwriting). Every color, size, radius, shadow and motion value in the UI comes
 * from here. No raw numbers or hex values in components.
 */

const palette = {
  /** Aged diary pages: the page, a deeper page edge, and the same by lamplight. */
  page: '#EFE4CC',
  pageDeep: '#E3D6B8',
  pageLamp: '#DCCFB2',
  pageLampDeep: '#CFC0A0',
  pageBright: '#F6EEDB',
  pageBrightLamp: '#E6DAC0',
  /** Gold tooling on the leather, and the cream lettering beside it. */
  gilt: '#C9A45C',
  giltBright: '#D4B26A',
  giltLamp: '#B8964F',
  lettering: '#E9DDC0',
  letteringMuted: 'rgba(233, 221, 192, 0.74)',
  letteringFaint: 'rgba(233, 221, 192, 0.46)',
  leatherInk: '#14201A',
  wax: '#7A231C',
  /** The person's own words are blue-black ink; replies to the past self are sepia. */
  inkBlue: '#23304A',
  sepia: '#6B2A22',
  kraft: '#D8B98C',
  kraftDim: '#C2A276',
  blush: '#F8DDD3',
  cork: '#C99A68',
  corkDark: '#8E6440',
  ink: '#2A2118',
  inkMuted: '#6B5F50',
  inkFaint: 'rgba(42, 33, 24, 0.14)',
  buddy: '#FFF3E4',
  buddyShade: '#E3C3A8',
  buddyBlush: '#FF9DB0',
  buddyEar: '#FFC4D0',
  buddyNose: '#F0879C',
  buddyOutline: '#A9876B',
  gridLine: 'rgba(201, 164, 92, 0.12)',
  ruleLine: 'rgba(120, 95, 60, 0.3)',
  marginLine: 'rgba(142, 42, 32, 0.45)',
  leather: '#1F3A2E',
  leatherDeep: '#17291F',
  lamp: '#FFB866',
  amber: '#F5B23C',
  amberInk: '#3D2600',
  green: '#2DB86A',
  greenInk: '#FFFFFF',
  metal: '#9AA3AD',
  metalLight: '#D9DEE3',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export interface ColorTokens {
  /** The desk / journal page behind everything. */
  desk: string;
  deskDeep: string;
  /** Paper card that groups content. Paper: text on it uses `ink`, never `onDesk`. */
  panel: string;
  /** Round buttons and quiet pills (paper discs; text on them uses `ink`). */
  control: string;
  /** Main action pill. */
  primary: string;
  onPrimary: string;
  hairline: string;
  /** Paper objects. Stay light in dark mode (dimmed cream under the lamp). */
  paper: string;
  paperWhite: string;
  kraft: string;
  blush: string;
  cork: string;
  corkDark: string;
  gridLine: string;
  ruleLine: string;
  marginLine: string;
  /** Text on paper. */
  ink: string;
  inkMuted: string;
  inkFaint: string;
  /** Text placed directly on the desk/page background. */
  onDesk: string;
  onDeskMuted: string;
  /** Counts next to titles ("Memories 56"). */
  onDeskFaint: string;
  amber: string;
  onAmber: string;
  green: string;
  onGreen: string;
  metal: string;
  metalLight: string;
  lamp: string;
  /** The buddy (a soft cream bunny): fur, shaded side, cheeks, inner ear, nose. */
  buddy: string;
  buddyShade: string;
  buddyBlush: string;
  buddyEar: string;
  buddyNose: string;
  /** Thin line around the buddy's white sticker edge, so it separates from any page. */
  buddyOutline: string;
  /** The wooden cupboard the year diaries stand in: frame, shelf tops, back panel, deep shadow inside. */
  wood: string;
  woodLight: string;
  woodDark: string;
  woodDeep: string;
  /** Handwriting on the cupboard's back panel (the diaries' age lines). */
  cupboardLabel: string;
  /** Grain overlay color. */
  grain: string;
  shadowBase: string;
  scrim: string;
  /** Gold tooling on the leather (rules, outlines, the title), a brighter gilt for text, and the stitching. */
  gilt: string;
  giltBright: string;
  stitch: string;
  /** Wax seals and the ribbon bookmark. */
  wax: string;
  /** The person's own words (blue-black ink) and their replies to their past self (sepia). */
  inkBlue: string;
  sepia: string;
}

/**
 * Day: the leather cover in daylight. Text on the leather is cream lettering and gilt; pages (panels, notes, every
 * memory) are aged cream paper with dark ink. The desk color is replaced by the chosen leather in `makeTheme`.
 */
export const lightColors: ColorTokens = {
  desk: palette.leather,
  deskDeep: palette.leatherDeep,
  panel: palette.page,
  control: palette.page,
  primary: palette.gilt,
  onPrimary: palette.leatherInk,
  hairline: palette.inkFaint,
  paper: palette.page,
  paperWhite: palette.pageBright,
  kraft: palette.kraft,
  blush: palette.blush,
  cork: palette.cork,
  corkDark: palette.corkDark,
  gridLine: palette.gridLine,
  ruleLine: palette.ruleLine,
  marginLine: palette.marginLine,
  ink: palette.ink,
  inkMuted: palette.inkMuted,
  inkFaint: palette.inkFaint,
  // By day the cover is pale, so lettering on it is dark ink.
  onDesk: palette.ink,
  onDeskMuted: 'rgba(42, 33, 24, 0.7)',
  onDeskFaint: 'rgba(42, 33, 24, 0.45)',
  amber: palette.amber,
  onAmber: palette.amberInk,
  green: palette.green,
  onGreen: palette.greenInk,
  metal: palette.metal,
  metalLight: palette.metalLight,
  lamp: palette.lamp,
  buddy: palette.buddy,
  buddyShade: palette.buddyShade,
  buddyBlush: palette.buddyBlush,
  buddyEar: palette.buddyEar,
  buddyNose: palette.buddyNose,
  buddyOutline: palette.buddyOutline,
  // A dark walnut bookcase, so the leather volumes stand on something as old and quiet as they are.
  wood: '#5A3A24',
  woodLight: '#7A5234',
  woodDark: '#3A2416',
  woodDeep: '#24160D',
  cupboardLabel: '#E9DDC0',
  grain: palette.black,
  shadowBase: '#4A3A28',
  scrim: 'rgba(20, 16, 12, 0.45)',
  // Deeper gold by day, so it reads on the pale cover.
  gilt: '#9A7A3A',
  giltBright: '#86682C',
  stitch: 'rgba(120, 90, 40, 0.4)',
  wax: palette.wax,
  inkBlue: palette.inkBlue,
  sepia: palette.sepia,
};

/** Lamplight: the same diary at night. The leather is deeper, the pages and the gold a little dimmer. */
export const darkColors: ColorTokens = {
  ...lightColors,
  panel: palette.pageLamp,
  control: palette.pageLamp,
  primary: palette.giltLamp,
  paper: palette.pageLamp,
  paperWhite: palette.pageBrightLamp,
  kraft: palette.kraftDim,
  blush: '#E9CDC3',
  cork: '#9C7550',
  corkDark: '#5E4029',
  onDesk: '#E3D7BC',
  onDeskMuted: 'rgba(227, 215, 188, 0.7)',
  onDeskFaint: 'rgba(227, 215, 188, 0.44)',
  shadowBase: palette.black,
  wood: '#4A2F1D',
  woodLight: '#644329',
  woodDark: '#2E1C11',
  woodDeep: '#1C1109',
  cupboardLabel: '#DDD0B2',
  scrim: 'rgba(0, 0, 0, 0.6)',
  gilt: palette.giltLamp,
  giltBright: '#C7A562',
  stitch: 'rgba(184, 150, 79, 0.38)',
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  gutter: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/**
 * Every control in the diary is made the same way and the same size: the bar, buttons, the stitched slips of buttons,
 * the Day/Night switch, the tape deck. One corner, one height, the stitching the same distance in, the highlighter wash
 * the same distance in and laid on at the same slight angle.
 */
export const control = {
  radius: 12,
  height: 52,
  stitchInset: 4,
  washInset: 6,
  /** The wash lies square: a tilted highlighter stroke read as craft, not as a bound diary. */
  washTilt: '0deg',
} as const;

export const radii = {
  paper: 3,
  card: 10,
  album: 14,
  panel: 6,
  pill: 999,
} as const;

export const sizes = {
  circleButton: 48,
  /** Below this window width the screen title uses `titleNarrow`. */
  narrowWindow: 400,
  icon: 22,
  iconSmall: 16,
  pillHeight: 46,
  pillHeightLarge: 54,
  rowHeight: 54,
  hitSlop: 8,
  blurIntensity: 50,
  /** Polaroid frame: side border and the thicker caption border. */
  polaroidBorder: 10,
  polaroidCaption: 46,
  tapeHeight: 22,
  tapeWidthRatio: 0.42,
  pinHead: 18,
  clipWidth: 18,
  clipHeight: 46,
  sticker: 36,
  stickerDecor: 30,
  buddy: 96,
  buddySmall: 64,
  stampHeight: 34,
  albumHeight: 200,
  albumRatio: 1.24,
  albumWidthRatio: 0.74,
  /** Tallest book spine on the cupboard shelves. */
  spineMax: 190,
  albumSpine: 14,
  albumPageEdge: 4,
  countSticker: 42,
  ruledLineGap: 30,
  inputMinLines: 6,
  pileHeight: 330,
  pileItemWidthRatio: 0.6,
  detailWidthRatio: 0.84,
  collageGap: 22,
  tornEdgeHeight: 10,
  ticketNotch: 11,
  ticketPerfGap: 8,
  foldSize: 24,
  doodleStroke: 3,
  confettiPiece: 9,
  confettiCount: 26,
  moteCount: 14,
  moteRadius: 1.6,
  lampRadiusRatio: 0.95,
  stickerTray: 44,
  swatch: 46,
  checkbox: 26,
  /** The paper navigation strip at the foot of each page, and its raised middle button. */
  navBar: 72,
  navCenter: 62,
  /** A paper-color chip on the first-run and Settings pages. */
  paperChip: 64,
} as const;

/**
 * A bound diary's type. Cormorant Garamond is the gilt lettering (titles, buttons, labels); IM Fell English is the
 * old printer's face for dates and quiet notes; Caveat is the person's own handwriting (their words, on the page).
 * Caveat's sizes run larger than a serif would, because it is small on the line.
 */
const GILT = 'CormorantGaramond_600SemiBold';
const GILT_ITALIC = 'CormorantGaramond_600SemiBold_Italic';
const PRINT = 'IMFellEnglish_400Regular';
const PRINT_ITALIC = 'IMFellEnglish_400Regular_Italic';
const BOLD = 'Caveat_700Bold';
const MEDIUM = 'Caveat_500Medium';

const hand = (size: number, lineHeight: number, family = 'Caveat_600SemiBold', letterSpacing = 0): TextStyle => ({
  fontFamily: family,
  fontSize: size,
  lineHeight,
  letterSpacing,
  // Caveat's glyphs overhang their measured box on Android; without this the last letter gets clipped.
  // (Android clips text inside its padding, so big headings also get a trailing space: see HAND_TAIL.)
  paddingRight: Math.ceil(size * 0.15),
});
/** Serif faces overhang far less, but italics still lean past their box. */
const serif = (size: number, lineHeight: number, family: string, letterSpacing = 0): TextStyle => ({
  fontFamily: family,
  fontSize: size,
  lineHeight,
  letterSpacing,
  paddingRight: Math.ceil(size * 0.06),
});

export const typography = {
  /** Page titles: gilt italic, like a name tooled on the cover. */
  title: serif(40, 46, GILT_ITALIC),
  /** Title on narrow phones, so title, count and buttons still share one line. */
  titleNarrow: serif(34, 40, GILT_ITALIC),
  heading: serif(28, 32, GILT_ITALIC),
  headline: serif(30, 36, GILT_ITALIC),
  month: serif(32, 38, GILT_ITALIC),
  /** Buttons and short labels. */
  label: serif(18, 22, GILT, 0.4),
  /** Quiet printed notes on the leather or a page: subtitles, help text, dates. */
  caption: serif(17, 23, PRINT_ITALIC),
  /** Small tooled capitals ("RETURNED TO YOU TODAY", "MMXXVI"). */
  stamp: serif(13, 16, GILT, 2.4),
  stampLarge: serif(20, 24, GILT, 2.8),
  albumYear: serif(32, 38, GILT),
  /** Printed text on a page or the leather (settings rows, notes), upright and italic. */
  print: serif(18, 24, PRINT),
  printItalic: serif(18, 24, PRINT_ITALIC),
  /** The person's own words, in their hand. */
  hand: hand(24, 28),
  handSmall: serif(15, 20, PRINT_ITALIC),
  handLarge: hand(32, 36, BOLD),
  body: hand(22, 28, MEDIUM),
  bodyStrong: hand(22, 28, BOLD),
  ticket: hand(23, 26),
  small: serif(15, 20, PRINT),
} as const;

/** Paper-on-desk shadow: tight + offset, layered, tinted by the object's color (never flat gray). */
export function paperShadow(tint: string, lift = 1, dark = false): string {
  const base = dark ? 0.6 : 0.24;
  const near = withAlpha(tint, base);
  const far = withAlpha(tint, base * 0.6);
  return `${lift}px ${2 * lift}px ${lift}px ${near}, ${3 * lift}px ${8 * lift}px ${14 * lift}px ${far}`;
}

export const motion = {
  gentle: { duration: 320, dampingRatio: 1 },
  drop: { duration: 460, dampingRatio: 0.78 },
  fan: { duration: 420, dampingRatio: 0.8 },
  lift: { duration: 280, dampingRatio: 0.85 },
  press: { duration: 220, dampingRatio: 0.9 },
  /** A friendly pop with one soft overshoot, not a wobble. */
  pop: { duration: 380, dampingRatio: 0.68 },
  dropStaggerMs: 75,
  dropFromY: -70,
  dropMaxAnimated: 12,
  pressedScale: 1.03,
  /** Buttons dip a little under the finger (quickly), then ease back without a bounce. */
  buttonPressScale: 0.95,
  buttonPressInMs: 90,
  buttonRelease: { duration: 320, dampingRatio: 1 },
  pressedLift: -3,
  tapeTug: -2,
  liftedScale: 1.3,
  statusPillVisibleMs: 2200,
  statusPillOffset: 24,
  imageFadeMs: 200,
  /** A polaroid turning over to its back: the turn, how high it lifts and how far it leans mid-air. */
  flipMs: 760,
  flipLiftPx: 22,
  flipScale: 0.1,
  flipLeanDeg: 5,
  /** Little hearts that pop up when it lands. */
  flipHeartsMs: 900,
  photoDevelopMs: 1400,
  swayDeg: 1.6,
  swayMs: 2600,
  wiggleDeg: 9,
  wiggleMs: 90,
  moteDriftMs: 16000,
  lampFadeMs: 700,
  lampClickMs: 140,
  celebrationMs: 1250,
  tidy: { duration: 620, dampingRatio: 0.82 },
  /** Startup animation: memories tumble onto the bunny, the name appears, the sheet lifts away. */
  /** Wait for the native splash to finish fading (SPLASH_FADE_MS in app/_layout) before the bunny moves. */
  introDescendDelayMs: 200,
  introFirstDropMs: 420,
  /** All the pieces finish starting to fall within this time, however many there are. */
  introRainMs: 1100,
  /** Hide the native splash after this even if the bunny picture never reports being shown. */
  introSplashFallbackMs: 900,
  introFallMs: 560,
  introHoldMs: 750,
  introExitMs: 420,
  introReducedHoldMs: 700,
  /** A volume leaving the shelf: heavy, so it pulls out slowly, floats with weight, and its cover swings open slowly and lands with a thud. */
  bookFlight: {
    /** Tipped forward and slid out of its row. */
    pullMs: 440,
    /** Floats to the middle in an arc, growing. */
    travelMs: 820,
    /** Turns, like a real box, from spine to cover. */
    turnMs: 640,
    /** The cover swings open on its spine and lies flat; the book slides to centre the spread. */
    openMs: 1000,
    /** Two pages flutter over after the cover, one after another. */
    pageMs: 560,
    pageGapMs: 140,
    burstMs: 900,
    settleMs: 300,
    readyFallbackMs: 700,
    /** Zooms into the right-hand page until it is the year's page. */
    diveMs: 640,
  },
  /** A sheet or strip easing up from the buttons, and away again (a little quicker). */
  sheetInMs: 300,
  sheetOutMs: 200,
  /** Longest a pushed page waits for "slide finished" before building its heavy parts anyway (Android's slide is ~400–450 ms). */
  screenFallbackMs: 700,
  /** Push / pop between screens. */
  screenMs: 280,
  /** Cross-fade between the bar's pages (Home, Years, Settings). */
  tabFadeMs: 160,
  buddyBobMs: 1900,
  buddyBobPx: 3,
  confettiMs: 1300,
  tapeFlickerMs: 70,
} as const;

/** Seeded scatter for scrapbook objects. */
export const scrap = {
  maxTilt: 4,
  maxOffset: 10,
  fanSpreadRatio: 0.5,
  fanRotationDeg: 9,
  fanLiftY: 18,
  pileOffsetX: 16,
  pileOffsetY: 12,
  pileVisible: 5,
  collageColumns: 2,
  collageMinScale: 0.86,
  albumTiltDeg: 2.5,
  scatterTilt: 16,
  scatterColumns: 3,
  scatterScale: 1.22,
  scatterRowRatio: 0.62,
  tidyColumns: 3,
  tidyTilt: 2.5,
} as const;

export const opacity = {
  pressed: 0.85,
  disabled: 0.4,
  tape: 0.86,
  grainLight: 0.08,
  grainDark: 0.1,
  vignette: 0.45,
  lampGlow: 0.5,
  mote: 0.55,
  stampInk: 0.9,
  pileShadow: 0.2,
  /** How strongly a page is washed with the year's color (inside a diary it is fully tinted). */
  pageWash: 0.6,
} as const;
