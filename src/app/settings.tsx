import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { CircleButton, PillButton } from '../components/Buttons';
import { PressableScale } from '../components/PressableScale';
import { PageFooter, Panel, ScreenTitle, SectionHeader, TopBar } from '../components/Screen';
import { useStatusPill } from '../components/StatusPill';
import { Buddy } from '../components/scrapbook/Buddy';
import { Doodle } from '../components/scrapbook/Doodle';
import { PaperBackground } from '../components/scrapbook/PaperBackground';
import { DEFAULT_REMINDER, backupRepository, settingsRepository, type BackupStatus } from '../data';
import { clearSampleEntries, seedSampleEntries } from '../dev/seed';
import { useReminderSettings, useToday } from '../hooks/useData';
import { formatDisplayDate, parseLocalDate, toLocalDate } from '../lib/dates';
import { SHOW_DEV_TOOLS } from '../lib/flags';
import { tapHaptic } from '../lib/haptics';
import { REMINDER_WINDOW_DAYS } from '../notifications/planner';
import { hasPermission, refreshReminders, requestPermission, sendTestNotification } from '../notifications/scheduler';
import { useTheme, useThemeMode, type ThemeMode } from '../theme';

function formatTime(hour: number, minute: number): string {
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const THEME_OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: 'system', label: 'System' },
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Midnight' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const { colors, spacing, typography, sizes } = theme;
  const insets = useSafeAreaInsets();
  const palette = theme.year(parseLocalDate(useToday()).year);
  const statusPill = useStatusPill();
  const { mode, setMode } = useThemeMode();
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

  function setTime(date: Date) {
    settingsRepository.setReminder({ hour: date.getHours(), minute: date.getMinutes() });
  }

  const time = formatTime(reminder.hour, reminder.minute);
  const pickerValue = new Date(2000, 0, 1, reminder.hour, reminder.minute);

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground variant="dots" desk wash={palette.tint} />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.xxxl * 2,
          paddingHorizontal: spacing.gutter,
          gap: spacing.xxl,
        }}
      >
        <View>
          <TopBar left={<CircleButton icon="chevron-back" accessibilityLabel="Back" onPress={() => router.back()} />} />
          <View style={[styles.row, styles.between, { alignItems: 'flex-end' }]}>
            <ScreenTitle title="Settings" accent={palette.secondary} />
            <Buddy mood="peek" accent={palette.primary} size={sizes.buddySmall} />
          </View>
        </View>

        <View style={{ gap: spacing.md }}>
          <SectionHeader title="Reminder" accent={palette.primary} />
          <Panel seed="reminder" accent={palette.primary} accent2={palette.secondary}>
            <CheckRow label="Daily reminder" checked={reminder.enabled} onPress={toggle} />
            {reminder.enabled ? (
              <Row label="Time" divider>
                {Platform.OS === 'ios' ? (
                  <DateTimePicker value={pickerValue} mode="time" display="compact" onValueChange={(_, d) => setTime(d)} />
                ) : (
                  <PressableScale
                    onPress={() => setShowAndroidPicker(true)}
                    accessibilityRole="button"
                    accessibilityLabel={`Reminder time ${time}`}
                  >
                    <Text style={[typography.handLarge, { color: colors.ink }]}>{time}</Text>
                  </PressableScale>
                )}
              </Row>
            ) : null}
          </Panel>
          {reminder.enabled && permitted ? <PillButton label={`Reminder set · ${time}`} icon="notifications" tone="amber" /> : null}
          <Text style={[typography.small, { color: colors.onDeskMuted, paddingHorizontal: spacing.xs, marginTop: spacing.sm }]}>
            {reminder.enabled && permitted === false
              ? 'Notifications are turned off for LookBack in your phone settings.'
              : `You'll only hear from us on days that have a memory.${
                  reminder.enabled && scheduled !== null ? ` ${scheduled} coming up in the next ${REMINDER_WINDOW_DAYS} days.` : ''
                }`}
          </Text>
        </View>

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

        <View>
          <SectionHeader title="Look" accent={palette.primary} />
          <Panel seed="look" accent={palette.secondary} accent2={palette.primary}>
            <View style={[styles.row, { gap: spacing.xs, paddingVertical: spacing.sm }]}>
              {THEME_OPTIONS.map((o) => (
                <ThemeChoice key={o.mode} label={o.label} selected={mode === o.mode} onPress={() => setMode(o.mode)} />
              ))}
            </View>
          </Panel>
        </View>

        <BackupSection accent={palette.primary} accent2={palette.secondary} />

        {SHOW_DEV_TOOLS ? (
          <View>
            <SectionHeader title="Developer" detail="dev & preview builds" accent={palette.primary} />
            <Panel seed="developer" accent={palette.primary} accent2={palette.secondary} paper={palette.tint}>
              <DevAction
                label="Seed sample memories"
                onPress={async () => statusPill.show(`Added ${await seedSampleEntries()} sample memories`)}
              />
              <DevAction
                divider
                label="Clear sample memories"
                onPress={async () => statusPill.show(`Removed ${await clearSampleEntries()} sample memories`)}
              />
              <DevAction
                divider
                label="Send test notification"
                onPress={async () => {
                  const ok = await sendTestNotification();
                  if (ok) statusPill.show('Test notification in 3 seconds');
                  else Alert.alert('Notifications are off', 'Allow notifications to test reminders.');
                }}
              />
            </Panel>
          </View>
        ) : null}
        <PageFooter label="the last page · settings" />
      </ScrollView>
    </View>
  );
}

