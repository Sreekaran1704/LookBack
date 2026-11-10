import { router, useLocalSearchParams } from 'expo-router';
import { memo, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleButton, PillButton } from '../../components/Buttons';
import { PageFooter, ScreenTitle, TopBar } from '../../components/Screen';
import { LiteShadows } from '../../components/ThemeProvider';
import { Buddy, BuddySays } from '../../components/scrapbook/Buddy';
import { Doodle } from '../../components/scrapbook/Doodle';
import { PaperBackground } from '../../components/scrapbook/PaperBackground';
import { ScrapObject } from '../../components/scrapbook/ScrapObject';
import { deg } from '../../components/scrapbook/shared';
import { Sticker } from '../../components/scrapbook/Sticker';
import type { Entry } from '../../data';
import { useYearEntries } from '../../hooks/useData';
import { useAfterTransition } from '../../hooks/useAfterTransition';
import { useBookFlight } from '../../components/BookFlight';
import { tapHaptic } from '../../lib/haptics';
import { hashString, lookForEntry, STICKERS } from '../../lib/seeded';
import { groupByMonth, monthName, scatterLayout, tidyLayout, type Slot } from '../../lib/yearSpread';
import { useTheme, type YearPalette } from '../../theme';

/** Height of a tidy cell relative to its width: fits a polaroid with its caption. */
const CELL_RATIO = 1.3;
const TIDY_NOTE_LINES = 5;
/** Drawn during the slide-in; the rest of the pile follows once the screen has arrived. */
const FIRST_PAINT = 4;
/** The rest of the pile stacks on within about this long, however many there are. */
/** After the slide-in, this many more pieces join the pile every STACK_TICK_MS (each falls as it joins). */
const STACK_BATCH = 1;
/**
 * Only memories within this many screen heights of what is visible are built, like a chat list: a
 * year can hold hundreds, but only a screenful or two is ever drawn. More are built as you scroll.
 */
const WINDOW_SCREENS = 1;
/** Scroll position is tracked in steps this tall, so scrolling re-renders only now and then. */
const WINDOW_STEP = 240;
const STACK_TICK_MS = 55;
/** Where a stacking piece starts falling from, above its spot. */
const STACK_DROP_PX = 520;
/** Objects are laid out this much larger than their cell and scaled down, so the handwriting, tape and stickers shrink with them. */
const MINIATURE = 1.7;

/**
 * A year, opened: every entry thrown on the page in a loose pile. "Tidy up" slides each one into
 * place under its month; "Scatter" throws them back.
 */
