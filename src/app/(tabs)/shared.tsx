import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { memo, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { PillButton } from '../../components/Buttons';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { useNavScroll } from '../../components/NavBar';
import { usePageActive } from '../../components/PageActive';
import { MyCard, NearbyPeople, ScanPerson, VisibleNearby } from '../../components/People';
import { PersonSeal } from '../../components/PersonSeal';
import { PressableScale } from '../../components/PressableScale';
import { PageFooter, PageHeader, Panel, usePageContentStyle } from '../../components/Screen';
import { PaperBackground } from '../../components/scrapbook/PaperBackground';
import { Texture } from '../../components/scrapbook/Texture';
import { sheetIn } from '../../components/transitions';
import { accountRepository, type AccountStatus } from '../../data';
import { sharingRepository, type Person } from '../../data/sharingRepository';
import { useProfile } from '../../hooks/useData';
import { useNearbyPeople, useVisibleNearby } from '../../hooks/useNearby';
import { useGonePeople, useOutbox, usePeople, useReceivedLetters } from '../../hooks/useSharing';
import { formatDisplayDate } from '../../lib/dates';
import { useTheme } from '../../theme';

/**
 * Shared: the pages people gave you, and your people (each with their seal), passed phone to phone like AirDrop.
 * Built for one hand: the reading sits at the top, and what you tap (add someone beside you, My code, Scan) is at the
 * bottom, just above the bar. To give a page, open it and tap Give.
 */
function SharedScreen() {
  const theme = useTheme();
  const { colors, typography, spacing, control } = theme;
  const reduceMotion = useReducedMotion();
  const content = usePageContentStyle();
  const onScroll = useNavScroll();
  const active = usePageActive();
  const { data: profile } = useProfile();
  const name = profile?.name || 'Someone';
  const [account, setAccount] = useState<AccountStatus | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [removing, setRemoving] = useState<Person | null>(null);
  const [problem, setProblem] = useState('');
  const people = usePeople();
  const letters = useReceivedLetters();
  const outbox = useOutbox();
  const gone = useGonePeople();
  useEffect(() => {
    const load = () => accountRepository.getStatus().then(setAccount, () => undefined);
    load();
    return accountRepository.subscribe(load);
  }, []);
  const me = account?.findable ? account.id : null;
  // Bluetooth only while this page is in front (the bar pages stay built behind each other).
  const [visible, retryVisible] = useVisibleNearby(!!me && active, name);
  const [nearbyState, nearby, retryNearby] = useNearbyPeople(!!me && active);
  const newNearby = nearby.filter((p) => !people.some((known) => known.id === p.id));
  const add = (person: { id: string; name: string; key?: string | null }, trust: 'scanned' | 'learned' = 'learned') => {
    setProblem('');
    sharingRepository.addPerson(person.id, person.name, person.key ?? null, trust).catch((e: unknown) => setProblem(e instanceof Error ? e.message : String(e)));
  };
  const waitingFor = (p: Person) => outbox.filter((o) => o.personId === p.id).length;
  const rowStyle = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.md, minHeight: control.height + 6, borderTopWidth: 1, borderTopColor: colors.ruleLine };

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground variant="dots" desk />
      <Animated.ScrollView contentContainerStyle={[content, { flexGrow: 1 }]} onScroll={onScroll} scrollEventThrottle={16}>
        <PageHeader title="Shared" subtitle="pages passed between you and your people" accent={colors.gilt} buddy={false} />
        {/* The page sits low: what you tap is near your thumb. */}
        <View style={{ flex: 1 }} />
        {!account ? null : !me ? (
          <Panel>
            <Text style={[typography.heading, { color: colors.ink }]}>Give a page to someone you trust</Text>
            <Text style={[typography.caption, { color: colors.inkMuted }]}>
              {account.available
                ? 'Connect your Google account on the You page first. It only lets your phones find each other: a page goes straight from your phone to theirs, encrypted, and is never stored online.'
                : "Giving pages isn't switched on in this build yet."}
            </Text>
            {account.available ? <PillButton label="Connect on You" icon="person-circle-outline" tone="dark" large onPress={() => router.navigate('/you')} /> : null}
          </Panel>
        ) : (
          <>
            <Panel>
              <Text style={[typography.heading, { color: colors.ink }]}>Given to you</Text>
              {letters.length ? (
                letters.map((letter) => (
                  <PressableScale key={letter.id} onPress={() => router.push(`/letter/${letter.id}`)} accessibilityRole="button" accessibilityLabel={`Open the page from ${letter.senderName}`}>
                    <View style={rowStyle}>
                      <PersonSeal id={letter.senderId} name={letter.senderName} />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={[typography.print, { color: colors.ink, fontWeight: letter.openedAt ? '400' : '700' }]}>
                          {letter.senderName}
                        </Text>
                        <Text numberOfLines={1} style={[typography.caption, { color: colors.inkMuted, fontSize: 14, lineHeight: 18 }]}>
                          a page from {formatDisplayDate(letter.memoryDate)}
                          {letter.voicePath ? ' · recording' : ''}
                          {letter.photoPath ? ' · photo' : ''}
                        </Text>
                      </View>
                      {letter.openedAt ? null : <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.sepia }} />}
                      <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
                    </View>
                  </PressableScale>
                ))
              ) : (
                <Text style={[typography.caption, { color: colors.inkMuted }]}>Pages people give you are kept here, on this phone only.</Text>
              )}
            </Panel>

            <Panel>
              <Text style={[typography.heading, { color: colors.ink }]}>Your people</Text>
              {people.map((p) => (
                <View key={p.id} style={rowStyle}>
                  <PersonSeal id={p.id} name={p.name} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={[typography.print, { color: colors.ink }]}>
                      {p.name}
                    </Text>
                    <Text numberOfLines={1} style={[typography.caption, { color: colors.inkMuted, fontSize: 14, lineHeight: 18 }]}>
                      {gone.has(p.id)
                        ? 'their account is gone · add them again'
                        : waitingFor(p)
                          ? `${waitingFor(p)} waiting to go to them`
                          : `added ${formatDisplayDate(p.addedAt.slice(0, 10))}`}
                    </Text>
                  </View>
                  <PressableScale onPress={() => setRemoving(p)} accessibilityRole="button" accessibilityLabel={`Remove ${p.name}`} hitSlop={8}>
                    <Ionicons name="close-circle-outline" size={24} color={colors.inkMuted} />
                  </PressableScale>
                </View>
              ))}
              {people.length ? null : <Text style={[typography.caption, { color: colors.inkMuted }]}>{"Add the people you'd give a page to: beside you, or with My code and Scan."}</Text>}
              <NearbyPeople state={nearbyState} people={newNearby} busy={false} onRetry={retryNearby} onPick={add} actionLabel={(n) => `Add ${n}`} compact />
              {visible === 'on' || visible === 'offline' ? <VisibleNearby state={visible} name={name} onRetry={retryVisible} compact /> : null}
            </Panel>

            {showCard ? (
              <Animated.View entering={sheetIn(reduceMotion)} style={{ padding: spacing.md, borderRadius: control.radius * 1.5, backgroundColor: colors.panel, boxShadow: theme.shadow(undefined, 1.4), overflow: 'hidden' }}>
                <Texture kind="paper" opacity={0.5} radius={control.radius * 1.5} />
                <MyCard id={me} name={name} />
              </Animated.View>
            ) : null}
            {/* The page's own buttons, last, right above the bar. */}
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <PillButton label={showCard ? 'Hide code' : 'My code'} icon="qr-code-outline" grow onPress={() => setShowCard((v) => !v)} />
              <PillButton label="Scan" icon="scan-outline" grow onPress={() => setScanning(true)} />
            </View>
          </>
        )}
        {problem ? (
          <Text accessibilityRole="alert" style={[typography.print, { color: colors.onDesk }]}>
            {problem}
          </Text>
        ) : null}
        <PageFooter label="shared · phone to phone" />
      </Animated.ScrollView>
      <ScanPerson
        visible={scanning}
        onClose={() => setScanning(false)}
        onPerson={(person) => {
          setScanning(false);
          if (person.id !== me) add(person, 'scanned');
        }}
      />
      <ConfirmSheet
        visible={!!removing}
        title={`Remove ${removing?.name ?? ''}?`}
        message="They won't be offered your pages any more, and anything still waiting for them is dropped. Pages they gave you stay."
        confirmLabel="Remove"
        confirmIcon="close"
        onConfirm={() => {
          const p = removing;
          setRemoving(null);
          if (p) void sharingRepository.removePerson(p.id);
        }}
        onCancel={() => setRemoving(null)}
      />
    </View>
  );
}

// Memoised, ignoring props, like the other bar pages: the page slider re-renders every page when the route changes.
export default memo(SharedScreen, () => true);
