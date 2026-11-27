import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { memo, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { PillButton } from '../../components/Buttons';
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
import { formatDisplayDate, toLocalDate } from '../../lib/dates';
import { groupByPerson } from '../../lib/sharedPeople';
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
  const groups = groupByPerson(people, letters);
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
                ? 'Connect your Google account on the You page first. It only lets your phones find each other: a page goes straight from your phone to theirs, encrypted; if their phone is off, it waits sealed so only their phone can open it.'
                : "Giving pages isn't switched on in this build yet."}
            </Text>
            {account.available ? <PillButton label="Connect on You" icon="person-circle-outline" tone="dark" large onPress={() => router.navigate('/you')} /> : null}
          </Panel>
        ) : (
          <>
            <Panel>
              <Text style={[typography.heading, { color: colors.ink }]}>Your people</Text>
              {groups.map((g) => {
                const status = g.person && gone.has(g.id)
                  ? 'their account is gone · add them again'
                  : g.person && waitingFor(g.person)
                    ? `${waitingFor(g.person)} waiting to go to them`
                    : g.letters.length
                      ? `${g.letters.length === 1 ? 'a page' : `${g.letters.length} pages`}${g.unread ? ` · ${g.unread} new` : ''} · last ${formatDisplayDate(toLocalDate(new Date(g.lastAt ?? '')))}`
                      : g.person
                        ? `added ${formatDisplayDate(g.person.addedAt.slice(0, 10))}`
                        : '';
                return (
                  <PressableScale key={g.id} onPress={() => router.push(`/person/${g.id}`)} accessibilityRole="button" accessibilityLabel={`${g.name}: ${status}`}>
                    <View style={rowStyle}>
                      <PersonSeal name={g.name} portrait={g.portrait} />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={[typography.print, { color: colors.ink, fontWeight: g.unread ? '700' : '400' }]}>
                          {g.name}
                        </Text>
                        <Text numberOfLines={1} style={[typography.caption, { color: colors.inkMuted, fontSize: 14, lineHeight: 18 }]}>
                          {status}
                        </Text>
                      </View>
                      {g.unread ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.sepia }} /> : null}
                      <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
                    </View>
                  </PressableScale>
                );
              })}
              {groups.length ? null : (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
                  <Ionicons name="person-add-outline" size={18} color={colors.gilt} style={{ marginTop: 2 }} />
                  <Text style={[typography.caption, { color: colors.inkMuted, flex: 1 }]}>{"Add the people you'd give a page to: beside you, or with My code and Scan."}</Text>
                </View>
              )}
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
    </View>
  );
}

// Memoised, ignoring props, like the other bar pages: the page slider re-renders every page when the route changes.
export default memo(SharedScreen, () => true);