export default function YearScreen() {
  const { year: yearParam } = useLocalSearchParams<{ year: string }>();
  const year = Number(yearParam);
  const theme = useTheme();
  const { spacing, sizes, scrap, typography, motion } = theme;
  const palette = theme.year(year);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { data: entries = [] } = useYearEntries(year);
  const reduceMotion = useReducedMotion();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [tidy, setTidy] = useState(false);
  const progress = useSharedValue(0);
  const transitioned = useAfterTransition(motion.screenMs + 80);
  // Opened from the shelf: the book and paper cover this screen until it has drawn; the memories only
  // stack on once they are gone, so you see them land.
  const { ready, flying } = useBookFlight();
  const arrived = transitioned && flying !== year;
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (!drawn) return;
    const frame = requestAnimationFrame(() => ready(year));
    return () => cancelAnimationFrame(frame);
  }, [drawn, ready, year]);
  // How many of the pile are mounted. Mounting a few per tick (instead of all at once) keeps every
  // frame light; each newcomer falls onto the pile as it arrives, so the pile visibly stacks up.
  // Opened from the shelf, the page loads hidden under the book: keep that load light (no memories
  // yet) and let the whole pile stack on after the reveal.
  const [initialShown] = useState(() => (flying === year ? 0 : FIRST_PAINT));
  const [shown, setShown] = useState(initialShown);
  const [windowTop, setWindowTop] = useState(0);
  const [pileTop, setPileTop] = useState(0);
  const { height: screenH } = useWindowDimensions();
  useEffect(() => {
    if (!arrived || shown >= entries.length) return;
    const timer = setTimeout(() => setShown((n) => n + STACK_BATCH), STACK_TICK_MS);
    return () => clearTimeout(timer);
  }, [arrived, shown, entries.length]);

  const contentW = width - spacing.gutter * 2;
  const gap = spacing.md;
  const itemW = (contentW - gap * (scrap.tidyColumns - 1)) / scrap.tidyColumns;
  const cellH = itemW * CELL_RATIO;
  const headerH = (typography.month.lineHeight ?? 0) + spacing.lg;

  const { groups, items, scatterH, tidyH, headers } = useMemo(() => {
    const months = groupByMonth(entries);
    const tidied = tidyLayout(
      months.map((g) => g.entries.map((e) => e.id)),
      { itemW, cellH, columns: scrap.tidyColumns, gap, headerH, groupGap: spacing.xl, maxTilt: scrap.tidyTilt },
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
    };
  }, [entries, itemW, cellH, contentW, gap, headerH, scrap, spacing.xl]);

  useEffect(() => {
    const target = tidy ? 1 : 0;
    progress.set(reduceMotion ? withTiming(target, { duration: motion.imageFadeMs }) : withSpring(target, motion.tidy));
  }, [tidy, progress, reduceMotion, motion.imageFadeMs, motion.tidy]);

  const toggle = () => {
    tapHaptic();
    scroll.current?.scrollTo({ y: 0, animated: !reduceMotion });
    setTidy((t) => !t);
  };

  return (
    <View style={{ flex: 1 }} onLayout={() => setDrawn(true)}>
      <PaperBackground variant="dots" desk color={theme.dark ? undefined : palette.tint} />
      <ScrollView
        ref={scroll}
        scrollEventThrottle={64}
        onScroll={(e) => {
          const step = Math.floor(e.nativeEvent.contentOffset.y / WINDOW_STEP) * WINDOW_STEP;
          setWindowTop((prev) => (prev === step ? prev : step));
        }}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.xxxl * 3,
          paddingHorizontal: spacing.gutter,
        }}
      >
        <TopBar left={<CircleButton icon="chevron-back" tint={palette.primary} accessibilityLabel="Back" onPress={() => router.back()} />} />
        <View style={[styles.header, { marginBottom: spacing.xxl }]}>
          <ScreenTitle title={String(year)} count={entries.length} accent={palette.secondary} />
          {entries.length > 0 ? <Buddy mood="peek" accent={palette.primary} size={sizes.buddySmall} bump={tidy ? 1 : 0} /> : null}
        </View>

        {entries.length === 0 ? (
          <BuddySays mood="sleepy" accent={palette.primary} text="Nothing saved this year." />
        ) : (
          <LiteShadows>
          <View style={{ height: tidy ? tidyH : scatterH }} onLayout={(e) => setPileTop(e.nativeEvent.layout.y)}>
            {(arrived ? groups : []).map((group, i) => (
              <MonthHeader
                key={group.month}
                month={group.month}
                count={group.entries.length}
                top={headers[i] ?? 0}
                progress={progress}
                palette={palette}
              />
            ))}
            {/* The bottom of the pile is there as the screen slides in; once it has arrived, the rest
                drop on one by one, in stacking order, so the pile builds up. */}
            {items
              .filter(({ z, from, to }) => {
                if (z >= shown) return false;
                // Near the visible part of the page, in either the scattered or the tidy layout.
                const top = windowTop - pileTop - screenH * WINDOW_SCREENS;
                const bottom = windowTop - pileTop + screenH * (1 + WINDOW_SCREENS);
                const near = (y: number) => y + cellH * 1.5 > top && y < bottom;
                return near(from.y) || near(to.y);
              })
              .map(({ entry, z, from, to }) => (
                <SpreadItem
                  key={entry.id}
                  entry={entry}
                  z={z}
                  from={from}
                  to={to}
                  width={itemW}
                  height={cellH}
                  progress={progress}
                  // Only the opening stack-up falls in; memories built later while scrolling are simply there.
                  dropDelay={z < initialShown || reduceMotion || shown >= entries.length ? undefined : 0}
                />
              ))}
          </View>
          </LiteShadows>
        )}
        {entries.length > 0 ? <PageFooter label={`${year} · ${entries.length} ${entries.length === 1 ? 'page' : 'pages'}`} /> : null}
      </ScrollView>

      {entries.length > 1 ? (
        <View pointerEvents="box-none" style={[styles.floating, { bottom: insets.bottom + spacing.xl }]}>
          <View>
            <PillButton
              label={tidy ? 'Scatter' : 'Tidy up'}
              icon={tidy ? 'shuffle' : 'albums-outline'}
              tone="dark"
              onPress={toggle}
              accessibilityLabel={tidy ? 'Scatter the memories' : 'Tidy up by month'}
            />
          </View>
        </View>
      ) : null}
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
  /** Added after the slide-in: falls onto the pile after this many ms. Undefined = already in place. */
  dropDelay?: number;
}

