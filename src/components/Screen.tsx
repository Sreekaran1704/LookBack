import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { mixHex, useTheme, withAlpha } from '../theme';
import { Texture } from './scrapbook/Texture';
import { PaperTabs, Stitches, WashIn } from './PaperTabs';
import { Raster } from './scrapbook/Raster';
import type { IconName } from './Buttons';
import { PressableScale } from './PressableScale';
import { useNavBarSpace } from './NavBar';
import { Buddy, type BuddyMood } from './scrapbook/Buddy';

const FLOWER = '✿';
/** The emblem beside a page's title is at most this big. */
const EMBLEM_MAX = 0.78;
/** The tooled rule under a section heading: its little diamond. */
const RULE_DIAMOND = 6;

/**
 * Android draws text clipped just inside its padding, and Caveat's last letter leans past the box
 * ("da|y", "Toda|y" lost the top of the y). A trailing space gives the last glyph room inside the clip.
 */
export const HAND_TAIL = ' ';

/**
 * A shared serif title with an optional compact count.
 */
export function ScreenTitle({ title, count }: { title: string; count?: number | string; accent?: string }) {
  const { colors, typography, spacing, sizes } = useTheme();
  const { width: windowW } = useWindowDimensions();
  // Title, count and the buttons share one line, so narrow phones get a smaller title rather than a wrapped one.
  const titleStyle = windowW < sizes.narrowWindow ? typography.titleNarrow : typography.title;
  return (
    <View style={[styles.titleRow, { gap: spacing.md }]} accessibilityRole="header">
      <Text style={[titleStyle, styles.emboss, { color: colors.giltBright }]} numberOfLines={1} textBreakStrategy="simple">
        {title}
        {HAND_TAIL}
      </Text>
      {count !== undefined ? (
        <View style={{ borderWidth: 1, borderColor: colors.gilt, borderRadius: 3, paddingHorizontal: spacing.sm, paddingVertical: 2 }}>
          <Text numberOfLines={1} textBreakStrategy="simple" style={[typography.stamp, { color: colors.giltBright }]}>
            {count}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** A quiet printed rule, shared by section headings. */
export function GiltRule({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.ruleRow, style]} pointerEvents="none">
      <View style={{ width: RULE_DIAMOND, height: RULE_DIAMOND, backgroundColor: colors.gilt, transform: [{ rotate: '45deg' }] }} />
      <View style={{ flex: 1, height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.gilt, opacity: 0.7 }} />
    </View>
  );
}

/** Serif section heading and a small supporting detail over a printed rule. */
export function SectionHeader({ title, detail }: { title: string; detail?: string; accent?: string }) {
  const { colors, typography, spacing } = useTheme();
  return (
    <View style={{ marginBottom: spacing.lg, gap: spacing.xs }}>
      <View style={[styles.sectionRow, { gap: spacing.sm }]}>
        <Text numberOfLines={1} textBreakStrategy="simple" style={[typography.heading, styles.emboss, { color: colors.onDesk }]}>
          {title}
          {HAND_TAIL}
        </Text>
        {detail ? (
          // flex: 1 + right-aligned, so Android never under-measures a shrink-wrapped label.
          <Text numberOfLines={1} style={[typography.caption, { color: colors.onDeskMuted, flex: 1, textAlign: 'right' }]}>
            {detail}
          </Text>
        ) : null}
      </View>
      <GiltRule />
    </View>
  );
}

/**
 * The padding every page's scroll content uses, so titles start at the same height and sections are
 * spaced the same on every page: the status bar plus a little, the gutter at the sides, room for the bar
 * at the foot, and one gap between sections. Pass `withNavBar: false` on pages without the bar.
 */
export function usePageContentStyle({ withNavBar = true, gap = true, thumbBar = false }: { withNavBar?: boolean; gap?: boolean; thumbBar?: boolean } = {}): ViewStyle {
  const { spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const navSpace = useNavBarSpace();
  return {
    paddingTop: insets.top + spacing.lg,
    // With an action bar under the page, the bar (and the room for the nav bar) is below the scroll view.
    paddingBottom: thumbBar ? spacing.xl : withNavBar ? navSpace : insets.bottom + spacing.xxxl * 2,
    paddingHorizontal: spacing.gutter + spacing.xs,
    ...(gap ? { gap: spacing.xxl } : null),
  };
}

interface PageHeaderProps {
  title: string;
  count?: number | string;
  /** A printed line under the title ("hi, Sree"). */
  subtitle?: string;
  /** Kept for callers; the diary's chrome is gilt on every page. */
  accent: string;
  buddyAccent?: string;
  /** The emblem beside the title; leave it out with `buddy={false}` (a page with its own emblem nearby). */
  buddy?: boolean;
  buddyMood?: BuddyMood;
  bump?: number | string;
  /** Kept for callers (the bunny used to peek over a wall here). */
  wall?: boolean;
  /** Buttons above the title (back, close, actions), in a `TopBar` row. */
  left?: ReactNode;
  right?: ReactNode;
}

/**
 * The top of every page, built the same way everywhere: an optional row of buttons, then the gilt title (with
 * its count), one printed line under it, and the diary's emblem on the right, as tall as the title block.
 */
export function PageHeader({ title, count, subtitle, buddy = true, buddyMood = 'happy', bump, left, right }: PageHeaderProps) {
  const { colors, typography, spacing, sizes } = useTheme();
  const [textH, setTextH] = useState(0);
  const onTextLayout = (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (Math.abs(h - textH) > 1) setTextH(h);
  };
  const emblem = textH > 0 ? Math.min(textH, sizes.buddy * EMBLEM_MAX) : 0;
  const line = subtitle?.endsWith(FLOWER) ? subtitle.slice(0, -FLOWER.length).trimEnd() : subtitle;
  return (
    <View>
      {left || right ? <TopBar left={left} right={right} /> : null}
      <View style={[styles.headerRow, { gap: spacing.md }]}>
        <View style={{ flex: 1 }} onLayout={onTextLayout}>
          <ScreenTitle title={title} count={count} />
          {/* Full width, so Android never under-measures a shrink-wrapped label. */}
          {line ? <Text style={[typography.caption, { color: colors.onDeskMuted, marginTop: spacing.xs, fontSize: (typography.caption.fontSize ?? 17) + 1 }]}>{line}</Text> : null}
        </View>
        {buddy && emblem > 0 ? <Buddy mood={buddyMood === 'peek' ? 'happy' : buddyMood} size={emblem} bump={bump} tappable /> : null}
      </View>
    </View>
  );
}

/** One button in a page's action bar. */
export interface BarAction {
  key: string;
  icon: IconName;
  label: string;
  onPress: () => void;
  /** The page's main action (save): a filled capsule in this color. */
  primary?: string;
  /** Icon color (e.g. the year's color for play). */
  tint?: string;
  /** Shown as switched on (its sheet is open, it is recording…). */
  active?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}

/**
 * A page's own buttons at the foot of the screen, where the thumb is, in the manner of One UI's bottom
 * bars: one rounded paper bar of equal places, each an icon with a short handwritten label under it,
 * the main action a filled capsule, a switched-on one sitting on a soft highlight. It is part of the
 * page's column (put it after the ScrollView, which gets `flex: 1`), so it never covers the page:
 * the page ends just above it. On bar pages it leaves room for the bar below; elsewhere it rides up
 * with the keyboard.
 */
export function ActionBar({ actions, withNavBar = true }: { actions: readonly BarAction[]; withNavBar?: boolean }) {
  const { spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const navSpace = useNavBarSpace();
  // The page's buttons are index tabs on its bottom edge, like the main pages' tabs.
  return <PaperTabs items={actions} bottomInset={withNavBar ? navSpace - spacing.lg : insets.bottom} />;
}

/** Height of a place in an action row: a button and its label. */
export function useActionRowHeight(): number {
  // The same height as the bar: an icon over a label, inside the stitching.
  const { control } = useTheme();
  return control.height + control.stitchInset * 2;
}

/**
 * A row of buttons on a stitched slip (the voice strip on the writing page, the tape deck), made like the bar and every
 * other control: cream card paper, stitched, equal places of a small ink drawing and a printed label, the switched-on one
 * and the main action on the highlighter wash. Anything in `lead` comes before the buttons (the waveform, the cassette).
 */
export function ActionRow({ actions, lead, style }: { actions: readonly BarAction[]; lead?: ReactNode; style?: StyleProp<ViewStyle>; tapes?: boolean }) {
  const theme = useTheme();
  const { sizes, typography, colors, control } = theme;
  const slotH = useActionRowHeight();
  const ink = colors.ink;
  const muted = withAlpha(colors.ink, 0.74);
  return (
    <View style={style}>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.panel, borderRadius: control.radius, padding: control.stitchInset, boxShadow: theme.shadow(undefined, 1) }}>
        <Texture kind="paper" opacity={0.5} radius={control.radius} />
        <Stitches />
        {lead}
        {actions.map((a) => {
          const on = a.active || !!a.primary;
          const fg = a.tint && !on ? a.tint : on ? ink : muted;
          return (
            <PressableScale
              key={a.key}
              onPress={a.onPress}
              disabled={a.disabled}
              accessibilityRole="button"
              accessibilityLabel={a.accessibilityLabel ?? a.label}
              accessibilityState={{ disabled: a.disabled, selected: a.active }}
              style={{ flex: 1 }}
            >
              <View style={{ height: slotH - control.stitchInset * 2, alignItems: 'center', justifyContent: 'center' }}>
                {on ? <WashIn color={a.primary ?? colors.gilt} /> : null}
                <Ionicons name={on ? (a.icon.replace('-outline', '') as IconName) : a.icon} size={sizes.icon - 2} color={fg} />
                {/* Full width + centred, so Android never under-measures a shrink-wrapped label. */}
                <Text numberOfLines={1} style={[typography.small, { fontSize: 13, lineHeight: 16, marginTop: 3, color: on ? ink : muted, fontWeight: on ? '700' : '600', alignSelf: 'stretch', textAlign: 'center', paddingRight: 0 }]}>
                  {a.label}
                </Text>
              </View>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

/** Row of floating buttons (and optionally the title) at the top of a screen. */
export function TopBar({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={[styles.topBar, { marginBottom: spacing.lg, gap: spacing.md }]}>
      <View style={[styles.cluster, { gap: spacing.md, flexShrink: 1 }]}>{left}</View>
      <View style={[styles.cluster, { gap: spacing.md }]}>{right}</View>
    </View>
  );
}

/** A printed page number at the foot of a screen, between two short gilt rules: every screen is a page of the same diary. */
export function PageFooter({ label }: { label: string }) {
  const { colors, typography, spacing } = useTheme();
  return (
    <View style={[styles.footer, { marginTop: spacing.xl, gap: spacing.md }]}>
      <View style={{ width: spacing.xl, height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.gilt, opacity: 0.6 }} />
      {/* flex: 1 + centred: Android drops the last words of a shrink-wrapped label ("the" instead of "the last page"). */}
      <Text numberOfLines={1} style={[typography.handSmall, { color: colors.onDeskFaint, textAlign: 'center', flex: 1 }]}>{label}</Text>
      <View style={{ width: spacing.xl, height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.gilt, opacity: 0.6 }} />
    </View>
  );
}

interface PanelProps {
  children: ReactNode;
  /** Kept for callers (cards used to be taped and stickered by seed and accent). */
  seed?: string;
  accent?: string;
  accent2?: string;
  paper?: string;
  sticker?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** A stack of diary pages, with a red margin, fibres and a soft paper edge. */
export function Panel({ children, paper, style }: PanelProps) {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const shape = { borderTopLeftRadius: 2, borderBottomLeftRadius: 2, borderTopRightRadius: 7, borderBottomRightRadius: 7 };
  return (
    <Raster>
      <View>
        <View style={[StyleSheet.absoluteFill, shape, { backgroundColor: mixHex(colors.paper, '#000000', 0.14), transform: [{ translateX: 3 }, { translateY: 3 }], opacity: 0.75 }]} />
        <View style={[shape, { backgroundColor: paper ?? colors.panel, paddingLeft: spacing.gutter + spacing.sm, paddingRight: spacing.gutter, paddingTop: spacing.lg, paddingBottom: spacing.md, boxShadow: theme.shadow(undefined, 1) }, style]}>
          <Texture kind="paper" radius={7} opacity={0.35} />
          <View pointerEvents="none" style={{ position: 'absolute', left: 14, top: 0, bottom: 0, width: 1, backgroundColor: colors.marginLine }} />
          {children}
        </View>
      </View>
    </Raster>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  /** Lettering pressed into the leather: a dark edge under it and a faint lit edge. */
  emboss: { textShadowColor: 'rgba(0, 0, 0, 0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0 },
  ruleRow: { flexDirection: 'row', alignItems: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  cluster: { flexDirection: 'row', alignItems: 'center' },
});
