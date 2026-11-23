import Ionicons from '@expo/vector-icons/Ionicons';
import { Fragment, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { tapHaptic } from '../lib/haptics';
import { control, useTheme, withAlpha } from '../theme';
import type { IconName } from './Buttons';
import { Texture } from './scrapbook/Texture';

export interface PaperTab {
  key: string;
  icon: IconName;
  label: string;
  onPress: () => void;
  /** The page you're on (or a switched-on action): it sits on the highlighter wash. */
  active?: boolean;
  /** The page's main action (save, write back): washed in this color. */
  primary?: string;
  /** Kept for callers; the bar is one paper. */
  color?: string;
  /** Icon color (e.g. the year's color for play). */
  tint?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
  /** A small count on the icon (new pages given to you). */
  badge?: number;
  /** A picture in place of the icon (the You page: your portrait), and how tall it is. Drawn once, not per ink. */
  picture?: { node: ReactNode; height: number };
}

/** The bar holds an icon over a label, so it is a little taller than a one-line control. */
const BAR_H = 60;
const ICON = 21;
/** The thread's thickness. */
/** How strong the ink is on the places you're not on (the one you're on is full ink, bold, on the wash). */
const MUTED_INK = 0.74;

/**
 * What the bar is made of: cream card paper by day; at night a deep lamp-lit strip in the paper's own dark shade with
 * light engraved ink (`theme.nav`), so the bar is as dark as the night page instead of a bright cream band.
 */
export function useBarPaper(): { bg: string; ink: string; muted: string; texture: number } {
  const theme = useTheme();
  if (theme.dark) return { bg: theme.nav.strip, ink: theme.nav.ink, muted: theme.nav.inkMuted, texture: 0.16 };
  return { bg: theme.colors.panel, ink: theme.colors.ink, muted: withAlpha(theme.colors.ink, MUTED_INK), texture: 0.5 };
}

/** Height of the bar and the gap under it (without the room for the phone's own bar). */
export const PAPER_TABS_H = BAR_H + 10;
/** On small or short windows the bar is more compact; on wide ones it stops growing and sits centred. */
const COMPACT_W = 380;
const COMPACT_H = 640;
const COMPACT_BAR_H = control.height;
const WIDE_MAX = 560;

/** The bar's size for this window: its height, icon and label size, and how wide it may get. */
export function useBarMetrics(): { barH: number; icon: number; label: number; maxW: number | undefined } {
  const { width, height } = useWindowDimensions();
  const compact = width < COMPACT_W || height < COMPACT_H;
  return { barH: compact ? COMPACT_BAR_H : BAR_H, icon: compact ? ICON - 2 : ICON, label: compact ? 11 : 13, maxW: width > WIDE_MAX + 80 ? WIDE_MAX : undefined };
}

/**
 * The bottom bar, One UI style, made exactly like every other control in the diary (`control` tokens): the same cream
 * card paper as the Settings cards and buttons, with its grain and paper shadow, stitched round just inside its edge,
 * and equal places, each a small ink drawing with a printed label. The page you're on has the same highlighter wash as
 * a chosen option; with `slide` (the pager's position) it slides along with your finger as you swipe between pages. A
 * page's main action is washed in its own color.
 */
export function PaperTabs({
  items,
  slide,
  lead,
  corner,
  center,
  centerAt = 2,
  bottomInset = 0,
  style,
}: {
  items: readonly PaperTab[];
  slide?: SharedValue<number>;
  lead?: ReactNode;
  corner?: ReactNode;
  /** A place in the middle of the bar (the round Write button), before item `centerAt`. */
  center?: ReactNode;
  centerAt?: number;
  bottomInset?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const [rowW, setRowW] = useState(0);
  const { barH, maxW } = useBarMetrics();
  const places = items.length + (center ? 1 : 0);
  const slot = places > 0 ? rowW / places : 0;
  const bar = useBarPaper();
  const hasCenter = !!center;
  // The wash follows the pages; with a middle place it glides over it between the pages either side.
  const washStyle = useAnimatedStyle(() => {
    const p = slide ? slide.get() : 0;
    const x = hasCenter ? p + Math.min(1, Math.max(0, p - (centerAt - 1))) : p;
    return { transform: [{ translateX: x * slot }, { rotate: control.washTilt }] };
  });
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.gutter, paddingTop: spacing.xs, paddingBottom: bottomInset + spacing.sm, width: maxW ? maxW + spacing.gutter * 2 : undefined, alignSelf: 'center' }, style]} pointerEvents="box-none">
      <View style={{ flex: 1, height: barH, borderRadius: control.radius, backgroundColor: bar.bg, boxShadow: theme.shadow(undefined, 1.2) }}>
        <Texture kind="paper" opacity={bar.texture} radius={control.radius} />
        <Stitches radius={control.radius} />
        <View style={{ flex: 1, flexDirection: 'row', paddingHorizontal: control.stitchInset }}>
          {lead}
          <View style={{ flex: places, flexDirection: 'row' }} onLayout={(e) => setRowW(e.nativeEvent.layout.width)}>
            {slide && slot > 0 ? (
              <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: control.washInset, top: control.washInset + 2, width: slot - control.washInset * 2, height: barH - (control.washInset + 2) * 2 }, washStyle]}>
                <Wash color={colors.gilt} edge />
              </Animated.View>
            ) : null}
            {items.map((t, i) => (
              <Fragment key={t.key}>
                {center && i === centerAt ? (
                  <View pointerEvents="box-none" style={{ flex: 1, height: barH, alignItems: 'center', justifyContent: 'center' }}>
                    {center}
                  </View>
                ) : null}
                <BarItem tab={t} index={i} slide={slide} barH={barH} />
              </Fragment>
            ))}
          </View>
        </View>
      </View>
      {corner}
    </View>
  );
}