const SpreadItem = memo(function SpreadItem({ entry, z, from, to, width, height, progress, dropDelay }: SpreadItemProps) {
  const { scrap, colors, radii, opacity, motion } = useTheme();
  // The slot supplies the tilt, so the object itself is drawn straight.
  const look = useMemo(() => ({ ...lookForEntry(entry, scrap.maxTilt, scrap.maxOffset), tilt: 0 }), [entry, scrap.maxTilt, scrap.maxOffset]);
  const drop = useSharedValue(dropDelay === undefined ? 1 : 0);
  useEffect(() => {
    if (dropDelay === undefined) return;
    drop.set(withDelay(dropDelay, withSpring(1, motion.drop)));
  }, [drop, dropDelay, motion.drop]);
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    const d = drop.get();
    return {
      opacity: d > 0.001 ? 1 : 0,
      transform: [
        { translateX: from.x + (to.x - from.x) * p },
        { translateY: from.y + (to.y - from.y) * p - (1 - d) * STACK_DROP_PX },
        { rotate: `${from.rotate + (to.rotate - from.rotate) * p + (1 - d) * 24}deg` },
        { scale: from.scale + (to.scale - from.scale) * p },
      ],
    };
  });
  return (
    <Animated.View style={[styles.item, { width, height, zIndex: z }, style]}>
      <View style={[styles.miniature, { width: width * MINIATURE, transform: [{ scale: 1 / MINIATURE }] }]}>
        {/* A flat offset shape stands in for the blurred paper shadow, which is too costly for a whole pile. */}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.shadowBase, opacity: opacity.pileShadow, borderRadius: radii.paper * 2, transform: [{ translateX: 4 }, { translateY: 6 }] },
          ]}
        />
        <ScrapObject
          entry={entry}
          look={look}
          raster={false}
          width={width * MINIATURE}
          numberOfLines={TIDY_NOTE_LINES}
          onPress={() => router.push(`/memory/${entry.id}`)}
        />
      </View>
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

/** Month heading for the tidy view: highlighted handwritten name, a count, and a sticker. Fades in as things settle. */
function MonthHeader({ month, count, top, progress, palette }: MonthHeaderProps) {
  const { colors, typography, spacing, sizes } = useTheme();
  const [w, setW] = useState(0);
  const lineH = typography.month.lineHeight ?? 0;
  const style = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * -spacing.md }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.month, { top, gap: spacing.sm }, style]}>
      <View>
        {w > 0 ? (
          <Doodle
            kind="highlight"
            width={w + spacing.sm}
            height={lineH}
            color={month % 2 ? palette.secondary : palette.primary}
            seed={month}
            style={{ position: 'absolute', left: -spacing.xs, top: spacing.xs }}
          />
        ) : null}
        <Text
          onLayout={(e) => setW(e.nativeEvent.layout.width)}
          numberOfLines={1}
          textBreakStrategy="simple"
          style={[typography.month, { color: colors.onDesk }]}
        >
          {monthName(month)}
        </Text>
      </View>
      <Text numberOfLines={1} style={[typography.hand, { color: colors.onDeskMuted, flex: 1 }]}>
        {count} {count === 1 ? 'memory' : 'memories'}
      </Text>
      <Sticker
        kind={STICKERS[month % STICKERS.length] ?? 'star'}
        size={sizes.stickerDecor}
        color={palette.secondary}
        color2={palette.primary}
        style={{ transform: [{ rotate: deg(month % 2 ? 12 : -12) }] }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  item: { position: 'absolute', left: 0, top: 0 },
  miniature: { position: 'absolute', left: 0, top: 0, transformOrigin: 'top left' },
  month: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center' },
  floating: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
