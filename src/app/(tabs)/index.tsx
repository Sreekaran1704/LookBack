import { router } from 'expo-router';
import { memo, useCallback, useRef, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { PillButton } from '../../components/Buttons';
import { Raster } from '../../components/scrapbook/Raster';
import { useHomeTopRequest } from '../../components/NavBar';
import { PageFooter, PageHeader, SectionHeader, usePageContentStyle } from '../../components/Screen';
import { YearsCupboard } from '../../components/YearsCupboard';
import { Buddy, BuddySays } from '../../components/scrapbook/Buddy';
import { DropIn } from '../../components/scrapbook/DropIn';
import { MemoryLetters } from '../../components/scrapbook/MemoryLetters';
import { PaperBackground } from '../../components/scrapbook/PaperBackground';
import { ScrapObject } from '../../components/scrapbook/ScrapObject';
import { useAllEntries, useProfile, useToday } from '../../hooks/useData';
import { formatMonthDay, onThisDay, parseLocalDate } from '../../lib/dates';
import { useTheme } from '../../theme';

const TODAY_WIDTH_RATIO = 0.5;

function MemoriesScreen() {
  const theme = useTheme();
  const { colors, spacing, typography, sizes } = theme;
  const { width } = useWindowDimensions();
  const today = useToday();
  const { data: entries = [] } = useAllEntries();
  const { data: profile } = useProfile();
  // Tapping Home while on home scrolls back to the top.
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useHomeTopRequest(useCallback(() => scroll.current?.scrollTo({ y: 0, animated: true }), []));

  const memories = onThisDay(entries, today);
  const todayEntry = entries.find((e) => e.localDate === today);
  const thisYear = theme.year(parseLocalDate(today).year);
  const contentW = width - spacing.gutter * 2;
  const pageContent = usePageContentStyle();

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground variant="dots" desk />
      <ScrollView
        ref={scroll}
        contentContainerStyle={pageContent}
      >
        {/* The cover: the app's name, and a hello from the bunny. Adding and settings live in the bar at the bottom. */}
        <PageHeader
          title="LookBack"
          subtitle={profile?.name ? `hi, ${profile.name} ✿` : 'one small thing a day ✿'}
          accent={thisYear.secondary}
          buddyAccent={thisYear.primary}
          wall
        />

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
                <Buddy mood="happy" accent={thisYear.primary} size={sizes.buddySmall} tappable />
                <Text style={[typography.caption, { color: colors.onDeskMuted }]}>Saved. See you next year.</Text>
                {/* A texture: its soft shadow would otherwise be blurred again every frame the bunnies bob. */}
                <Raster style={{ alignSelf: 'flex-start' }}>
                  <PillButton label="Edit today" icon="create-outline" onPress={() => router.push('/entry')} />
                </Raster>
              </View>
            </View>
          ) : (
            <View style={{ gap: spacing.lg }}>
              <BuddySays mood="wave" accent={thisYear.primary} text="What's one small thing from today?" />
              <Raster>
              <PillButton
              label="Add today's moment"
              icon="add"
              tone="dark"
              large
              onPress={() => router.push('/entry')}
            />
              </Raster>
            </View>
          )}
        </View>

        <View>
          <SectionHeader title="Years" accent={thisYear.primary} />
          <YearsCupboard entries={entries} today={today} width={contentW} dropFrom={2} />
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

// Memoised, ignoring props: the page slider re-renders every page when the route changes, and the first time the bar
// opens a page the router hands it a new route object, which rebuilt the whole page once (Settings: 90 ms, the stutter at
// the end of the first swipe to it). The page reads everything it needs through hooks, so its props never matter.
export default memo(MemoriesScreen, () => true);
