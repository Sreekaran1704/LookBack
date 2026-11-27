import { router, useFocusEffect, usePathname } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { makeMutable, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, withAlpha } from '../theme';
import type { IconName } from './Buttons';
import { pagerPosition } from './pagerPosition';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useReceivedLetters } from '../hooks/useSharing';
import { useAllEntries, useProfile, useToday } from '../hooks/useData';
import { portraitFor } from '../lib/portrait';
import { FilmPortrait } from './scrapbook/FilmPortrait';
import { tapHaptic } from '../lib/haptics';
import { PAPER_TABS_H, PaperTabs, Stitches, useBarMetrics, useBarPaper, type PaperTab } from './PaperTabs';
import { Texture } from './scrapbook/Texture';

/** A button a screen adds to the bar while it is in front (the year page's "Tidy up" / "Scatter"). */
export interface NavAction {
  key: string;
  icon: IconName;
  label: string;
  onPress: () => void;
}

interface NavBarState {
  action: NavAction | null;
  setAction: (action: NavAction | null) => void;
}

const NavBarContext = createContext<NavBarState>({ action: null, setAction: () => undefined });

/**
 * The bar is for moving between the three main pages. Pages you open into (a memory, a year's diary, the
 * writing page, the first-run questions) have their own action bar instead, so the bar steps aside there.
 */
/** How far the fade under the phone's own buttons reaches up into the page. */
const FADE_ABOVE = 18;
const HIDDEN_ON = ['/entry', '/welcome', '/memory/', '/year/', '/letter', '/settings', '/portrait', '/person/'];

export function NavBarProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<NavAction | null>(null);
  return <NavBarContext.Provider value={{ action, setAction }}>{children}</NavBarContext.Provider>;
}

