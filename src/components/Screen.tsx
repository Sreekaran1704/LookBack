import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { seededRng, STICKERS, TAPE_PATTERNS } from '../lib/seeded';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme';
import type { IconName } from './Buttons';
import { PressableScale } from './PressableScale';
import { useNavBarSpace } from './NavBar';
import { BrickWall } from './scrapbook/BrickWall';
import { Buddy, PEEK_SHARE, type BuddyMood } from './scrapbook/Buddy';
import { Doodle } from './scrapbook/Doodle';
import { Raster } from './scrapbook/Raster';
import { deg } from './scrapbook/shared';
import { Sticker } from './scrapbook/Sticker';
import { WashiTape } from './scrapbook/WashiTape';

const COUNT_CIRCLE_PAD = 14;
const FLOWER = '✿';
/** The header bunny's wall: its share of the header's height, how far the bunny sinks behind it, its width. */
const WALL_SHARE = 0.3;
const WALL_TUCK = 0.45;
const WALL_WIDTH = 1.05;
/** At most this share of the bunny's height goes behind the wall (just the paws). */
const WALL_TUCK_OF_BUNNY = 0.15;
/** A very tall header (a wrapped title) shouldn't grow a giant bunny. */
const BUDDY_MAX_SCALE = 1;
/**
 * Android draws text clipped just inside its padding, and Caveat's last letter leans past the box
 * ("da|y", "Toda|y" lost the top of the y). A trailing space gives the last glyph room inside the clip.
 */
export const HAND_TAIL = ' ';

/**
 * Big handwritten title with a highlighter swipe behind it, and an optional count circled in pen:
 * "Memories (56)".
 */
