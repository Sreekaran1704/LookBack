import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, usePathname } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAllEntries, useToday } from '../hooks/useData';
import { parseLocalDate } from '../lib/dates';
import { tapHaptic } from '../lib/haptics';
import { useTheme, withAlpha } from '../theme';
import type { IconName } from './Buttons';
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

/** Routes that have no bar: the writing page (it has its own close/save and the keyboard) and the first-run questions. */
const HIDDEN_ON = ['/entry', '/welcome'];

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
  return sizes.navBar + insets.bottom + spacing.xxl;
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

/** Gap between the + button and the notch cut around it (the same all the way round). */
const NOTCH_GAP = 6;
/** How far below the strip's top edge the + button's center sits (share of its size): it rests in the notch. */
const SINK = 0.08;
const CORNER = 22;
const SHADOW_DROP = 3;
const STITCH_INSET = 5;
/** Where the notch's curve meets the soft lip that rounds it into the top edge. */
const LIP_Y = 4;
const LIP = 12;

/**
 * The strip's outline: a rounded paper band with a round notch around the + button. The notch is a
 * circle around the button's own center (cy below the top edge), so the gap is even all the way round.
 */
function stripPath(w: number, h: number, cx: number, cy: number, notchR: number, inset = 0): string {
  const r = CORNER - inset;
  const top = inset;
  const left = inset;
  const right = w - inset;
  const bottom = h - inset;
  const R = notchR + inset;
  const y0 = top + LIP_Y;
  const dx = Math.sqrt(Math.max(0, R * R - (y0 - cy) ** 2));
  const large = y0 < cy ? 1 : 0;
  return [
    `M ${left + r} ${top}`,
    `L ${cx - dx - LIP} ${top}`,
    `Q ${cx - dx} ${top} ${cx - dx} ${y0}`,
    `A ${R} ${R} 0 ${large} 0 ${cx + dx} ${y0}`,
    `Q ${cx + dx} ${top} ${cx + dx + LIP} ${top}`,
    `L ${right - r} ${top}`,
    `Q ${right} ${top} ${right} ${top + r}`,
    `L ${right} ${bottom - r}`,
    `Q ${right} ${bottom} ${right - r} ${bottom}`,
    `L ${left + r} ${bottom}`,
    `Q ${left} ${bottom} ${left} ${bottom - r}`,
    `L ${left} ${top + r}`,
    `Q ${left} ${top} ${left + r} ${top}`,
    'Z',
  ].join(' ');
}

/**
 * The paper navigation strip at the foot of every page: a stitched paper band taped down at both
 * ends, with a round notch cut out for the + button, which sits in it like a sticker with bunny ears
 * peeking over the top. Home and Years on the left, Settings on the right, plus whatever button the
 * current page adds (the year page's Tidy up / Scatter). The page you're on sits on a soft blob of
 * the year's color. Buttons fade in and out as you move between pages.
 */
