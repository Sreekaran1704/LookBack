import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { File, Paths } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { DiaryDock } from '../../components/DiaryDock';
import { PersonSeal } from '../../components/PersonSeal';
import { PressableScale } from '../../components/PressableScale';
import { PageFooter, PageHeader, Panel, usePageContentStyle } from '../../components/Screen';
import { PaperBackground } from '../../components/scrapbook/PaperBackground';
import { settingsRepository } from '../../data';
import { sharingRepository } from '../../data/sharingRepository';
import { useGonePeople, useOutbox, usePeople, useReceivedLetters } from '../../hooks/useSharing';
import { formatDisplayDate, toLocalDate } from '../../lib/dates';
import { groupByPerson } from '../../lib/sharedPeople';
import { useTheme } from '../../theme';

const uriOf = (path: string | null) => (path ? new File(Paths.document, path).uri : null);
const BIG_SEAL = 84;
const THUMB = 56;

/**
 * One person, opened from Shared: their portrait and name, then every page they gave you (newest first), each a row
 * with its date, what's in it and the start of its words. Tap one to read it. Remove takes them out of your people.
 */
export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, typography, spacing, control } = useTheme();
  const content = usePageContentStyle({ thumbBar: true });
  const people = usePeople();
  const letters = useReceivedLetters();
  const outbox = useOutbox();
  const gone = useGonePeople();
  const [removing, setRemoving] = useState(false);
  // Whether this person is the one on the "From your person" home-screen widget.
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    const load = () => settingsRepository.getWidgetPerson().then((p) => setPinned(p === id), () => undefined);
    load();
    return settingsRepository.subscribe(load);
  }, [id]);
  const group = groupByPerson(people, letters).find((g) => g.id === id) ?? null;
  const waiting = outbox.filter((o) => o.personId === id).length;
  const name = group?.name ?? 'Someone';

  const subtitle = !group
    ? 'not on this phone any more'
    : gone.has(id)
      ? 'their account is gone · add them again'
      : group.letters.length
        ? `${group.letters.length === 1 ? 'one page' : `${group.letters.length} pages`} given to you${waiting ? ` · ${waiting} waiting to go to them` : ''}`
        : waiting
          ? `${waiting} waiting to go to them`
          : 'nothing given yet · open a page and tap Give';

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground variant="dots" desk />
      <ScrollView contentContainerStyle={content}>
        <PageHeader title={name} subtitle={subtitle} accent={colors.gilt} buddy={false} />
        {group ? (
          <View style={{ alignItems: 'center' }}>
            <PersonSeal name={group.name} portrait={group.portrait} size={BIG_SEAL} hole={colors.desk} />
          </View>
        ) : null}
        {group?.letters.length ? (
          <Panel>
            <Text style={[typography.heading, { color: colors.ink }]}>From {name}</Text>
            {group.letters.map((l) => {
              const photo = uriOf(l.photoPath);
              const kinds = [l.voicePath ? 'recording' : null, l.photoPath ? 'photo' : null].filter(Boolean).join(' · ');
              return (
                <PressableScale key={l.id} onPress={() => router.push(`/letter/${l.id}`)} accessibilityRole="button" accessibilityLabel={`Open the page from ${formatDisplayDate(l.memoryDate)}`}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: control.height + 10, borderTopWidth: 1, borderTopColor: colors.ruleLine, paddingVertical: spacing.sm }}>
                    {photo ? (
                      <Image source={{ uri: photo }} style={{ width: THUMB, height: THUMB, borderRadius: 4 }} contentFit="cover" />
                    ) : (
                      <View style={{ width: THUMB, height: THUMB, borderRadius: 4, backgroundColor: colors.control, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={l.voicePath ? 'recording-outline' : 'document-text-outline'} size={24} color={colors.inkMuted} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={[typography.print, { color: colors.ink, fontWeight: l.openedAt ? '400' : '700' }]}>
                        {formatDisplayDate(l.memoryDate)}
                      </Text>
                      <Text numberOfLines={1} style={[typography.hand, { color: colors.inkBlue, fontSize: 18, lineHeight: 22 }]}>
                        {l.body.split('\n')[0] || l.voiceTitle || (l.photoPath ? 'a photo' : 'a recording')}
                      </Text>
                      <Text numberOfLines={1} style={[typography.caption, { color: colors.inkMuted, fontSize: 13, lineHeight: 17 }]}>
                        given {formatDisplayDate(toLocalDate(new Date(l.receivedAt)))}
                        {kinds ? ` · ${kinds}` : ''}
                      </Text>
                    </View>
                    {l.openedAt ? null : <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.sepia }} />}
                    <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
                  </View>
                </PressableScale>
              );
            })}
          </Panel>
        ) : null}
        <PageFooter label={`shared · ${name}`} />
      </ScrollView>
      <DiaryDock
        actions={[
          { key: 'back', label: 'Back', icon: 'chevron-back', onPress: () => router.back() },
          ...(group
            ? [{ key: 'widget', label: pinned ? 'On widget' : 'Widget', icon: pinned ? ('heart' as const) : ('heart-outline' as const), active: pinned, accessibilityLabel: pinned ? `Take ${name} off your home-screen widget` : `Show ${name}'s pages on your home-screen widget`, onPress: () => void settingsRepository.setWidgetPerson(pinned ? null : id) }]
            : []),
          ...(group?.person ? [{ key: 'remove', label: 'Remove', icon: 'person-remove-outline' as const, onPress: () => setRemoving(true) }] : []),
        ]}
      />
      <ConfirmSheet
        visible={removing}
        title={`Remove ${name}?`}
        message="They won't be offered your pages any more, and anything still waiting for them is dropped. Pages they gave you stay."
        confirmLabel="Remove"
        confirmIcon="close"
        onConfirm={() => {
          setRemoving(false);
          void sharingRepository.removePerson(id).then(() => router.back());
        }}
        onCancel={() => setRemoving(false)}
      />
    </View>
  );
}