/** Private backup to the person's own Google Drive: connect an account, back up, see when it last ran. */
function BackupSection({ accent, accent2 }: { accent: string; accent2: string }) {
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
      statusPill.show(
        result.restored > 0 ? `Brought back ${result.restored}, ${result.total} safe in Drive` : `${result.total} memories safe in Drive`,
      );
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

  if (!status) return null;
  const last = status.lastBackupAt ? formatDisplayDate(toLocalDate(new Date(status.lastBackupAt))) : 'not yet';

  return (
    <View style={{ gap: spacing.md }}>
      <SectionHeader title="Backup" accent={accent} />
      <Panel seed="backup" accent={accent2} accent2={accent}>
        {status.account ? (
          <>
            <Row label="Account">
              <Text numberOfLines={1} style={[typography.handSmall, { color: colors.inkMuted, flexShrink: 1, textAlign: 'right' }]}>
                {status.account}
              </Text>
            </Row>
            <Row label="Last backup" divider>
              <Text style={[typography.hand, { color: colors.ink }]}>{busy ? 'working…' : last}</Text>
            </Row>
          </>
        ) : (
          <Text style={[typography.hand, { color: colors.ink, paddingVertical: spacing.md }]}>
            {status.available
              ? 'Keep a private copy of your memories in your own Google Drive.'
              : "Google Drive backup isn't switched on in this build yet."}
          </Text>
        )}
      </Panel>
      {status.account ? (
        <View style={[styles.row, { gap: spacing.md, flexWrap: 'wrap' }]}>
          <PillButton label={busy ? 'Backing up…' : 'Back up now'} icon="cloud-upload-outline" tone="dark" onPress={backUp} disabled={busy} />
          <PillButton label="Disconnect" icon="close" onPress={disconnect} disabled={busy} />
        </View>
      ) : status.available ? (
        <PillButton label={busy ? 'Connecting…' : 'Connect Google Drive'} icon="logo-google" tone="dark" onPress={connect} disabled={busy} />
      ) : null}
      <Text style={[typography.small, { color: colors.onDeskMuted, paddingHorizontal: spacing.xs }]}>
        {status.account
          ? `Saved in a "${status.folder}" folder in your Drive, once a day and whenever you tap Back up now. On a new phone, connect the same account to bring everything back.`
          : `It goes into a "${status.folder}" folder that only you can see. The app can't read anything else in your Drive.`}
      </Text>
    </View>
  );
}

/** One line on a paper card: label on the left, control on the right. */
function Row({ label, divider = false, children }: { label: string; divider?: boolean; children?: ReactNode }) {
  const { colors, spacing, typography, sizes } = useTheme();
  return (
    <View
      style={[
        styles.row,
        styles.between,
        { minHeight: sizes.rowHeight, gap: spacing.md },
        divider ? { borderTopWidth: 1, borderTopColor: colors.ruleLine } : null,
      ]}
    >
      {/* flex: 1 — Android under-measures Caveat, so give the label the row's width instead of its own. */}
      <Text style={[typography.hand, { color: colors.ink, flex: 1 }]}>{label}</Text>
      {children}
    </View>
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
            <Path
              d={`M 6 ${s / 2 + 1} L ${s / 2 - 1} ${s - 3} L ${s + 4} 0`}
              stroke={colors.green}
              strokeWidth={3.2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </Svg>
        <Text style={[typography.hand, { color: colors.ink, flex: 1 }]}>{label}</Text>
      </View>
    </PressableScale>
  );
}

/** Theme option: the chosen one is circled in pen. */
function ThemeChoice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors, spacing, typography } = useTheme();
  const [w, setW] = useState(0);
  return (
    <PressableScale
      style={{ flex: label.length }}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label} theme`}
    >
      <View style={{ paddingHorizontal: spacing.xs, paddingVertical: spacing.sm }}>
        {selected && w > 0 ? (
          <Doodle
            kind="circle"
            width={w + spacing.sm}
            height={(typography.hand.lineHeight ?? 0) + spacing.lg}
            color={colors.amber}
            seed={label.length}
            style={{ position: 'absolute', left: 0, top: 0 }}
          />
        ) : null}
        <Text
          onLayout={(e) => setW(e.nativeEvent.layout.width)}
          numberOfLines={1}
          style={[typography.hand, { color: selected ? colors.ink : colors.inkMuted, textAlign: 'center', paddingRight: 0 }]}
        >
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

function DevAction({ label, divider = false, onPress }: { label: string; divider?: boolean; onPress: () => void }) {
  const { colors, sizes } = useTheme();
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Row label={label} divider={divider}>
        <Ionicons name="arrow-forward" size={sizes.iconSmall} color={colors.ink} />
      </Row>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { justifyContent: 'space-between' },
});
