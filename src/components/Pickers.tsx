import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { selectHaptic } from '../lib/haptics';
import { CASSETTE_STYLES, PAPERS, useTheme, withAlpha, type CassetteStyleId, type Paper, type PaperTone } from '../theme';
import type { IconName } from './Buttons';
import { usePageActive } from './PageActive';
import { holdPager } from './pagerPosition';
import { PressableScale } from './PressableScale';
import { Cassette } from './scrapbook/Cassette';

export interface ToggleOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

/**
 * A paper track with a gilt tab that slides to the chosen side ("Day | Lamplight").
 * The tab springs across; with reduce motion it just moves.
 */
export function SlidingToggle<T extends string>({
  options,
  value,
  onChange,
  accent,
}: {
  options: readonly ToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accent?: string;
}) {
  const theme = useTheme();
  const { colors, spacing, radii, typography, sizes, motion } = theme;
  const reduceMotion = useReducedMotion();
  const [w, setW] = useState(0);
  // A value that isn't one of the options (nothing chosen yet) shows no tab.
  const found = options.findIndex((o) => o.value === value);
  const index = Math.max(0, found);
  const at = useSharedValue(index);
  useEffect(() => {
    at.set(reduceMotion ? withTiming(index, { duration: 0 }) : withSpring(index, motion.lift));
  }, [index, at, reduceMotion, motion.lift]);
  const pad = spacing.xs;
  const tabW = w > 0 ? (w - pad * 2) / options.length : 0;
  const tabStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: at.get() * tabW }],
  }));
  const fill = accent ?? colors.primary;

  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessibilityRole="radiogroup"
      style={[
        styles.track,
        {
          padding: pad,
          borderRadius: radii.pill,
          backgroundColor: colors.paperWhite,
          boxShadow: theme.shadow(undefined, 0.6),
        },
      ]}
    >
      {tabW > 0 && found >= 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: pad,
              top: pad,
              bottom: pad,
              width: tabW,
              borderRadius: radii.pill,
              backgroundColor: fill,
            },
            tabStyle,
          ]}
        />
      ) : null}
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <PressableScale
            key={o.value}
            onPress={() => {
              selectHaptic();
              onChange(o.value);
            }}
            haptic={false}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            style={[styles.option, { minHeight: sizes.pillHeight, gap: spacing.sm }]}
          >
            {o.icon ? (
              <Ionicons
                name={o.icon}
                size={sizes.iconSmall + 2}
                color={selected ? colors.onPrimary : colors.inkMuted}
              />
            ) : null}
            {/* Extra room on the right: Android under-measures Caveat and clips the last letter of a short label ("Ligh"). */}
            <Text
              numberOfLines={1}
              textBreakStrategy="simple"
              style={[
                typography.label,
                {
                  color: selected ? colors.onPrimary : colors.inkMuted,
                  paddingRight: spacing.md,
                },
              ]}
            >
              {/* A trailing space: Android under-measures Caveat and clips the last letter of a short label ("Ligh"). */}
              {`${o.label} `}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** How far the strip leans over by itself the first time it is shown, so you can see it slides. */
const NUDGE_PX = 56;
const NUDGE_DELAY_MS = 700;
const NUDGE_BACK_MS = 420;
/** Room inside the strip's ends (for the chosen paper's ring and shadow). */
const STRIP_PAD = 8;
const EDGE_SLACK = 4;

/**
 * A sideways strip of paper swatches (in the chosen tone), dotted like the page; the chosen one is lifted and checked.
 * It opens centred on the chosen paper, with quiet ink chevrons beside it (never over a swatch, level with the middle of
 * the swatches, dimmed at an end) and only whole papers in view (the strip is sized to fit them); the first time it's shown it leans over and
 * back by itself. Dragging it holds the bar pages' swiper still.
 */
