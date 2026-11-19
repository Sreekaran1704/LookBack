import { makeMutable } from 'react-native-reanimated';

/**
 * Where the bar's pages are, shared between the page slider ((tabs)/_layout) and the bar (NavBar):
 * 0 = Home, 1 = Years, 2 = Settings, 0.4 = Home with Years 40% slid over it. The bar's highlight
 * follows it, so it moves with your finger during a swipe.
 */
export const pagerPosition = makeMutable(0);

/** The bar pages' native swiper, so a gesture inside a page can hold it still (see `holdPager`). */
let pagerControl: { setScrollEnabled: (enabled: boolean) => void } | null = null;

export function registerPager(control: { setScrollEnabled: (enabled: boolean) => void } | null): void {
  pagerControl = control;
}

/**
 * Hold the pages still while a finger works a sideways gesture of its own (the letter deck), so the
 * whole page doesn't slide away with the letter. Imperative: nothing in React changes mid-swipe.
 */
export function holdPager(hold: boolean): void {
  pagerControl?.setScrollEnabled(!hold);
}