/**
 * Hand stitches just inside an edge: a dashed waxed thread with a faint shade under each stitch. Only the You page's
 * account buttons (Back up, Disconnect…) keep it; the person liked them stitched.
 */
export function ThreadStitches({ radius = control.radius, inset = control.stitchInset }: { radius?: number; inset?: number }) {
  const { colors } = useTheme();
  return (
    <>
      <View pointerEvents="none" style={{ position: 'absolute', left: inset, right: inset, top: inset + 0.8, bottom: inset - 0.8, borderRadius: Math.max(0, radius - inset), borderWidth: THREAD, borderStyle: 'dashed', borderColor: withAlpha(colors.ink, 0.1) }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: inset, right: inset, top: inset, bottom: inset, borderRadius: Math.max(0, radius - inset), borderWidth: THREAD, borderStyle: 'dashed', borderColor: withAlpha(colors.giltBright, 0.6) }} />
    </>
  );
}
const THREAD = 1.3;
/** The tilt of a marker stroke, for the stitched account buttons. */
const MARKER_TILT = '-1.5deg';

/** A fine tooled rule just inside a control's edge (the name is kept from when it was hand stitching). */
export function Stitches({ radius = control.radius, inset = control.stitchInset, color }: { radius?: number; inset?: number; color?: string }) {
  const { colors } = useTheme();
  const line = color ?? colors.gilt;
  // Was a dashed waxed thread; now one fine tooled rule just inside the edge, like the gilt rule on the paper covers.
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: inset, right: inset, top: inset, bottom: inset, borderRadius: Math.max(0, radius - inset), borderWidth: StyleSheet.hairlineWidth * 2, borderColor: withAlpha(line, 0.45) }}
    />
  );
}

/**
 * What's chosen or what matters: a flat, quiet tint. With `edge` (the bar's page you're on) it's lighter and outlined
 * by a fine line of the same color, so it reads as a clear place rather than a dark patch under the ink.
 */
export function Wash({ color, edge = false, marker = false }: { color: string; edge?: boolean; marker?: boolean }) {
  if (marker) {
    // The old highlighter stroke: a little deeper along its foot, the way a marker leaves more ink at the end.
    return (
      <View
        style={{
          flex: 1,
          borderRadius: control.radius - control.washInset + 2,
          backgroundColor: withAlpha(color, 0.26),
          backgroundImage: `linear-gradient(180deg, ${withAlpha(color, 0)} 0%, ${withAlpha(color, 0.16)} 100%)`,
        }}
      />
    );
  }
  // A flat, quiet tint (no deeper foot, no tilt); with `edge` a fine line of the same color round it.
  return (
    <View
      style={{
        flex: 1,
        borderRadius: control.radius - control.washInset + 2,
        backgroundColor: withAlpha(color, edge ? 0.12 : 0.2),
        borderWidth: edge ? StyleSheet.hairlineWidth * 2 : 0,
        borderColor: withAlpha(color, 0.6),
      }}
    />
  );
}

