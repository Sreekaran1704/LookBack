import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { holdPager } from '../pagerPosition';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Path, Rect } from 'react-native-svg';
import type { Entry } from '../../data';
import { formatDisplayDate, parseLocalDate, yearsAgoLabel, yearsBetween } from '../../lib/dates';
import { gestureEndHaptic, gestureStartHaptic, selectHaptic, toggleHaptic } from '../../lib/haptics';
import { seededRng } from '../../lib/seeded';
import { mixHex, useTheme, withAlpha } from '../../theme';
import { useProfile } from '../../hooks/useData';
import { DropIn } from './DropIn';
import { ScrapObject } from './ScrapObject';
import { deg } from './shared';
import { Raster } from './Raster';

interface Props {
  /** Matches for today, most recent year first. */
  entries: Entry[];
  today: string;
  onOpen: (id: string) => void;
}

/** Envelope width as a share of the content width (one letter, or the top of a deck of several). */
const WIDTH_SINGLE = 0.82;
const WIDTH_MANY = 0.8;
/** The deck: how far each letter underneath peeks out, and how it's turned. */
const DECK_STEP_X = 9;
const DECK_STEP_Y = 12;
const DECK_TURN_DEG = 3.5;
const DECK_SHRINK = 0.045;
const DECK_VISIBLE = 3;
/** A swipe further than this share of the width (or this fast) sends the letter to the back. */
const FLING_SHARE = 0.26;
const FLING_VELOCITY = 850;
const FLY_OUT = 1.15;
const DRAG_TURN = 16;
const ENVELOPE_RATIO = 0.64;
/** How far the letter rises out of the envelope, as a share of the envelope height. */
const RISE_RATIO = 0.62;
const FLAP_RATIO = 0.56;
const LETTER_RATIO = 0.84;
const LETTER_INSET = 14;
const CORNER = 4;
const STAMP = 46;
/** The postmark struck across the stamp. */
const POSTMARK = 44;
/** The inside of an envelope is a shade deeper than its paper. */
const INSIDE_SHADE = 0.16;
const SHADE = '#000000';
/** 90s airmail: the red and blue chevrons round the edge, the PAR AVION label. */
const AIRMAIL_RED = '#C8302B';
const AIRMAIL_BLUE = '#1F4EA0';
const AIRMAIL_LABEL = '#F4F6FB';
const AIRMAIL_STRIPES = `repeating-linear-gradient(135deg, ${AIRMAIL_RED} 0px, ${AIRMAIL_RED} 8px, transparent 8px, transparent 14px, ${AIRMAIL_BLUE} 14px, ${AIRMAIL_BLUE} 22px, transparent 22px, transparent 28px)`;
const AIRMAIL_EDGE = 6;
const FOLD_OPACITY = 0.35;
/** How long after a tap the envelope stays live (the flap and letter spring), before it is cached again. */
const SETTLE_MS = 900;

/**
 * "On this day" as letters from your past self: one cream envelope per earlier year, sealed with wax pressed with
 * the diary's stamp, a postage stamp with the year and today's postmark. Tap an envelope and its flap opens and
 * the page slides out; tap the page to read it in full.
 * Several years make a deck: swipe the top letter away and it tucks itself in at the back, or tap a
 * year's stamp underneath to bring that letter to the top.
 */
export function MemoryLetters({ entries, today, onOpen }: Props) {
  const { spacing } = useTheme();
  const { width: screenW } = useWindowDimensions();
  const contentW = screenW - spacing.gutter * 2;
  if (entries.length === 1 && entries[0]) {
    return (
      <View style={styles.center}>
        <DropIn index={0}>
          <Letter entry={entries[0]} today={today} width={contentW * WIDTH_SINGLE} onOpen={onOpen} first />
        </DropIn>
      </View>
    );
  }
  // Remount the deck when the set of letters changes (a new day), so it starts in order again.
  return <LetterDeck key={entries.map((e) => e.id).join()} entries={entries} today={today} onOpen={onOpen} width={contentW * WIDTH_MANY} />;
}

