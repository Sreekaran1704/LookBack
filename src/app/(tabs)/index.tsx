import { router } from 'expo-router';
import { useCallback, useRef, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PillButton } from '../../components/Buttons';
import { useHomeTopRequest, useNavBarSpace } from '../../components/NavBar';
import { PageFooter, ScreenTitle, SectionHeader } from '../../components/Screen';
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

export default function MemoriesScreen() {
  const theme = useTheme();
  const { colors, spacing, typography, sizes } = theme;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const today = useToday();
  const { data: entries = [] } = useAllEntries();
  const { data: profile } = useProfile();
  const navSpace = useNavBarSpace();
  // Tapping Home while on home scrolls back to the top.
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useHomeTopRequest(useCallback(() => scroll.current?.scrollTo({ y: 0, animated: true }), []));

  const memories = onThisDay(entries, today);
  const todayEntry = entries.find((e) => e.localDate === today);
  const thisYear = theme.year(parseLocalDate(today).year);
  const contentW = width - spacing.gutter * 2;

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground variant="dots" desk />
      <ScrollView
        ref={scroll}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.md,
          paddingBottom: navSpace,
          paddingHorizontal: spacing.gutter,
          gap: spacing.xxl,
        }}
      >
        {/* The cover: the app's name, and a hello from the bunny. Adding and settings live in the bar at the bottom. */}
        <View style={[styles.cover, { gap: spacing.md }]}>
          <View style={{ flex: 1 }}>
            <ScreenTitle title="LookBack" accent={thisYear.secondary} />
            {/* Full width: a shrink-wrapped Caveat label gets under-measured on Android. */}
            <Text style={[typography.hand, { color: colors.onDeskMuted, marginTop: spacing.xs }]}>
              {profile?.name ? `hi, ${profile.name} ✿` : 'one small thing a day ✿'}
            </Text>
          </View>
          <Buddy mood="peek" accent={thisYear.primary} size={sizes.buddySmall} />
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
  cover: { flexDirection: 'row', alignItems: 'flex-end' },
});