/** Puts a screen's own button in the bar while that screen is focused. */
export function useNavAction(action: NavAction | null) {
  const { setAction } = useContext(NavBarContext);
  const key = action?.key;
  const label = action?.label;
  useFocusEffect(
    useCallback(() => {
      setAction(action);
      return () => setAction(null);
      // Re-register when what the button says changes; the handler itself is read at press time.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, label, setAction]),
  );
}

/** Room a scrolling screen leaves at its foot so its last lines aren't hidden behind the tabs. */
export function useNavBarSpace(): number {
  const { spacing } = useTheme();
  const insets = useSafeAreaInsets();
  return PAPER_TABS_H + insets.bottom + spacing.lg;
}

/**
 * The bar steps out of the way while you read: scrolling down a page slides it away, scrolling back up (or reaching the
 * top) brings it back. 0 = shown, 1 = tucked away. Each bar page's scroll view reports to it with `useNavScroll()`.
 */
const navTucked = makeMutable(0);
/** Scroll this far in one direction before the bar moves, so small jitters don't flick it. */
const TUCK_STEP = 8;
const TUCK_AFTER = 120;
const TUCK_MS = 220;

/** A scroll handler for a bar page's (Animated) ScrollView: hides the bar going down, shows it going up. */
export function useNavScroll() {
  const last = useSharedValue(0);
  return useAnimatedScrollHandler({
    onScroll: (e) => {
      const y = e.contentOffset.y;
      const dy = y - last.get();
      if (Math.abs(dy) < TUCK_STEP) return;
      last.set(y);
      const tuck = dy > 0 && y > TUCK_AFTER ? 1 : 0;
      if (navTucked.get() !== tuck) navTucked.set(withTiming(tuck, { duration: TUCK_MS }));
    },
  });
}

/** Home on home scrolls back to the top. */
const homeTopListeners = new Set<() => void>();
export function useHomeTopRequest(scrollToTop: () => void) {
  useEffect(() => {
    homeTopListeners.add(scrollToTop);
    return () => {
      homeTopListeners.delete(scrollToTop);
    };
  }, [scrollToTop]);
}

const PAGES = [
  { path: '/', label: 'Home', icon: 'home-outline' },
  { path: '/years', label: 'Years', icon: 'library-outline' },
  { path: '/shared', label: 'Shared', icon: 'mail-outline' },
  { path: '/you', label: 'You', icon: 'person-circle-outline' },
] as const;
/** The round Write button sits in the middle of the bar, before this page. */
const WRITE_AT = 2;

/**
 * The bottom bar on the main pages, one strip: Home · Years · Write · Shared · You. The page you're on sits on the
 * highlighter wash, following your finger as you swipe between pages (gliding over the middle). Write is round, a
 * little bigger, standing up out of the middle of the bar (Edit once today is written). Shared shows how many pages
 * given to you are still unopened. Settings opens from You.
 */
export function NavBar() {
  const { motion, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { action } = useContext(NavBarContext);
  const reduceMotion = useReducedMotion();
  const [keyboard, setKeyboard] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const totalH = PAPER_TABS_H + insets.bottom;
  const hidden = keyboard || HIDDEN_ON.some((p) => pathname.startsWith(p));
  const shown = useSharedValue(hidden ? 0 : 1);
  useEffect(() => {
    shown.set(reduceMotion ? (hidden ? 0 : 1) : withSpring(hidden ? 0 : 1, motion.lift));
  }, [hidden, shown, reduceMotion, motion.lift]);
  // Changing page always brings the bar back.
  useEffect(() => {
    navTucked.set(withTiming(0, { duration: TUCK_MS }));
  }, [pathname]);
  const barStyle = useAnimatedStyle(() => {
    const away = Math.max(1 - shown.get(), navTucked.get());
    return { opacity: 1 - away * 0.9, transform: [{ translateY: away * totalH }] };
  });

  const on = PAGES.findIndex((p) => p.path === pathname);
  const unread = useReceivedLetters().filter((l) => !l.openedAt).length;
  const go = (path: (typeof PAGES)[number]['path']) => {
    if (path === '/' && pathname === '/') {
      homeTopListeners.forEach((l) => l());
      return;
    }
    if (pathname === path) return;
    router.navigate(path);
  };
  const me = useMyPortrait();
  const items: PaperTab[] = [
    ...PAGES.map((p, i) => ({
      key: p.path,
      icon: p.icon as IconName,
      label: p.label,
      active: i === on,
      onPress: () => go(p.path),
      badge: p.path === '/shared' ? unread : undefined,
      picture: p.path === '/you' ? me : undefined,
    })),
    ...(action ? [{ key: action.key, icon: action.icon, label: action.label, onPress: action.onPress }] : []),
  ];

  return (
    <>
      {/* The strip under the phone's own buttons stays covered even when the bar tucks away while scrolling, so the
          page never shows loose behind them (3-button navigation leaves a tall strip). Static: no per-frame cost. */}
      {insets.bottom > 0 && !hidden ? (
        <View
          pointerEvents="none"
          style={[
            styles.wrap,
            {
              height: insets.bottom + FADE_ABOVE,
              backgroundImage: `linear-gradient(180deg, ${withAlpha(colors.desk, 0)} 0%, ${withAlpha(colors.desk, 0.9)} ${Math.round((FADE_ABOVE / (insets.bottom + FADE_ABOVE)) * 100)}%, ${colors.desk} 100%)`,
            },
          ]}
        />
      ) : null}
      <Animated.View pointerEvents={hidden ? 'none' : 'box-none'} style={[styles.wrap, barStyle]}>
        <PaperTabs items={items} slide={on >= 0 ? pagerPosition : undefined} bottomInset={insets.bottom} center={<WriteButton />} centerAt={WRITE_AT} />
      </Animated.View>
    </>
  );
}

/** How much taller than an icon your portrait is on the You place (it stands up out of the wash's top, halfway to the bar's edge; the bottom lines up). */
const BAR_PORTRAIT_GROW = 4;

/** Your portrait for the You place, drawn again only when your portrait, name or the bar's paper changes. */
function useMyPortrait(): PaperTab['picture'] {
  const { data: profile } = useProfile();
  const { icon } = useBarMetrics();
  const bar = useBarPaper();
  const code = profile?.portrait ?? null;
  const name = profile?.name ?? '';
  const height = icon + BAR_PORTRAIT_GROW;
  return useMemo(
    () => ({ height, node: <FilmPortrait portrait={portraitFor(code, name)} size={height} hole={bar.bg} /> }),
    [code, name, height, bar.bg],
  );
}

/**
 * The round button in the middle of the bar, a little bigger than the places beside it and standing up out of it:
 * write today's page (once written, edit it). The same stitched cream paper as the bar, with the highlighter wash
 * behind a pencil while today is still blank.
 */
function WriteButton() {
  const theme = useTheme();
  const { colors, typography } = theme;
  const today = useToday();
  const { data: entries = [] } = useAllEntries();
  const written = entries.some((e) => e.localDate === today);
  const { barH } = useBarMetrics();
  const d = Math.round(barH * 1.22);
  const bar = useBarPaper();
  // Made like the bar beside it: stitched card paper; the highlighter wash says today is still waiting to be written.
  return (
    <Pressable
      onPress={() => {
        tapHaptic();
        router.push('/entry');
      }}
      accessibilityRole="button"
      accessibilityLabel={written ? "Edit today's page" : "Write today's page"}
      style={({ pressed }) => ({ width: d, height: d, borderRadius: d / 2, backgroundColor: bar.bg, boxShadow: theme.shadow(undefined, 1.6), alignItems: 'center', justifyContent: 'center', transform: [{ translateY: -barH * 0.28 }, { scale: pressed ? 0.95 : 1 }] })}
    >
      <Texture kind="paper" opacity={bar.texture} radius={d / 2} />
      <Stitches radius={d / 2} />
      {written ? null : (
        <View pointerEvents="none" style={{ position: 'absolute', left: theme.control.washInset + 2, right: theme.control.washInset + 2, top: theme.control.washInset + 2, bottom: theme.control.washInset + 2, transform: [{ rotate: '-8deg' }] }}>
          <View style={{ flex: 1, borderRadius: d, backgroundColor: withAlpha(colors.gilt, 0.3) }} />
        </View>
      )}
      <Ionicons name={written ? 'create-outline' : 'pencil'} size={23} color={bar.ink} />
      <Text style={[typography.small, { color: bar.ink, fontSize: 12, lineHeight: 15, fontWeight: '700', paddingRight: 0 }]}>{written ? 'Edit' : 'Write'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
