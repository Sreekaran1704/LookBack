import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavBarSpace } from '../../components/NavBar';
import { PageFooter, ScreenTitle } from '../../components/Screen';
import { YearsCupboard } from '../../components/YearsCupboard';
import { Buddy } from '../../components/scrapbook/Buddy';
import { PaperBackground } from '../../components/scrapbook/PaperBackground';
import { useAllEntries, useToday } from '../../hooks/useData';
import { groupByYear, parseLocalDate } from '../../lib/dates';
import { useTheme } from '../../theme';

/** Every year's diary in the cupboard, on a page of its own (the bar's Years button). Tap a spine to open that year. */
export default function YearsScreen() {
  const theme = useTheme();
  const { colors, spacing, typography, sizes } = theme;
  const insets = useSafeAreaInsets();
  const navSpace = useNavBarSpace();
  const { width } = useWindowDimensions();
  const today = useToday();
  const { data: entries = [] } = useAllEntries();
  const palette = theme.year(parseLocalDate(today).year);
  const years = groupByYear(entries);
  const oldest = years[years.length - 1]?.year;

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground variant="dots" desk />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: navSpace, paddingHorizontal: spacing.gutter, gap: spacing.xl }}>
        <View style={[styles.row, { gap: spacing.md }]}>
          <View style={{ flex: 1 }}>
            <ScreenTitle title="Years" count={years.length > 0 ? years.length : undefined} accent={palette.secondary} />
            <Text style={[typography.hand, { color: colors.onDeskMuted, marginTop: spacing.xs }]}>
              {oldest !== undefined
                ? `${entries.length} ${entries.length === 1 ? 'memory' : 'memories'} since ${oldest}. Tap a diary to open it.`
                : 'Your diaries will stand here.'}
            </Text>
          </View>
          <Buddy mood="peek" accent={palette.primary} size={sizes.buddySmall} />
        </View>
        <YearsCupboard entries={entries} today={today} width={width - spacing.gutter * 2} />
        <PageFooter label="the bookshelf" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
});
