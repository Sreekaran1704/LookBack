import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { DiaryDock } from '../components/DiaryDock';
import { GiftFlight, type FlightState } from '../components/GiftFlight';
import { MyCard, NearbyPeople, ScanPerson } from '../components/People';
import { PersonButton } from '../components/PersonSeal';
import { PageHeader, Panel, usePageContentStyle, type BarAction } from '../components/Screen';
import { PaperBackground } from '../components/scrapbook/PaperBackground';
import { Texture } from '../components/scrapbook/Texture';
import { sheetIn, sheetOut } from '../components/transitions';
import { accountRepository, type AccountStatus } from '../data';
import { sharingRepository } from '../data/sharingRepository';
import { giveMemory, type GiftState } from '../data/social/postman';
import { useEntry, useProfile } from '../hooks/useData';
import { useNearbyPeople } from '../hooks/useNearby';
import { useGiftProblem, useGiftProgress, useGiftState, useOutbox, usePeople } from '../hooks/useSharing';
import { formatDisplayDate } from '../lib/dates';
import { useTheme } from '../theme';

const FLIGHT: Record<GiftState, FlightState> = {
  knocking: 'waiting',
  connecting: 'connecting',
  sending: 'moving',
  sent: 'done',
  declined: 'declined',
  failed: 'failed',
};

/**
 * Giving a page (from a memory's Give): who to give it to, each with their seal, low on the page under your thumb, and
 * the page's buttons (Back · My code · Scan) in the bar at its foot. Tapping someone sends it flying across.
 */
export default function GiveScreen() {
  const { entryId } = useLocalSearchParams<{ entryId?: string }>();
  const { data: entry } = useEntry(entryId ?? '');
  const { data: profile } = useProfile();
  const theme = useTheme();
  const { colors, typography, spacing, control } = theme;
  const reduceMotion = useReducedMotion();
  const content = usePageContentStyle({ thumbBar: true });
  const [account, setAccount] = useState<AccountStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [showCard, setShowCard] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [gift, setGift] = useState<{ id: string; name: string; personId: string } | null>(null);
  const [flightHidden, setFlightHidden] = useState(false);
  const people = usePeople();
  const outbox = useOutbox();
  const giftState = useGiftState(gift?.id ?? null);
  const giftProgress = useGiftProgress(gift?.id ?? null);
  const giftProblem = useGiftProblem(gift?.id ?? null);
  const name = profile?.name || 'Someone';
  useEffect(() => {
    const load = () => accountRepository.getStatus().then(setAccount, () => undefined);
    load();
    return accountRepository.subscribe(load);
  }, []);
  const me = account?.findable ? account.id : null;
  const [nearbyState, nearby, retryNearby] = useNearbyPeople(!!me);
  const newNearby = nearby.filter((p) => !people.some((known) => known.id === p.id));

  if (!entryId) return <Redirect href="/shared" />;

  /** `scanned`: their code was just scanned, so its key is trusted over any learned one. */
  const give = async (person: { id: string; name: string; key?: string | null }, trust: 'scanned' | 'learned' = 'learned') => {
    if (!entry || busy) return;
    setBusy(true);
    setProblem('');
    try {
      await sharingRepository.addPerson(person.id, person.name, person.key ?? null, trust);
      setFlightHidden(false);
      setGift({ id: await giveMemory(entry.id, person.id), name: person.name, personId: person.id });
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const actions: BarAction[] = [{ key: 'back', label: 'Back', icon: 'chevron-back', onPress: () => router.back() }];
  if (me) {
    actions.push({ key: 'code', label: 'My code', icon: 'qr-code-outline', active: showCard, onPress: () => setShowCard((v) => !v) });
    actions.push({ key: 'scan', label: 'Scan', icon: 'scan-outline', onPress: () => setScanning(true) });
  } else if (account?.available) {
    actions.push({ key: 'you', label: 'Connect', icon: 'person-circle-outline', primary: colors.gilt, onPress: () => router.navigate('/you') });
  }
  const flightLine = entry ? entry.text.trim().split('\n')[0] || (entry.voicePath ? 'a recording' : entry.photoPath ? 'a photo' : 'a page') : '';
  const what = entry ? ['Its words', entry.photoPath ? 'photo' : null, entry.voicePath ? 'recording' : null].filter(Boolean).join(', ') : '';

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground desk />
      <ScrollView contentContainerStyle={[content, { flexGrow: 1 }]} keyboardShouldPersistTaps="handled">
        <PageHeader title="Give this page" subtitle={entry ? `from ${formatDisplayDate(entry.localDate)}` : ''} accent={colors.gilt} buddy={false} />
        {/* Everything to tap sits low, near your thumb. */}
        <View style={{ flex: 1 }} />
        {!account ? null : !me ? (
          <Panel>
            <Text style={[typography.print, { color: colors.ink }]}>Connect your Google account on the You page first.</Text>
            <Text style={[typography.caption, { color: colors.inkMuted }]}>It only lets your phones find each other. The page goes straight from your phone to theirs, never online.</Text>
          </Panel>
        ) : (
          <View style={{ gap: spacing.sm }}>
            <Text style={[typography.caption, { color: colors.onDeskMuted }]}>
              {what} go straight from your phone to theirs, encrypted. Your reply to yourself stays with you.
            </Text>
            {people.map((p) => (
              <PersonButton key={p.id} id={p.id} name={p.name} portrait={p.portrait} label={`Give to ${p.name}`} disabled={busy} onPress={() => void give(p)} />
            ))}
            <NearbyPeople state={nearbyState} people={newNearby} busy={busy} onRetry={retryNearby} onPick={(p) => void give(p)} actionLabel={(n) => `Give to ${n} · beside you`} compact />
          </View>
        )}
        {problem ? (
          <Text accessibilityRole="alert" style={[typography.print, { color: colors.onDesk }]}>
            {problem}
          </Text>
        ) : null}
      </ScrollView>
      <DiaryDock actions={actions}>
        {/* Your code, on a card just above the bar (one hand: nothing to scroll to). */}
        {showCard && me ? (
          <Animated.View entering={sheetIn(reduceMotion)} exiting={sheetOut(reduceMotion)} style={{ marginHorizontal: spacing.gutter, marginBottom: spacing.sm, padding: spacing.md, borderRadius: control.radius * 1.5, backgroundColor: colors.panel, boxShadow: theme.shadow(undefined, 1.6), overflow: 'hidden' }}>
            <Texture kind="paper" opacity={0.5} radius={control.radius * 1.5} />
            <MyCard id={me} name={name} />
          </Animated.View>
        ) : null}
      </DiaryDock>
      <ScanPerson
        visible={scanning}
        onClose={() => setScanning(false)}
        onPerson={(person) => {
          setScanning(false);
          if (person.id !== me) void give(person, 'scanned');
        }}
      />
      {gift && entry ? (
        <GiftFlight
          visible={!flightHidden}
          direction="out"
          personId={gift.personId}
          name={gift.name}
          title={formatDisplayDate(entry.localDate)}
          line={flightLine}
          state={FLIGHT[giftState ?? (outbox.some((o) => o.id === gift.id) ? 'knocking' : 'sent')]}
          progress={giftProgress}
          problem={giftProblem}
          onClose={() => {
            setFlightHidden(true);
            if (giftState === 'sent' || giftState === 'declined') setGift(null);
          }}
        />
      ) : null}
    </View>
  );
}
