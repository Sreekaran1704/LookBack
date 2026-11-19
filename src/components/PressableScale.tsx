import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { tapHaptic } from '../lib/haptics';
import { useTheme } from '../theme';
import { EASE_OUT } from './transitions';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  haptic?: boolean;
}

/**
 * A button's press: it dips a little under the finger right away and eases back without a bounce, with a
 * light haptic tap (the same feel on every button in the app).
 * The style goes on the pressable itself, so layout styles (absoluteFill, width…) size the touch area too.
 */
export function PressableScale({ style, children, haptic = true, onPress, disabled, ...rest }: Props) {
  const { motion, opacity } = useTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      style={[style, animatedStyle, disabled ? { opacity: opacity.disabled } : null]}
      onPressIn={() => {
        scale.set(withTiming(motion.buttonPressScale, { duration: motion.buttonPressInMs, easing: EASE_OUT }));
      }}
      onPressOut={() => {
        scale.set(withSpring(1, motion.buttonRelease));
      }}
      onPress={(event) => {
        if (haptic) tapHaptic();
        onPress?.(event);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
