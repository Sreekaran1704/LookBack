import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { ActionBar, PageFooter, PageHeader, usePageContentStyle, type BarAction } from '../../components/Screen';
import { BuddySays } from '../../components/scrapbook/Buddy';
import { DropIn } from '../../components/scrapbook/DropIn';
import { PaperBackground } from '../../components/scrapbook/PaperBackground';
import { ScrapObject } from '../../components/scrapbook/ScrapObject';
import { ShredAway } from '../../components/scrapbook/ShredAway';
import { entriesRepository, resolveVoiceUri, type Entry } from '../../data';
import { useVoicePlayback } from '../../hooks/useVoicePlayback';
import { useAfterTransition } from '../../hooks/useAfterTransition';
import { useEntry, useToday } from '../../hooks/useData';
import { planPolaroidWords } from '../../lib/polaroid';
import { formatDisplayDate, formatMonthDay, memoryKicker, parseLocalDate, toLocalDate } from '../../lib/dates';
import { useTheme } from '../../theme';

export default function MemoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { colors, spacing, sizes, typography } = theme;
  const { width } = useWindowDimensions();
  const today = useToday();
  const { data: entry } = useEntry(id);
  const pageContent = usePageContentStyle({ thumbBar: true });

  const palette = theme.year(parseLocalDate(entry?.localDate ?? today).year);
  const kicker = entry ? memoryKicker(entry.localDate, today) : '';
  const savedOn = entry ? formatDisplayDate(toLocalDate(new Date(entry.createdAt))) : '';

  const [asking, setAsking] = useState(false);
  // A polaroid whose words are on its back: tap it (or the pill) to turn it over.
  const [flipped, setFlipped] = useState(false);
  // A polaroid (a photo, or a voice note) whose words are on its back. With a photo and a voice note the waveform has the strip.
  const isPolaroid = entry?.photoPath != null || entry?.voicePath != null;
  const hasBack = entry != null && isPolaroid && planPolaroidWords(entry.text, undefined, undefined, entry.photoPath != null && entry.voicePath != null).back !== null;
  // The page slides in light (paper, title, buttons); the memory itself (photo decode, polaroid, audio player) is built
  // once it has arrived, then drops in. Building it mid-slide cost a frame of over a second.
  const arrived = useAfterTransition(theme.motion.screenFallbackMs);
  const voicePlayer = useVoicePlayback(arrived && entry?.voicePath ? resolveVoiceUri(entry.voicePath) : null);
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

  const actions: BarAction[] = [{ key: 'back', icon: 'chevron-back', label: 'Back', tint: palette.primary, onPress: () => router.back() }];
  if (entry && voicePlayer) {
    actions.push({ key: 'play', icon: voicePlayer.playing ? 'pause' : 'play', label: voicePlayer.playing ? 'Pause' : 'Listen', tint: palette.primary, active: voicePlayer.playing, onPress: voicePlayer.toggle });
  }
  if (entry && hasBack) {
    actions.push({ key: 'turn', icon: 'sync-outline', label: flipped ? 'Turn back' : 'Turn over', tint: palette.primary, active: flipped, onPress: () => setFlipped((f) => !f) });
  }
  if (entry) actions.push({ key: 'delete', icon: 'trash-outline', label: 'Delete', accessibilityLabel: 'Delete this memory', onPress: () => setAsking(true) });

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground variant="dots" desk />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={pageContent}>
        {/* The date is the title (it always fits one line); how long ago it was goes under it. */}
        <PageHeader
          title={entry ? formatMonthDay(entry.localDate) : 'A memory'}
          subtitle={entry ? `${kicker} · ${parseLocalDate(entry.localDate).year}` : undefined}
          accent={palette.secondary}
          buddyAccent={palette.primary}
          buddy={entry !== null}
        />
        {entry === null ? (
          <BuddySays mood="sleepy" accent={palette.primary} text="This memory isn't here anymore." />
        ) : entry ? (
          <>
            <DropIn key={arrived ? 'in' : 'wait'} index={0} style={{ alignItems: 'center', paddingVertical: spacing.xl, minHeight: width * sizes.detailWidthRatio * 1.3 }}>
              {arrived ? (
              <ScrapObject
                entry={entry}
                width={width * sizes.detailWidthRatio}
                stamp={!flipped}
                lift={1.6}
                sway
                flipped={flipped}
                voicePlayer={voicePlayer}
                // A voice memory plays when tapped (the play button too); it turns over with the P.T.O pill.
                onPress={voicePlayer && !flipped ? voicePlayer.toggle : hasBack ? () => setFlipped((f) => !f) : undefined}
              />
              ) : null}
            </DropIn>
            {/* Full width + right-aligned: a shrink-wrapped Caveat label gets under-measured on Android and loses its last word. */}
            <Text style={[typography.hand, { color: colors.onDeskMuted, textAlign: 'right', transform: [{ rotate: '-2deg' }] }]}>
              saved on {savedOn}
            </Text>
            <PageFooter label={`a page from ${parseLocalDate(entry.localDate).year}`} />
          </>
        ) : null}
      </ScrollView>
      {/* The page's buttons at the foot, in reach of a thumb. Today's page is edited from the bar's + (it turns into a pencil), so no Edit here. */}
      <ActionBar withNavBar={false} actions={actions} />
      {entry ? (
        <ConfirmSheet
          visible={asking}
          title="Let this one go?"
          message={`Bun will forget the page from ${formatDisplayDate(entry.localDate)}${entry.photoPath ? ', photo and all' : entry.voicePath ? ', voice and all' : ''}. It leaves this phone now and your Drive backup at the next backup. There's no getting it back.`}
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