function LetterDeck({ entries, today, onOpen, width }: Props & { width: number }) {
  const theme = useTheme();
  const { colors, spacing, typography, motion, sizes } = theme;
  const reduceMotion = useReducedMotion();
  const [order, setOrder] = useState(() => entries.map((_, i) => i));
  const [exit, setExit] = useState<{ index: number; x: number; n: number } | null>(null);
  const dragX = useSharedValue(0);
  const front = order[0] ?? 0;
  const frontEntry = entries[front] ?? entries[0];
  const height = width * ENVELOPE_RATIO;
  const rise = height * RISE_RATIO;

  // Send the top letter to the back of the deck; it slides back in from the side it was thrown to.
  const cycle = (x: number) => {
    gestureEndHaptic();
    setExit((e) => ({ index: front, x, n: (e?.n ?? 0) + 1 }));
    setOrder((o) => [...o.slice(1), ...o.slice(0, 1)]);
    dragX.set(0);
  };
  const bringToFront = (index: number) => {
    if (index === front) return;
    selectHaptic();
    setOrder((o) => {
      const at = o.indexOf(index);
      return [...o.slice(at), ...o.slice(0, at)];
    });
  };

  const pan = usePanGesture({
    activeOffsetX: [-12, 12],
    failOffsetY: [-14, 14],
    onActivate: () => {
      scheduleOnRN(gestureStartHaptic);
    },
    onUpdate: (e) => {
      dragX.set(e.translationX);
    },
    onDeactivate: (e) => {
      const fling = Math.abs(e.translationX) > width * FLING_SHARE || Math.abs(e.velocityX) > FLING_VELOCITY;
      if (!fling) {
        dragX.set(withSpring(0, motion.lift));
        return;
      }
      const to = (e.translationX + e.velocityX * 0.1 >= 0 ? 1 : -1) * width * FLY_OUT;
      dragX.set(
        withTiming(to, { duration: motion.imageFadeMs }, (done) => {
          if (done) scheduleOnRN(cycle, to);
        }),
      );
    },
  });

  return (
    <View style={{ alignItems: 'center', gap: spacing.md }}>
      <View style={{ width, height: rise + height + DECK_STEP_Y * (DECK_VISIBLE - 1) }}>
        {/* A line announcing the post, in the space the open letter rises into. */}
        <View pointerEvents="none" style={[styles.perch, { position: 'absolute', left: 0, right: 0, top: 0, height: rise }]}>
          <Text style={[typography.caption, { color: colors.onDeskMuted, flex: 1, textAlign: 'center', paddingBottom: spacing.lg }]}>
            {`${entries.length} letters came back from your past self. Swipe to shuffle, tap one to open it.`}
          </Text>
        </View>
        <GestureDetector gesture={pan}>
          {/* While a finger is on the deck the pages hold still: the swipe moves the letter, not the whole page. */}
          <View style={StyleSheet.absoluteFill} onTouchStart={() => holdPager(true)} onTouchEnd={() => holdPager(false)} onTouchCancel={() => holdPager(false)}>
            {entries.map((entry, index) => {
              const pos = order.indexOf(index);
              return (
                <DeckCard key={entry.id} pos={pos} count={entries.length} dragX={dragX} exitX={exit?.index === index ? exit : null} reduceMotion={reduceMotion}>
                  <Letter entry={entry} today={today} width={width} onOpen={onOpen} first={false} perch={false} label={false} closeKey={order.join()} />
                </DeckCard>
              );
            })}
          </View>
        </GestureDetector>
      </View>

      {/* Full width + centred: a shrink-wrapped Caveat label gets under-measured on Android. */}
      {frontEntry ? (
        <Text style={[typography.headline, { color: colors.giltBright, textAlign: 'center', alignSelf: 'stretch' }]}>
          {yearsAgoLabel(yearsBetween(frontEntry.localDate, today))}
        </Text>
      ) : null}
      {/* One postage stamp per year: the top letter's is lifted; tap a stamp to bring its letter up. */}
      <View style={[styles.stamps, { gap: spacing.md }]}>
        {entries.map((entry, index) => {
          const year = parseLocalDate(entry.localDate).year;
          const on = index === front;
          return (
            <Pressable
              key={entry.id}
              onPress={() => bringToFront(index)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`Letter from ${year}`}
              hitSlop={sizes.hitSlop}
              style={{
                width: STAMP,
                height: STAMP * 0.8,
                backgroundColor: on ? colors.primary : colors.paperWhite,
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: on ? colors.paperWhite : colors.sepia,
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: theme.shadow(undefined, on ? 1.2 : 0.5),
                transform: [{ rotate: on ? '-6deg' : '0deg' }, { translateY: on ? -4 : 0 }, { scale: on ? 1.1 : 1 }],
              }}
            >
              <Text style={[typography.stamp, { color: on ? colors.onPrimary : colors.sepia, paddingRight: 0, letterSpacing: 0 }]}>{year}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** One letter in the deck, springing to its place in the pile; the top one follows the finger. */
function DeckCard({
  pos,
  count,
  dragX,
  exitX,
  reduceMotion,
  children,
}: {
  pos: number;
  count: number;
  dragX: SharedValue<number>;
  exitX: { x: number; n: number } | null;
  reduceMotion: boolean;
  children: React.ReactNode;
}) {
  const { motion } = useTheme();
  const slot = useSharedValue(pos);
  const ownX = useSharedValue(0);
  const front = pos === 0;
  useEffect(() => {
    slot.set(reduceMotion ? withTiming(pos, { duration: motion.imageFadeMs }) : withSpring(pos, motion.fan));
  }, [pos, slot, reduceMotion, motion.fan, motion.imageFadeMs]);
  // Thrown off the top: come back in from where it flew to, tucking in behind the others.
  const exitN = exitX?.n;
  const exitAt = exitX?.x;
  useEffect(() => {
    if (exitN === undefined || exitAt === undefined) return;
    ownX.set(exitAt);
    ownX.set(reduceMotion ? withTiming(0, { duration: motion.imageFadeMs }) : withSpring(0, motion.fan));
  }, [exitN, exitAt, ownX, reduceMotion, motion.fan, motion.imageFadeMs]);

  const style = useAnimatedStyle(() => {
    const s = slot.get();
    const side = Math.round(s) % 2 === 0 ? 1 : -1;
    const drag = front ? dragX.get() : 0;
    return {
      opacity: s > DECK_VISIBLE - 0.5 ? Math.max(0, DECK_VISIBLE + 0.5 - s) : 1,
      transform: [
        { translateX: drag + ownX.get() + s * DECK_STEP_X * side },
        { translateY: s * DECK_STEP_Y },
        { rotate: `${drag / DRAG_TURN + s * DECK_TURN_DEG * side}deg` },
        { scale: 1 - s * DECK_SHRINK },
      ],
    };
  });
  return (
    <Animated.View pointerEvents={front ? 'box-none' : 'none'} style={[StyleSheet.absoluteFill, { zIndex: count - pos }, style]}>
      {children}
    </Animated.View>
  );
}

interface LetterProps {
  entry: Entry;
  today: string;
  width: number;
  onOpen: (id: string) => void;
  /** The first letter's line says a letter came back; any others say "and one from". */
  first: boolean;
  /** Show the note above the sealed envelope (off in a deck, which has one note for all). */
  perch?: boolean;
  /** Show "One year ago today" underneath (off in a deck, which shows it once). */
  label?: boolean;
  /** Changing this tucks the letter back into its envelope. */
  closeKey?: string;
}

function Letter({ entry, today, width, onOpen, first, perch = true, label = true, closeKey }: LetterProps) {
  const theme = useTheme();
  const { colors, spacing, typography, motion } = theme;
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  // While the flap moves, the envelope is drawn live; once it is shut and still it becomes a texture.
  const [settling, setSettling] = useState(false);
  const progress = useSharedValue(0);

  const year = parseLocalDate(entry.localDate).year;
  const { data: profile } = useProfile();
  const name = profile?.name?.trim() ?? '';
  const rng = seededRng(`letter-${entry.id}`);
  const tilt = rng.range(-1.5, 1.5);
  const stampTilt = rng.range(-6, 6);
  const postmarkTilt = rng.range(-18, 4);
  // Airmail envelopes were white paper.
  const paper = colors.paperWhite;
  const inside = mixHex(colors.paper, SHADE, INSIDE_SHADE);
  const line = withAlpha(colors.ink, 0.28);

  const height = width * ENVELOPE_RATIO;
  const rise = height * RISE_RATIO;
  const flapH = height * FLAP_RATIO;
  const letterW = width * LETTER_RATIO;

  // Tucked back in whenever the deck is shuffled.
  const [seenCloseKey, setSeenCloseKey] = useState(closeKey);
  if (closeKey !== seenCloseKey) {
    setSeenCloseKey(closeKey);
    setOpen(false);
  }

  useEffect(() => {
    const target = open ? 1 : 0;
    progress.set(reduceMotion ? withTiming(target, { duration: motion.imageFadeMs }) : withSpring(target, motion.fan));
  }, [open, progress, reduceMotion, motion.fan, motion.imageFadeMs]);

  // The flap flips up: the closed flap folds away in the first half, the open one unfolds behind the letter in the second.
  const closedFlap = useAnimatedStyle(() => ({ transform: [{ scaleY: Math.max(0, 1 - progress.get() * 2) }] }));
  const openFlap = useAnimatedStyle(() => ({ transform: [{ scaleY: Math.max(0, Math.min(1, progress.get() * 2 - 1)) }] }));
  const letterStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.get() * 4),
    transform: [{ translateY: (1 - Math.min(1, progress.get())) * rise }],
  }));
  const closedOnly = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - progress.get() * 3) }));

  const flapPath = `M 0 0 L ${width} 0 L ${width / 2 + 6} ${flapH - 6} Q ${width / 2} ${flapH} ${width / 2 - 6} ${flapH - 6} Z`;
  const toggle = () => {
    toggleHaptic(!open);
    setOpen((o) => !o);
    setSettling(true);
    setTimeout(() => setSettling(false), SETTLE_MS);
  };

  return (
    <View style={{ width, gap: spacing.md }}>
      {/* A sealed, still envelope is kept as a texture: its soft shadow is drawn once instead of every frame
          (the bunnies bob all the time, which would otherwise redraw it 60 times a second). */}
      <Raster enabled={!open && !settling}>
      <View style={{ width, height: rise + height, transform: [{ rotate: deg(tilt) }] }}>
        {/* Waiting on top of the sealed envelope. */}
        <Animated.View pointerEvents="none" style={[styles.perch, { height: rise, paddingHorizontal: spacing.md }, closedOnly]}>
          {perch ? (
            <Text style={[typography.caption, { color: colors.onDeskMuted, flex: 1, textAlign: 'center', paddingBottom: spacing.lg }]}>
              {first ? `A letter came back, from ${year}. Tap to open it.` : `…and one from ${year}`}
            </Text>
          ) : null}
        </Animated.View>

        <View style={{ position: 'absolute', top: rise, width, height }}>
          {/* Inside of the envelope. */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: inside, borderRadius: CORNER }]} />
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -flapH, width, height: flapH, transformOrigin: 'bottom' }, openFlap]}>
            <Svg width={width} height={flapH} style={{ transform: [{ scaleY: -1 }] }}>
              <Path d={flapPath} fill={paper} stroke={line} strokeWidth={1} strokeLinejoin="round" />
            </Svg>
          </Animated.View>

          {/* The memory, sliding up out of the pocket. Clipped at the bottom so it stays tucked in. */}
          <View pointerEvents="box-none" style={{ position: 'absolute', top: -rise, left: 0, right: 0, height: rise + height - CORNER, overflow: 'hidden' }}>
            <Animated.View pointerEvents={open ? 'auto' : 'none'} style={[{ position: 'absolute', top: LETTER_INSET, left: (width - letterW) / 2 }, letterStyle]}>
              <ScrapObject entry={entry} width={letterW} numberOfLines={4} onPress={() => onOpen(entry.id)} />
            </Animated.View>
          </View>

          {/* Front of the envelope. */}
          <Pressable
            onPress={toggle}
            accessibilityRole="button"
            accessibilityLabel={open ? `Put the ${year} letter away` : `Open the letter from ${year}`}
            style={{ position: 'absolute', top: open ? height * 0.42 : 0, bottom: 0, left: 0, right: 0 }}
          />
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { top: height * 0.42, borderBottomLeftRadius: CORNER, borderBottomRightRadius: CORNER, overflow: 'hidden' }]}
          >
            <Svg width={width} height={height * 0.58}>
              <Rect x={0} y={0} width={width} height={height * 0.58} fill={paper} />
              <Path
                d={`M 0 ${height * 0.58} L ${width / 2} ${height * 0.1} L ${width} ${height * 0.58}`}
                stroke={colors.ink}
                strokeWidth={1}
                fill="none"
                opacity={FOLD_OPACITY}
              />
            </Svg>
            {/* PAR AVION, in the top left corner of the front. */}
            <View style={{ position: 'absolute', left: spacing.lg, top: spacing.sm, borderWidth: 1.2, borderColor: AIRMAIL_BLUE, paddingHorizontal: 5, paddingVertical: 1, backgroundColor: AIRMAIL_LABEL }}>
              <Text style={[typography.stamp, { color: AIRMAIL_BLUE, fontSize: 7, lineHeight: 10, letterSpacing: 1.2, paddingRight: 0 }]}>PAR AVION</Text>
            </View>
            {/* The address, handwritten on ruled lines: to you, by name, to open today; and under it, who sent it. */}
            <View style={{ position: 'absolute', left: spacing.lg + spacing.md, right: STAMP + spacing.xl, bottom: spacing.sm + 2, gap: 1 }}>
              <Text numberOfLines={1} style={[typography.hand, { color: colors.inkBlue, fontSize: 22, lineHeight: 24 }]}>{name || 'Me'}, </Text>
              <View style={{ height: StyleSheet.hairlineWidth * 2, backgroundColor: withAlpha(colors.ink, 0.3) }} />
              <Text numberOfLines={1} style={[typography.hand, { color: colors.inkBlue, fontSize: 15, lineHeight: 18 }]}>to open on {formatDisplayDate(today).replace(/,? \d{4}$/, '')} </Text>
              <View style={{ height: StyleSheet.hairlineWidth * 2, backgroundColor: withAlpha(colors.ink, 0.3) }} />
              <Text numberOfLines={1} style={[typography.stamp, { color: colors.sepia, fontSize: 7, lineHeight: 11, letterSpacing: 1.4, paddingRight: 0, marginTop: 2 }]}>FROM ME · {year}</Text>
            </View>
            {/* Postage stamp with the year (perforated edge), and today's postmark struck across it. */}
            <View
              style={{
                position: 'absolute',
                right: spacing.md,
                bottom: spacing.md,
                width: STAMP,
                height: STAMP * 1.15,
                backgroundColor: colors.paperWhite,
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: colors.sepia,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ rotate: deg(stampTilt) }],
              }}
            >
              <Text style={[typography.stampLarge, { color: colors.sepia, paddingRight: 0, letterSpacing: 0, fontSize: 15 }]}>{year}</Text>
            </View>
            {/* Wavy cancellation lines struck across the stamp. */}
            <Svg pointerEvents="none" width={STAMP * 1.9} height={STAMP * 0.7} style={{ position: 'absolute', right: spacing.md - STAMP * 0.2, bottom: spacing.md + STAMP * 0.3 }}>
              {[0.2, 0.45, 0.7].map((y) => (
                <Path
                  key={y}
                  d={`M 0 ${STAMP * 0.7 * y} q ${STAMP * 0.24} -5 ${STAMP * 0.48} 0 t ${STAMP * 0.48} 0 t ${STAMP * 0.48} 0 t ${STAMP * 0.48} 0`}
                  stroke={withAlpha(colors.inkBlue, 0.5)}
                  strokeWidth={1.2}
                  fill="none"
                />
              ))}
            </Svg>
            <View
              style={{
                position: 'absolute',
                // Struck just left of the stamp, its ring catching the stamp's edge (above it, so the date reads whole).
                right: spacing.md + STAMP * 0.82,
                bottom: spacing.md + STAMP * 0.32,
                zIndex: 2,
                width: POSTMARK,
                height: POSTMARK,
                borderRadius: POSTMARK / 2,
                borderWidth: 1.2,
                borderColor: withAlpha(colors.inkBlue, 0.55),
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ rotate: deg(postmarkTilt) }],
              }}
            >
              <Text numberOfLines={1} style={[typography.stamp, { color: withAlpha(colors.inkBlue, 0.6), fontSize: 8, lineHeight: 10, letterSpacing: 0.6, paddingRight: 0 }]}>
                {formatDisplayDate(today).replace(/,? \d{4}$/, '').toUpperCase()}
              </Text>
            </View>
            {/* The airmail border along the front's sides and foot. */}
            <View style={[styles.edgeH, { bottom: 0, backgroundImage: AIRMAIL_STRIPES }]} />
            <View style={[styles.edgeV, { left: 0, backgroundImage: AIRMAIL_STRIPES }]} />
            <View style={[styles.edgeV, { right: 0, backgroundImage: AIRMAIL_STRIPES }]} />
          </View>
          {/* Upper part of the front, shown only while sealed. */}
          <Animated.View
            pointerEvents="none"
            style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.42 + 1, backgroundColor: paper, borderTopLeftRadius: CORNER, borderTopRightRadius: CORNER, overflow: 'hidden' }, closedOnly]}
          >
            <View style={[styles.edgeH, { top: 0, backgroundImage: AIRMAIL_STRIPES }]} />
            <View style={[styles.edgeV, { left: 0, backgroundImage: AIRMAIL_STRIPES }]} />
            <View style={[styles.edgeV, { right: 0, backgroundImage: AIRMAIL_STRIPES }]} />
          </Animated.View>

          {/* The flap, tucked shut, its edge striped red and blue like the rest of the airmail border. */}
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, width, height: flapH, transformOrigin: 'top' }, closedFlap]}>
            <Svg width={width} height={flapH}>
              <Path d={flapPath} fill={paper} stroke={line} strokeWidth={1} strokeLinejoin="round" />
              <Path d={flapPath} fill="none" stroke={AIRMAIL_RED} strokeWidth={4} strokeDasharray="8 8" strokeLinejoin="round" opacity={0.9} />
              <Path d={flapPath} fill="none" stroke={AIRMAIL_BLUE} strokeWidth={4} strokeDasharray="8 8" strokeDashoffset={8} strokeLinejoin="round" opacity={0.9} />
            </Svg>
          </Animated.View>

          {/* Paper shadow under the whole envelope. */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: -1, borderRadius: CORNER, boxShadow: theme.shadow(undefined, 1.2) }]} />
        </View>
      </View>
      </Raster>
      {/* Full width + centred: a shrink-wrapped Caveat label gets under-measured on Android. */}
      {label ? <Text style={[typography.headline, { color: colors.giltBright, textAlign: 'center', alignSelf: 'stretch' }]}>{yearsAgoLabel(yearsBetween(entry.localDate, today))}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  edgeH: { position: 'absolute', left: 0, right: 0, height: AIRMAIL_EDGE },
  edgeV: { position: 'absolute', top: 0, bottom: 0, width: AIRMAIL_EDGE },
  perch: { flexDirection: 'row', alignItems: 'flex-end' },
  stamps: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
});
