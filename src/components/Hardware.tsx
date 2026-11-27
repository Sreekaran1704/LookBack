import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { pressHaptic, toggleHaptic } from '../lib/haptics';
import { control, useTheme, withAlpha } from '../theme';
import type { IconName } from './Buttons';
import { ThreadStitches, WashIn } from './PaperTabs';

/**
 * Controls made the same way as the paper covers: fine ink and gilt lines, solid ink for what is chosen or main,
 * thin line drawings and printed labels. (They sit on paper cards, so they use the ink
 * colors.) The names are kept from when these were hardware, so callers carry on.
 */

export interface SwitchOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}


/** The two-way switch's track: recessed into the card, with a solid ink thumb inset from its edge. */
const SWITCH_INSET = 3;

/**
 * A choice between two (Day · Night), made quiet like the paper samples above it: a track pressed into the card (a
 * faint ink tint, a hairline edge, an inner shadow) and a solid ink thumb that slides under the chosen one, its label in
 * the card's paper color. No stitching, wash or tilt. Tap either to choose it.
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
  const half = (w - SWITCH_INSET * 2) / 2;
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: at.get() * half }] }));
  const radius = control.radius;
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessibilityRole="radiogroup"
      style={[
        styles.track,
        {
          borderRadius: radius,
          backgroundColor: withAlpha(colors.ink, 0.06),
          borderColor: withAlpha(colors.ink, 0.16),
          boxShadow: `inset 0px 1px 3px ${withAlpha(colors.ink, 0.14)}`,
        },
      ]}
    >
      {w > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: SWITCH_INSET,
              top: SWITCH_INSET,
              bottom: SWITCH_INSET,
              width: half,
              borderRadius: Math.max(2, radius - SWITCH_INSET),
              backgroundColor: colors.ink,
              boxShadow: `0px 1px 2px ${withAlpha(colors.ink, 0.35)}`,
            },
            thumbStyle,
          ]}
        />
      ) : null}
      {options.map((o, i) => {
        const chosen = i === on;
        const ink = chosen ? colors.panel : withAlpha(colors.ink, 0.55);
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
            {o.icon ? <Ionicons name={o.icon} size={16} color={ink} /> : null}
            <Text style={[typography.label, { color: ink, fontSize: 17, lineHeight: 21, paddingRight: 0 }]}>{`${o.label} `}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * A thing to do: a printed label and a small ink drawing in a stitched frame. The main one sits on a highlighter
 * wash; one that takes something away is in red ink on a red wash. (Kept stitched: the person preferred these.)
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
      <ThreadStitches />
      {wash ? <WashIn color={wash} marker /> : null}
      <View style={styles.place}>
        {icon ? <Ionicons name={icon} size={18} color={ink} /> : null}
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[typography.small, { flexShrink: 1, color: ink, fontSize: 15, lineHeight: 19, fontWeight: '700', paddingRight: 0 }]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { height: control.height, flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth * 2 },
  frame: { height: control.height, borderRadius: control.radius, flexDirection: 'row', alignItems: 'center', boxShadow: '0px 1px 3px rgba(60,40,20,0.2)' },
  place: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, alignSelf: 'stretch' },
});
