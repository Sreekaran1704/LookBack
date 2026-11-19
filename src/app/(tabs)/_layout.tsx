import { router, usePathname } from 'expo-router';
import { TabList, TabTrigger, useTabsWithChildren } from 'expo-router/ui';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';
import PagerView, { type PagerViewProps } from 'react-native-pager-view';
import Animated, { useEvent } from 'react-native-reanimated';
import { PageActiveProvider } from '../../components/PageActive';
import { pagerPosition, registerPager } from '../../components/pagerPosition';
import { tapHaptic } from '../../lib/haptics';
import { useTheme } from '../../theme';

/** The bar's pages, left to right. */
const PAGES = [
  { name: 'index', path: '/' },
  { name: 'years', path: '/years' },
  { name: 'settings', path: '/settings' },
] as const;
type PagePath = (typeof PAGES)[number]['path'];

/**
 * Build the pages you haven't opened yet once the intro is over, so the first swipe finds them ready. The tab router
 * only knows the pages you have visited, so they are preloaded first.
 */
const WARM_UP_MS = 4000;

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

/** The bar page for a path, or -1 for anything else (a diary, a memory, the writing page). */
function indexOfPath(pathname: string): number {
  return PAGES.findIndex((p) => p.path === pathname);
}

/**
 * Home, Years and Settings side by side in Android's own page swiper (ViewPager2, as Instagram's tabs use): the drag,
 * the fling and the snap all run natively, so the page stays glued to your thumb whatever JavaScript is doing. (A
 * hand-built slider, driven through the gesture and animation libraries, never felt as attached on Home.)
 *
 * The bar's highlight follows the swipe frame by frame (`pagerPosition`, set on the UI thread). The route changes
 * once a swipe has settled; a bar tap (or back) changes the route first and the pager slides to it. Every page stays
 * built, and a page that isn't in front pauses its animations (PageActive).
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  const pathname = usePathname();
  // Only a bar page moves the pager. While a diary or a memory is open on top, the path is that page's,
  // and the pager stays where it was.
  const tabIndex = indexOfPath(pathname);
  const [index, setIndex] = useState(tabIndex < 0 ? 0 : tabIndex);
  if (tabIndex >= 0 && tabIndex !== index) setIndex(tabIndex);

  const { state, descriptors, NavigationContent } = useTabsWithChildren({
    backBehavior: 'firstRoute',
    children: (
      <TabList>
        <TabTrigger name="index" href="/" />
        <TabTrigger name="years" href="/years" />
        <TabTrigger name="settings" href="/settings" />
      </TabList>
    ),
  });

  const pager = useRef<ComponentRef<typeof PagerView>>(null);
  /** The page the pager shows (or is settling on), as Android last reported it. */
  const shown = useRef(index);
  /** The page a swipe selected, to move the route to once the swipe has settled. */
  const selected = useRef(index);
  /** Whether the pager is still being dragged or settling. */
  const moving = useRef(false);
  /** Once a swipe has settled on a page: move the route there. Android reports "settled" and "selected" in either order. */
  const settle = () => {
    if (moving.current) return;
    const target = PAGES[selected.current];
    if (!target || selected.current === index) return;
    tapHaptic();
    router.navigate(target.path as PagePath);
  };

  // Lets a sideways gesture inside a page (the letter deck) hold the pages still.
  useEffect(() => {
    registerPager(pager.current);
    return () => registerPager(null);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => PAGES.forEach((page) => router.prefetch(page.path as PagePath)), WARM_UP_MS);
    return () => clearTimeout(t);
  }, []);

  // The bar (or a back press) changed the page: slide there.
  useEffect(() => {
    if (shown.current === index) return;
    shown.current = index;
    selected.current = index;
    pager.current?.setPage(index);
  }, [index]);

  // Frame by frame on the UI thread: where the pages are, for the bar's highlight.
  const onPageScroll = useEvent<{ position: number; offset: number }>(
    (e) => {
      'worklet';
      pagerPosition.set(e.position + e.offset);
    },
    ['onPageScroll'],
  );

  return (
    <NavigationContent>
      <AnimatedPagerView
        ref={pager}
        style={[styles.fill, { backgroundColor: colors.desk }]}
        initialPage={index}
        // Keep every page built and laid out on both sides, so a swipe never waits for one.
        offscreenPageLimit={PAGES.length - 1}
        // A Reanimated event handler runs on the UI thread; its type differs from the plain callback the prop declares.
        onPageScroll={onPageScroll as unknown as PagerViewProps['onPageScroll']}
        onPageSelected={(e) => {
          selected.current = e.nativeEvent.position;
          shown.current = e.nativeEvent.position;
          settle();
        }}
        onPageScrollStateChanged={(e) => {
          moving.current = e.nativeEvent.pageScrollState !== 'idle';
          settle();
        }}
      >
        {PAGES.map((page, i) => {
          const route = state.routes.find((r) => r.name === page.name);
          const descriptor = route ? descriptors[route.key] : undefined;
          return (
            <View key={page.name} collapsable={false} style={[styles.fill, { backgroundColor: colors.desk }]}>
              {descriptor ? <PageActiveProvider active={i === index}>{descriptor.render()}</PageActiveProvider> : null}
            </View>
          );
        })}
      </AnimatedPagerView>
    </NavigationContent>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
