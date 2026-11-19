import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, usePathname } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAllEntries, useToday } from '../hooks/useData';
import { tapHaptic } from '../lib/haptics';
import { useTheme } from '../theme';
import type { IconName } from './Buttons';
import { pagerPosition } from './pagerPosition';
import { PressableScale } from './PressableScale';
import { WashiTape } from './scrapbook/WashiTape';

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
const HIDDEN_ON = ['/entry', '/welcome', '/memory', '/year'];

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

/** Room a scrolling screen leaves at its foot so its last lines aren't hidden behind the bar. */
export function useNavBarSpace(): number {
  const { sizes, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  // The + button and its bunny ears stand above the strip (about 0.75 of its size): the page's last line must clear them.
  return sizes.navBar + insets.bottom + sizes.navCenter * 0.75 + spacing.lg;
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

const CORNER = 22;
const SHADOW_DROP = 3;
const STITCH_INSET = 5;
/** Space between the highlight under the page you're on and the strip's edges. */
const PILL_MARGIN = 9;

/** The bar's pages, left to right, all the same width. */
const PAGES = [
  { path: '/', label: 'Home', icon: 'home-outline', iconOn: 'home' },
  { path: '/years', label: 'Years', icon: 'library-outline', iconOn: 'library' },
  { path: '/settings', label: 'Settings', icon: 'settings-outline', iconOn: 'settings' },
] as const;

function stripPath(w: number, h: number, inset = 0): string {
  const r = CORNER - inset;
  const l = inset;
  const t = inset;
  const rt = w - inset;
  const b = h - inset;
  return `M ${l + r} ${t} L ${rt - r} ${t} Q ${rt} ${t} ${rt} ${t + r} L ${rt} ${b - r} Q ${rt} ${b} ${rt - r} ${b} L ${l + r} ${b} Q ${l} ${b} ${l} ${b - r} L ${l} ${t + r} Q ${l} ${t} ${l + r} ${t} Z`;
}

/**
 * The paper bar at the foot of every page: a stitched paper strip taped at both ends with equal places
 * (Home, Years, Settings, plus a page's own button such as the year page's Tidy up / Scatter as a fourth),
 * a highlight that follows the pages as they slide (with your finger, mid-swipe), and beside it the round
 * + sticker with bunny ears that writes today (or edits it, green).
 */
export function NavBar() {
  const theme = useTheme();
  const { colors, spacing, sizes, motion } = theme;
  const nav = theme.nav;
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { action } = useContext(NavBarContext);
  const today = useToday();
  const { data: entries = [] } = useAllEntries();
  const written = entries.some((e) => e.localDate === today);
  const reduceMotion = useReducedMotion();
  const [keyboard, setKeyboard] = useState(false);
  const [w, setW] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const hidden = keyboard || HIDDEN_ON.some((p) => pathname.startsWith(p));
  const shown = useSharedValue(hidden ? 0 : 1);
  useEffect(() => {
    shown.set(reduceMotion ? (hidden ? 0 : 1) : withSpring(hidden ? 0 : 1, motion.lift));
  }, [hidden, shown, reduceMotion, motion.lift]);
  const barStyle = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: (1 - shown.get()) * (sizes.navBar + insets.bottom + spacing.xl) }],
  }));

  const h = sizes.navBar;
  const d = sizes.navCenter;
  const gap = spacing.sm;
  const stripW = Math.max(0, w - d - gap);
  const slot = stripW / (PAGES.length + (action ? 1 : 0));
  const pillW = Math.max(0, slot - spacing.sm * 2);
  const on = PAGES.findIndex((p) => p.path === pathname);
  // The highlight sits wherever the pages are, so it slides along with a swipe (hidden on pages outside the bar).
  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pagerPosition.get() * slot + (slot - pillW) / 2 }] }));

  const go = (path: '/' | '/years' | '/settings') => {
    if (path === '/' && pathname === '/') {
      homeTopListeners.forEach((l) => l());
      return;
    }
    if (pathname === path) return;
    router.navigate(path);
  };
  const enter = reduceMotion ? undefined : FadeIn.duration(motion.imageFadeMs);
  const exit = reduceMotion ? undefined : FadeOut.duration(motion.imageFadeMs);
  const fill = written ? colors.green : nav.plus;

  return (
    <Animated.View
      pointerEvents={hidden ? 'none' : 'box-none'}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[styles.wrap, { left: spacing.gutter, right: spacing.gutter, bottom: insets.bottom + spacing.sm, height: h }, barStyle]}
    >
      {stripW > 0 ? (
        <Svg pointerEvents="none" width={stripW} height={h + SHADOW_DROP} style={styles.shape}>
          {/* Paper shadow, the strip itself, and a dashed stitch just inside its edge. */}
          <Path d={stripPath(stripW, h)} fill={nav.shadow} transform={`translate(0 ${SHADOW_DROP})`} />
          <Path d={stripPath(stripW, h)} fill={nav.strip} stroke={nav.edge} strokeWidth={1} />
          <Path d={stripPath(stripW, h, STITCH_INSET)} fill="none" stroke={nav.stitch} strokeWidth={1.4} strokeDasharray="5 4" strokeLinecap="round" />
        </Svg>
      ) : null}
      <WashiTape width={sizes.tapeHeight * 2.4} color={nav.tape} color2={nav.rim} pattern="stripes" angle={-24} style={[styles.tape, { left: -spacing.md, top: -spacing.sm }]} />
      <WashiTape width={sizes.tapeHeight * 2.4} color={nav.tape2} color2={nav.rim} pattern="dots" angle={22} style={[styles.tape, { left: stripW - sizes.tapeHeight * 2.4 + spacing.md, top: -spacing.sm }]} />

      {/* Three equal places, and the highlight under the one you're on. */}
      <View style={[styles.slots, { width: stripW, height: h }]}>
        {on >= 0 && pillW > 0 ? (
          <Animated.View pointerEvents="none" style={[styles.pill, { top: PILL_MARGIN, width: pillW, height: h - PILL_MARGIN * 2, borderRadius: (h - PILL_MARGIN * 2) / 2.4, backgroundColor: nav.active }, pillStyle]} />
        ) : null}
        {PAGES.map((page, i) => (
          <Tab key={page.path} icon={i === on ? page.iconOn : page.icon} label={page.label} active={i === on} width={slot} onPress={() => go(page.path)} />
        ))}
        {/* A page's own button takes a fourth, equal place. */}
        {action ? (
          <Animated.View key={action.key} entering={enter} exiting={exit}>
            <Tab icon={action.icon} label={action.label} active={false} accent={nav.tape} width={slot} onPress={action.onPress} />
          </Animated.View>
        ) : null}
      </View>

      {/* The + sticker with bunny ears, at the end of the strip. */}
      <View style={[styles.plusWrap, { left: stripW + gap, width: d, height: h }]}>
        <View pointerEvents="none" style={[styles.ears, { top: (h - d) / 2 - d * 0.32, width: d }]}>
          {[-1, 1].map((side) => (
            <View
              key={side}
              style={[
                styles.ear,
                { width: d * 0.24, height: d * 0.5, borderRadius: d * 0.12, backgroundColor: nav.rim, borderColor: nav.edge, transform: [{ rotate: `${side * 16}deg` }] },
              ]}
            >
              <View style={{ flex: 1, margin: d * 0.05, borderRadius: d * 0.1, backgroundColor: colors.buddyEar }} />
            </View>
          ))}
        </View>
        <PressableScale
          onPress={() => router.push('/entry')}
          accessibilityRole="button"
          accessibilityLabel={written ? "Edit today's memory" : "Write today's memory"}
          style={[
            styles.center,
            { width: d, height: d, borderRadius: d / 2, backgroundColor: fill, borderWidth: 4, borderColor: nav.rim, boxShadow: theme.shadow(fill, 1.2) },
          ]}
        >
          <Ionicons name={written ? 'create' : 'add'} size={sizes.icon * (written ? 1.2 : 1.5)} color={nav.rim} />
        </PressableScale>
      </View>
    </Animated.View>
  );
}

