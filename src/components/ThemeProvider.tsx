import { useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { settingsRepository } from '../data';
import { darkTheme, lightTheme, ThemeContext, type ThemeMode } from '../theme';

/** Follows the system light/dark setting by default, with a manual override stored in settings. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    settingsRepository.getThemeMode().then(setModeState, () => undefined);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    settingsRepository.setThemeMode(next).catch(() => undefined);
  }, []);

  const scheme = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  const value = useMemo(
    () => ({ theme: scheme === 'dark' ? darkTheme : lightTheme, mode, setMode }),
    [scheme, mode, setMode],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Everything inside draws without blurred shadows or shape filters. Used where dozens of small
 * objects are on screen and moving at once (the year pile), where those effects cost frames.
 */
export function LiteShadows({ children }: { children: ReactNode }) {
  const context = useContext(ThemeContext);
  const value = useMemo(() => ({ ...context, theme: { ...context.theme, lite: true, shadow: () => undefined } }), [context]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
