import { router } from 'expo-router';
import { memo, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ActionRow, CardTitle, CheckRow, Help, Row } from '../../components/CardParts';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { HardwareButton } from '../../components/Hardware';
import { useNavScroll } from '../../components/NavBar';
import { PressableScale } from '../../components/PressableScale';
import { PageFooter, PageHeader, Panel, usePageContentStyle } from '../../components/Screen';
import { useStatusPill } from '../../components/StatusPill';
import { PaperBackground } from '../../components/scrapbook/PaperBackground';
import { accountRepository, backupRepository, settingsRepository, type AccountStatus, type BackupStatus } from '../../data';
import { useProfile, useToday } from '../../hooks/useData';
import { useOutbox, usePeople, useReceivedLetters } from '../../hooks/useSharing';
import { formatDisplayDate, parseLocalDate, toLocalDate } from '../../lib/dates';
import { useTheme, type YearPalette } from '../../theme';

/**
 * You: your name, your Google account (one connection: your Drive backup, and who you are when people give you pages),
 * the people and pages passed between you, and the way into Settings.
 */
function YouScreen() {
  const theme = useTheme();
  const pageContent = usePageContentStyle();
  const onScroll = useNavScroll();
  const palette = theme.year(parseLocalDate(useToday()).year);
  const { data: profile } = useProfile();
  const name = profile?.name ?? '';
  return (
    <View style={{ flex: 1 }}>
      <PaperBackground variant="dots" desk />
      <Animated.ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={pageContent} onScroll={onScroll} scrollEventThrottle={16}>
        <PageHeader title="You" subtitle={name ? `${name}'s diary` : 'whose diary is this?'} accent={palette.primary} />
        <NameCard palette={palette} name={name} />
        <AccountCard palette={palette} />
        <PeopleCard palette={palette} />
        <Panel seed="settings" accent={palette.primary} accent2={palette.secondary}>
          <CardTitle icon="settings-outline" title="Settings" />
          <Help>The paper and its tone, reminders, and about the diary.</Help>
          <ActionRow label="Open settings" divider onPress={() => router.push('/settings')} />
        </Panel>
        <PageFooter label="you · your account" />
      </Animated.ScrollView>
    </View>
  );
}

