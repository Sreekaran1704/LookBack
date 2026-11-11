import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { tapHaptic } from '../lib/haptics';
import { PAPERS, useTheme, type Paper, type PaperTone } from '../theme';
import type { IconName } from './Buttons';
import { PressableScale } from './PressableScale';

export interface ToggleOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

/**
 * A paper track with a colored tab that slides to the chosen side ("Note | Photo", "Light | Dark").
 * The tab springs across; with reduce motion it just moves.
 */
export function SlidingToggle<T extends string>({
  options,
  value,
  onChange,
  accent,
}: {
  options: readonly ToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accent?: string;
}) {
  const theme = useTheme();
  const { colors, spacing, radii, typography, sizes, motion } = theme;
  const reduceMotion = useReducedMotion();
  const [w, setW] = useState(0);
  // A value that isn't one of the options (nothing chosen yet) shows no tab.
  const found = options.findIndex((o) => o.value === value);
  const index = Math.max(0, found);
  const at = useSharedValue(index);
  useEffect(() => {
    at.set(reduceMotion ? withTiming(index, { duration: 0 }) : withSpring(index, motion.lift));
  }, [index, at, reduceMotion, motion.lift]);
  const pad = spacing.xs;
  const tabW = w > 0 ? (w - pad * 2) / options.length : 0;
  const tabStyle = useAnimatedStyle(() => ({ transform: [{ translateX: at.get() * tabW }] }));
  const fill = accent ?? colors.primary;

  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessibilityRole="radiogroup"
      style={[styles.track, { padding: pad, borderRadius: radii.pill, backgroundColor: colors.paperWhite, boxShadow: theme.shadow(undefined, 0.6) }]}
    >
      {tabW > 0 && found >= 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', left: pad, top: pad, bottom: pad, width: tabW, borderRadius: radii.pill, backgroundColor: fill }, tabStyle]}
        />
      ) : null}
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <PressableScale
            key={o.value}
            onPress={() => {
              tapHaptic();
              onChange(o.value);
            }}
            haptic={false}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            style={[styles.option, { minHeight: sizes.pillHeight, gap: spacing.sm }]}
          >
            {o.icon ? <Ionicons name={o.icon} size={sizes.iconSmall + 2} color={selected ? colors.paperWhite : colors.inkMuted} /> : null}
            {/* Extra room on the right: Android under-measures Caveat and clips the last letter of a short label ("Ligh"). */}
            <Text numberOfLines={1} textBreakStrategy="simple" style={[typography.label, { color: selected ? colors.paperWhite : colors.inkMuted, paddingRight: spacing.md }]}>
              {/* A trailing space: Android under-measures Caveat and clips the last letter of a short label ("Ligh"). */}
              {`${o.label} `}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** A little square of each paper color (in the chosen tone), dotted like the page. The chosen one is lifted and checked. */
export function PaperPicker({ value, tone, onChange }: { value: string; tone: PaperTone; onChange: (paper: string) => void }) {
  const { spacing } = useTheme();
  return (
    <View style={[styles.wrap, { gap: spacing.md }]}>
      {PAPERS.map((p) => (
        <PaperChip key={p.name} paper={p} tone={tone} selected={p.name === value} onPress={() => onChange(p.name)} />
      ))}
    </View>
  );
}

const DOTS = 3;

function PaperChip({ paper, tone, selected, onPress }: { paper: Paper; tone: PaperTone; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  const { colors, sizes, radii, typography, spacing } = theme;
  const s = sizes.paperChip;
  const dark = tone === 'dark';
  const gap = s / (DOTS + 1);
  return (
    <PressableScale onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={`${paper.label} paper`}>
      <View style={{ alignItems: 'center', gap: spacing.xxs, width: s + spacing.sm }}>
        <View
          style={{
            width: s,
            height: s,
            borderRadius: radii.paper * 2,
            backgroundColor: dark ? paper.dark : paper.light,
            borderWidth: selected ? 3 : 1,
            borderColor: selected ? colors.ink : colors.inkFaint,
            boxShadow: theme.shadow(undefined, selected ? 1.2 : 0.5),
            transform: [{ rotate: selected ? '-4deg' : '0deg' }, { scale: selected ? 1.06 : 1 }],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Svg width={s} height={s} style={StyleSheet.absoluteFill}>
            {Array.from({ length: DOTS * DOTS }, (_, i) => (
              <Circle key={i} cx={gap * ((i % DOTS) + 1)} cy={gap * (Math.floor(i / DOTS) + 1)} r={1.6} fill={dark ? colors.paperWhite : paper.dots} opacity={0.5} />
            ))}
          </Svg>
          {selected ? (
            <View style={[styles.check, { backgroundColor: colors.green, borderColor: colors.paperWhite }]}>
              <Ionicons name="checkmark" size={sizes.iconSmall} color={colors.onGreen} />
            </View>
          ) : null}
        </View>
        {/* Full width + centred: a shrink-wrapped Caveat label gets under-measured on Android. */}
        <Text numberOfLines={1} style={[typography.small, { alignSelf: 'stretch', textAlign: 'center', color: colors.ink, paddingRight: 0 }]}>
          {paper.label}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', alignItems: 'center' },
  option: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  check: { position: 'absolute', right: -8, top: -8, width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