export function NavBar() {
  const theme = useTheme();
  const { colors, spacing, sizes, typography, motion } = theme;
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { action } = useContext(NavBarContext);
  const today = useToday();
  const { data: entries = [] } = useAllEntries();
  const written = entries.some((e) => e.localDate === today);
  const palette = theme.year(parseLocalDate(today).year);
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

  const onHome = pathname === '/';
  const onYears = pathname === '/years';
  const onSettings = pathname === '/settings';
  const go = (path: '/' | '/years' | '/settings') => {
    if (path === '/' && onHome) {
      homeTopListeners.forEach((l) => l());
      return;
    }
    if (pathname === path) return;
    router.navigate(path);
  };
  const enter = reduceMotion ? undefined : FadeIn.duration(motion.imageFadeMs);
  const exit = reduceMotion ? undefined : FadeOut.duration(motion.imageFadeMs);
  const layout = reduceMotion ? undefined : LinearTransition.springify().damping(18);

  const h = sizes.navBar;
  const d = sizes.navCenter;
  const cx = w / 2;
  const cy = d * SINK;
  const notchR = d / 2 + NOTCH_GAP;
  const fill = written ? colors.green : palette.primary;

  return (
    <Animated.View
      pointerEvents={hidden ? 'none' : 'box-none'}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[styles.wrap, { left: spacing.gutter, right: spacing.gutter, bottom: insets.bottom + spacing.sm, height: h }, barStyle]}
    >
      {w > 0 ? (
        <Svg pointerEvents="none" width={w} height={h + SHADOW_DROP} style={styles.shape}>
          {/* Paper shadow, the strip itself, and a dashed stitch just inside its edge. */}
          <Path d={stripPath(w, h, cx, cy, notchR)} fill={withAlpha(palette.ink, theme.dark ? 0.5 : 0.18)} transform={`translate(0 ${SHADOW_DROP})`} />
          <Path d={stripPath(w, h, cx, cy, notchR)} fill={colors.panel} stroke={withAlpha(palette.ink, 0.25)} strokeWidth={1} />
          <Path d={stripPath(w, h, cx, cy, notchR, STITCH_INSET)} fill="none" stroke={withAlpha(palette.primary, 0.55)} strokeWidth={1.4} strokeDasharray="5 4" strokeLinecap="round" />
        </Svg>
      ) : null}
      <WashiTape width={sizes.tapeHeight * 2.4} color={palette.primary} color2={colors.paperWhite} pattern="stripes" angle={-24} style={[styles.tape, { left: -spacing.md, top: -spacing.sm }]} />
      <WashiTape width={sizes.tapeHeight * 2.4} color={palette.secondary} color2={colors.paperWhite} pattern="dots" angle={22} style={[styles.tape, { right: -spacing.md, top: -spacing.sm }]} />

      <View style={[styles.bar, { height: h, paddingHorizontal: spacing.sm }]}>
        <Animated.View layout={layout} style={styles.side}>
          <Tab icon={onHome ? 'home' : 'home-outline'} label="Home" active={onHome} accent={palette.primary} onPress={() => go('/')} />
          <Tab icon={onYears ? 'library' : 'library-outline'} label="Years" active={onYears} accent={palette.primary} onPress={() => go('/years')} />
        </Animated.View>

        {/* The + sticker sitting in the notch, bunny ears peeking over it. What it does is written under it. */}
        <View style={[styles.middle, { width: notchR * 2, height: h, paddingBottom: spacing.xs }]}>
          <View pointerEvents="none" style={[styles.ears, { top: cy - d / 2 - d * 0.3, width: d }]}>
            {[-1, 1].map((side) => (
              <View
                key={side}
                style={[
                  styles.ear,
                  { width: d * 0.24, height: d * 0.5, borderRadius: d * 0.12, backgroundColor: colors.paperWhite, borderColor: withAlpha(palette.ink, 0.25), transform: [{ rotate: `${side * 16}deg` }] },
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
              {
                position: 'absolute',
                top: cy - d / 2,
                width: d,
                height: d,
                borderRadius: d / 2,
                backgroundColor: fill,
                borderWidth: 4,
                borderColor: colors.paperWhite,
                boxShadow: theme.shadow(fill, 1.2),
              },
            ]}
          >
            <Ionicons name={written ? 'create' : 'add'} size={sizes.icon * (written ? 1.2 : 1.5)} color={colors.paperWhite} />
          </PressableScale>
          <Text numberOfLines={1} style={[typography.small, { color: colors.ink, alignSelf: 'stretch', textAlign: 'center' }]}>
            {written ? 'edit ✓' : 'write'}
          </Text>
        </View>

        <Animated.View layout={layout} style={styles.side}>
          {action ? (
            <Animated.View key={action.key} entering={enter} exiting={exit} style={{ flex: 1 }}>
              <Tab icon={action.icon} label={action.label} accent={palette.primary} onPress={action.onPress} />
            </Animated.View>
          ) : null}
          <Tab icon={onSettings ? 'settings' : 'settings-outline'} label="Settings" active={onSettings} accent={palette.primary} onPress={() => go('/settings')} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

/** Space between the page highlight and the strip's edge, above and below alike. */
const PILL_MARGIN = 9;
const PILL_WIDTH = 86;

function Tab({ icon, label, active = false, accent, onPress }: { icon: IconName; label: string; active?: boolean; accent: string; onPress: () => void }) {
  const { colors, typography, sizes, spacing } = useTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const pillH = size.h - PILL_MARGIN * 2;
  // The same width for every tab, however much room the tab has.
  const pillW = Math.min(size.w - spacing.xs * 2, PILL_WIDTH);
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
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={[styles.tab, { height: sizes.navBar }]}
    >
      {/* The page you're on sits on a soft pill of the year's color, centered in the strip. */}
      {active && size.w > 0 ? (
        <Svg pointerEvents="none" width={size.w} height={size.h} style={StyleSheet.absoluteFill}>
          <Rect x={(size.w - pillW) / 2} y={PILL_MARGIN} width={pillW} height={pillH} rx={pillH / 2.4} ry={pillH / 2.4} fill={withAlpha(accent, 0.28)} />
        </Svg>
      ) : null}
      <Ionicons name={icon} size={sizes.icon} color={active ? colors.ink : colors.inkMuted} />
      {/* Full width + centred: a shrink-wrapped Caveat label gets under-measured on Android. */}
      <Text numberOfLines={1} style={[typography.small, { color: active ? colors.ink : colors.inkMuted, alignSelf: 'stretch', textAlign: 'center' }]}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
  shape: { position: 'absolute', left: 0, top: 0 },
  bar: { flexDirection: 'row', alignItems: 'center' },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  middle: { alignItems: 'center', justifyContent: 'flex-end' },
  ears: { position: 'absolute', flexDirection: 'row', justifyContent: 'center', gap: 14 },
  ear: { borderWidth: 1, overflow: 'hidden' },
  tape: { position: 'absolute', zIndex: 2 },
});
