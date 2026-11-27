import DateTimePicker from '@react-native-community/datetimepicker';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { DEFAULT_REMINDER, settingsRepository } from '../data';
import { useReminderSettings } from '../hooks/useData';
import { tapHaptic } from '../lib/haptics';
import { REMINDER_WINDOW_DAYS } from '../notifications/planner';
import { hasPermission, refreshReminders, requestPermission } from '../notifications/scheduler';
import { useLook, useTheme, type PaperTone, type YearPalette } from '../theme';
import { CardTitle, CheckRow, Help, Row } from './CardParts';
import { SlideSwitch } from './Hardware';
import { usePageActive } from './PageActive';
import { CassettePicker, PaperPicker } from './Pickers';
import { PressableScale } from './PressableScale';
import { Panel } from './Screen';

/** The Look and Reminders cards, shown on the You page (and kept here so any page can show them). */

function formatTime(hour: number, minute: number): string {
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const TONES = [
  { value: 'light', label: 'Day', icon: 'sunny-outline' },
  { value: 'dark', label: 'Night', icon: 'moon-outline' },
] as const;

export function LookCard({ palette }: { palette: YearPalette }) {
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
      <View style={{ paddingTop: spacing.md }}>
        <CassettePicker value={look.cassette} onChange={(cassette) => setLook({ ...look, cassette })} />
      </View>
      <Help>Your cassette: the app icon and every tape in the diary. The icon changes once you leave the app.</Help>
    </Panel>
  );
}

export function ReminderCard({ palette }: { palette: YearPalette }) {
  const { colors, typography } = useTheme();
  const { data: reminder = DEFAULT_REMINDER } = useReminderSettings();
  const [permitted, setPermitted] = useState<boolean | null>(null);
  const [scheduled, setScheduled] = useState<number | null>(null);
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  const recount = useCallback(() => {
    hasPermission().then(setPermitted);
    refreshReminders().then(setScheduled, () => setScheduled(null));
  }, []);
  // You is built at startup while hidden; reminders are left alone until the page is first shown.
  const active = usePageActive();
  const [shown, setShown] = useState(active);
  if (active && !shown) setShown(true);
  useEffect(() => {
    if (!shown) return undefined;
    recount();
    return settingsRepository.subscribe(recount);
  }, [recount, shown]);

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

