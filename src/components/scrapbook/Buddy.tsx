import { Image, type ImageRef } from 'expo-image';
import { memo, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { selectHaptic } from '../../lib/haptics';
import { useTheme } from '../../theme';
import { usePageActive } from '../PageActive';
import { Cassette } from './Cassette';
import { Raster } from './Raster';

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
  /** Tap it and it squishes, hops and blinks (off where a tap must reach something under it, e.g. the intro). */
  tappable?: boolean;
  /** The old cream bunny sticker instead of the gilt emblem (only the intro, which must match the splash screen). */
  classic?: boolean;
  /** The square app icon instead of the cassette (the intro, which must match the splash screen exactly). */
  icon?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * The bunny's poses, pre-rendered by scripts/make-icons.mjs from the same shapes as the app icon and
 * splash (soft shading, die-cut sticker edge). Showing a picture costs a fraction of drawing ~40
 * blurred layers live, which kept screens with a bunny from scrolling smoothly. The bow is a separate
 * white picture tinted with the year's color. Re-run the script after changing the bunny's look.
 */
export const POSES: Record<BuddyMood, number> = {
  happy: require('../../../assets/buddy/happy.png'),
  wave: require('../../../assets/buddy/wave.png'),
  sleepy: require('../../../assets/buddy/sleepy.png'),
  cheer: require('../../../assets/buddy/cheer.png'),
  peek: require('../../../assets/buddy/peek.png'),
};
export const BOW: number = require('../../../assets/buddy/bow.png');
/** The open-eyed poses mid-blink, laid over the pose for a moment. */
const BLINKS: Partial<Record<BuddyMood, number>> = {
  happy: require('../../../assets/buddy/happy-blink.png'),
  wave: require('../../../assets/buddy/wave-blink.png'),
  peek: require('../../../assets/buddy/peek-blink.png'),
};

/** Decodes every pose ahead of time, so a bunny never appears a frame late. Call once at startup. */
export function preloadBuddy(): Promise<ImageRef[]> {
  // The stamp first: the intro shows it in the very first frame, in the splash's place.
  return Promise.all([STAMP, ...Object.values(POSES), ...Object.values(BLINKS), BOW].map((source) => Image.loadAsync(source)));
}

/** `peek` only shows the ears, eyes and paws, as if looking over an edge (its picture is the top 68%). */
export const PEEK_SHARE = 0.68;
const HOP_PX = 12;
const HOP_MS = 130;
const WAVE_ROCK_DEG = 5;
const CHEER_BOB = 2.4;
const POP_FROM = 0.4;
/** Blinks come every BLINK_MIN_MS + up to BLINK_SPREAD_MS, sometimes twice; the lids stay shut BLINK_HOLD_MS. */
const BLINK_MIN_MS = 2200;
const BLINK_SPREAD_MS = 3800;
const BLINK_HOLD_MS = 90;
const DOUBLE_BLINK = 0.25;
/** Breathing: how much it fills out and settles with each bob. */
const BREATH = 0.014;
/** Now and then it tilts its head, curious, and back. */
const TILT_DEG = 4;
const TILT_MIN_MS = 5000;
const TILT_SPREAD_MS = 4000;
/** A tap squishes it (and it springs back up with a hop). */
const SQUISH = 0.12;

/** The stamp: gilt rings, LOOKBACK over the top and a mixtape at its heart (scripts/make-icons.mjs → assets/stamp.png). */
export const STAMP: number = require('../../../assets/stamp.png');
const STAMP_PRESS = 0.95;
/** A cassette is 100 × 63; tapped, its reels turn this long. */
const CASSETTE_RATIO = 0.63;
const SPIN_FOR_MS = 2400;

/**
 * The diary's mark: a round postmark tooled in gilt into the leather, "LOOKBACK" around the top and a mixtape
 * at its heart: what you say or write here is kept, and played back to you a year on. It sits still, fades in when it appears and gives a small press when `bump` changes or it is tapped.
 * It takes the old bunny's place and size, so every page that had one keeps its layout.
 */
const Emblem = memo(function Emblem({ mood = 'happy', size, bump, entrance = true, onShown, tappable = false, icon = false, style }: Props) {
  const theme = useTheme();
  const { sizes, motion } = theme;
  const s = size ?? sizes.buddy;
  const reduceMotion = useReducedMotion();
  const height = mood === 'peek' ? s * PEEK_SHARE : s;
  const d = Math.min(s, height);
  const fade = useSharedValue(reduceMotion || !entrance ? 1 : 0);
  const press = useSharedValue(0);
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    onShown?.();
    // Only once, when it first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (reduceMotion || !entrance) return;
    fade.set(withTiming(1, { duration: motion.imageFadeMs * 2 }));
  }, [fade, entrance, reduceMotion, motion.imageFadeMs]);
  useEffect(() => {
    if (reduceMotion || bump === undefined) return;
    press.set(withSequence(withTiming(1, { duration: 90 }), withSpring(0, motion.buttonRelease)));
  }, [bump, press, reduceMotion, motion.buttonRelease]);
  // A tap plays the tape for a moment: the reels turn, then stop.
  useEffect(() => {
    if (!spinning) return;
    const t = setTimeout(() => setSpinning(false), SPIN_FOR_MS);
    return () => clearTimeout(t);
  }, [spinning]);

  const animStyle = useAnimatedStyle(() => ({ opacity: fade.get(), transform: [{ scale: 1 - press.get() * (1 - STAMP_PRESS) }] }));
  const mark = icon ? (
    <Animated.View style={[{ width: d, height: d }, animStyle]}>
      <Image source={STAMP} style={{ width: d, height: d }} contentFit="contain" transition={0} cachePolicy="memory" />
    </Animated.View>
  ) : (
    // A real cassette, lying a little crooked like it was put down on the page.
    <Animated.View style={[{ transform: [{ rotate: '-4deg' }] }, animStyle]}>
      <Cassette width={s} title="LookBack" detail="C·365" spinning={spinning} />
    </Animated.View>
  );
  const box = [{ width: s, height: icon ? height : s * CASSETTE_RATIO, alignItems: 'center' as const, justifyContent: 'center' as const }, style];
  if (tappable) {
    return (
      <Pressable
        onPress={() => {
          selectHaptic();
          if (!reduceMotion) press.set(withSequence(withTiming(1, { duration: 90 }), withSpring(0, motion.buttonRelease)));
          setSpinning(true);
        }}
        style={box}
        accessibilityRole="button"
        accessibilityLabel="LookBack cassette"
        accessibilityHint="Plays the tape for a moment"
        hitSlop={sizes.hitSlop}
      >
        {mark}
      </Pressable>
    );
  }
  return (
    <View pointerEvents="none" style={box} accessibilityElementsHidden importantForAccessibility="no">
      {mark}
    </View>
  );
});

