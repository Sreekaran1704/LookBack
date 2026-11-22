import { router } from 'expo-router';
import { memo, useCallback, useRef, type ComponentRef } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { useHomeTopRequest, useNavScroll } from '../../components/NavBar';
import { PageFooter, PageHeader, SectionHeader, usePageContentStyle } from '../../components/Screen';
import { TodaySpread } from '../../components/TodaySpread';
import { YearsCupboard } from '../../components/YearsCupboard';
import { BuddySays } from '../../components/scrapbook/Buddy';
import { MemoryLetters } from '../../components/scrapbook/MemoryLetters';
import { PaperBackground } from '../../components/scrapbook/PaperBackground';
import { useAllEntries, useProfile, useToday } from '../../hooks/useData';
import { formatMonthDay, onThisDay, parseLocalDate } from '../../lib/dates';
import { useTheme } from '../../theme';

/** Wait for the keyboard to start rising before bringing today's page up above it. */
const WRITE_SCROLL_DELAY_MS = 250;

function MemoriesScreen() {
  const theme = useTheme();
  const { spacing } = theme;
  const { width } = useWindowDimensions();
  const today = useToday();
  const { data: entries = [] } = useAllEntries();
  const { data: profile } = useProfile();
  // Tapping Home while on home scrolls back to the top.
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  // Where "Today" sits on the page, so writing can bring it up above the keyboard.
  const todayY = useRef(0);
  const onScroll = useNavScroll();
  useHomeTopRequest(useCallback(() => scroll.current?.scrollTo({ y: 0, animated: true }), []));

  const memories = onThisDay(entries, today);
  const todayEntry = entries.find((e) => e.localDate === today);
  const thisYear = theme.year(parseLocalDate(today).year);
  const contentW = width - spacing.gutter * 2;
  const pageContent = usePageContentStyle();

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground variant="dots" desk />
      <Animated.ScrollView ref={scroll} contentContainerStyle={pageContent} keyboardShouldPersistTaps="handled" onScroll={onScroll} scrollEventThrottle={16}>
        {/* The cover: the app's name tooled in gilt, a hello, and the emblem. Writing and settings live in the bar at the bottom. */}
        <PageHeader
          title="Your memories"
          subtitle={profile?.name ? `a little of your life, ${profile.name}` : 'a little of your life, kept for you'}
          accent={thisYear.secondary}
          buddyAccent={thisYear.primary}
          wall
        />

        <View>
          <SectionHeader title="From your past self" detail={formatMonthDay(today)} accent={thisYear.primary} />
          {memories.length > 0 ? (
            <MemoryLetters entries={memories} today={today} onOpen={(id) => router.push(`/memory/${id}`)} />
          ) : (
            <BuddySays
              mood="sleepy"
              accent={thisYear.primary}
              text="Nothing came back today. Whatever you write now returns to you on this day next year."
            />
          )}
        </View>

        <View onLayout={(e) => (todayY.current = e.nativeEvent.layout.y)}>
          <SectionHeader title="Today’s page" accent={thisYear.primary} />
          {/* The diary lying open at today's page: you write on it right here. */}
          <TodaySpread
            entry={todayEntry ?? null}
            today={today}
            width={contentW}
            onOpen={() => todayEntry && router.push(`/memory/${todayEntry.id}`)}
            onWrite={() => router.push('/entry')}
            onStartWriting={() => setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, todayY.current - spacing.md), animated: true }), WRITE_SCROLL_DELAY_MS)}
          />
        </View>

        <View>
          <SectionHeader title="Years" accent={thisYear.primary} />
          <YearsCupboard entries={entries} today={today} width={contentW} dropFrom={2} />
        </View>
        <PageFooter label="page 1 · the cover" />
      </Animated.ScrollView>
    </View>
  );
}


// Memoised, ignoring props: the page slider re-renders every page when the route changes, and the first time the bar
// opens a page the router hands it a new route object, which rebuilt the whole page once (Settings: 90 ms, the stutter at
// the end of the first swipe to it). The page reads everything it needs through hooks, so its props never matter.
export default memo(MemoriesScreen, () => true);
