import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { PillButton } from '../../components/Buttons';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { DiaryDock } from '../../components/DiaryDock';
import { PersonSeal } from '../../components/PersonSeal';
import { PressableScale } from '../../components/PressableScale';
import { PageFooter, PageHeader, Panel, usePageContentStyle } from '../../components/Screen';
import { PaperBackground } from '../../components/scrapbook/PaperBackground';
import { settingsRepository } from '../../data';
import { sharingRepository } from '../../data/sharingRepository';
import { useAppOpen } from '../../hooks/useAppOpen';
import { useAllEntries } from '../../hooks/useData';
import { useGivenPages, usePeople, useReceivedLetters } from '../../hooks/useSharing';
import { formatDisplayDate } from '../../lib/dates';
import { groupByPerson } from '../../lib/sharedPeople';
import { useTheme, withAlpha } from '../../theme';

const BIG_SEAL = 140;
const TILE = 100;

/**
 * A friend's profile, its own page (opened from their portrait at the top of your chat, growing out of it): their
 * portrait big, whether you're friends, the best-friend heart, Show on widget (with a note on what that does), Remove,
 * and "Your memories together": only the pages you've given each other, no words.
 */
export default function FriendScreen() {
  const { id, x, y } = useLocalSearchParams<{ id: string; x?: string; y?: string }>();
  const open = useAppOpen({ x, y });
  const theme = useTheme();
  const { colors, typography, spacing } = theme;
  const content = usePageContentStyle({ thumbBar: true });
  const people = usePeople();
  const letters = useReceivedLetters();
  const given = useGivenPages(id);
  const { data: entries } = useAllEntries();
  const [removing, setRemoving] = useState(false);
  const [widgetNote, setWidgetNote] = useState(false);
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    const load = () => settingsRepository.getWidgetPerson().then((p) => setPinned(p === id), () => undefined);
    load();
    return settingsRepository.subscribe(load);
  }, [id]);

  const group = groupByPerson(people, letters).find((g) => g.id === id) ?? null;
  const person = group?.person ?? null;
  const name = group?.name ?? 'Someone';
  const best = !!person?.best;

  // The memories you've given each other: pages only, newest first.
  const memories = [
    ...(group?.letters ?? []).map((l) => ({ key: `in-${l.id}`, at: l.receivedAt, date: l.memoryDate, photo: l.photoPath, voice: !!l.voicePath, open: () => router.push(`/letter/${l.id}`) })),
    ...given.map((g) => {
      const entry = entries?.find((e) => e.id === g.entryId) ?? null;
      return { key: `out-${g.id}`, at: g.givenAt, date: entry?.localDate ?? g.memoryDate, photo: entry?.photoPath ?? null, voice: !!entry?.voicePath, open: entry ? () => router.push(`/memory/${entry.id}`) : null };
    }),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <Animated.View style={open.style} onLayout={open.onLayout} renderToHardwareTextureAndroid={open.layer} needsOffscreenAlphaCompositing={false}>
      <PaperBackground variant="dots" desk />
      <ScrollView contentContainerStyle={content}>
        <PageHeader title={`${name}${best ? ' ❤️' : ''}`} subtitle={person?.friends ? 'friends · you added each other' : person ? "you added them · they haven't added you back" : 'not one of your people'} accent={colors.gilt} buddy={false} />
        {group ? (
          <View style={{ alignItems: 'center' }}>
            {/* The film portrait is an SVG (painted on the CPU): a plain frame stands in until the page has opened. */}
            {open.ready ? <PersonSeal name={group.name} portrait={group.portrait} size={BIG_SEAL} hole={colors.desk} /> : <View style={{ width: (BIG_SEAL * 64) / 78, height: BIG_SEAL, borderRadius: 3, backgroundColor: colors.ink }} />}
          </View>
        ) : null}
        {person ? (
          <View style={{ gap: spacing.sm }}>
            <PillButton label={best ? 'Best friends ❤️' : 'Make them your best friend'} icon={best ? 'heart' : 'heart-outline'} tone={best ? 'dark' : 'paper'} onPress={() => void sharingRepository.setBest(id, !best)} />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <PillButton
                label={pinned ? 'On your widget' : 'Show on widget'}
                icon="apps-outline"
                grow
                onPress={() => {
                  if (pinned) {
                    void settingsRepository.setWidgetPerson(null);
                    return;
                  }
                  void settingsRepository.setWidgetPerson(id);
                  setWidgetNote(true);
                }}
              />
              <PillButton label="Remove" icon="person-remove-outline" grow onPress={() => setRemoving(true)} />
            </View>
          </View>
        ) : null}
        {open.ready ? (
          <Panel>
            <Text style={[typography.heading, { color: colors.ink }]}>Your memories together</Text>
            {memories.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {memories.map((m) => (
                  <PressableScale key={m.key} onPress={m.open ?? undefined} disabled={!m.open} accessibilityRole="button" accessibilityLabel={`The page from ${m.date ? formatDisplayDate(m.date) : 'that day'}`}>
                    {m.photo ? (
                      <Image source={{ uri: sharingRepository.fileUri(m.photo) }} style={{ width: TILE, height: TILE, borderRadius: 6 }} contentFit="cover" />
                    ) : (
                      <View style={{ width: TILE, height: TILE, borderRadius: 6, backgroundColor: withAlpha(colors.ink, 0.07), alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <Ionicons name={m.voice ? 'recording-outline' : 'document-text-outline'} size={30} color={colors.inkMuted} />
                        <Text style={[typography.caption, { color: colors.inkMuted, fontSize: 12, lineHeight: 15, textAlign: 'center', alignSelf: 'stretch' }]}>{m.date ? formatDisplayDate(m.date) : ''}</Text>
                      </View>
                    )}
                  </PressableScale>
                ))}
              </View>
            ) : (
              <Text style={[typography.caption, { color: colors.inkMuted }]}>None yet. Give them a page and it shows here.</Text>
            )}
          </Panel>
        ) : null}
        <PageFooter label={`friends · ${name}`} />
      </ScrollView>
      <DiaryDock actions={[{ key: 'back', label: 'Back', icon: 'chevron-back', onPress: open.close }]} />
      <ConfirmSheet
        visible={widgetNote}
        single
        mood="happy"
        title={`${name} is on your widget`}
        message={`The "From your person" widget on your home screen now shows the pages ${name} gives you. Add it from your home screen's widgets if it isn't there yet.`}
        confirmLabel="Lovely"
        cancelLabel="Lovely"
        onConfirm={() => setWidgetNote(false)}
        onCancel={() => setWidgetNote(false)}
      />
      <ConfirmSheet
        visible={removing}
        title={`Remove ${name}?`}
        message="You won't be friends any more: no pages or messages between you until you add each other again. What you've shared stays unless you both remove each other."
        confirmLabel="Remove"
        confirmIcon="close"
        onConfirm={() => {
          setRemoving(false);
          void sharingRepository.removePerson(id).then(() => router.dismissTo('/shared'));
        }}
        onCancel={() => setRemoving(false)}
      />
    </Animated.View>
  );
}
