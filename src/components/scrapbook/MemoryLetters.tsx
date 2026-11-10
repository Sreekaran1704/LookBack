import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import type { Entry } from '../../data';
import { parseLocalDate, yearsAgoLabel, yearsBetween } from '../../lib/dates';
import { tapHaptic } from '../../lib/haptics';
import { seededRng, STICKERS } from '../../lib/seeded';
import { useTheme } from '../../theme';
import { Buddy } from './Buddy';
import { DropIn } from './DropIn';
import { ScrapObject } from './ScrapObject';
import { deg } from './shared';
import { Sticker } from './Sticker';

interface Props {
  /** Matches for today, most recent year first. */
  entries: Entry[];
  today: string;
  onOpen: (id: string) => void;
}

/** Envelope width as a share of the content width: one letter sits centred, several scroll sideways with the next peeking in. */
const WIDTH_SINGLE = 0.82;
const WIDTH_MANY = 0.74;
const ENVELOPE_RATIO = 0.64;
/** How far the letter rises out of the envelope, as a share of the envelope height. */
const RISE_RATIO = 0.62;
const FLAP_RATIO = 0.56;
const LETTER_RATIO = 0.84;
const LETTER_INSET = 14;
const CORNER = 10;
const SEAL = 40;
const STAMP = 44;
const FOLD_OPACITY = 0.35;

/**
 * "On this day" as letters from your past self: one sealed envelope per earlier year. Tap an
 * envelope and its flap opens and the memory slides out; tap the memory to read it in full.
 */
export function MemoryLetters({ entries, today, onOpen }: Props) {
  const { spacing } = useTheme();
  const { width: screenW } = useWindowDimensions();
  const contentW = screenW - spacing.gutter * 2;
  const single = entries.length === 1;
  const envelopeW = contentW * (single ? WIDTH_SINGLE : WIDTH_MANY);

  const letters = entries.map((entry, i) => (
    <DropIn key={entry.id} index={i}>
      <Letter entry={entry} today={today} width={envelopeW} onOpen={onOpen} first={i === 0} />
    </DropIn>
  ));

  if (single) return <View style={styles.center}>{letters}</View>;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={envelopeW + spacing.xl}
      decelerationRate="fast"
      // Bleed to the screen edges so the next envelope peeks in.
      style={{ marginHorizontal: -spacing.gutter }}
      contentContainerStyle={{ paddingHorizontal: spacing.gutter, gap: spacing.xl }}
    >
      {letters}
    </ScrollView>
  );
}

interface LetterProps {
  entry: Entry;
  today: string;
  width: number;
  onOpen: (id: string) => void;
  /** Only the first envelope gets the buddy; the rest just get a note. */
  first: boolean;
}

