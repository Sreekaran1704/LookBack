import { createContext, useContext } from 'react';
import {
  control,
  darkColors,
  lightColors,
  motion,
  opacity,
  paperShadow,
  radii,
  scrap,
  sizes,
  spacing,
  typography,
  type ColorTokens,
} from './tokens';
import { DEFAULT_LOOK, navColors, paperByName, type Look, type NavColors, type Paper } from './papers';
import { mixHex, withAlpha, yearPalette, type YearPalette } from './yearColors';

export interface Theme {
  scheme: 'light' | 'dark';
  dark: boolean;
  /** Cheap drawing for crowds of small objects (the year pile): no blurred shadows or shape filters. */
  lite: boolean;
  /** The page color the person picked (the desk in light and dark tones). */
  paper: Paper;
  /** The bottom bar's colors, matched to the paper and tone. */
  nav: NavColors;
  colors: ColorTokens;
  spacing: typeof spacing;
  /** One size and make for every control (bar, buttons, slips, switches). */
  control: typeof control;
  radii: typeof radii;
  sizes: typeof sizes;
  typography: typeof typography;
  motion: typeof motion;
  scrap: typeof scrap;
  opacity: typeof opacity;
  year: (year: number) => YearPalette;
  /** Tinted paper shadow (boxShadow string); defaults to a warm brown. In dark mode it becomes a deeper shadow. */
  shadow: (tint?: string, lift?: number) => string | undefined;
}

const base = { spacing, control, radii, sizes, typography, motion, scrap, opacity, year: yearPalette };

const cache = new Map<string, Theme>();

const WHITE = '#FFFFFF';
const BLACK = '#000000';
/** How the paper's accent becomes the diary's accents: darkened for lettering by day, lifted by lamplight. */
const ACCENT_TEXT_DAY = 0.3;
const ACCENT_LIFT_NIGHT = 0.15;
const ACCENT_TEXT_NIGHT = 0.4;
const STITCH_ALPHA = 0.5;
/** How much of the paper's color warms the cream cards. */
const CARD_TINT_DAY = 0.4;
const CARD_TINT_NIGHT = 0.2;

/** The whole theme for a look: the chosen leather as the desk (the cover every page sits on), by day or lamplight. */
export function makeTheme(look: Look): Theme {
  const key = `${look.paper}:${look.tone}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const paper = paperByName(look.paper);
  const dark = look.tone === 'dark';
  // The chosen paper colors the whole diary, not just the page: its accent is the gilt (titles, rules, the highlighter
  // wash, what's chosen), the stitching is in it, and the cards are the same cream warmed with a little of the paper.
  // By lamplight the same accent is lifted so it reads on the deep page.
  const accent = paper.dots;
  const colors: ColorTokens = dark
    ? {
        ...darkColors,
        desk: paper.dark,
        deskDeep: paper.darkDeep,
        gilt: mixHex(accent, WHITE, ACCENT_LIFT_NIGHT),
        giltBright: mixHex(accent, WHITE, ACCENT_TEXT_NIGHT),
        stitch: withAlpha(mixHex(accent, WHITE, ACCENT_LIFT_NIGHT), STITCH_ALPHA),
        primary: mixHex(accent, WHITE, ACCENT_LIFT_NIGHT),
        panel: mixHex(darkColors.panel, paper.light, CARD_TINT_NIGHT),
      }
    : {
        ...lightColors,
        desk: paper.light,
        deskDeep: paper.lightDeep,
        gilt: accent,
        giltBright: mixHex(accent, BLACK, ACCENT_TEXT_DAY),
        stitch: withAlpha(accent, STITCH_ALPHA),
        primary: accent,
        panel: mixHex(lightColors.panel, paper.light, CARD_TINT_DAY),
      };
  const theme: Theme = {
    scheme: dark ? 'dark' : 'light',
    dark,
    lite: false,
    paper,
    nav: navColors(paper, look.tone),
    colors,
    ...base,
    // Soft warm shadows on the pale day cover; deep ones at night.
    shadow: (_tint, lift = 1) => paperShadow(colors.shadowBase, lift, dark),
  };
  cache.set(key, theme);
  return theme;
}

export const lightTheme: Theme = makeTheme(DEFAULT_LOOK);

export interface ThemeContextValue {
  theme: Theme;
  look: Look;
  setLook: (look: Look) => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  look: DEFAULT_LOOK,
  setLook: () => undefined,
});

export function useTheme(): Theme {
  return useContext(ThemeContext).theme;
}

/** The page look (paper color + light/dark tone) and a setter that saves it. */
export function useLook(): Pick<ThemeContextValue, 'look' | 'setLook'> {
  const { look, setLook } = useContext(ThemeContext);
  return { look, setLook };
}

export * from './tokens';
export * from './yearColors';
export * from './papers';
