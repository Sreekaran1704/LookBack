import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleButton, PillButton } from '../components/Buttons';
import { PageFooter, ScreenTitle, SectionHeader, TopBar } from '../components/Screen';
import { useBookFlight } from '../components/BookFlight';
import { BookSpine, spineSize } from '../components/scrapbook/BookSpine';
import { BOOK_GAP, CUPBOARD_FRAME, Cupboard, SHELF_INSET } from '../components/scrapbook/Cupboard';
import { Buddy, BuddySays } from '../components/scrapbook/Buddy';
import { DropIn } from '../components/scrapbook/DropIn';
import { MemoryLetters } from '../components/scrapbook/MemoryLetters';
import { PaperBackground } from '../components/scrapbook/PaperBackground';
import { ScrapObject } from '../components/scrapbook/ScrapObject';
import { useAllEntries, useToday } from '../hooks/useData';
import { formatMonthDay, groupByYear, onThisDay, parseLocalDate } from '../lib/dates';
import { useTheme } from '../theme';

const TODAY_WIDTH_RATIO = 0.5;

export default function MemoriesScreen() {
  const theme = useTheme();
  const { colors, spacing, scrap, typography, sizes } = theme;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const today = useToday();
  const { data: entries = [] } = useAllEntries();

  const memories = onThisDay(entries, today);
  const years = groupByYear(entries);
  const todayEntry = entries.find((e) => e.localDate === today);
  const thisYear = theme.year(parseLocalDate(today).year);
  const contentW = width - spacing.gutter * 2;
  const flight = useBookFlight();
  // The diary as it appears once pulled out (the flying cover), and the books on the shelves.
  const albumW = (contentW - spacing.xl) / scrap.collageColumns;
  const shelfW = contentW - CUPBOARD_FRAME * 2 - SHELF_INSET * 2;
  // Oldest on the left, newest on the right, as you would shelve them; a shelf fills before the next.
  const shelves = useMemo(() => {
    const out: (typeof years)[] = [[]];
    let used = 0;
    for (const group of [...years].reverse()) {
      const w = spineSize(group.year, sizes.spineMax).width + BOOK_GAP;
      // Leave room for the bunny bookend at the end of the shelf.
      if (used + w > shelfW - sizes.buddySmall && (out[out.length - 1]?.length ?? 0) > 0) {
        out.push([]);
        used = 0;
      }
      out[out.length - 1]?.push(group);
      used += w;
    }
    return out;
  }, [years, sizes.spineMax, sizes.buddySmall, shelfW]);

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground variant="dots" desk wash={thisYear.tint} />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.xxxl * 2,
          paddingHorizontal: spacing.gutter,
          gap: spacing.xxl,
        }}
      >
        <View>
          {/* Title shares the row with the buttons. */}
          <TopBar
            left={<ScreenTitle title="Memories" count={entries.length > 0 ? entries.length : undefined} accent={thisYear.secondary} />}
            right={
              <>
                <CircleButton icon="settings-outline" accessibilityLabel="Settings" onPress={() => router.push('/settings')} />
                <CircleButton
                  icon="add"
                  tint={thisYear.primary}
                  accessibilityLabel="Add today's moment"
                  onPress={() => router.push('/entry')}
                />
              </>
            }
          />
        </View>

        <View>
          <SectionHeader title="On this day" detail={formatMonthDay(today)} accent={thisYear.primary} />
          {memories.length > 0 ? (
            <MemoryLetters entries={memories} today={today} onOpen={(id) => router.push(`/memory/${id}`)} />
          ) : (
            <BuddySays
              mood="sleepy"
              accent={thisYear.primary}
              text="Nothing from this day yet. Whatever you save today comes back next year."
            />
          )}
        </View>

        <View>
          <SectionHeader title="Today" accent={thisYear.primary} />
          {todayEntry ? (
            <View style={[styles.todayRow, { gap: spacing.lg }]}>
              <DropIn index={1}>
                <ScrapObject
                  entry={todayEntry}
                  width={contentW * TODAY_WIDTH_RATIO}
                  numberOfLines={4}
                  onPress={() => router.push(`/memory/${todayEntry.id}`)}
                />
              </DropIn>
              <View style={{ flex: 1, gap: spacing.md }}>
                <Buddy mood="happy" accent={thisYear.primary} size={sizes.buddySmall} />
                <Text style={[typography.caption, { color: colors.onDeskMuted }]}>Saved. See you next year.</Text>
                <PillButton label="Edit today" icon="create-outline" onPress={() => router.push('/entry')} />
              </View>
            </View>
          ) : (
            <View style={{ gap: spacing.lg }}>
              <BuddySays mood="wave" accent={thisYear.primary} text="What's one small thing from today?" />
              <PillButton
              label="Add today's moment"
              icon="add"
              tone="dark"
              large
              onPress={() => router.push('/entry')}
            />
            </View>
          )}
        </View>

        <View>
          <SectionHeader title="Years" accent={thisYear.primary} />
          {years.length === 0 ? (
            <Text style={[typography.caption, { color: colors.onDeskMuted }]}>Nothing here yet. Add today&apos;s moment.</Text>
          ) : (
            <Cupboard
              width={contentW}
              shelves={shelves.map((shelf) =>
                shelf.map((group, i) => {
                  const age = parseLocalDate(today).year - group.year;
                  return (
                    <DropIn key={group.year} index={i + 2}>
                      <BookSpine
                        year={group.year}
                        count={group.entries.length}
                        age={age}
                        maxHeight={sizes.spineMax}
                        hidden={flight.flying === group.year}
                        onPress={(frame) =>
                          flight.fly({ year: group.year, count: group.entries.length, age, width: albumW, spineMax: sizes.spineMax, frame })
                        }
                      />
                    </DropIn>
                  );
                }),
              )}
              decor={<Buddy mood="happy" size={sizes.buddySmall} entrance={false} accent={thisYear.primary} />}
            />
          )}
        </View>
        <PageFooter label="page 1 · the cover" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' },
  todayRow: { flexDirection: 'row', alignItems: 'center' },
});
