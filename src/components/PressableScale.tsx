import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { tapHaptic } from '../lib/haptics';
import { useTheme } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  haptic?: boolean;
}

/**
 * Pressable with a gentle spring scale and a light haptic tap.
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
        scale.set(withSpring(motion.pressedScale, motion.press));
      }}
      onPressOut={() => {
        scale.set(withSpring(1, motion.press));
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