/** The wash laid on inside a control, the same distance in and at the same angle everywhere. */
export function WashIn({ color, insetY = control.washInset, edge = false, marker = false }: { color: string; insetY?: number; edge?: boolean; marker?: boolean }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: control.washInset, right: control.washInset, top: insetY, bottom: insetY, transform: [{ rotate: marker ? MARKER_TILT : control.washTilt }] }}>
      <Wash color={color} edge={edge} marker={marker} />
    </View>
  );
}

function BarItem({ tab, index, slide, barH }: { tab: PaperTab; index: number; slide?: SharedValue<number>; barH: number }) {
  const theme = useTheme();
  const { colors, typography } = theme;
  // The bar's own ink (dark on cream by day, light engraving at night); the pages you're not on are a softer ink,
  // still plainly readable.
  const { ink, muted, bg } = useBarPaper();
  const on = tab.active || !!tab.primary;
  const { icon: iconSize, label: labelSize } = useBarMetrics();
  const litStyle = useAnimatedStyle(() => ({ opacity: slide ? Math.max(0, 1 - Math.abs(slide.get() - index)) : 1 }));
  // The same line drawing whether you're on the page or not (a filled one turned into a dark blob, worst at night and
  // under a badge): the page you're on is told by full ink, a bold label and its outlined wash.
  // With a picture, the lit copy (laid over the plain one while the pages slide) leaves a gap where it sits, so the
  // picture is drawn once and only the label changes ink.
  const content = (color: string, lit: boolean, overlay = false) => (
    <View style={{ alignItems: 'center', alignSelf: 'stretch' }}>
      <View>
        {tab.picture ? (
          // The picture takes an icon's room (so its label lines up with the others), sitting on the same line as the
          // icons and standing up out of the top if it's taller.
          <View style={{ height: iconSize, justifyContent: 'flex-end', alignItems: 'center' }}>
            {overlay ? null : <View style={{ marginTop: iconSize - tab.picture.height }}>{tab.picture.node}</View>}
          </View>
        ) : (
          <Ionicons name={tab.icon} size={iconSize} color={tab.tint && !tab.primary ? tab.tint : color} />
        )}
        {tab.badge ? (
          <View style={{ position: 'absolute', top: -5, right: -11, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.sepia, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: bg }}>
            <Text style={{ color: colors.paperWhite, fontSize: 10, lineHeight: 12, fontWeight: '700' }}>{tab.badge > 9 ? '9+' : tab.badge}</Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} style={[typography.small, { color, fontSize: labelSize, lineHeight: labelSize + 3, marginTop: 3, alignSelf: 'stretch', textAlign: 'center', fontWeight: lit ? '700' : '600', paddingRight: 0, letterSpacing: 0.3 }]}>
        {tab.label}
      </Text>
    </View>
  );
  return (
    <Pressable
      onPress={() => {
        tapHaptic();
        tab.onPress();
      }}
      disabled={tab.disabled}
      accessibilityRole="button"
      accessibilityLabel={tab.accessibilityLabel ?? tab.label}
      accessibilityState={{ selected: tab.active, disabled: tab.disabled }}
      style={({ pressed }) => ({ flex: 1, height: barH, alignItems: 'center', justifyContent: 'center', opacity: tab.disabled ? 0.4 : pressed ? 0.6 : 1 })}
    >
      {!slide && on ? <WashIn color={tab.primary ?? colors.gilt} insetY={control.washInset + 2} edge={!tab.primary} /> : null}
      {slide ? (
        <>
          {content(muted, false)}
          <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, litStyle]}>{content(ink, true, true)}</Animated.View>
        </>
      ) : (
        content(on ? ink : muted, on)
      )}
    </Pressable>
  );
}
