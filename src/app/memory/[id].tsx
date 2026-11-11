import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleButton, PillButton } from '../../components/Buttons';
import { useNavBarSpace } from '../../components/NavBar';
import { HAND_TAIL, TopBar } from '../../components/Screen';
import { BuddySays } from '../../components/scrapbook/Buddy';
import { DropIn } from '../../components/scrapbook/DropIn';
import { PaperBackground } from '../../components/scrapbook/PaperBackground';
import { ScrapObject } from '../../components/scrapbook/ScrapObject';
import { useEntry, useToday } from '../../hooks/useData';
import { formatDisplayDate, memoryKicker, parseLocalDate, toLocalDate } from '../../lib/dates';
import { useTheme } from '../../theme';

export default function MemoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { colors, spacing, sizes, typography } = theme;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const today = useToday();
  const { data: entry } = useEntry(id);
  const navSpace = useNavBarSpace();

  const palette = theme.year(parseLocalDate(entry?.localDate ?? today).year);
  const isToday = entry?.localDate === today;
  const kicker = entry ? memoryKicker(entry.localDate, today) : '';
  const savedOn = entry ? formatDisplayDate(toLocalDate(new Date(entry.createdAt))) : '';

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground variant="dots" desk />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.md,
          paddingBottom: navSpace,
          paddingHorizontal: spacing.gutter,
          gap: spacing.xl,
        }}
      >
        <TopBar
          left={<CircleButton icon="chevron-back" tint={palette.primary} accessibilityLabel="Back" onPress={() => router.back()} />}
          right={isToday ? <PillButton label="Edit" icon="create-outline" onPress={() => router.push('/entry')} /> : null}
        />
        {entry === null ? (
          <BuddySays mood="sleepy" accent={palette.primary} text="This memory isn't here anymore." />
        ) : entry ? (
          <>
            <Text style={[typography.headline, { color: colors.onDesk }]}>
              {kicker}
              {HAND_TAIL}
            </Text>
            <DropIn index={0} style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
              <ScrapObject entry={entry} width={width * sizes.detailWidthRatio} stamp lift={1.6} sway />
            </DropIn>
            {entry.photoPath && entry.text ? (
              <Text style={[typography.body, { color: colors.onDesk }]}>{entry.text}</Text>
            ) : null}
            {/* Full width + right-aligned: a shrink-wrapped Caveat label gets under-measured on Android and loses its last word. */}
            <Text style={[typography.hand, { color: colors.onDeskMuted, textAlign: 'right', transform: [{ rotate: '-2deg' }] }]}>
              saved on {savedOn}
            </Text>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
