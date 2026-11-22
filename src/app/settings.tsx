import DateTimePicker from '@react-native-community/datetimepicker';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { memo, useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { DiaryDock } from '../components/DiaryDock';
import { ActionRow, CardTitle, CheckRow, Help, Row } from '../components/CardParts';
import { SlideSwitch } from '../components/Hardware';
import { PaperPicker } from '../components/Pickers';
import { PressableScale } from '../components/PressableScale';
import { PageFooter, PageHeader, Panel, usePageContentStyle } from '../components/Screen';
import { useStatusPill } from '../components/StatusPill';
import { PaperBackground } from '../components/scrapbook/PaperBackground';
import { DEFAULT_REMINDER, settingsRepository } from '../data';
import { cycleAppIcon } from '../device/appIcon';
import { clearSampleEntries, seedSampleEntries } from '../dev/seed';
import { useReminderSettings, useToday } from '../hooks/useData';
import { parseLocalDate } from '../lib/dates';
import { SHOW_DEV_TOOLS } from '../lib/flags';
import { tapHaptic } from '../lib/haptics';
import { REMINDER_WINDOW_DAYS } from '../notifications/planner';
import { hasPermission, refreshReminders, requestPermission, sendTestNotification } from '../notifications/scheduler';
import { useLook, useTheme, type PaperTone, type YearPalette } from '../theme';

function formatTime(hour: number, minute: number): string {
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const TONES = [
  { value: 'light', label: 'Day', icon: 'sunny-outline' },
  { value: 'dark', label: 'Night', icon: 'moon-outline' },
] as const;

/**
 * Settings, the last page of the diary: one page per topic (the look, reminders, about; you,
 * your Google account and backup are on the You page), each with its controls and a line of help inside it, so nothing floats loose.
 */
function SettingsScreen() {
  const theme = useTheme();
  const pageContent = usePageContentStyle({ thumbBar: true });
  const palette = theme.year(parseLocalDate(useToday()).year);

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground variant="dots" desk />
      <Animated.ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={pageContent}>
        <PageHeader title="Settings" subtitle="make this diary yours" accent={palette.secondary} />

        <LookCard palette={palette} />
        <ReminderCard palette={palette} />
        <AboutCard palette={palette} />
        {SHOW_DEV_TOOLS ? <DeveloperCard palette={palette} /> : null}

        <PageFooter label="the last page · settings" />
      </Animated.ScrollView>
      <DiaryDock actions={[{ key: 'back', label: 'Back', icon: 'chevron-back', onPress: () => router.back() }]} />
    </View>
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
        <SlideSwitch<PaperTone> options={TONES} value={look.tone} onChange={(tone) => setLook({ ...look, tone })} />
      </View>
      <Help>The colour of your paper. Night is the same paper by lamplight.</Help>
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
      <CardTitle icon="notifications-outline" title="Reminders" />
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
function AboutCard({ palette }: { palette: YearPalette }) {
  const { colors, typography } = useTheme();
  return (
    <Panel seed="about" accent={palette.primary} accent2={palette.secondary}>
      <CardTitle icon="book-outline" title="About" color={palette.primary} />
      <Row label="LookBack">
        <Text style={[typography.handSmall, { color: colors.inkMuted }]}>version {Constants.expoConfig?.version ?? '1.0'}</Text>
      </Row>
      <ActionRow label="Read the first page again" divider onPress={() => router.push('/welcome')} />
      <Help>Write what weighs on you. It comes back to you on the same day next year, so you can see how it feels now.</Help>
    </Panel>
  );
}

function DeveloperCard({ palette }: { palette: YearPalette }) {
  const statusPill = useStatusPill();
  return (
    <Panel seed="developer" accent={palette.primary} accent2={palette.secondary}>
      <CardTitle icon="construct-outline" title="Developer" />
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


// Memoised, ignoring props (it was a bar page; it now opens from You): the page slider re-renders every page when the route changes, and the first time the bar
// opens a page the router hands it a new route object, which rebuilt the whole page once (Settings: 90 ms, the stutter at
// the end of the first swipe to it). The page reads everything it needs through hooks, so its props never matter.
export default memo(SettingsScreen, () => true);
