import { router, useLocalSearchParams } from 'expo-router';
import { memo, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { GiltRule, HAND_TAIL, PageFooter, PageHeader, usePageContentStyle } from '../../components/Screen';
import { LiteShadows } from '../../components/ThemeProvider';
import { BuddySays } from '../../components/scrapbook/Buddy';
import { PaperBackground } from '../../components/scrapbook/PaperBackground';
import { Raster } from '../../components/scrapbook/Raster';
import { ScrapObject } from '../../components/scrapbook/ScrapObject';
import { resolvePhotoUri, type Entry } from '../../data';
import { DiaryDock } from '../../components/DiaryDock';
import { MemoryLine, MemoryPeg } from '../../components/scrapbook/MemoryLine';
import { Polaroid } from '../../components/scrapbook/Polaroid';
import { formatMonthDay } from '../../lib/dates';
import { PressableScale } from '../../components/PressableScale';
import { useYearEntries } from '../../hooks/useData';
import { useAfterTransition } from '../../hooks/useAfterTransition';
import { useBookFlight } from '../../components/BookFlight';
import { tapHaptic } from '../../lib/haptics';
import { hashString, lookForEntry } from '../../lib/seeded';
import { groupByMonth, monthName, scatterLayout, tidyLayout, type Slot } from '../../lib/yearSpread';
import { useTheme, type YearPalette } from '../../theme';

/** Height of a tidy cell relative to its width: fits a polaroid with its caption. */
const CELL_RATIO = 1.3;
/** A note's height in the tidy rows: a heading line plus up to TIDY_NOTE_LINES of words (about this many letters each). */
const NOTE_BASE = 0.42;
const NOTE_LINE = 0.08;
const NOTE_LINE_CHARS = 20;

/** How tall a memory hangs in the tidy rows: a polaroid (photo or voice) takes the whole cell, a note only its lines. */
function tidyHeight(entry: Entry, itemW: number, cellH: number): number {
  if (entry.photoPath || entry.voicePath) return cellH;
  const lines = Math.min(TIDY_NOTE_LINES, Math.max(1, Math.ceil(entry.text.trim().length / NOTE_LINE_CHARS)));
  return Math.min(cellH, itemW * (NOTE_BASE + NOTE_LINE * lines));
}
const TIDY_NOTE_LINES = 5;
/** Prepare the finished drawings under the opening cover, with a bounded render window. */
const PREPARE_BATCH = 2;
const PREPARE_TICK_MS = 32;
const WINDOW_STEP = 240;
const WINDOW_SCREENS = 1;
const MINIATURE = 1.7;
/**
 * The pile stacks up one memory at a time, bottom of the pile first: each gets its turn STACK_STEP_MS after the one under
 * it and takes FALL_MS to fall, turn and settle with a soft overshoot. One UI-thread clock (in ms) drives them all, so no
 * work happens in React while it plays (the cards are already built and painted under the cover).
 */
const STACK_STEP_MS = 70;
const FALL_MS = 460;
/** How far past "landed" the settle overshoots (0 = none). Soft: a paper dropping, not a ball. */
const SETTLE_OVERSHOOT = 0.9;
const SCATTER_DROP_PX = 520;
/** The clock once the stack-up is over: far past every turn, so memories scrolled into view later are simply there. */
const LANDED = 1e9;
const EMPTY_ENTRIES: Entry[] = [];

/**
 * A year, opened: every entry thrown on the page in a loose pile. "Tidy up" slides each one into
 * place under its month; "Scatter" throws them back.
 */
export default function YearScreen() {
  const { year: yearParam } = useLocalSearchParams<{ year: string }>();
  const year = Number(yearParam);
  const theme = useTheme();
  const { spacing, scrap, typography, motion } = theme;
  const palette = theme.year(year);
  const { width } = useWindowDimensions();
  const { data: loadedEntries } = useYearEntries(year);
  const entries = loadedEntries ?? EMPTY_ENTRIES;
  const reduceMotion = useReducedMotion();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [tidy, setTidy] = useState(false);
  const progress = useSharedValue(0);
  // One UI-thread clock reveals already-drawn cards; React does no work during their entrance.
  const entrance = useSharedValue(0);
  const transitioned = useAfterTransition(motion.screenMs + 80);
  const { ready, flying } = useBookFlight();
  const arrived = transitioned && flying !== year;
  const [drawn, setDrawn] = useState(false);
  const [shown, setShown] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [windowTop, setWindowTop] = useState(0);
  const [pileTop, setPileTop] = useState(0);
  const { height: screenH } = useWindowDimensions();

  const contentW = width - spacing.xl * 2;
  const gap = 18;
  const itemW = (contentW - gap * (scrap.tidyColumns - 1)) / scrap.tidyColumns;
  const cellH = itemW * CELL_RATIO;
  const headerH = (typography.month.lineHeight ?? 0) + spacing.sm + 12;

  const { groups, items, scatterH, tidyH, headers, rowTops } = useMemo(() => {
    const months = groupByMonth(entries);
    const tidied = tidyLayout(
      months.map((g) => g.entries.map((e) => e.id)),
      { itemW, cellH, columns: scrap.tidyColumns, gap, headerH, groupGap: spacing.md, maxTilt: scrap.tidyTilt, heights: months.map((g) => g.entries.map((e) => tidyHeight(e, itemW, cellH))) },
    );
    const flat = months.flatMap((g) => g.entries);
    // The pile is in a shuffled (but stable) order, so months are mixed up until it is tidied.
    const shuffled = [...flat].sort((a, b) => hashString(a.id) - hashString(b.id));
    const scattered = scatterLayout(
      shuffled.map((e) => e.id),
      {
        width: contentW,
        itemW,
        itemH: cellH,
        columns: scrap.scatterColumns,
        scale: scrap.scatterScale,
        rowRatio: scrap.scatterRowRatio,
        maxTilt: scrap.scatterTilt,
      },
    );
    const pileIndex = new Map(shuffled.map((e, i) => [e.id, i]));
    const fallback: Slot = { x: 0, y: 0, rotate: 0, scale: 1 };
    return {
      groups: months,
      items: flat.map((entry, i) => {
        const z = pileIndex.get(entry.id) ?? 0;
        return { entry, z, from: scattered.slots[z] ?? fallback, to: tidied.slots[i] ?? fallback };
      }),
      scatterH: scattered.height,
      tidyH: tidied.height,
      headers: tidied.headers,
      rowTops: tidied.rowTops,
    };
  }, [entries, itemW, cellH, contentW, gap, headerH, scrap, spacing.md]);

  const visibleItems = useMemo(() => {
    const top = windowTop - pileTop - screenH * WINDOW_SCREENS;
    const bottom = windowTop - pileTop + screenH * (1 + WINDOW_SCREENS);
    const near = (y: number) => y + cellH * 1.5 > top && y < bottom;
    return items.filter(({ from, to }) => near(from.y) || near(to.y));
  }, [items, windowTop, pileTop, screenH, cellH]);

  // Each visible memory's turn in the stack-up: its place in the pile among those on screen (bottom first).
  const turnOf = useMemo(() => {
    const order = [...visibleItems].sort((a, b) => a.z - b.z);
    return new Map(order.map((it, i) => [it.entry.id, i]));
  }, [visibleItems]);
  const stackMs = Math.max(0, visibleItems.length - 1) * STACK_STEP_MS + FALL_MS;

  useEffect(() => {
    if (revealed || shown >= visibleItems.length || (flying !== year && !transitioned)) return;
    const timer = setTimeout(() => setShown((n) => Math.min(visibleItems.length, n + PREPARE_BATCH)), PREPARE_TICK_MS);
    return () => clearTimeout(timer);
  }, [revealed, shown, visibleItems.length, flying, year, transitioned]);

  // Hand over only once the finished visible cards have had a chance to lay out and paint.
  useEffect(() => {
    if (!drawn || loadedEntries === undefined || shown < visibleItems.length) return;
    let second = 0;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => ready(year)); });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [drawn, loadedEntries, shown, visibleItems.length, ready, year]);

  useEffect(() => {
    if (!arrived || revealed || loadedEntries === undefined || shown < visibleItems.length) return;
    const frame = requestAnimationFrame(() => {
      setRevealed(true);
      entrance.set(
        withTiming(stackMs, { duration: reduceMotion ? motion.imageFadeMs : stackMs, easing: Easing.linear }, (done) => {
          if (done) entrance.set(LANDED);
        }),
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [arrived, revealed, loadedEntries, shown, visibleItems.length, entrance, reduceMotion, motion.imageFadeMs, stackMs]);

  useEffect(() => {
    const target = tidy ? 1 : 0;
    progress.set(reduceMotion ? withTiming(target, { duration: motion.imageFadeMs }) : withSpring(target, motion.tidy));
  }, [tidy, progress, reduceMotion, motion.imageFadeMs, motion.tidy]);

  const toggle = () => {
    tapHaptic();
    scroll.current?.scrollTo({ y: 0, animated: !reduceMotion });
    if (tidy && !reduceMotion) {
      // Scatter reuses the already-drawn cards: they stack up again, one at a time; only their transforms restart.
      entrance.set(0);
      entrance.set(
        withTiming(stackMs, { duration: stackMs, easing: Easing.linear }, (done) => {
          if (done) entrance.set(LANDED);
        }),
      );
    } else {
      // Tidying: everything is already landed.
      entrance.set(LANDED);
    }
    setTidy((t) => !t);
  };
  const pageContent = usePageContentStyle({ gap: false, thumbBar: true });

  return (
    <View style={{ flex: 1 }} onLayout={() => setDrawn(true)}>
      {/* The volume's own leather: the cover, stained a little with the year's color. */}
      <PaperBackground variant="dots" desk wash={palette.primary} />
      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        scrollEventThrottle={64}
        onScroll={(e) => {
          const step = Math.floor(e.nativeEvent.contentOffset.y / WINDOW_STEP) * WINDOW_STEP;
          setWindowTop((prev) => (prev === step ? prev : step));
        }}
        contentContainerStyle={pageContent}
      >
        <View style={{ marginBottom: spacing.xxl }}>
          <PageHeader
            title={String(year)}
            count={entries.length}
            subtitle={entries.length === 0 ? undefined : tidy ? 'moments on a string, month by month' : 'every page, loose in the volume'}
            accent={palette.secondary}
            buddyAccent={palette.primary}
            buddy={entries.length > 0}
            bump={tidy ? 1 : 0}
          />
        </View>

        {entries.length === 0 ? (
          <BuddySays mood="sleepy" accent={palette.primary} text="Nothing saved this year." />
        ) : (
          <LiteShadows>
          <View style={{ height: tidy ? tidyH : scatterH }} onLayout={(e) => setPileTop(e.nativeEvent.layout.y)}>
            {groups.map((group, i) => (headers[i] ?? 0) + headerH > windowTop - pileTop - screenH && (headers[i] ?? 0) < windowTop - pileTop + screenH * 2 ? (
              <MonthHeader
                key={group.month}
                month={group.month}
                count={group.entries.length}
                top={headers[i] ?? 0}
                progress={progress}
                palette={palette}
              />
            ) : null)}
            {groups.flatMap((group, i) => (rowTops[i] ?? []).map((rowTop, row) => rowTop > windowTop - pileTop - screenH && rowTop < windowTop - pileTop + screenH * 2 ? (
              <MemoryLine key={`${group.month}-${row}`} width={contentW} top={rowTop} progress={progress} />
            ) : null))}
            {visibleItems.slice(0, revealed ? undefined : shown).map(({ entry, z, from, to }) => (
              <SpreadItem key={entry.id} entry={entry} z={z} from={from} to={to} width={itemW} height={cellH}
                progress={progress} entrance={entrance} entranceIndex={turnOf.get(entry.id) ?? 0} reduced={reduceMotion} near />
            ))}
          </View>
          </LiteShadows>
        )}
        {entries.length > 0 ? <PageFooter label={`${year} · ${entries.length} ${entries.length === 1 ? 'page' : 'pages'}`} /> : null}
      </ScrollView>
      {/* Back, at the foot where a thumb reaches it (Tidy up / Scatter is in the bar). */}
      {/* Inside a diary the page's own buttons replace the main bar: Back, and Tidy up / Scatter. */}
      <DiaryDock
        actions={[
          { key: 'back', icon: 'chevron-back', label: 'Back', onPress: () => router.back() },
          ...(entries.length > 1
            ? [{ key: 'tidy', icon: tidy ? ('shuffle' as const) : ('albums-outline' as const), label: tidy ? 'Scatter' : 'Tidy up', tint: theme.colors.giltBright, active: tidy, onPress: toggle }]
            : []),
        ]}
      />
    </View>
  );
}

interface SpreadItemProps {
  entry: Entry;
  /** Stacking order in the pile. */
  z: number;
  from: Slot;
  to: Slot;
  width: number;
  height: number;
  progress: SharedValue<number>;
  near: boolean;
  entrance: SharedValue<number>;
  entranceIndex: number;
  reduced: boolean;
}

const SpreadItem = memo(function SpreadItem({ entry, z, from, to, width, height, progress, entrance, entranceIndex, reduced, near }: SpreadItemProps) {
  const { scrap, colors, radii, opacity } = useTheme();
  const look = useMemo(() => ({ ...lookForEntry(entry, scrap.maxTilt, scrap.maxOffset), tilt: 0 }), [entry, scrap.maxTilt, scrap.maxOffset]);
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    const clock = entrance.get();
    // This memory's own fall: it starts on its turn and lasts FALL_MS.
    const t = Math.max(0, Math.min(1, (clock - entranceIndex * STACK_STEP_MS) / FALL_MS));
    const fade = Math.min(1, t * 5);
    // Falls fast, settles softly with a little overshoot (ease-out-back). At rest under the cover (clock 0) it is painted
    // at its final place, so its picture is ready before the fall.
    const u = t - 1;
    const settle = 1 + (SETTLE_OVERSHOOT + 1) * u * u * u + SETTLE_OVERSHOOT * u * u;
    const d = reduced || clock === 0 ? 1 : settle;
    return {
      opacity: reduced ? Math.max(0.001, fade) : clock === 0 ? 0.001 : fade,
      transform: [
        { translateX: from.x + (to.x - from.x) * p },
        { translateY: from.y + (to.y - from.y) * p - (1 - d) * SCATTER_DROP_PX },
        { rotate: `${from.rotate + (to.rotate - from.rotate) * p + (1 - d) * 18}deg` },
        { scale: (from.scale + (to.scale - from.scale) * p) * (0.97 + Math.min(1, d) * 0.03) },
      ],
    };
  });
  return (
    <Animated.View style={[styles.item, { width, height, zIndex: z }, style]}>
      {/* The picture is taken outside the miniature's scale-down, so it is the size you see (about 1 MB),
          not the 1.7× size the object is laid out at. Offscreen memories are unmounted by the render window. */}
      <Raster enabled={near}>
      <View style={{ width, height }}>
      <View style={[styles.miniature, { width: width * MINIATURE, transform: [{ scale: 1 / MINIATURE }] }]}>
        {/* A flat offset shape stands in for the blurred paper shadow, which is too costly for a whole pile. */}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.shadowBase, opacity: opacity.pileShadow, borderRadius: radii.paper * 2, transform: [{ translateX: 4 }, { translateY: 6 }] },
          ]}
        />
        {entry.photoPath ? (
          <PressableScale onPress={() => router.push(`/memory/${entry.id}`)} accessibilityRole="button" accessibilityLabel={`Open memory from ${formatMonthDay(entry.localDate)}`}>
            <Polaroid frontOnly width={width * MINIATURE} uri={resolvePhotoUri(entry.photoPath)} tint={colors.sepia} words={entry.text} date={formatMonthDay(entry.localDate)} />
          </PressableScale>
        ) : (
          <ScrapObject entry={entry} look={look} raster={false} width={width * MINIATURE} numberOfLines={TIDY_NOTE_LINES} onPress={() => router.push(`/memory/${entry.id}`)} />
        )}
      </View>
      </View>
      </Raster>
      <MemoryPeg progress={progress} />
    </Animated.View>
  );
});

interface MonthHeaderProps {
  month: number;
  count: number;
  top: number;
  progress: SharedValue<number>;
  palette: YearPalette;
}

/** Month heading for the tidy view: the month in gilt italic over a tooled gold rule, and its count. Fades in as things settle. */
function MonthHeader({ month, count, top, progress }: MonthHeaderProps) {
  const { colors, typography, spacing } = useTheme();
  const style = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * -spacing.md }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.month, { top, gap: spacing.xs }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
        <Text numberOfLines={1} textBreakStrategy="simple" style={[typography.month, { color: colors.giltBright }]}>
          {monthName(month)}
          {HAND_TAIL}
        </Text>
        <Text numberOfLines={1} style={[typography.caption, { color: colors.onDeskMuted, flex: 1, textAlign: 'right' }]}>
          {count} {count === 1 ? 'page' : 'pages'}
        </Text>
      </View>
      <GiltRule />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  item: { position: 'absolute', left: 0, top: 0 },
  miniature: { position: 'absolute', left: 0, top: 0, transformOrigin: 'top left' },
  month: { position: 'absolute', left: 0, right: 0 },
});
