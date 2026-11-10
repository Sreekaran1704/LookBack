import type { TextStyle } from 'react-native';
import { withAlpha } from './yearColors';

/**
 * Scrapbook design tokens: a cutesy paper journal (cream desk, taped paper, stickers, handwriting). Every color, size, radius, shadow and motion value in the UI comes
 * from here. No raw numbers or hex values in components.
 */

const palette = {
  cream: '#FBF5E6',
  creamDim: '#ECE2CA',
  kraft: '#D8B98C',
  kraftDim: '#C2A276',
  blush: '#F8DDD3',
  cork: '#C99A68',
  corkDark: '#8E6440',
  paperWhite: '#FFFDF8',
  paperWhiteDim: '#EFE8D8',
  ink: '#2A2118',
  inkMuted: '#7A6A58',
  inkFaint: 'rgba(42, 33, 24, 0.14)',
  faint: '#B3A088',
  buddy: '#FFF3E4',
  buddyShade: '#E3C3A8',
  buddyBlush: '#FF9DB0',
  buddyEar: '#FFC4D0',
  buddyNose: '#F0879C',
  buddyOutline: '#A9876B',
  gridLine: 'rgba(91, 140, 201, 0.16)',
  ruleLine: 'rgba(91, 140, 201, 0.32)',
  marginLine: 'rgba(232, 84, 84, 0.45)',
  deskNight: '#1B1A18',
  deskNightDeep: '#0F0E0D',
  lamp: '#FFB866',
  moonCream: '#F4ECD8',
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
}

export const lightColors: ColorTokens = {
  desk: palette.cream,
  deskDeep: palette.creamDim,
  panel: palette.paperWhite,
  control: palette.paperWhite,
  primary: palette.ink,
  onPrimary: palette.paperWhite,
  hairline: palette.inkFaint,
  paper: palette.cream,
  paperWhite: palette.paperWhite,
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
  onDesk: palette.ink,
  onDeskMuted: palette.inkMuted,
  onDeskFaint: palette.faint,
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
  wood: '#B57A47',
  woodLight: '#D9A26A',
  woodDark: '#7E4E2B',
  woodDeep: '#5A341B',
  cupboardLabel: '#F6E7D2',
  grain: palette.black,
  shadowBase: '#5B3E1F',
  scrim: 'rgba(42, 33, 24, 0.35)',
};

export const darkColors: ColorTokens = {
  desk: palette.deskNight,
  deskDeep: palette.deskNightDeep,
  panel: palette.paperWhiteDim,
  control: palette.paperWhiteDim,
  primary: palette.amber,
  onPrimary: palette.amberInk,
  hairline: palette.inkFaint,
  paper: palette.creamDim,
  paperWhite: palette.paperWhiteDim,
  kraft: palette.kraftDim,
  blush: '#E9CDC3',
  cork: '#9C7550',
  corkDark: '#5E4029',
  gridLine: 'rgba(244, 236, 216, 0.07)',
  ruleLine: palette.ruleLine,
  marginLine: palette.marginLine,
  ink: palette.ink,
  inkMuted: palette.inkMuted,
  inkFaint: palette.inkFaint,
  onDesk: palette.moonCream,
  onDeskMuted: 'rgba(244, 236, 216, 0.68)',
  onDeskFaint: 'rgba(244, 236, 216, 0.45)',
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
  wood: '#9A6339',
  woodLight: '#BE8752',
  woodDark: '#653D20',
  woodDeep: '#3E2412',
  cupboardLabel: '#E9D6BC',
  grain: palette.white,
  shadowBase: palette.black,
  scrim: 'rgba(0, 0, 0, 0.5)',
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
} as const;

/**
 * Handwriting everywhere: Caveat in three weights. Sizes run larger than a sans would, because Caveat is small on the line.
 */
const hand = (size: number, lineHeight: number, family = 'Caveat_600SemiBold', letterSpacing = 0): TextStyle => ({
  fontFamily: family,
  fontSize: size,
  lineHeight,
  letterSpacing,
  // Caveat's glyphs overhang their measured box on Android; without this the last letter gets clipped.
  paddingRight: Math.ceil(size * 0.15),
});
const BOLD = 'Caveat_700Bold';
const MEDIUM = 'Caveat_500Medium';

export const typography = {
  title: hand(50, 54, BOLD),
  /** Title on narrow phones, so title, count and buttons still share one line. */
  titleNarrow: hand(42, 46, BOLD),
  heading: hand(32, 36, BOLD),
  headline: hand(36, 40, BOLD),
  month: hand(40, 44, BOLD),
  label: hand(23, 27, BOLD),
  caption: hand(22, 26, MEDIUM),
  stamp: hand(18, 20, BOLD, 1.4),
  stampLarge: hand(28, 30, BOLD, 1.6),
  albumYear: hand(40, 44, BOLD),
  hand: hand(24, 28),
  handSmall: hand(19, 22, MEDIUM),
  handLarge: hand(32, 36, BOLD),
  body: hand(22, 28, MEDIUM),
  bodyStrong: hand(22, 28, BOLD),
  ticket: hand(23, 26),
  small: hand(19, 22, MEDIUM),
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
  drop: { duration: 460, dampingRatio: 0.7 },
  fan: { duration: 420, dampingRatio: 0.8 },
  lift: { duration: 280, dampingRatio: 0.85 },
  press: { duration: 220, dampingRatio: 0.9 },
  pop: { duration: 380, dampingRatio: 0.55 },
  dropStaggerMs: 75,
  dropFromY: -70,
  dropMaxAnimated: 12,
  pressedScale: 1.03,
  pressedLift: -3,
  tapeTug: -2,
  liftedScale: 1.3,
  statusPillVisibleMs: 2200,
  statusPillOffset: 24,
  imageFadeMs: 200,
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
  /** A diary leaving the shelf: pull out, float to the middle, cover opens (stars burst), then it dissolves into its page. */
  bookFlight: { pullMs: 220, travelMs: 560, turnMs: 360, openMs: 420, burstMs: 700, settleMs: 160, readyFallbackMs: 600, diveMs: 460 },
  /** Push / pop between screens. */
  screenMs: 280,
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