export function PaperPicker({
  value,
  tone,
  onChange,
}: {
  value: string;
  tone: PaperTone;
  onChange: (paper: string) => void;
}) {
  const { spacing, sizes } = useTheme();
  const reduceMotion = useReducedMotion();
  const active = usePageActive();
  const scroller = useRef<ScrollViewInstance>(null);
  const [room, setRoom] = useState(0);
  const [x, setX] = useState(0);
  const gap = spacing.md;
  const step = CHIP_W + gap;
  // The strip is exactly as wide as the whole papers that fit, so none is ever cut off at an edge; the arrows page on.
  const fit = room > 0 ? Math.max(1, Math.min(PAPERS.length, Math.floor((room - STRIP_PAD * 2 + gap) / step))) : 0;
  const stripW = fit * step - gap + STRIP_PAD * 2;
  const max = Math.max(0, PAPERS.length - fit) * step;
  const index = Math.max(
    0,
    PAPERS.findIndex((p) => p.name === value),
  );
  // Open with the chosen paper as near the middle as a whole-paper position allows (only the first time).
  const placed = useRef(false);
  const [home, setHome] = useState<number | null>(null);
  useEffect(() => {
    if (!fit || placed.current) return;
    placed.current = true;
    const to = Math.min(max, Math.max(0, (index - Math.floor((fit - 1) / 2)) * step));
    requestAnimationFrame(() => {
      scroller.current?.scrollTo({ x: to, animated: false });
      setHome(to);
    });
  }, [fit, max, index, step]);
  // The first time the page is in front, lean towards the side with more papers and back.
  const nudged = useRef(false);
  useEffect(() => {
    if (!active || home === null || nudged.current || reduceMotion || max <= 0) return undefined;
    nudged.current = true;
    const from = home;
    const to = from + NUDGE_PX <= max ? from + NUDGE_PX : Math.max(0, from - NUDGE_PX);
    const t1 = setTimeout(() => scroller.current?.scrollTo({ x: to, animated: true }), NUDGE_DELAY_MS);
    const t2 = setTimeout(
      () => scroller.current?.scrollTo({ x: from, animated: true }),
      NUDGE_DELAY_MS + NUDGE_BACK_MS,
    );
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [active, home, max, reduceMotion]);
  const release = () => holdPager(false);
  // An arrow turns to the next set of whole papers.
  const go = (dir: 1 | -1) => {
    const at = Math.round(x / step) * step;
    scroller.current?.scrollTo({ x: Math.min(max, Math.max(0, at + dir * fit * step)), animated: true });
  };
  const moreLeft = x > EDGE_SLACK;
  const moreRight = x < max - EDGE_SLACK;
  const arrowTop = spacing.md + CHIP_H / 2 - arrowSize(sizes.icon) / 2;
  return (
    <View style={styles.stripRow}>
      {max > 0 ? <Arrow side="left" top={arrowTop} enabled={moreLeft} onPress={() => go(-1)} /> : null}
      <View style={{ flex: 1, alignItems: 'center' }} onLayout={(e) => setRoom(e.nativeEvent.layout.width)}>
        {fit ? (
          <ScrollView
            ref={scroller}
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={step}
            scrollEventThrottle={32}
            onScroll={(e) => setX(Math.round(e.nativeEvent.contentOffset.x))}
            onTouchStart={() => holdPager(true)}
            onTouchEnd={release}
            onTouchCancel={release}
            onMomentumScrollEnd={release}
            accessibilityRole="radiogroup"
            accessibilityHint="Slide sideways for more papers"
            style={{ width: stripW, flexGrow: 0 }}
            contentContainerStyle={{ gap, paddingHorizontal: STRIP_PAD, paddingVertical: spacing.md }}
          >
            {PAPERS.map((p) => (
              <PaperChip
                key={p.name}
                paper={p}
                tone={tone}
                selected={p.name === value}
                onPress={() => onChange(p.name)}
              />
            ))}
          </ScrollView>
        ) : null}
      </View>
      {max > 0 ? <Arrow side="right" top={arrowTop} enabled={moreRight} onPress={() => go(1)} /> : null}
    </View>
  );
}

const arrowSize = (icon: number) => icon;

/**
 * An arrow beside one end of the strip: a bare ink chevron (no badge or ring; it sits on the paper card, so ink, not
 * gilt), level with the middle of the swatches, with a generous touch area. Dimmed at that end.
 */
function Arrow({
  side,
  top,
  enabled,
  onPress,
}: {
  side: 'left' | 'right';
  top: number;
  enabled: boolean;
  onPress: () => void;
}) {
  const { colors, sizes } = useTheme();
  const left = side === 'left';
  const d = arrowSize(sizes.icon);
  return (
    <PressableScale
      onPress={onPress}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={left ? 'Earlier papers' : 'More papers'}
      hitSlop={{ top: 24, bottom: 24, left: 12, right: 12 }}
      style={{ marginTop: top, width: d, height: d, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name={left ? 'chevron-back' : 'chevron-forward'} size={d} color={withAlpha(colors.ink, 0.7)} />
    </PressableScale>
  );
}

/** A paper sample: a small portrait card of the paper, ringed in ink when it is the one chosen. */
const SWATCH_W = 50;
const SWATCH_H = 66;
const RING_GAP = 3;
const RING_W = 1.5;
const CHIP_W = SWATCH_W + (RING_GAP + RING_W) * 2;
const CHIP_H = SWATCH_H + (RING_GAP + RING_W) * 2;

function PaperChip({
  paper,
  tone,
  selected,
  onPress,
}: {
  paper: Paper;
  tone: PaperTone;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { colors, typography, spacing } = theme;
  const dark = tone === 'dark';
  const face = dark ? paper.dark : paper.light;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${paper.label} paper`}
    >
      <View style={{ alignItems: 'center', gap: spacing.xs, width: CHIP_W }}>
        <View
          style={{
            padding: RING_GAP,
            borderRadius: 6 + RING_GAP,
            borderWidth: RING_W,
            borderColor: selected ? colors.ink : 'transparent',
          }}
        >
          {/* The sample: the paper lit from the top left, a hairline edge, and a thin tooled rule inside. */}
          <View
            style={{
              width: SWATCH_W,
              height: SWATCH_H,
              borderRadius: 6,
              backgroundColor: face,
              backgroundImage: `linear-gradient(160deg, ${withAlpha('#FFFFFF', dark ? 0.08 : 0.35)} 0%, ${withAlpha('#FFFFFF', 0)} 50%, ${dark ? withAlpha('#000000', 0.18) : paper.lightDeep} 100%)`,
              borderWidth: StyleSheet.hairlineWidth * 2,
              borderColor: withAlpha(colors.ink, dark ? 0.35 : 0.3),
              boxShadow: theme.shadow(undefined, dark ? 0.5 : 0.8),
            }}
          >
            <View
              style={{
                position: 'absolute',
                top: 5,
                left: 5,
                right: 5,
                bottom: 5,
                borderRadius: 3,
                borderWidth: StyleSheet.hairlineWidth * 2,
                borderColor: withAlpha(dark ? paper.giltNight : paper.giltDay, dark ? 0.55 : 0.75),
              }}
            />
          </View>
        </View>
        {/* Full width + centred: a shrink-wrapped label gets under-measured on Android. */}
        <Text
          numberOfLines={1}
          style={[
            typography.small,
            {
              alignSelf: 'stretch',
              textAlign: 'center',
              color: selected ? colors.ink : colors.inkMuted,
              paddingRight: 0,
            },
          ]}
        >
          {paper.label}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', alignItems: 'center' },
  stripRow: { flexDirection: 'row', alignItems: 'flex-start' },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});


/**
 * Six cassettes in two rows of three, each drawn exactly as it will look in the app: the chosen one sits on a soft wash
 * outlined in gilt, its name underlined. The Look card is a texture (Panel), so they cost nothing while scrolling.
 */
export function CassettePicker({ value, onChange }: { value: CassetteStyleId; onChange: (id: CassetteStyleId) => void }) {
  const { colors, spacing, radii, typography } = useTheme();
  // Each cassette is drawn live at an exact width (pictures came out sliced at the foot on Android).
  const [rowW, setRowW] = useState(0);
  const imgW = rowW > 0 ? Math.floor((rowW / 3 - spacing.xs * 2) * 0.86) : 0;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.sm }} onLayout={(e) => setRowW(e.nativeEvent.layout.width)}>
      {CASSETTE_STYLES.map((s) => {
        const on = s.id === value;
        return (
          <View key={s.id} style={{ width: '33.33%', paddingHorizontal: spacing.xs }}>
            <PressableScale
              onPress={() => {
                selectHaptic();
                onChange(s.id);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${s.name} cassette: ${s.note}`}
            >
              <View style={{ alignItems: 'center', paddingVertical: spacing.xs, borderRadius: radii.card, borderWidth: 1.5, borderColor: on ? colors.gilt : 'transparent', backgroundColor: on ? withAlpha(colors.gilt, 0.12) : 'transparent' }}>
                {imgW > 0 ? (
                  <View style={{ paddingVertical: spacing.xs }}>
                    <Cassette width={imgW} title="LookBack" detail="C90" played={0.3} style={s} />
                  </View>
                ) : null}
                <Text style={[typography.caption, { width: '100%', textAlign: 'center', color: on ? colors.ink : colors.inkMuted, textDecorationLine: on ? 'underline' : 'none' }]}>{s.name}</Text>
              </View>
            </PressableScale>
          </View>
        );
      })}
    </View>
  );
}
