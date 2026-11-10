import { memo, useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme';
import { shapeShadow } from './shared';

const CLIP_PATH =
  'M 7 40 L 7 9 A 5 5 0 0 1 17 9 L 17 36 A 3 3 0 0 1 11 36 L 11 12';

/** Metal paper clip. Sways very slightly when `sway` is on (respects reduce motion). */
export const PaperClip = memo(function PaperClip({
  sway = false,
  style,
}: {
  sway?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const { sizes, colors, motion } = theme;
  const reduceMotion = useReducedMotion();
  const angle = useSharedValue(0);

  useEffect(() => {
    if (!sway || reduceMotion) return;
    angle.set(
      withRepeat(
        withTiming(1, { duration: motion.swayMs, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, [angle, motion.swayMs, reduceMotion, sway]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(angle.get() * 2 - 1) * motion.swayDeg}deg` }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ width: sizes.clipWidth * 1.4, height: sizes.clipHeight, transformOrigin: 'top' }, animatedStyle, style]}
    >
      <View style={shapeShadow(theme, colors.metalLight, false)}>
        <Svg width={sizes.clipWidth * 1.4} height={sizes.clipHeight} viewBox="0 0 24 46">
          <Path d={CLIP_PATH} stroke={colors.metal} strokeWidth={2.6} fill="none" strokeLinecap="round" />
          <Path d={CLIP_PATH} stroke={colors.metalLight} strokeWidth={1} fill="none" strokeLinecap="round" opacity={0.9} />
        </Svg>
      </View>
    </Animated.View>
  );
});
