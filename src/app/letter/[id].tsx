import { Image } from 'expo-image';
import { File, Paths } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { DiaryDock } from '../../components/DiaryDock';
import { PageHeader, Panel, usePageContentStyle } from '../../components/Screen';
import { PaperBackground } from '../../components/scrapbook/PaperBackground';
import { LiftedCassette, TapeRecorder, useCassetteLift } from '../../components/scrapbook/TapeRecorder';
import { sharingRepository } from '../../data/sharingRepository';
import { useReceivedLetter } from '../../hooks/useSharing';
import { useTapeDeck } from '../../hooks/useTapeDeck';
import { useVoicePlayback } from '../../hooks/useVoicePlayback';
import { formatDisplayDate, toLocalDate } from '../../lib/dates';
import { useTheme } from '../../theme';

const uriOf = (path: string | null) => (path ? new File(Paths.document, path).uri : null);

/** A page someone gave you, read from this phone (it came straight from theirs; it was never online). */
export default function LetterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, typography, spacing } = useTheme();
  const content = usePageContentStyle({ thumbBar: true });
  const letter = useReceivedLetter(id);
  const [cardW, setCardW] = useState(300);
  const [removing, setRemoving] = useState(false);
  useEffect(() => {
    if (letter && !letter.openedAt) void sharingRepository.markOpened(letter.id);
  }, [letter]);
  const photo = uriOf(letter?.photoPath ?? null);
  const voice = uriOf(letter?.voicePath ?? null);
  const player = useVoicePlayback(voice);
  const deck = useTapeDeck(player);
  const lift = useCassetteLift(deck);
  const label = letter?.voiceTitle || 'Something for you';
  return (
    <View style={{ flex: 1 }}>
      <PaperBackground desk />
      <ScrollView contentContainerStyle={content}>
        <PageHeader
          title={letter ? `From ${letter.senderName}` : 'A page for you'}
          subtitle={letter ? `a page from ${formatDisplayDate(letter.memoryDate)}` : letter === null ? "this page isn't on this phone" : 'opening it…'}
          accent={colors.gilt}
          buddy={false}
        />
        {letter ? (
          <>
            <Panel>
              <View onLayout={(e) => setCardW(e.nativeEvent.layout.width)} style={{ gap: spacing.lg }}>
                {photo ? <Image source={{ uri: photo }} style={{ width: '100%', aspectRatio: 1 }} contentFit="contain" accessibilityLabel={`Photo from ${letter.senderName}`} /> : null}
                {letter.body ? <Text style={[typography.hand, { color: colors.inkBlue }]}>{letter.body}</Text> : null}
                <Text style={[typography.caption, { color: colors.inkMuted }]}>given to you {formatDisplayDate(toLocalDate(new Date(letter.receivedAt)))} · kept on this phone</Text>
              </View>
            </Panel>
            {voice && player ? <TapeRecorder width={cardW} player={player} label={label} deck={deck} lift={lift} /> : null}
          </>
        ) : null}
      </ScrollView>
      <DiaryDock
        actions={[
          { key: 'back', label: 'Back', icon: 'chevron-back', onPress: () => router.back() },
          ...(letter ? [{ key: 'remove', label: 'Remove', icon: 'trash-outline' as const, onPress: () => setRemoving(true) }] : []),
        ]}
      />
      {voice && player ? <LiftedCassette lift={lift} label={label} player={player} deck={deck} /> : null}
      <ConfirmSheet
        visible={removing}
        title="Remove this page?"
        message="It's only on this phone, so once it's gone it's gone. You'd have to ask them to give it again."
        confirmLabel="Remove"
        confirmIcon="trash-outline"
        onConfirm={() => {
          setRemoving(false);
          void sharingRepository.removeLetter(id).then(() => router.back());
        }}
        onCancel={() => setRemoving(false)}
      />
    </View>
  );
}
