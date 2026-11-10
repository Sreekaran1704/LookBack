import Ionicons from '@expo/vector-icons/Ionicons';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

interface StatusPillApi {
  show: (message: string) => void;
}

const StatusPillContext = createContext<StatusPillApi>({ show: () => undefined });

export function useStatusPill(): StatusPillApi {
  return useContext(StatusPillContext);
}

/** Floating green "saved" pill at the bottom of the screen, shown briefly. */
export function StatusPillProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const { colors, spacing, radii, typography, motion, sizes } = theme;
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const visible = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (next: string) => {
      setMessage(next);
      visible.set(withSpring(1, motion.pop));
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        visible.set(withSpring(0, motion.gentle));
      }, motion.statusPillVisibleMs);
    },
    [motion, visible],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, visible.get()),
    transform: [{ translateY: (1 - visible.get()) * motion.statusPillOffset }, { scale: 0.9 + 0.1 * visible.get() }],
  }));

  const api = useMemo(() => ({ show }), [show]);

  return (
    <StatusPillContext.Provider value={api}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[styles.host, { bottom: insets.bottom + spacing.lg }, animatedStyle]}
        accessibilityLiveRegion="polite"
      >
        {message ? (
          <View
            style={[
              styles.pill,
              {
                borderRadius: radii.pill,
                paddingHorizontal: spacing.gutter,
                minHeight: sizes.pillHeight,
                gap: spacing.sm,
                backgroundColor: colors.green,
                boxShadow: theme.shadow(colors.green, 1),
              },
            ]}
          >
            <Ionicons name="checkmark-circle" size={sizes.icon} color={colors.onGreen} />
            <Text style={[typography.label, { color: colors.onGreen }]}>{message}</Text>
          </View>
        ) : null}
      </Animated.View>
    </StatusPillContext.Provider>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center' },
});
