import { useIsFocused } from 'expo-router';
import { createContext, useContext, type ReactNode } from 'react';

/**
 * Whether the page this is on is the one being shown. The bar's pages stay built while hidden (so
 * switching is instant), and anything that animates forever (the bunny's bob) pauses while its page
 * is hidden: otherwise hidden pages keep the phone repainting behind the visible one.
 */
const PageActiveContext = createContext(true);

export function usePageActive(): boolean {
  return useContext(PageActiveContext);
}

/** Wraps a navigator screen; must be inside the navigator (it asks the screen whether it is focused). */
export function PageActiveGate({ children }: { children: ReactNode }) {
  const focused = useIsFocused();
  return <PageActiveContext.Provider value={focused}>{children}</PageActiveContext.Provider>;
}
