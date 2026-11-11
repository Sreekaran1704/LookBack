import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { PillButton, type IconName } from '../../components/Buttons';
import { useNavBarSpace } from '../../components/NavBar';
import { PaperPicker, SlidingToggle } from '../../components/Pickers';
import { PressableScale } from '../../components/PressableScale';
import { HAND_TAIL, PageFooter, Panel, ScreenTitle } from '../../components/Screen';
import { useStatusPill } from '../../components/StatusPill';
import { Buddy } from '../../components/scrapbook/Buddy';
import { PaperBackground } from '../../components/scrapbook/PaperBackground';
import { DEFAULT_REMINDER, backupRepository, settingsRepository, type BackupStatus } from '../../data';
import { cycleAppIcon } from '../../device/appIcon';
import { clearSampleEntries, seedSampleEntries } from '../../dev/seed';
import { useProfile, useReminderSettings, useToday } from '../../hooks/useData';
import { formatDisplayDate, parseLocalDate, toLocalDate } from '../../lib/dates';
import { SHOW_DEV_TOOLS } from '../../lib/flags';
import { tapHaptic } from '../../lib/haptics';
import { REMINDER_WINDOW_DAYS } from '../../notifications/planner';
import { hasPermission, refreshReminders, requestPermission, sendTestNotification } from '../../notifications/scheduler';
import { useLook, useTheme, type PaperTone, type YearPalette } from '../../theme';

function formatTime(hour: number, minute: number): string {
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const TONES = [
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
] as const;

/**
 * Settings, the last page of the notebook: one paper card per topic (you, the look, reminders,
 * backup, about), each with its controls and a line of help inside it, so nothing floats loose.
 */
export default function SettingsScreen() {
  const theme = useTheme();
  const { spacing, sizes } = theme;
  const insets = useSafeAreaInsets();
  const navSpace = useNavBarSpace();
  const palette = theme.year(parseLocalDate(useToday()).year);
  const { data: profile } = useProfile();

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground variant="dots" desk />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: navSpace, paddingHorizontal: spacing.gutter, gap: spacing.xxl }}
      >
        <View style={[styles.row, styles.between, { alignItems: 'flex-end' }]}>
          <View style={{ flex: 1 }}>
            <ScreenTitle title="Settings" accent={palette.secondary} />
          </View>
          <Buddy mood="peek" accent={palette.primary} size={sizes.buddySmall} />
        </View>

        <YouCard palette={palette} name={profile?.name ?? ''} />
        <LookCard palette={palette} />
        <ReminderCard palette={palette} />
        <BackupCard palette={palette} />
        <AboutCard palette={palette} />
        {SHOW_DEV_TOOLS ? <DeveloperCard palette={palette} /> : null}

        <PageFooter label="the last page · settings" />
      </ScrollView>
    </View>
  );
}

/** A card's heading: an icon in a colored circle and a handwritten title. */
function CardTitle({ icon, title, color }: { icon: IconName; title: string; color: string }) {
  const { colors, spacing, typography, sizes } = useTheme();
  return (
    <View style={[styles.row, { gap: spacing.sm, marginBottom: spacing.sm }]}>
      <View style={[styles.badge, { backgroundColor: color, width: sizes.icon * 1.6, height: sizes.icon * 1.6, borderRadius: sizes.icon }]}>
        <Ionicons name={icon} size={sizes.iconSmall} color={colors.paperWhite} />
      </View>
      <Text style={[typography.heading, { color: colors.ink, flex: 1 }]}>
        {title}
        {HAND_TAIL}
      </Text>
    </View>
  );
}

function Help({ children }: { children: ReactNode }) {
  const { colors, spacing, typography } = useTheme();
  return <Text style={[typography.small, { color: colors.inkMuted, paddingVertical: spacing.sm }]}>{children}</Text>;
}

function YouCard({ palette, name }: { palette: YearPalette; name: string }) {
  const { colors, spacing, typography } = useTheme();
  // Plain text until tapped: a text box on the page gets focus whenever the Settings page appears, which
  // stalled the switch to Settings for a third of a second (and sometimes popped the keyboard up by itself).
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const save = () => {
    const next = draft.trim();
    setEditing(false);
    if (next !== name) settingsRepository.setProfile({ name: next }).catch(() => undefined);
  };
  return (
    <Panel seed="you" accent={palette.primary} accent2={palette.secondary}>
      <CardTitle icon="happy-outline" title="You" color={palette.primary} />
      <Row label="Your name">
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
            <Text style={[typography.hand, { color: name ? colors.ink : colors.inkMuted, minWidth: 110, textAlign: 'right', paddingVertical: spacing.xs }]}>
              {name || 'add ✎'}
            </Text>
          </PressableScale>
        )}
      </Row>
    </Panel>
  );
}

