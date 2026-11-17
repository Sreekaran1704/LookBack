import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleButton, PillButton } from '../../components/Buttons';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { useNavBarSpace } from '../../components/NavBar';
import { HAND_TAIL, TopBar } from '../../components/Screen';
import { BuddySays } from '../../components/scrapbook/Buddy';
import { DropIn } from '../../components/scrapbook/DropIn';
import { PaperBackground } from '../../components/scrapbook/PaperBackground';
import { ScrapObject } from '../../components/scrapbook/ScrapObject';
import { ShredAway } from '../../components/scrapbook/ShredAway';
import { entriesRepository, type Entry } from '../../data';
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

  const [asking, setAsking] = useState(false);
  // The memory being shredded: kept here so the animation can show it while it is deleted underneath.
  const [shredding, setShredding] = useState<Entry | null>(null);

  const shred = () => {
    if (!entry) return;
    setAsking(false);
    setShredding(entry);
  };
  const afterShred = () => {
    const gone = shredding;
    if (!gone) return;
    entriesRepository
      .remove(gone.id)
      .then(() => router.back())
      .catch((error: unknown) => {
        setShredding(null);
        Alert.alert("Couldn't delete", error instanceof Error ? error.message : String(error));
      });
  };

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
          right={
            entry ? (
              <>
                <PillButton label="Delete" icon="trash-outline" accessibilityLabel="Delete this memory" onPress={() => setAsking(true)} />
                {isToday ? <PillButton label="Edit" icon="create-outline" onPress={() => router.push('/entry')} /> : null}
              </>
            ) : null
          }
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
      {entry ? (
        <ConfirmSheet
          visible={asking}
          title="Let this one go?"
          message={`Bun will forget the page from ${formatDisplayDate(entry.localDate)}${entry.photoPath ? ', photo and all' : ''}. It leaves this phone now and your Drive backup at the next backup. There's no getting it back.`}
          confirmLabel="Shred it"
          confirmIcon="cut-outline"
          onConfirm={shred}
          onCancel={() => setAsking(false)}
        />
      ) : null}
      {shredding ? <ShredAway entry={shredding} onDone={afterShred} /> : null}
    </View>
  );
}