function Letter({ entry, today, width, onOpen, first }: LetterProps) {
  const theme = useTheme();
  const { colors, spacing, typography, motion, sizes } = theme;
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const progress = useSharedValue(0);

  const year = parseLocalDate(entry.localDate).year;
  const palette = theme.year(year);
  const rng = seededRng(`letter-${entry.id}`);
  const tilt = rng.range(-1.5, 1.5);
  const seal = rng.pick(STICKERS);
  const stampTilt = rng.range(-8, 8);

  const height = width * ENVELOPE_RATIO;
  const rise = height * RISE_RATIO;
  const flapH = height * FLAP_RATIO;
  const letterW = width * LETTER_RATIO;

  useEffect(() => {
    const target = open ? 1 : 0;
    progress.set(reduceMotion ? withTiming(target, { duration: motion.imageFadeMs }) : withSpring(target, motion.fan));
  }, [open, progress, reduceMotion, motion.fan, motion.imageFadeMs]);

  // The flap flips up: the closed flap folds away in the first half, the open one unfolds behind the letter in the second.
  const closedFlap = useAnimatedStyle(() => ({ transform: [{ scaleY: Math.max(0, 1 - progress.get() * 2) }] }));
  const openFlap = useAnimatedStyle(() => ({ transform: [{ scaleY: Math.max(0, Math.min(1, progress.get() * 2 - 1)) }] }));
  const letterStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.get() * 4),
    transform: [{ translateY: (1 - Math.min(1, progress.get())) * rise }],
  }));
  const closedOnly = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - progress.get() * 3) }));

  const flapPath = `M 0 0 L ${width} 0 L ${width / 2 + 6} ${flapH - 6} Q ${width / 2} ${flapH} ${width / 2 - 6} ${flapH - 6} Z`;
  const toggle = () => {
    tapHaptic();
    setOpen((o) => !o);
  };

  return (
    <View style={{ width, gap: spacing.md }}>
      <View style={{ width, height: rise + height, transform: [{ rotate: deg(tilt) }] }}>
        {/* Waiting on top of the sealed envelope. */}
        <Animated.View pointerEvents="none" style={[styles.perch, { height: rise, gap: spacing.sm, paddingHorizontal: spacing.md }, closedOnly]}>
          {first ? <Buddy mood="wave" accent={palette.primary} size={Math.min(sizes.buddy, rise)} style={{ marginBottom: -spacing.sm }} /> : null}
          <Text style={[typography.handSmall, { color: colors.onDeskMuted, flex: 1, paddingBottom: spacing.md }]}>
            {first ? `psst… a letter from ${year}. Tap to open!` : `…and one from ${year}`}
          </Text>
        </Animated.View>

        <View style={{ position: 'absolute', top: rise, width, height }}>
          {/* Inside of the envelope. */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.secondary, borderRadius: CORNER }]} />
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -flapH, width, height: flapH, transformOrigin: 'bottom' }, openFlap]}>
            <Svg width={width} height={flapH} style={{ transform: [{ scaleY: -1 }] }}>
              <Path d={flapPath} fill={colors.paperWhite} stroke={palette.primary} strokeWidth={1.5} strokeLinejoin="round" />
            </Svg>
          </Animated.View>

          {/* The memory, sliding up out of the pocket. Clipped at the bottom so it stays tucked in. */}
          <View pointerEvents="box-none" style={{ position: 'absolute', top: -rise, left: 0, right: 0, height: rise + height - CORNER, overflow: 'hidden' }}>
            <Animated.View pointerEvents={open ? 'auto' : 'none'} style={[{ position: 'absolute', top: LETTER_INSET, left: (width - letterW) / 2 }, letterStyle]}>
              <ScrapObject entry={entry} width={letterW} numberOfLines={4} onPress={() => onOpen(entry.id)} />
            </Animated.View>
          </View>

          {/* Front of the envelope. */}
          <Pressable
            onPress={toggle}
            accessibilityRole="button"
            accessibilityLabel={open ? `Put the ${year} letter away` : `Open the letter from ${year}`}
            style={{ position: 'absolute', top: open ? height * 0.42 : 0, bottom: 0, left: 0, right: 0 }}
          />
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { top: height * 0.42, borderBottomLeftRadius: CORNER, borderBottomRightRadius: CORNER, overflow: 'hidden' }]}
          >
            <Svg width={width} height={height * 0.58}>
              <Rect x={0} y={0} width={width} height={height * 0.58} fill={palette.tint} />
              <Path
                d={`M 0 ${height * 0.58} L ${width / 2} ${height * 0.1} L ${width} ${height * 0.58}`}
                stroke={palette.primary}
                strokeWidth={1.5}
                fill="none"
                opacity={FOLD_OPACITY}
              />
            </Svg>
            <View style={{ position: 'absolute', left: spacing.lg, right: STAMP + spacing.xl, bottom: spacing.sm }}>
              <Text numberOfLines={1} style={[typography.handSmall, { color: colors.inkMuted }]}>to: me, today</Text>
              <Text numberOfLines={1} style={[typography.hand, { color: colors.ink }]}>
                from: past me
              </Text>
            </View>
            {/* Postage stamp with the year. */}
            <View
              style={{
                position: 'absolute',
                right: spacing.md,
                bottom: spacing.md,
                width: STAMP,
                height: STAMP * 1.15,
                backgroundColor: colors.paperWhite,
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: palette.primary,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ rotate: deg(stampTilt) }],
              }}
            >
              <Text style={[typography.stamp, { color: palette.primary, paddingRight: 0, letterSpacing: 0 }]}>{year}</Text>
            </View>
          </View>
          {/* Upper part of the front, shown only while sealed. */}
          <Animated.View
            pointerEvents="none"
            style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.42 + 1, backgroundColor: palette.tint, borderTopLeftRadius: CORNER, borderTopRightRadius: CORNER }, closedOnly]}
          />

          {/* Sealed flap with a sticker holding it shut. */}
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, width, height: flapH, transformOrigin: 'top' }, closedFlap]}>
            <Svg width={width} height={flapH}>
              <Path d={flapPath} fill={colors.paperWhite} stroke={palette.primary} strokeWidth={1.5} strokeLinejoin="round" />
            </Svg>
          </Animated.View>
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: flapH - SEAL * 0.6, left: (width - SEAL) / 2 }, closedOnly]}>
            <Sticker kind={seal} size={SEAL} color={palette.primary} color2={palette.secondary} />
          </Animated.View>

          {/* Paper shadow under the whole envelope. */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: -1, borderRadius: CORNER, boxShadow: theme.shadow(palette.primary, 1.2) }]} />
        </View>
      </View>
      {/* Full width + centred: a shrink-wrapped Caveat label gets under-measured on Android. */}
      <Text style={[typography.handLarge, { color: colors.onDesk, textAlign: 'center' }]}>{yearsAgoLabel(yearsBetween(entry.localDate, today))}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  perch: { flexDirection: 'row', alignItems: 'flex-end' },
});
