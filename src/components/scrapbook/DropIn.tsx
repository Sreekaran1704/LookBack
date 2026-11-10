import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';

const SETTLE_EXTRA_DEG = 8;

/**
 * Objects drop onto the page one by one: fall from above, rotation settles, tiny bounce.
 * Only the first `dropMaxAnimated` items animate (caps simultaneous animations); with
 * "reduce motion" on, items simply fade in.
 */
export function DropIn({ index, children, style }: { index: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { motion } = useTheme();
  const reduceMotion = useReducedMotion();
  const animate = index < motion.dropMaxAnimated;
  const progress = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    if (!animate) return;
    const delay = index * motion.dropStaggerMs;
    progress.set(
      withDelay(delay, reduceMotion ? withTiming(1, { duration: motion.imageFadeMs }) : withSpring(1, motion.drop)),
    );
  }, [animate, index, motion.drop, motion.dropStaggerMs, motion.imageFadeMs, progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.get();
    if (reduceMotion) return { opacity: p };
    return {
      opacity: Math.min(1, p * 2),
      transform: [{ translateY: (1 - p) * motion.dropFromY }, { rotate: `${(1 - p) * SETTLE_EXTRA_DEG}deg` }],
    };
  });

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
