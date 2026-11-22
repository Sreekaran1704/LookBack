import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { pressHaptic, toggleHaptic } from '../lib/haptics';
import { control, useTheme, withAlpha } from '../theme';
import type { IconName } from './Buttons';
import { Stitches, Wash, WashIn } from './PaperTabs';

/**
 * Controls made the same way as the bottom bar: stitched round in waxed thread, a highlighter wash behind
 * what's chosen or what matters, small ink drawings and printed labels. (They sit on paper cards, so they use the ink
 * colors.) The names are kept from when these were hardware, so callers carry on.
 */

export interface SwitchOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}


/**
 * A choice between two (Day · Night): both written in a stitched frame, the chosen one on a highlighter wash that
 * slides across when you change it. Tap either to choose it.
 */
export function SlideSwitch<T extends string>({ options, value, onChange }: { options: readonly [SwitchOption<T>, SwitchOption<T>]; value: T; onChange: (value: T) => void }) {
  const { typography, colors, motion } = useTheme();
  const reduceMotion = useReducedMotion();
  const [w, setW] = useState(0);
  const on = options[1].value === value ? 1 : 0;
  const at = useSharedValue(on);
  useEffect(() => {
    at.set(reduceMotion ? withTiming(on, { duration: 0 }) : withSpring(on, motion.lift));
  }, [on, at, reduceMotion, motion.lift]);
  const half = w / 2;
  const washStyle = useAnimatedStyle(() => ({ transform: [{ translateX: at.get() * half }, { rotate: control.washTilt }] }));
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={[styles.frame, { backgroundColor: colors.panel }]} accessibilityRole="radiogroup">
      <Stitches />
      {w > 0 ? (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: control.washInset, top: control.washInset, width: half - control.washInset * 2, bottom: control.washInset }, washStyle]}>
          <Wash color={colors.gilt} />
        </Animated.View>
      ) : null}
      {options.map((o, i) => {
        const chosen = i === on;
        const ink = chosen ? colors.ink : withAlpha(colors.ink, 0.5);
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              if (chosen) return;
              toggleHaptic(i === 1);
              onChange(o.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: chosen }}
            accessibilityLabel={o.label}
            style={styles.place}
          >
            {o.icon ? <Ionicons name={chosen ? (o.icon.replace('-outline', '') as IconName) : o.icon} size={18} color={ink} /> : null}
            <Text style={[typography.small, { color: ink, fontSize: 15, lineHeight: 19, fontWeight: chosen ? '700' : '400', paddingRight: 0 }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * A thing to do: a printed label and a small ink drawing in a stitched frame. The main one sits on a highlighter
 * wash; one that takes something away is in red ink on a red wash.
 */
export function HardwareButton({ label, icon, onPress, tone = 'plain', disabled = false, grow = false }: { label: string; icon?: IconName; onPress: () => void; tone?: 'plain' | 'primary' | 'danger'; disabled?: boolean; grow?: boolean }) {
  const { typography, colors } = useTheme();
  const ink = tone === 'danger' ? colors.wax : colors.ink;
  const wash = tone === 'primary' ? colors.gilt : tone === 'danger' ? colors.wax : null;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressHaptic}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.frame, { flex: grow ? 1 : undefined, backgroundColor: colors.panel, opacity: disabled ? 0.45 : pressed ? 0.6 : 1, paddingHorizontal: 14, transform: [{ translateY: pressed ? 1 : 0 }] }]}
    >
      <Stitches />
      {wash ? <WashIn color={wash} /> : null}
      <View style={styles.place}>
        {icon ? <Ionicons name={icon} size={18} color={ink} /> : null}
        <Text numberOfLines={1} style={[typography.small, { flexShrink: 1, color: ink, fontSize: 15, lineHeight: 19, fontWeight: '700', paddingRight: 0 }]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: { height: control.height, borderRadius: control.radius, flexDirection: 'row', alignItems: 'center', boxShadow: '0px 1px 3px rgba(60,40,20,0.2)' },
  place: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, alignSelf: 'stretch' },
});
