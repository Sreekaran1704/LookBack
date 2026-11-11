import { createContext, useContext } from 'react';
import {
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
import { DEFAULT_LOOK, paperByName, type Look, type Paper } from './papers';
import { withAlpha, yearPalette, type YearPalette } from './yearColors';

export interface Theme {
  scheme: 'light' | 'dark';
  dark: boolean;
  /** Cheap drawing for crowds of small objects (the year pile): no blurred shadows or shape filters. */
  lite: boolean;
  /** The page color the person picked (the desk in light and dark tones). */
  paper: Paper;
  colors: ColorTokens;
  spacing: typeof spacing;
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

const base = { spacing, radii, sizes, typography, motion, scrap, opacity, year: yearPalette };

const DARK_DOTS = 'rgba(255, 255, 255, 0.09)';
const cache = new Map<string, Theme>();

/** The whole theme for a page look: the chosen paper as the desk, in its light or dark tone. */
export function makeTheme(look: Look): Theme {
  const key = `${look.paper}:${look.tone}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const paper = paperByName(look.paper);
  const dark = look.tone === 'dark';
  const colors: ColorTokens = dark
    ? { ...darkColors, desk: paper.dark, deskDeep: paper.darkDeep, gridLine: DARK_DOTS }
    : { ...lightColors, desk: paper.light, deskDeep: paper.lightDeep, gridLine: withAlpha(paper.dots, 0.32) };
  const theme: Theme = {
    scheme: dark ? 'dark' : 'light',
    dark,
    lite: false,
    paper,
    colors,
    ...base,
    shadow: dark ? (_tint, lift = 1) => paperShadow(darkColors.shadowBase, lift, true) : (tint, lift = 1) => paperShadow(tint ?? lightColors.shadowBase, lift, false),
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