function LookCard({ palette }: { palette: YearPalette }) {
  const { spacing } = useTheme();
  const { look, setLook } = useLook();
  return (
    <Panel seed="look" accent={palette.secondary} accent2={palette.primary}>
      <CardTitle icon="color-palette-outline" title="Look" color={palette.secondary} />
      <View style={{ gap: spacing.lg, paddingVertical: spacing.sm }}>
        <PaperPicker value={look.paper} tone={look.tone} onChange={(paper) => setLook({ ...look, paper })} />
        <SlidingToggle<PaperTone> options={TONES} value={look.tone} onChange={(tone) => setLook({ ...look, tone })} accent={palette.primary} />
      </View>
      <Help>Your notebook&apos;s paper. Dark is the same paper by lamplight; notes and photos stay light on it.</Help>
    </Panel>
  );
}

function ReminderCard({ palette }: { palette: YearPalette }) {
  const { colors, typography } = useTheme();
  const { data: reminder = DEFAULT_REMINDER } = useReminderSettings();
  const [permitted, setPermitted] = useState<boolean | null>(null);
  const [scheduled, setScheduled] = useState<number | null>(null);
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  const recount = useCallback(() => {
    hasPermission().then(setPermitted);
    refreshReminders().then(setScheduled, () => setScheduled(null));
  }, []);
  useEffect(() => {
    recount();
    return settingsRepository.subscribe(recount);
  }, [recount]);

  async function toggle() {
    tapHaptic();
    const enabled = !reminder.enabled;
    if (enabled && !(await requestPermission())) {
      setPermitted(false);
      Alert.alert('Notifications are off', 'Turn on notifications for LookBack in your phone settings to get reminders.');
      return;
    }
    await settingsRepository.setReminder({ enabled });
  }
  const setTime = (date: Date) => settingsRepository.setReminder({ hour: date.getHours(), minute: date.getMinutes() });
  const time = formatTime(reminder.hour, reminder.minute);
  const pickerValue = new Date(2000, 0, 1, reminder.hour, reminder.minute);

  return (
    <Panel seed="reminder" accent={palette.primary} accent2={palette.secondary}>
      <CardTitle icon="notifications-outline" title="Reminders" color={colors.amber} />
      <CheckRow label="Letters from past years" checked={reminder.enabled} onPress={toggle} />
      {reminder.enabled ? (
        <Row label="Arrive at" divider>
          {Platform.OS === 'ios' ? (
            <DateTimePicker value={pickerValue} mode="time" display="compact" onValueChange={(_, d) => setTime(d)} />
          ) : (
            <PressableScale onPress={() => setShowAndroidPicker(true)} accessibilityRole="button" accessibilityLabel={`Reminder time ${time}`}>
              <Text style={[typography.handLarge, { color: colors.ink }]}>{time}</Text>
            </PressableScale>
          )}
        </Row>
      ) : null}
      <Help>
        {reminder.enabled && permitted === false
          ? 'Notifications are turned off for LookBack in your phone settings.'
          : `Only on days that have a memory from an earlier year.${
              reminder.enabled && scheduled !== null ? ` ${scheduled} coming up in the next ${REMINDER_WINDOW_DAYS} days.` : ''
            }`}
      </Help>
      {showAndroidPicker ? (
        <DateTimePicker
          value={pickerValue}
          mode="time"
          onValueChange={(_, date) => {
            setShowAndroidPicker(false);
            setTime(date);
          }}
          onDismiss={() => setShowAndroidPicker(false)}
        />
      ) : null}
    </Panel>
  );
}

/** Private backup to the person's own Google Drive: connect an account, back up, see when it last ran. */
function BackupCard({ palette }: { palette: YearPalette }) {
  const { colors, spacing, typography } = useTheme();
  const statusPill = useStatusPill();
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const load = () => backupRepository.getStatus().then(setStatus, () => undefined);
    load();
    return settingsRepository.subscribe(load);
  }, []);

  async function run(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await task();
    } catch (error) {
      Alert.alert("Backup didn't finish", error instanceof Error ? error.message : String(error));
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
      if (await backupRepository.connect()) await backUp();
    });
  const disconnect = () =>
    Alert.alert('Stop backing up?', 'Your memories stay on this phone and in your Drive folder. Only the connection is removed.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: () => run(() => backupRepository.disconnect()) },
    ]);

  const last = status?.lastBackupAt ? formatDisplayDate(toLocalDate(new Date(status.lastBackupAt))) : 'not yet';
  return (
    <Panel seed="backup" accent={palette.secondary} accent2={palette.primary}>
      <CardTitle icon="cloud-outline" title="Backup" color={colors.green} />
      {!status ? null : status.account ? (
        <>
          <Row label="Google Drive">
            <Text numberOfLines={1} style={[typography.handSmall, { color: colors.inkMuted, flexShrink: 1, textAlign: 'right' }]}>
              {status.account}
            </Text>
          </Row>
          <Row label="Last backup" divider>
            <Text style={[typography.hand, { color: colors.ink }]}>{busy ? 'working…' : last}</Text>
          </Row>
          {/* Both on one line: back up (a green sticker) and disconnect (a quieter coral one). */}
          <View style={[styles.row, { gap: spacing.sm, paddingTop: spacing.md }]}>
            <PillButton label={busy ? 'Saving…' : 'Back up'} icon="cloud-upload-outline" color={colors.green} grow onPress={backUp} disabled={busy} />
            <PillButton label="Disconnect" icon="unlink-outline" color={colors.inkMuted} outline grow onPress={disconnect} disabled={busy} />
          </View>
          <Help>{`Saved in a "${status.folder}" folder in your Drive, once a day and whenever you tap Back up.`}</Help>
        </>
      ) : status.available ? (
        <>
          <Help>{`Keep a private copy in your own Google Drive, in a "${status.folder}" folder only you can see.`}</Help>
          <PillButton label={busy ? 'Connecting…' : 'Connect Google Drive'} icon="logo-google" color={colors.green} onPress={connect} disabled={busy} />
          <View style={{ height: spacing.sm }} />
        </>
      ) : (
        <Help>Google Drive backup isn&apos;t switched on in this build yet.</Help>
      )}
    </Panel>
  );
}

