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
import { yearPalette, type YearPalette } from './yearColors';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface Theme {
  scheme: 'light' | 'dark';
  dark: boolean;
  /** Cheap drawing for crowds of small objects (the year pile): no blurred shadows or shape filters. */
  lite: boolean;
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

export const lightTheme: Theme = {
  scheme: 'light',
  dark: false,
  lite: false,
  colors: lightColors,
  ...base,
  shadow: (tint, lift = 1) => paperShadow(tint ?? lightColors.shadowBase, lift, false),
};

export const darkTheme: Theme = {
  scheme: 'dark',
  dark: true,
  lite: false,
  colors: darkColors,
  ...base,
  shadow: (_tint, lift = 1) => paperShadow(darkColors.shadowBase, lift, true),
};

export interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  mode: 'system',
  setMode: () => undefined,
});

export function useTheme(): Theme {
  return useContext(ThemeContext).theme;
}

export function useThemeMode(): Pick<ThemeContextValue, 'mode' | 'setMode'> {
  const { mode, setMode } = useContext(ThemeContext);
  return { mode, setMode };
}

export * from './tokens';
export * from './yearColors';
