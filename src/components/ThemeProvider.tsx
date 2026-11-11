import { useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { settingsRepository } from '../data';
import { DEFAULT_LOOK, makeTheme, ThemeContext, type Look } from '../theme';

/**
 * The page look lives in a tiny store loaded during the splash (`preloadLook`), so the very first frame
 * is already drawn on the person's own paper, with no flash of the default.
 */
let current: Look = DEFAULT_LOOK;
const listeners = new Set<() => void>();
function setCurrent(next: Look) {
  current = next;
  listeners.forEach((l) => l());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function preloadLook(): Promise<void> {
  setCurrent(await settingsRepository.getLook());
}

/** The chosen paper color in its light or dark tone; changing it re-themes the whole app at once. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const look = useSyncExternalStore(subscribe, () => current);
  const setLook = useCallback((next: Look) => {
    setCurrent(next);
    settingsRepository.setLook(next).catch(() => undefined);
  }, []);
  const value = useMemo(() => ({ theme: makeTheme(look), look, setLook }), [look, setLook]);
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
