import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { selectHaptic } from '../lib/haptics';
import { PORTRAIT_OPTIONS, PORTRAIT_SECTIONS, type Portrait, type PortraitPart } from '../lib/portrait';
import { useTheme, withAlpha } from '../theme';
import { PressableScale } from './PressableScale';
import { Panel } from './Screen';
import { PORTRAIT_SWATCHES } from './scrapbook/FilmPortrait';

const SWATCH = 30;

/**
 * The portrait maker's choices on a paper card: one sideways row per part (skin, face, build, hair…), every option
 * open to everyone. Used by the portrait page and the first run's portrait step.
 */
export function PortraitChoices({ value, onChange }: { value: Portrait; onChange: (next: Portrait) => void }) {
  return (
    <Panel>
      {PORTRAIT_SECTIONS.map(({ part, label, swatch }) => (
        <OptionRow
          key={part}
          part={part}
          label={label}
          swatch={!!swatch}
          value={value[part]}
          onPick={(i) => {
            selectHaptic();
            onChange({ ...value, [part]: i });
          }}
        />
      ))}
    </Panel>
  );
}

/**
 * One part's choices as a sideways row. It keeps its chosen option in view: placed there when it opens, and slid
 * to it when it changes (Surprise me) and is off to one side.
 */
function OptionRow({ part, label, swatch, value, onPick }: { part: PortraitPart; label: string; swatch: boolean; value: number; onPick: (i: number) => void }) {
  const { colors, spacing, typography } = useTheme();
  const scroller = useRef<ScrollViewInstance>(null);
  const items = useRef<{ x: number; w: number }[]>([]);
  const view = useRef({ x: 0, w: 0 });
  const placed = useRef(false);
  const reveal = (animated: boolean) => {
    const item = items.current[value];
    const { x, w } = view.current;
    if (!item || !w) return;
    if (item.x >= x && item.x + item.w <= x + w) return;
    scroller.current?.scrollTo({ x: Math.max(0, item.x - spacing.lg), animated });
  };
  useEffect(() => {
    if (placed.current) reveal(true);
    // Only when the choice changes; `reveal` reads the latest positions from refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <View style={{ paddingVertical: spacing.xs }}>
      <Text style={[typography.caption, { color: colors.inkMuted }]}>{label}</Text>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={32}
        onScroll={(e) => {
          view.current.x = e.nativeEvent.contentOffset.x;
        }}
        onLayout={(e) => {
          view.current.w = e.nativeEvent.layout.width;
        }}
        contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm, paddingRight: spacing.lg }}
      >
        {PORTRAIT_OPTIONS[part].map((option, i) => {
          const chosen = value === i;
          const color = swatch ? PORTRAIT_SWATCHES[part]?.[i] : undefined;
          return (
            <PressableScale
              key={option}
              onPress={() => onPick(i)}
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                items.current[i] = { x, w: width };
                if (i === value && !placed.current) {
                  placed.current = true;
                  requestAnimationFrame(() => reveal(false));
                }
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: chosen }}
              accessibilityLabel={`${label} ${option}`}
            >
              {color ? (
                <View style={[styles.swatchRing, { borderColor: chosen ? colors.ink : 'transparent' }]}>
                  <View style={[styles.swatch, { backgroundColor: color, borderColor: withAlpha(colors.ink, 0.25) }]} />
                </View>
              ) : (
                <View style={[styles.chip, { backgroundColor: chosen ? colors.ink : 'transparent', borderColor: chosen ? colors.ink : withAlpha(colors.ink, 0.3) }]}>
                  <Text numberOfLines={1} style={[typography.label, { color: chosen ? colors.panel : colors.ink, fontSize: 16, lineHeight: 20, paddingRight: 0 }]}>
                    {`${option} `}
                  </Text>
                </View>
              )}
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { height: 38, paddingHorizontal: 14, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth * 2, alignItems: 'center', justifyContent: 'center' },
  swatchRing: { padding: 3, borderRadius: SWATCH, borderWidth: 1.5 },
  swatch: { width: SWATCH, height: SWATCH, borderRadius: SWATCH / 2, borderWidth: StyleSheet.hairlineWidth * 2 },
});