function Tab({ icon, label, active, width, accent, onPress }: { icon: IconName; label: string; active: boolean; width: number; accent?: string; onPress: () => void }) {
  const { nav, typography, sizes } = useTheme();
  return (
    <PressableScale
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      haptic={false}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={[styles.tab, { width, height: sizes.navBar }]}
    >
      <Ionicons name={icon} size={sizes.icon} color={accent ?? (active ? nav.ink : nav.inkMuted)} />
      {/* Full width + centred: a shrink-wrapped Caveat label gets under-measured on Android. */}
      <Text numberOfLines={1} style={[typography.small, { color: active ? nav.ink : nav.inkMuted, alignSelf: 'stretch', textAlign: 'center' }]}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
  shape: { position: 'absolute', left: 0, top: 0 },
  slots: { position: 'absolute', left: 0, top: 0, flexDirection: 'row', alignItems: 'center' },
  pill: { position: 'absolute', left: 0 },
  tab: { alignItems: 'center', justifyContent: 'center' },
  plusWrap: { position: 'absolute', top: 0, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  ears: { position: 'absolute', flexDirection: 'row', justifyContent: 'center', gap: 14 },
  ear: { borderWidth: 1, overflow: 'hidden' },
  tape: { position: 'absolute', zIndex: 2 },
});