function AboutCard({ palette }: { palette: YearPalette }) {
  const { colors, typography } = useTheme();
  return (
    <Panel seed="about" accent={palette.primary} accent2={palette.secondary}>
      <CardTitle icon="book-outline" title="About" color={palette.primary} />
      <Row label="LookBack">
        <Text style={[typography.handSmall, { color: colors.inkMuted }]}>version {Constants.expoConfig?.version ?? '1.0'}</Text>
      </Row>
      <ActionRow label="Meet the bunny again" divider onPress={() => router.push('/welcome')} />
      <Help>One small thing a day. It comes back to you on the same day next year.</Help>
    </Panel>
  );
}

function DeveloperCard({ palette }: { palette: YearPalette }) {
  const { colors } = useTheme();
  const statusPill = useStatusPill();
  return (
    <Panel seed="developer" accent={palette.primary} accent2={palette.secondary} paper={palette.tint}>
      <CardTitle icon="construct-outline" title="Developer" color={colors.inkMuted} />
      <ActionRow label="Seed sample memories" onPress={async () => statusPill.show(`Added ${await seedSampleEntries()} sample memories`)} />
      <ActionRow divider label="Clear sample memories" onPress={async () => statusPill.show(`Removed ${await clearSampleEntries()} sample memories`)} />
      <ActionRow divider label="Next icon mood" onPress={async () => statusPill.show(`Icon: ${await cycleAppIcon()} (see your app drawer)`)} />
      <ActionRow
        divider
        label="Send test notification"
        onPress={async () => {
          const ok = await sendTestNotification();
          if (ok) statusPill.show('Test notification in 3 seconds');
          else Alert.alert('Notifications are off', 'Allow notifications to test reminders.');
        }}
      />
    </Panel>
  );
}

/** One line on a paper card: label on the left, control on the right. */
function Row({ label, divider = false, children }: { label: string; divider?: boolean; children?: ReactNode }) {
  const { colors, spacing, typography, sizes } = useTheme();
  return (
    <View style={[styles.row, styles.between, { minHeight: sizes.rowHeight, gap: spacing.md }, divider ? { borderTopWidth: 1, borderTopColor: colors.ruleLine } : null]}>
      {/* flex: 1 — Android under-measures Caveat, so give the label the row's width instead of its own. */}
      <Text style={[typography.hand, { color: colors.ink, flex: 1 }]}>{label}</Text>
      {children}
    </View>
  );
}

function ActionRow({ label, divider = false, onPress }: { label: string; divider?: boolean; onPress: () => void }) {
  const { colors, sizes } = useTheme();
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Row label={label} divider={divider}>
        <Ionicons name="arrow-forward" size={sizes.iconSmall} color={colors.ink} />
      </Row>
    </PressableScale>
  );
}

/** Hand-drawn checkbox: a wobbly square with a scribbled tick. */
function CheckRow({ label, checked, onPress }: { label: string; checked: boolean; onPress: () => void }) {
  const { colors, spacing, typography, sizes } = useTheme();
  const s = sizes.checkbox;
  return (
    <PressableScale onPress={onPress} haptic={false} accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={label}>
      <View style={[styles.row, { minHeight: sizes.rowHeight, gap: spacing.md }]}>
        <Svg width={s + 6} height={s + 6}>
          <Path d={`M 3 4 L ${s} 3 L ${s + 1} ${s} L 4 ${s + 1} Z`} stroke={colors.ink} strokeWidth={2} fill="none" strokeLinejoin="round" />
          {checked ? (
            <Path d={`M 6 ${s / 2 + 1} L ${s / 2 - 1} ${s - 3} L ${s + 4} 0`} stroke={colors.green} strokeWidth={3.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
        </Svg>
        <Text style={[typography.hand, { color: colors.ink, flex: 1 }]}>{label}</Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { justifyContent: 'space-between' },
  badge: { alignItems: 'center', justifyContent: 'center' },
});
