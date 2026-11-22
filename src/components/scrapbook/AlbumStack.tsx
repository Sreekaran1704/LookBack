import { memo, useRef, type ComponentRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Pattern, Rect, Stop } from 'react-native-svg';
import { tapHaptic } from '../../lib/haptics';
import { seededRng } from '../../lib/seeded';
import { useTheme } from '../../theme';
import { mixHex, withAlpha } from '../../theme/yearColors';
import { Polaroid } from './Polaroid';
import { Raster } from './Raster';
import { deg, useSvgId } from './shared';

interface Props {
  year: number;
  count: number;
  width: number;
  /** A photo to peek out of the pages, if the year has one. */
  coverUri: string | null;
  /** Whole years since this diary's year (0 = this year's). Older diaries look more worn. */
  age?: number;
  /** Tapped: gets where the diary is on screen, so it can fly off the shelf from exactly there. */
  onPress?: (frame: DiaryFrame) => void;
  /** 0 = shut, 1 = cover swung open (used by the flying copy). */
  open?: SharedValue<number>;
  /** Hidden while its flying copy is off the shelf. */
  hidden?: boolean;
  /** Keep the drawn diary as a texture (default). Off for a copy whose cover moves. */
  raster?: boolean;
  /** The age line under the diary ("2 years old"). */
  showLabel?: boolean;
  /** Color of the age line (it sits on wood inside the cupboard). */
  labelColor?: string;
  /** Only the front cover, no pages or shadow under it (the opening book turns it on its own). */
  coverOnly?: boolean;
}

/** Window position and size of a diary (the book itself, without the age line). */
export interface DiaryFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** How far the cover swings open, in degrees. Past 90 it has turned away (its back is hidden). */
const OPEN_DEG = 165;

/** "brand new", "1 year old", "4 years old" */
export function diaryAgeLabel(age: number): string {
  if (age <= 0) return 'brand new';
  return age === 1 ? '1 year old' : `${age} years old`;
}

/** Wear stops getting worse after this many years. */
const MAX_WEAR_AGE = 6;
const FADE_PER_YEAR = 0.07;
const COFFEE = '#6B4423';
/** Elastic band that holds the diary shut, as a share of the cover width from the left. */
const BAND_AT = 0.8;
const BAND_W = 9;
/** The cover is leather in a deep shade of the year's color, with squarer corners than a notebook. */
const LEATHER_DEPTH = 0.62;
const COVER_RADIUS = 6;

const PAGE_LAYERS = 3;
const PEEK_RATIO = 0.42;
const LINEN_LIGHT = '#FFFFFF';
const LINEN_DARK = '#000000';

/**
 * A year as a leather-bound volume: leather in a deep shade of the year's color lit from the top left, a stitched
 * spine, a tooled gilt frame, the year in gilt Roman numerals, and a strap holding it shut. Wear (fading, worn
 * corners, scuffs, a coffee ring) builds up with the years.
 */