/** The diary's stamp everywhere; the classic cream bunny only where asked (the intro). */
export const Buddy = memo(function Buddy(props: Props) {
  return props.classic ? <ClassicBuddy {...props} /> : <Emblem {...props} />;
});

/**
 * The classic buddy: a small, soft cream bunny sticker. It is alive: it pops in when it appears, bobs (rocking
 * when it waves, bouncing when it cheers, breathing slowly when asleep), and hops whenever `bump` changes. With
 * "reduce motion" on it holds still. Now only the intro uses it, to match the splash screen.
 */
const ClassicBuddy = memo(function ClassicBuddy({ mood = 'happy', size, accent, bump, entrance = true, onShown, tappable = false, style }: Props) {
  const theme = useTheme();
  const { colors, sizes, motion } = theme;
  const s = size ?? sizes.buddy;
  const reduceMotion = useReducedMotion();
  // Holds still while its page is hidden (the bar's pages stay built behind the visible one).
  const active = usePageActive();
  const bob = useSharedValue(0);
  const pop = useSharedValue(reduceMotion || !entrance ? 1 : POP_FROM);
  const hop = useSharedValue(0);
  const blink = useSharedValue(0);
  const tilt = useSharedValue(0);
  const squish = useSharedValue(0);
  const bow = accent ?? colors.amber;
  const peek = mood === 'peek';
  const height = peek ? s * PEEK_SHARE : s;
  const blinkPose = BLINKS[mood];

  const cheering = mood === 'cheer';
  const waving = mood === 'wave';
  const sleeping = mood === 'sleepy';

  useEffect(() => {
    if (reduceMotion) return;
    if (!active) {
      cancelAnimation(bob);
      return;
    }
    const duration = cheering ? motion.buddyBobMs / 4 : sleeping ? motion.buddyBobMs * 1.6 : motion.buddyBobMs;
    bob.set(0);
    bob.set(withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [bob, cheering, sleeping, motion.buddyBobMs, reduceMotion, active]);

  // It blinks every few seconds (now and then twice), like something alive.
  useEffect(() => {
    if (reduceMotion || !active || !blinkPose) return;
    let timer: ReturnType<typeof setTimeout>;
    const shut = () => withSequence(withTiming(1, { duration: 40 }), withDelay(BLINK_HOLD_MS, withTiming(0, { duration: 70 })));
    const next = () => {
      timer = setTimeout(() => {
        blink.set(Math.random() < DOUBLE_BLINK ? withSequence(shut(), withDelay(110, shut())) : shut());
        next();
      }, BLINK_MIN_MS + Math.random() * BLINK_SPREAD_MS);
    };
    next();
    return () => clearTimeout(timer);
  }, [blink, blinkPose, reduceMotion, active]);

  // Now and then a curious little head tilt, one way or the other, and back.
  useEffect(() => {
    if (reduceMotion || !active || waving || cheering) return;
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      timer = setTimeout(() => {
        const dir = Math.random() < 0.5 ? -1 : 1;
        tilt.set(
          withSequence(
            withTiming(dir * TILT_DEG, { duration: 420, easing: Easing.out(Easing.cubic) }),
            withDelay(700, withTiming(0, { duration: 520, easing: Easing.inOut(Easing.cubic) })),
          ),
        );
        next();
      }, TILT_MIN_MS + Math.random() * TILT_SPREAD_MS);
    };
    next();
    return () => clearTimeout(timer);
  }, [tilt, reduceMotion, active, waving, cheering]);

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

  const onTap = () => {
    selectHaptic();
    if (reduceMotion) return;
    // Squish down under the finger, spring back up into a little hop, and blink twice.
    squish.set(withSequence(withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) }), withSpring(0, motion.pop)));
    hop.set(withDelay(90, withSequence(withTiming(1, { duration: HOP_MS, easing: Easing.out(Easing.quad) }), withSpring(0, motion.pop))));
    if (blinkPose) blink.set(withSequence(withTiming(1, { duration: 40 }), withDelay(80, withTiming(0, { duration: 60 })), withDelay(90, withTiming(1, { duration: 40 })), withDelay(80, withTiming(0, { duration: 70 }))));
  };

  const bobStyle = useAnimatedStyle(() => {
    const wave = (bob.get() - 0.5) * 2;
    const h = hop.get();
    const q = squish.get();
    // Breathing: it fills out a touch as it rises and settles as it sinks.
    const breath = sleeping ? 0.02 : BREATH;
    return {
      transform: [
        { translateY: wave * motion.buddyBobPx * (cheering ? CHEER_BOB : sleeping ? 0.4 : 1) - h * HOP_PX },
        { rotate: `${(waving ? wave * WAVE_ROCK_DEG : 0) + tilt.get()}deg` },
        // Squash on take-off, stretch in the air; squish when tapped; breathe.
        { scaleX: pop.get() * (1 - h * 0.06) * (1 + q * SQUISH) * (1 - wave * breath * 0.6) },
        { scaleY: pop.get() * (1 + h * 0.08) * (1 - q * SQUISH) * (1 + wave * breath) },
      ],
    };
  });
  const blinkStyle = useAnimatedStyle(() => ({ opacity: blink.get() }));

  const picture = (
    <Animated.View style={[{ width: s, height, transformOrigin: 'bottom' }, bobStyle]}>
      <Image source={POSES[mood]} style={{ width: s, height }} contentFit="fill" transition={0} cachePolicy="memory" onDisplay={onShown} />
      {blinkPose ? (
        <Animated.View style={[StyleSheet.absoluteFill, blinkStyle]}>
          <Image source={blinkPose} style={{ width: s, height }} contentFit="fill" transition={0} cachePolicy="memory" />
        </Animated.View>
      ) : null}
      {/* The bow sits at the same place in every pose; only its square's top part shows on 'peek'. */}
      <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
        <Image source={BOW} tintColor={bow} style={{ width: s, height: s }} contentFit="fill" transition={0} cachePolicy="memory" />
      </View>
    </Animated.View>
  );

  if (tappable) {
    return (
      <Pressable onPress={onTap} style={[{ width: s, height }, style]} accessibilityRole="button" accessibilityLabel="The bunny" hitSlop={sizes.hitSlop}>
        {picture}
      </Pressable>
    );
  }
  return (
    <View pointerEvents="none" style={[{ width: s, height }, style]} accessibilityElementsHidden importantForAccessibility="no">
      {picture}
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
  const { colors, spacing, typography, sizes } = theme;
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }, style]}>
      <Buddy mood={mood} accent={accent} size={(size ?? sizes.buddy) * 0.8} bump={bump} tappable />
      {/* A slip of diary paper with a printed note. A texture: its shadow is drawn once. */}
      <Raster style={{ flex: 1 }}>
        <View
          style={{
            backgroundColor: colors.paper,
            borderTopLeftRadius: 2,
            borderBottomLeftRadius: 2,
            borderTopRightRadius: 6,
            borderBottomRightRadius: 6,
            paddingLeft: spacing.xl,
            paddingRight: spacing.lg,
            paddingVertical: spacing.md,
            boxShadow: theme.shadow(undefined, 0.8),
          }}
        >
          <View style={{ position: 'absolute', left: spacing.md, top: 0, bottom: 0, width: StyleSheet.hairlineWidth * 2, backgroundColor: colors.marginLine }} />
          <Text style={[typography.caption, { color: colors.ink }]}>{text}</Text>
        </View>
      </Raster>
    </View>
  );
}