export function ScreenTitle({ title, count, accent }: { title: string; count?: number | string; accent?: string }) {
  const { colors, typography, spacing, sizes } = useTheme();
  const { width: windowW } = useWindowDimensions();
  // Title, count and the buttons share one line, so narrow phones get a smaller title rather than a wrapped one.
  const titleStyle = windowW < sizes.narrowWindow ? typography.titleNarrow : typography.title;
  const [titleW, setTitleW] = useState(0);
  const [countW, setCountW] = useState(0);
  const highlight = accent ?? colors.amber;
  const titleH = titleStyle.lineHeight ?? 0;
  const countH = typography.hand.lineHeight ?? 0;

  return (
    <View style={[styles.titleRow, { gap: spacing.sm }]} accessibilityRole="header">
      <View>
        {titleW > 0 ? (
          <Doodle
            kind="highlight"
            width={titleW + spacing.md}
            height={titleH}
            color={highlight}
            seed={title.length}
            style={{ position: 'absolute', left: -spacing.sm / 2, top: spacing.xs }}
          />
        ) : null}
        <Text
          onLayout={(e: LayoutChangeEvent) => setTitleW(e.nativeEvent.layout.width)}
          style={[titleStyle, { color: colors.onDesk }]}
          numberOfLines={1}
          textBreakStrategy="simple"
        >
          {title}
          {HAND_TAIL}
        </Text>
      </View>
      {count !== undefined ? (
        <View style={{ paddingHorizontal: COUNT_CIRCLE_PAD / 2 }}>
          {countW > 0 ? (
            <Doodle
              kind="circle"
              width={countW + COUNT_CIRCLE_PAD}
              height={countH + COUNT_CIRCLE_PAD / 2}
              color={highlight}
              seed={String(count).length + 3}
              style={{ position: 'absolute', left: 0, top: -COUNT_CIRCLE_PAD / 4 }}
            />
          ) : null}
          <Text
            onLayout={(e: LayoutChangeEvent) => setCountW(e.nativeEvent.layout.width)}
            numberOfLines={1}
            // Android's default break strategy drops the last word of a shrink-wrapped Caveat label ("November 10" → "November").
            textBreakStrategy="simple"
            // More room on the right: Android measures a Caveat line shorter than it draws, so the circle ran through the last digit.
            style={[typography.hand, { color: colors.onDeskMuted, paddingLeft: COUNT_CIRCLE_PAD / 2, paddingRight: COUNT_CIRCLE_PAD * 1.25 }]}
          >
            {count}
            {HAND_TAIL}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Section heading with a wavy hand-drawn underline and an optional handwritten detail on the right. */
export function SectionHeader({ title, detail, accent }: { title: string; detail?: string; accent?: string }) {
  const { colors, typography, spacing } = useTheme();
  const [w, setW] = useState(0);
  return (
    // Title and detail share one baseline; the wavy underline hangs below the title outside the row's flow,
    // so it doesn't push the title up off the detail's line.
    <View style={[styles.sectionRow, { marginBottom: spacing.lg + spacing.md, gap: spacing.sm }]}>
      <View>
        <Text
          onLayout={(e) => setW(e.nativeEvent.layout.width)}
          numberOfLines={1}
          textBreakStrategy="simple"
          style={[typography.heading, { color: colors.onDesk }]}
        >
          {title}
          {HAND_TAIL}
        </Text>
        {w > 0 ? (
          <View style={{ position: 'absolute', left: 0, top: '100%' }}>
            <Doodle kind="underline" width={w} height={spacing.md} color={accent ?? colors.amber} seed={title.length} />
          </View>
        ) : null}
      </View>
      {detail ? (
        // flex: 1 + right-aligned: a shrink-wrapped Caveat label gets under-measured on Android.
        <Text numberOfLines={1} style={[typography.hand, { color: colors.onDeskMuted, flex: 1, textAlign: 'right' }]}>
          {detail}
        </Text>
      ) : null}
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
    paddingHorizontal: spacing.gutter,
    ...(gap ? { gap: spacing.xxl } : null),
  };
}

interface PageHeaderProps {
  title: string;
  count?: number | string;
  /** A handwritten line under the title ("hi, Sree ✿"). */
  subtitle?: string;
  /** Highlighter colour behind the title (the year's partner colour). */
  accent: string;
  /** The peeking bunny's bow colour; leave the bunny out with `buddy={false}` (a page with its own bunny nearby). */
  buddyAccent?: string;
  buddy?: boolean;
  buddyMood?: BuddyMood;
  bump?: number | string;
  /** The bunny peeks over a little brick wall instead of the page's edge (Home). */
  wall?: boolean;
  /** Buttons above the title (back, close, actions), in a `TopBar` row. */
  left?: ReactNode;
  right?: ReactNode;
}

/**
 * The top of every page, built the same way everywhere: an optional row of buttons, then the big
 * highlighted title (with its count circled), a handwritten line under it, and the bunny peeking over
 * from the right, bottom-aligned with the title block.
 */
export function PageHeader({ title, count, subtitle, accent, buddyAccent, buddy = true, buddyMood = 'peek', bump, wall = false, left, right }: PageHeaderProps) {
  const { colors, typography, spacing, sizes, nav } = useTheme();
  const flower = subtitle?.endsWith(FLOWER) ?? false;
  // The bunny is exactly as tall as the title + subtitle beside it, so the two read as one block.
  const [textH, setTextH] = useState(0);
  const onTextLayout = (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (Math.abs(h - textH) > 1) setTextH(h);
  };
  const peekShare = buddyMood === 'peek' ? PEEK_SHARE : 1;
  // Behind a wall the bunny's cut-off bottom (and its bob) hides behind the bricks; its paws rest on the top.
  const baseWall = wall ? Math.round(textH * WALL_SHARE) : 0;
  const tuck = Math.round(baseWall * WALL_TUCK);
  const buddySize = textH > 0 ? Math.min((textH - baseWall + tuck) / peekShare, sizes.buddy * BUDDY_MAX_SCALE) : 0;
  // Only its paws go behind the bricks, however tall the wall; a tall header (a wrapped subtitle) gets a
  // taller wall rather than a giant bunny.
  const sink = wall ? Math.min(tuck, Math.round(buddySize * peekShare * WALL_TUCK_OF_BUNNY)) : 0;
  const wallH = wall ? Math.round(textH - buddySize * peekShare + sink) : 0;
  return (
    <View>
      {left || right ? <TopBar left={left} right={right} /> : null}
      <View style={[styles.headerRow, { gap: spacing.md }]}>
        <View style={{ flex: 1 }} onLayout={onTextLayout}>
          <ScreenTitle title={title} count={count} accent={accent} />
          {/* Full width: a shrink-wrapped Caveat label gets under-measured on Android. */}
          {subtitle ? (
            <Text style={[typography.hand, { color: colors.onDeskMuted, marginTop: spacing.xs }]}>
              {flower ? subtitle.slice(0, -FLOWER.length) : subtitle}
              {/* The little flower is in the paper's partner accent, so it goes with whichever paper is chosen. */}
              {flower ? <Text style={{ color: nav.tape2 }}>{FLOWER}</Text> : null}
            </Text>
          ) : null}
        </View>
        {buddy && buddySize > 0 ? (
          <View style={{ alignItems: 'center' }}>
            <Buddy mood={buddyMood} accent={buddyAccent ?? accent} size={buddySize} bump={bump} tappable style={wall ? { marginBottom: -sink } : undefined} />
            {wall ? <BrickWall width={Math.round(buddySize * WALL_WIDTH)} height={wallH} /> : null}
          </View>
        ) : null}
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
  return (
    <View style={{ paddingHorizontal: spacing.gutter, paddingTop: spacing.sm, paddingBottom: withNavBar ? navSpace - spacing.lg : insets.bottom + spacing.sm }}>
      <ActionRow actions={actions} />
    </View>
  );
}

/** Height of a place in an action row: a button and its label. */
export function useActionRowHeight(): number {
  const { sizes, spacing } = useTheme();
  return sizes.circleButton + spacing.lg;
}

/** The action bar's paper: corner radius, how far in the stitch runs, and its solid paper shadow (like the main bar). */
const ROW_CORNER = 22;
const ROW_STITCH = 5;
const ROW_DROP = 3;

/**
 * The bar itself, made like the main bar at the foot of the bar pages: a strip of the chosen paper with a
 * dashed stitch just inside its edge, washi tape on both ends and a flat paper shadow, holding equal places
 * of icon + handwritten label. The main action is a sticker: a filled capsule with a white rim, set a
 * touch crooked. Anything in `lead` comes before the buttons (the voice strip's waveform while recording).
 */
export function ActionRow({ actions, lead, style, tapes = true }: { actions: readonly BarAction[]; lead?: ReactNode; style?: StyleProp<ViewStyle>; tapes?: boolean }) {
  const theme = useTheme();
  const { spacing, sizes, typography } = theme;
  const nav = theme.nav;
  const slotH = useActionRowHeight();
  const tapeW = sizes.tapeHeight * 2.4;
  return (
    <View style={style}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: nav.strip,
          borderRadius: ROW_CORNER,
          borderWidth: 1,
          borderColor: nav.edge,
          padding: spacing.xs + 2,
          gap: spacing.xs,
          boxShadow: `0px ${ROW_DROP}px 0px ${nav.shadow}`,
        }}
      >
        {/* The stitch, just inside the paper's edge. */}
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: ROW_STITCH, left: ROW_STITCH, right: ROW_STITCH, bottom: ROW_STITCH, borderRadius: ROW_CORNER - ROW_STITCH, borderWidth: 1.4, borderStyle: 'dashed', borderColor: nav.stitch }}
        />
        {lead}
        {actions.map((a) => {
          const fg = a.primary ? nav.rim : (a.tint ?? (a.active ? nav.ink : nav.inkMuted));
          return (
            <PressableScale
              key={a.key}
              onPress={a.onPress}
              disabled={a.disabled}
              accessibilityRole="button"
              accessibilityLabel={a.accessibilityLabel ?? a.label}
              accessibilityState={{ disabled: a.disabled, selected: a.active }}
              style={{ flex: a.primary ? 1.4 : 1 }}
            >
              <View
                style={[
                  {
                    height: slotH - spacing.xs * 2,
                    borderRadius: (slotH - spacing.xs * 2) / 2.4,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                  },
                  a.primary
                    ? { backgroundColor: a.primary, borderWidth: 2.5, borderColor: nav.rim, transform: [{ rotate: '-2deg' }], boxShadow: theme.shadow(a.primary, 0.6) }
                    : a.active
                      ? { backgroundColor: nav.active }
                      : null,
                ]}
              >
                <Ionicons name={a.icon} size={sizes.icon} color={fg} />
                {/* Full width + centred: a shrink-wrapped Caveat label gets under-measured on Android. */}
                <Text numberOfLines={1} style={[typography.small, { color: a.primary ? nav.rim : a.active || a.tint ? nav.ink : nav.inkMuted, alignSelf: 'stretch', textAlign: 'center', lineHeight: typography.small.fontSize ? typography.small.fontSize * 1.1 : undefined }]}>
                  {a.label}
                </Text>
              </View>
            </PressableScale>
          );
        })}
      </View>
      {tapes ? (
        <>
          <WashiTape width={tapeW} color={nav.tape} color2={nav.rim} pattern="stripes" angle={-24} style={{ position: 'absolute', left: -spacing.md, top: -spacing.sm }} />
          <WashiTape width={tapeW} color={nav.tape2} color2={nav.rim} pattern="dots" angle={22} style={{ position: 'absolute', right: -spacing.md, top: -spacing.sm }} />
        </>
      ) : null}
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

/** Handwritten page number at the foot of a screen: every screen is a page of the same journal. */
export function PageFooter({ label }: { label: string }) {
  const { colors, typography, spacing } = useTheme();
  return (
    // Full width + centred: a shrink-wrapped Caveat label gets under-measured on Android.
    <Text style={[typography.handSmall, { color: colors.onDeskFaint, textAlign: 'center', marginTop: spacing.xl }]}>~ {label} ~</Text>
  );
}

interface PanelProps {
  children: ReactNode;
  /** Seeds the tilt, tape and sticker so each card looks different but stays put. */
  seed?: string;
  /** Tape + sticker color (usually a year color). */
  accent?: string;
  accent2?: string;
  paper?: string;
  sticker?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** A paper card stuck to the page: slightly crooked, held by a strip of washi tape, with a sticker in a corner. */
export function Panel({ children, seed = 'panel', accent, accent2, paper, sticker = true, style }: PanelProps) {
  const theme = useTheme();
  const { colors, radii, spacing, sizes } = theme;
  const [w, setW] = useState(0);
  const rng = seededRng(`panel-${seed}`);
  const tilt = rng.range(-1.2, 1.2);
  const tapeAngle = rng.range(-7, 7);
  const tapeAt = rng.range(0.2, 0.55);
  const pattern = rng.pick(TAPE_PATTERNS);
  const stickerKind = rng.pick(STICKERS);
  const stickerTilt = rng.range(-18, 18);
  const tapeColor = accent ?? colors.amber;
  const tapeW = Math.max(w * 0.28, sizes.tapeHeight * 3);

  return (
    // Kept as a texture: the card's blurred shadow, tape and sticker are painted once, not on every frame
    // (Settings took 16 ms of GPU a frame while its bunny bobbed). It re-renders when the card's content changes.
    <Raster>
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[
        {
          backgroundColor: paper ?? colors.panel,
          borderRadius: radii.panel,
          paddingHorizontal: spacing.gutter,
          paddingTop: spacing.lg,
          paddingBottom: spacing.md,
          boxShadow: theme.shadow(undefined, 1),
          transform: [{ rotate: deg(tilt) }],
        },
        style,
      ]}
    >
      {children}
      {w > 0 ? (
        <WashiTape
          width={tapeW}
          color={tapeColor}
          color2={accent2 ?? colors.paperWhite}
          pattern={pattern}
          angle={tapeAngle}
          style={{ position: 'absolute', top: -sizes.tapeHeight / 2, left: (w - tapeW) * tapeAt }}
        />
      ) : null}
      {sticker ? (
        <Sticker
          kind={stickerKind}
          size={sizes.stickerDecor}
          color={accent2 ?? tapeColor}
          color2={tapeColor}
          style={{ position: 'absolute', right: -sizes.stickerDecor * 0.3, bottom: -sizes.stickerDecor * 0.3, transform: [{ rotate: deg(stickerTilt) }] }}
        />
      ) : null}
    </View>
    </Raster>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end' },
  cluster: { flexDirection: 'row', alignItems: 'center' },
});
