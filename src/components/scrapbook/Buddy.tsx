import { Image, type ImageRef } from 'expo-image';
import { memo, useEffect } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';

export type BuddyMood = 'wave' | 'happy' | 'sleepy' | 'cheer' | 'peek';

interface Props {
  mood?: BuddyMood;
  size?: number;
  /** Color of the little bow by its ear (usually a year color). */
  accent?: string;
  /** Change this value to make the buddy hop (a keystroke, a button press, something arriving). */
  bump?: number | string;
  /** Pop in when it first appears (default). Off when it must match the splash screen exactly. */
  entrance?: boolean;
  /** Called once the picture is actually on screen (the intro waits for this before hiding the splash). */
  onShown?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * The bunny's poses, pre-rendered by scripts/make-icons.mjs from the same shapes as the app icon and
 * splash (soft shading, die-cut sticker edge). Showing a picture costs a fraction of drawing ~40
 * blurred layers live, which kept screens with a bunny from scrolling smoothly. The bow is a separate
 * white picture tinted with the year's color. Re-run the script after changing the bunny's look.
 */
const POSES: Record<BuddyMood, number> = {
  happy: require('../../../assets/buddy/happy.png'),
  wave: require('../../../assets/buddy/wave.png'),
  sleepy: require('../../../assets/buddy/sleepy.png'),
  cheer: require('../../../assets/buddy/cheer.png'),
  peek: require('../../../assets/buddy/peek.png'),
};
const BOW: number = require('../../../assets/buddy/bow.png');

/** Decodes every pose ahead of time, so a bunny never appears a frame late. Call once at startup. */
export function preloadBuddy(): Promise<ImageRef[]> {
  return Promise.all([...Object.values(POSES), BOW].map((source) => Image.loadAsync(source)));
}

/** `peek` only shows the ears, eyes and paws, as if looking over an edge (its picture is the top 68%). */
const PEEK_SHARE = 0.68;
const HOP_PX = 12;
const HOP_MS = 130;
const WAVE_ROCK_DEG = 5;
const CHEER_BOB = 2.4;
const POP_FROM = 0.4;

/**
 * The buddy: a small, soft cream bunny sticker that keeps the user company. It is alive: it pops in
 * when it appears, bobs (rocking when it waves, bouncing when it cheers, breathing slowly when asleep),
 * and hops whenever `bump` changes. With "reduce motion" on it holds still. It looks the same in dark mode.
 */
export const Buddy = memo(function Buddy({ mood = 'happy', size, accent, bump, entrance = true, onShown, style }: Props) {
  const theme = useTheme();
  const { colors, sizes, motion } = theme;
  const s = size ?? sizes.buddy;
  const reduceMotion = useReducedMotion();
  const bob = useSharedValue(0);
  const pop = useSharedValue(reduceMotion || !entrance ? 1 : POP_FROM);
  const hop = useSharedValue(0);
  const bow = accent ?? colors.amber;
  const peek = mood === 'peek';
  const height = peek ? s * PEEK_SHARE : s;

  const cheering = mood === 'cheer';
  const waving = mood === 'wave';
  const sleeping = mood === 'sleepy';

  useEffect(() => {
    if (reduceMotion) return;
    const duration = cheering ? motion.buddyBobMs / 4 : sleeping ? motion.buddyBobMs * 1.6 : motion.buddyBobMs;
    bob.set(0);
    bob.set(withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [bob, cheering, sleeping, motion.buddyBobMs, reduceMotion]);

  // Pop in on arrival (each screen the buddy shows up on).
  useEffect(() => {
    if (reduceMotion || !entrance) return;
    pop.set(withSpring(1, motion.pop));
  }, [pop, motion.pop, reduceMotion, entrance]);

  // Hop when something happens.
  useEffect(() => {
    if (reduceMotion || bump === undefined) return;
    hop.set(withSequence(withTiming(1, { duration: HOP_MS, easing: Easing.out(Easing.quad) }), withSpring(0, motion.pop)));
  }, [bump, hop, motion.pop, reduceMotion]);

  const bobStyle = useAnimatedStyle(() => {
    const wave = (bob.get() - 0.5) * 2;
    const h = hop.get();
    return {
      transform: [
        { translateY: wave * motion.buddyBobPx * (cheering ? CHEER_BOB : sleeping ? 0.4 : 1) - h * HOP_PX },
        { rotate: `${waving ? wave * WAVE_ROCK_DEG : 0}deg` },
        // Squash on take-off, stretch in the air; breathe when asleep.
        { scaleX: pop.get() * (1 - h * 0.06) },
        { scaleY: pop.get() * (1 + h * 0.08) * (sleeping ? 1 + wave * 0.02 : 1) },
      ],
    };
  });

  return (
    <View pointerEvents="none" style={[{ width: s, height }, style]} accessibilityElementsHidden importantForAccessibility="no">
      <Animated.View style={[{ width: s, height, transformOrigin: 'bottom' }, bobStyle]}>
        <Image source={POSES[mood]} style={{ width: s, height }} contentFit="fill" transition={0} cachePolicy="memory" onDisplay={onShown} />
        {/* The bow sits at the same place in every pose; only its square's top part shows on 'peek'. */}
        <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
          <Image source={BOW} tintColor={bow} style={{ width: s, height: s }} contentFit="fill" transition={0} cachePolicy="memory" />
        </View>
      </Animated.View>
    </View>
  );
});

interface SaysProps {
  text: string;
  mood?: BuddyMood;
  accent?: string;
  size?: number;
  bump?: number | string;
  style?: StyleProp<ViewStyle>;
}

/** The buddy next to a small paper speech note. Used for empty states and gentle nudges. */
export function BuddySays({ text, mood = 'wave', accent, size, bump, style }: SaysProps) {
  const theme = useTheme();
  const { colors, spacing, typography, radii, sizes } = theme;
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, style]}>
      <Buddy mood={mood} accent={accent} size={size ?? sizes.buddy} bump={bump} />
      <View
        style={{
          flex: 1,
          backgroundColor: colors.paperWhite,
          borderRadius: radii.album,
          borderBottomLeftRadius: radii.paper,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          boxShadow: theme.shadow(accent, 0.8),
          transform: [{ rotate: '-1deg' }],
        }}
      >
        <Text style={[typography.caption, { color: colors.ink }]}>{text}</Text>
      </View>
    </View>
  );
}
