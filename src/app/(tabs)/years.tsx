import { memo } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { useNavScroll } from '../../components/NavBar';
import { PageFooter, PageHeader, usePageContentStyle } from '../../components/Screen';
import { YearsCupboard } from '../../components/YearsCupboard';
import { PaperBackground } from '../../components/scrapbook/PaperBackground';
import { useAllEntries, useToday } from '../../hooks/useData';
import { groupByYear, parseLocalDate } from '../../lib/dates';
import { useTheme } from '../../theme';

/** Every year's diary in the cupboard, on a page of its own (the bar's Years button). Tap a spine to open that year. */
function YearsScreen() {
  const theme = useTheme();
  const { spacing } = theme;
  const pageContent = usePageContentStyle();
  const onScroll = useNavScroll();
  const { width } = useWindowDimensions();
  const today = useToday();
  const { data: entries = [] } = useAllEntries();
  const palette = theme.year(parseLocalDate(today).year);
  const years = groupByYear(entries);
  const oldest = years[years.length - 1]?.year;

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground variant="dots" desk />
      <Animated.ScrollView contentContainerStyle={pageContent} onScroll={onScroll} scrollEventThrottle={16}>
        <PageHeader
          title="Years"
          count={years.length > 0 ? years.length : undefined}
          subtitle={
            oldest !== undefined
              ? `${entries.length} ${entries.length === 1 ? 'memory' : 'memories'} since ${oldest}.\nOpen a year. Meet yourself again.`
              : 'Your diaries will stand here.'
          }
          accent={palette.secondary}
          buddyAccent={palette.primary}
          wall
        />
        <YearsCupboard entries={entries} today={today} width={width - spacing.gutter * 2} />
        <PageFooter label="the bookshelf" />
      </Animated.ScrollView>
    </View>
  );
}

// Memoised, ignoring props: the page slider re-renders every page when the route changes, and the first time the bar
// opens a page the router hands it a new route object, which rebuilt the whole page once (Settings: 90 ms, the stutter at
// the end of the first swipe to it). The page reads everything it needs through hooks, so its props never matter.
export default memo(YearsScreen, () => true);