export const AlbumStack = memo(function AlbumStack({
  year,
  count,
  width,
  coverUri,
  age = 0,
  onPress,
  open,
  hidden = false,
  raster = true,
  showLabel = true,
  labelColor,
  coverOnly = false,
}: Props) {
  const theme = useTheme();
  const { colors, sizes, spacing, typography, motion, scrap } = theme;
  const palette = theme.year(year);
  const linenId = useSvgId('linen');
  const lightId = useSvgId('light');
  const bandId = useSvgId('band');
  const rng = seededRng(`album-${year}`);
  const tilt = rng.range(-scrap.albumTiltDeg, scrap.albumTiltDeg);
  const peekTilt = rng.range(-10, 10);
  const pressed = useSharedValue(0);
  const bookRef = useRef<ComponentRef<typeof View>>(null);
  const coverStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${-(open?.get() ?? 0) * OPEN_DEG}deg` }],
  }));
  const liftStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${tilt}deg` },
      { translateY: pressed.get() * motion.pressedLift },
      { scale: 1 + pressed.get() * (motion.pressedScale - 1) },
    ],
  }));

  const h = sizes.albumHeight;
  const edge = sizes.albumPageEdge;
  const coverW = width - edge * PAGE_LAYERS;
  const coverH = h - edge * PAGE_LAYERS;
  const peekW = width * PEEK_RATIO;
  const peekTop = coverUri ? peekW * 0.55 : 0;

  // How the years show: the cover fades, corners wear through, creases and scuffs appear, then a coffee ring.
  const wear = Math.min(Math.max(age, 0), MAX_WEAR_AGE);
  const cornerWear = wear * 3.5;
  const scuffs = Array.from({ length: wear >= 2 ? wear * 2 : 0 }, () => ({
    x: rng.range(sizes.albumSpine + 10, coverW - 14),
    y: rng.range(10, coverH - 14),
    len: rng.range(5, 13),
    angle: rng.range(-0.6, 0.6),
  }));
  const bandX = coverW * BAND_AT;
  // The coffee ring sits low in a corner, half off the cover.
  const ring = { x: rng.range(sizes.albumSpine + 14, sizes.albumSpine + 26), y: rng.range(coverH * 0.9, coverH * 0.97), r: rng.range(15, 19) };
  // Leather in a deep shade of the year's color, tooled in gilt.
  const leather = mixHex(palette.primary, LINEN_DARK, LEATHER_DEPTH);
  const gilt = colors.giltBright;

  return (
    <Pressable
      onPressIn={() => pressed.set(withSpring(1, motion.press))}
      onPressOut={() => pressed.set(withSpring(0, motion.press))}
      onPress={() => {
        tapHaptic();
        bookRef.current?.measureInWindow((x: number, y: number, w: number, hgt: number) => onPress?.({ x, y, width: w, height: hgt }));
      }}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${year} diary, ${diaryAgeLabel(age)}, ${count} memories`}
      style={{ width, gap: spacing.sm, opacity: hidden ? 0 : 1 }}
    >
      <Raster enabled={raster}>
      <Animated.View ref={bookRef} collapsable={false} style={[{ width, height: h + peekTop }, liftStyle]}>
        {coverUri ? (
          <View style={{ position: 'absolute', top: 0, right: spacing.lg, transform: [{ rotate: deg(peekTilt) }] }}>
            <Polaroid width={peekW} uri={coverUri} tint={palette.primary} />
          </View>
        ) : null}

        {/* Contact shadow where the diary rests on the page. */}
        {coverOnly ? null : <View
          style={{
            position: 'absolute',
            left: spacing.sm,
            right: spacing.xs,
            top: peekTop + h - spacing.lg,
            height: spacing.xl,
            borderRadius: spacing.xl,
            backgroundColor: withAlpha(palette.ink, 0.28),
            boxShadow: `0px 0px ${spacing.md}px ${withAlpha(palette.ink, 0.35)}`,
          }}
        />}

        {/* Page edges sticking out under the cover. */}
        {coverOnly ? null : Array.from({ length: PAGE_LAYERS }, (_, i) => PAGE_LAYERS - i).map((layer) => (
          <View
            key={layer}
            style={{
              position: 'absolute',
              top: peekTop + edge * layer,
              left: edge * layer,
              width: coverW,
              height: coverH,
              borderRadius: COVER_RADIUS,
              // Pages yellow with age.
              backgroundColor: wear >= 3 ? colors.kraft : layer % 2 ? colors.paperWhite : colors.paper,
              borderWidth: 1,
              borderColor: withAlpha(palette.ink, 0.3),
              boxShadow: theme.shadow(palette.ink, 0.6),
            }}
          />
        ))}

        {/* The first page, under the cover: seen only when the cover swings open. */}
        {open ? (
          <View
            style={{
              position: 'absolute',
              top: peekTop,
              left: 0,
              width: coverW,
              height: coverH,
              borderRadius: COVER_RADIUS,
              backgroundColor: colors.paperWhite,
              borderWidth: 1,
              borderColor: withAlpha(palette.ink, 0.3),
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs,
            }}
          >
            <Text style={[typography.albumYear, { color: colors.sepia, textAlign: 'center', alignSelf: 'stretch', paddingRight: 0 }]}>
              {year}
            </Text>
            <Text style={[typography.handSmall, { color: colors.inkMuted, textAlign: 'center', alignSelf: 'stretch', paddingRight: 0 }]}>
              {count} {count === 1 ? 'page' : 'pages'}
            </Text>
          </View>
        ) : null}

        {/* The cover swings open on its spine (the left edge). */}
        <Animated.View
          style={[
            { position: 'absolute', top: peekTop, left: 0, width: coverW, height: coverH, transformOrigin: 'left center', backfaceVisibility: 'hidden' },
            open ? coverStyle : null,
          ]}
        >
        <Raster enabled={!!open}>
        <View
          style={{
            width: coverW,
            height: coverH,
            borderRadius: COVER_RADIUS,
            backgroundColor: leather,
            overflow: 'hidden',
            // Outline and shadow in the diary's own deep shade, so it stands off a page of the same color.
            borderWidth: 1.5,
            borderColor: withAlpha(palette.ink, 0.55),
            boxShadow: theme.shadow(palette.ink, 1.4),
          }}
        >
          <Svg width={coverW} height={coverH} style={{ position: 'absolute' }}>
            <Defs>
              <LinearGradient id={lightId} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={LINEN_LIGHT} stopOpacity={0.3} />
                <Stop offset="0.45" stopColor={LINEN_LIGHT} stopOpacity={0} />
                <Stop offset="1" stopColor={LINEN_DARK} stopOpacity={0.24} />
              </LinearGradient>
              <LinearGradient id={bandId} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={palette.ink} stopOpacity={0.95} />
                <Stop offset="0.45" stopColor={palette.ink} stopOpacity={0.7} />
                <Stop offset="1" stopColor={palette.ink} stopOpacity={1} />
              </LinearGradient>
              <Pattern id={linenId} width={6} height={6} patternUnits="userSpaceOnUse">
                <Line x1={0} y1={0} x2={6} y2={6} stroke={withAlpha(LINEN_LIGHT, 0.05)} strokeWidth={1} />
                <Line x1={6} y1={0} x2={0} y2={6} stroke={withAlpha(LINEN_DARK, 0.06)} strokeWidth={1} />
              </Pattern>
            </Defs>
            <Rect x={0} y={0} width={coverW} height={coverH} fill={`url(#${linenId})`} />
            {/* Spine with stitching. */}
            <Rect x={0} y={0} width={sizes.albumSpine} height={coverH} fill={withAlpha(LINEN_DARK, 0.16)} />
            <Line
              x1={sizes.albumSpine + 6}
              x2={sizes.albumSpine + 6}
              y1={8}
              y2={coverH - 8}
              stroke={withAlpha(gilt, 0.55)}
              strokeWidth={1.2}
              strokeDasharray="5 4"
            />
            {/* A tooled gilt frame: a fine outer line and a heavier one just inside it. */}
            <Rect x={sizes.albumSpine + 11} y={9} width={coverW - sizes.albumSpine - 20} height={coverH - 18} rx={3} stroke={gilt} strokeOpacity={0.75} strokeWidth={0.8} fill="none" />
            <Rect x={sizes.albumSpine + 14.5} y={12.5} width={coverW - sizes.albumSpine - 27} height={coverH - 25} rx={2} stroke={gilt} strokeOpacity={0.9} strokeWidth={1.4} fill="none" />

            {/* Sun-faded cover. */}
            <Rect x={0} y={0} width={coverW} height={coverH} fill={colors.paper} opacity={wear * FADE_PER_YEAR} />
            {wear >= 1 ? (
              <>
                {/* Corners worn through to the board. */}
                <Circle cx={coverW} cy={0} r={cornerWear} fill={colors.kraft} opacity={0.85} />
                <Circle cx={coverW} cy={coverH} r={cornerWear * 1.2} fill={colors.kraft} opacity={0.85} />
                <Circle cx={sizes.albumSpine} cy={coverH} r={cornerWear * 0.7} fill={colors.kraft} opacity={0.7} />
              </>
            ) : null}
            {wear >= 2 ? (
              <Path
                d={`M ${coverW * 0.62} 0 L ${coverW} ${coverH * 0.3}`}
                stroke={withAlpha(LINEN_DARK, 0.18)}
                strokeWidth={1.2}
              />
            ) : null}
            {scuffs.map((s, i) => (
              <Line
                key={i}
                x1={s.x}
                y1={s.y}
                x2={s.x + Math.cos(s.angle) * s.len}
                y2={s.y + Math.sin(s.angle) * s.len}
                stroke={withAlpha(LINEN_LIGHT, 0.45)}
                strokeWidth={1.4}
                strokeLinecap="round"
              />
            ))}
            {wear >= 3 ? (
              <Circle cx={ring.x} cy={ring.y} r={ring.r} stroke={COFFEE} strokeWidth={2.2} fill={withAlpha(COFFEE, 0.06)} opacity={0.32} />
            ) : null}

            {/* Light falls from the top left: a sheen up there, shade towards the bottom right. */}
            <Rect x={0} y={0} width={coverW} height={coverH} fill={`url(#${lightId})`} />
            {/* The rounded spine catches a strip of light. */}
            <Rect x={3} y={0} width={3} height={coverH} fill={LINEN_LIGHT} opacity={0.22} />

            {/* Elastic band, with its shadow on the cover. */}
            <Rect x={bandX + 2.5} y={0} width={BAND_W} height={coverH} fill={LINEN_DARK} opacity={0.16} />
            <Rect x={bandX} y={0} width={BAND_W} height={coverH} fill={`url(#${bandId})`} />
          </Svg>
          {/* The year tooled in gilt in the middle of the cover, between two short rules. */}
          <View pointerEvents="none" style={{ position: 'absolute', top: coverH * 0.34, left: sizes.albumSpine + 16, width: bandX - sizes.albumSpine - 20, alignItems: 'center', gap: spacing.xs }}>
            <View style={{ width: '50%', height: 1, backgroundColor: gilt, opacity: 0.8 }} />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
              textBreakStrategy="simple"
              style={[typography.albumYear, { color: gilt, textAlign: 'center', alignSelf: 'stretch', paddingRight: 0, letterSpacing: 2, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0 }]}
            >
              {year}
            </Text>
            <View style={{ width: '50%', height: 1, backgroundColor: gilt, opacity: 0.8 }} />
          </View>
        </View>
        </Raster>
        </Animated.View>

        {/* This year's diary still has its ribbon bookmark hanging out. */}
        {age <= 0 ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: coverW * 0.6,
              top: peekTop + coverH - spacing.xs,
              width: spacing.md,
              height: spacing.xl,
              backgroundColor: colors.wax,
              borderBottomLeftRadius: spacing.xs,
              borderBottomRightRadius: spacing.xs,
              zIndex: -1,
            }}
          />
        ) : null}
      </Animated.View>
      </Raster>
      {/* Full width + centred: a shrink-wrapped Caveat label gets under-measured on Android. */}
      {showLabel ? (
        <Text numberOfLines={1} style={[typography.handSmall, { color: labelColor ?? colors.onDeskMuted, textAlign: 'center', marginTop: age <= 0 ? spacing.md : 0 }]}>
          {diaryAgeLabel(age)}
        </Text>
      ) : null}
    </Pressable>
  );
});