function NameCard({ palette, name }: { palette: YearPalette; name: string }) {
  const { colors, spacing, typography } = useTheme();
  // Plain text until tapped: a text box on a bar page gets focus whenever the page appears (a stall, and sometimes the
  // keyboard popping up by itself).
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const save = () => {
    const next = draft.trim();
    setEditing(false);
    if (next !== name) settingsRepository.setProfile({ name: next }).catch(() => undefined);
  };
  return (
    <Panel seed="you" accent={palette.primary} accent2={palette.secondary}>
      <CardTitle icon="happy-outline" title="Your name" />
      <Row label="Name">
        {editing ? (
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onBlur={save}
            onSubmitEditing={save}
            autoFocus
            placeholder="your name"
            placeholderTextColor={colors.inkMuted}
            returnKeyType="done"
            maxLength={24}
            style={[typography.hand, { color: colors.ink, minWidth: 110, textAlign: 'right', paddingVertical: spacing.xs }]}
            accessibilityLabel="Your name"
          />
        ) : (
          <PressableScale
            onPress={() => {
              setDraft(name);
              setEditing(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={name ? `Your name, ${name}. Tap to change` : 'Add your name'}
          >
            <Text style={[typography.hand, { color: name ? colors.ink : colors.inkMuted, minWidth: 110, textAlign: 'right', paddingVertical: spacing.xs }]}>{name || 'add ✎'}</Text>
          </PressableScale>
        )}
      </Row>
      <Help>People you give a page to see it from this name.</Help>
    </Panel>
  );
}

/** Your Google account: connect once for the Drive backup and for being findable; back up now; disconnect. */
function AccountCard({ palette }: { palette: YearPalette }) {
  const { colors, spacing, typography, sizes } = useTheme();
  const statusPill = useStatusPill();
  const [account, setAccount] = useState<AccountStatus | null>(null);
  const [backup, setBackup] = useState<BackupStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [askDisconnect, setAskDisconnect] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  useEffect(() => {
    const load = () => {
      accountRepository.getStatus().then(setAccount, () => undefined);
      backupRepository.getStatus().then(setBackup, () => undefined);
    };
    load();
    return accountRepository.subscribe(load);
  }, []);
  async function run(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await task();
    } catch (error) {
      Alert.alert("That didn't finish", error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }
  const backUp = () =>
    run(async () => {
      const result = await backupRepository.syncNow();
      statusPill.show(result.restored > 0 ? `Brought back ${result.restored}, ${result.total} safe in Drive` : `${result.total} memories safe in Drive`);
    });
  const connect = () =>
    run(async () => {
      if (!(await accountRepository.connect())) return;
      const result = await backupRepository.syncNow();
      statusPill.show(`Connected · ${result.total} memories safe in Drive`);
    });
  const last = backup?.lastBackupAt ? formatDisplayDate(toLocalDate(new Date(backup.lastBackupAt))) : 'not yet';
  return (
    <Panel seed="account" accent={palette.secondary} accent2={palette.primary}>
      <CardTitle icon="logo-google" title="Google account" />
      {!account ? null : account.email ? (
        <>
          {/* The address goes under its label: beside it, a long one squeezed the label onto two lines. */}
          <View style={{ minHeight: sizes.rowHeight, justifyContent: 'center' }}>
            <Text style={[typography.print, { color: colors.ink }]}>Connected</Text>
            <Text numberOfLines={1} style={[typography.handSmall, { color: colors.inkMuted }]}>
              {account.email}
            </Text>
          </View>
          <Row label="Last backup" divider>
            <Text style={[typography.printItalic, { color: colors.ink }]}>{busy ? 'working…' : last}</Text>
          </Row>
          <Row label="People can give you pages" divider>
            <Text style={[typography.printItalic, { color: colors.ink }]}>{account.findable ? 'yes' : 'reconnect'}</Text>
          </Row>
          <View style={[styles.row, { gap: spacing.sm, paddingTop: spacing.md }]}>
            <HardwareButton label={busy ? 'Saving…' : 'Back up'} icon="cloud-upload-outline" tone="primary" grow onPress={backUp} disabled={busy} />
            <HardwareButton label="Disconnect" icon="unlink-outline" tone="danger" grow onPress={() => setAskDisconnect(true)} disabled={busy} />
          </View>
          {account.findable ? null : (
            <>
              <View style={{ height: spacing.sm }} />
              <HardwareButton label={busy ? 'Connecting…' : 'Connect again'} icon="logo-google" tone="primary" onPress={connect} disabled={busy} />
            </>
          )}
          <Help>{`Your diary is backed up to a "${backup?.folder ?? 'LookBack'}" folder in your Drive once a day. Pages you give go straight from your phone to theirs, never online.`}</Help>
          <View style={{ height: spacing.sm }} />
          <HardwareButton label="Delete sharing account" icon="trash-outline" tone="danger" onPress={() => setAskDelete(true)} disabled={busy} />
        </>
      ) : account.available ? (
        <>
          <Help>{`One connection for two things: a private copy of your diary in your own Drive (a "${backup?.folder ?? 'LookBack'}" folder only you can see), and letting the people you trust give you pages.`}</Help>
          <HardwareButton label={busy ? 'Connecting…' : 'Connect Google'} icon="logo-google" tone="primary" onPress={connect} disabled={busy} />
          <View style={{ height: spacing.sm }} />
        </>
      ) : (
        <Help>Google isn&apos;t switched on in this build yet.</Help>
      )}
      <ConfirmSheet
        visible={askDisconnect}
        title="Disconnect Google?"
        message="Backups stop and people can't give you pages. Your diary, your Drive folder and the pages you were given all stay."
        confirmLabel="Disconnect"
        confirmIcon="unlink-outline"
        onCancel={() => setAskDisconnect(false)}
        onConfirm={() => {
          setAskDisconnect(false);
          void run(() => accountRepository.disconnect());
        }}
      />
      <ConfirmSheet
        visible={askDelete}
        title="Delete your sharing account?"
        message="LookBack's server forgets you: your sign-in, your name and where to reach your phone. Your diary, your Drive folder and the pages you were given all stay. People will need to add you again."
        confirmLabel="Delete"
        confirmIcon="trash-outline"
        onCancel={() => setAskDelete(false)}
        onConfirm={() => {
          setAskDelete(false);
          void run(() => accountRepository.deleteAccount());
        }}
      />
    </Panel>
  );
}

/** The people you give pages to, and the pages given to you: a doorway to Shared. */
function PeopleCard({ palette }: { palette: YearPalette }) {
  const { colors, typography } = useTheme();
  const people = usePeople();
  const letters = useReceivedLetters();
  const outbox = useOutbox();
  const unread = letters.filter((l) => !l.openedAt).length;
  const [autoAccept, setAutoAccept] = useState(true);
  useEffect(() => {
    const load = () => void settingsRepository.getAutoAccept().then(setAutoAccept, () => undefined);
    load();
    return settingsRepository.subscribe(load);
  }, []);
  return (
    <Panel seed="people" accent={palette.primary} accent2={palette.secondary}>
      <CardTitle icon="mail-outline" title="Shared" />
      <Row label="Your people">
        <Text style={[typography.printItalic, { color: colors.ink }]}>{people.length}</Text>
      </Row>
      <Row label="Pages given to you" divider>
        <Text style={[typography.printItalic, { color: colors.ink }]}>{unread ? `${letters.length} · ${unread} new` : letters.length}</Text>
      </Row>
      {outbox.length ? (
        <Row label="Waiting to go" divider>
          <Text style={[typography.printItalic, { color: colors.ink }]}>{outbox.length}</Text>
        </Row>
      ) : null}
      <CheckRow label="Pages from my people arrive by themselves" checked={autoAccept} onPress={() => void settingsRepository.setAutoAccept(!autoAccept)} />
      <Help>Only from people you added. Anyone else still asks first.</Help>
      <ActionRow label="Open Shared" divider onPress={() => router.navigate('/shared')} />
    </Panel>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});

// Memoised, ignoring props, like the other bar pages: the page slider re-renders every page when the route changes.
export default memo(YouScreen, () => true);
