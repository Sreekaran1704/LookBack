import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { seededRng, STICKERS, TAPE_PATTERNS } from '../lib/seeded';
import { useTheme } from '../theme';
import { Doodle } from './scrapbook/Doodle';
import { deg } from './scrapbook/shared';
import { Sticker } from './scrapbook/Sticker';
import { WashiTape } from './scrapbook/WashiTape';

const COUNT_CIRCLE_PAD = 14;

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
            style={[typography.hand, { color: colors.onDeskMuted, paddingHorizontal: COUNT_CIRCLE_PAD / 2 }]}
          >
            {count}
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
    <View style={[styles.sectionRow, { marginBottom: spacing.lg, gap: spacing.sm }]}>
      <View>
        <Text
          onLayout={(e) => setW(e.nativeEvent.layout.width)}
          numberOfLines={1}
          textBreakStrategy="simple"
          style={[typography.heading, { color: colors.onDesk }]}
        >
          {title}
        </Text>
        {w > 0 ? <Doodle kind="underline" width={w} height={spacing.md} color={accent ?? colors.amber} seed={title.length} /> : null}
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
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  sectionRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cluster: { flexDirection: 'row', alignItems: 'center' },
});
