import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, SlideInRight, SlideOutLeft, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleButton, PillButton } from '../components/Buttons';
import { PaperPicker, SlidingToggle } from '../components/Pickers';
import { Buddy, type BuddyMood } from '../components/scrapbook/Buddy';
import { Confetti } from '../components/scrapbook/Confetti';
import { PaperBackground } from '../components/scrapbook/PaperBackground';
import { backupRepository, DEFAULT_REMINDER, settingsRepository, type BackupStatus } from '../data';
import { useProfile, useReminderSettings, useToday } from '../hooks/useData';
import { parseLocalDate } from '../lib/dates';
import { successHaptic } from '../lib/haptics';
import { requestPermission } from '../notifications/scheduler';
import { useLook, useTheme, type PaperTone } from '../theme';

const STEPS = ['hello', 'name', 'paper', 'reminder', 'backup', 'done'] as const;
type Step = (typeof STEPS)[number];

const TONES = [
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
] as const;

const MOODS: Record<Step, BuddyMood> = { hello: 'wave', name: 'happy', paper: 'peek', reminder: 'happy', backup: 'happy', done: 'cheer' };

function formatTime(hour: number, minute: number): string {
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * First run (and "Meet the bunny again" in Settings): the bunny introduces itself and asks a few
 * things, one page at a time: your name, your paper and light or dark (the whole app changes as you
 * pick), when letters from the past should arrive, and whether to keep a copy in Google Drive. Each
 * answer is saved as soon as it's given, so leaving halfway keeps what was chosen.
 */
export default function WelcomeScreen() {
  const theme = useTheme();
  const { colors, spacing, typography, sizes } = theme;
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const palette = theme.year(parseLocalDate(useToday()).year);
  const [step, setStep] = useState(0);
  const current = STEPS[step] ?? 'hello';
  const { data: profile } = useProfile();
  const [name, setName] = useState('');
  const [seenName, setSeenName] = useState<string | undefined>(undefined);
  if (profile?.name !== undefined && profile.name !== seenName) {
    setSeenName(profile.name);
    if (profile.name) setName(profile.name);
  }

  const next = () => {
    if (current === 'name') settingsRepository.setProfile({ name: name.trim() }).catch(() => undefined);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => (step === 0 ? router.back() : setStep((s) => s - 1));
  const finish = async (write: boolean) => {
    await settingsRepository.setOnboarded(true);
    if (write) router.replace('/entry');
    else router.back();
  };

  const entering = reduceMotion ? FadeIn : SlideInRight.springify().damping(20);
  const exiting = reduceMotion ? undefined : SlideOutLeft.duration(theme.motion.screenMs);
  const who = name.trim();

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground variant="dots" desk />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={[styles.top, { paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.gutter, gap: spacing.md }]}>
          {step > 0 && current !== 'done' ? <CircleButton icon="chevron-back" accessibilityLabel="Back" onPress={back} /> : <View style={{ width: sizes.circleButton }} />}
          {/* Progress: a row of little hearts, filled as you go. */}
          <View style={[styles.row, { flex: 1, justifyContent: 'center', gap: spacing.xs }]} accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((s, i) => (
              <Text key={s} style={[typography.hand, { color: i <= step ? palette.primary : colors.onDeskFaint, paddingRight: 0 }]}>
                {i <= step ? '♥' : '♡'}
              </Text>
            ))}
          </View>
          <View style={{ width: sizes.circleButton }} />
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, padding: spacing.gutter, paddingBottom: insets.bottom + spacing.xl }}>
          <Animated.View key={current} entering={entering} exiting={exiting} style={{ flex: 1, gap: spacing.xl }}>
            <View style={{ alignItems: 'center' }}>
              <Buddy mood={MOODS[current]} accent={palette.primary} size={current === 'hello' || current === 'done' ? sizes.buddy * 1.8 : sizes.buddy * 1.2} bump={step} />
            </View>

            {current === 'hello' ? (
              <Page
                title={'Hi! I\'m Bun.'}
                body="Every day, tell me one small thing: a note, a quote or a photo. On the same day next year, I'll bring it back to you as a letter."
              >
                <PillButton label="Nice to meet you!" icon="heart" tone="dark" large onPress={next} />
              </Page>
            ) : null}

            {current === 'name' ? (
              <Page title="What should I call you?" body="Just a first name is lovely. You can skip this.">
                <View style={[styles.note, { backgroundColor: colors.paperWhite, borderRadius: theme.radii.paper, padding: spacing.lg, boxShadow: theme.shadow(palette.primary, 1) }]}>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="your name"
                    placeholderTextColor={colors.inkMuted}
                    autoFocus
                    returnKeyType="next"
                    onSubmitEditing={next}
                    maxLength={24}
                    style={[typography.headline, { color: colors.ink, textAlign: 'center' }]}
                    accessibilityLabel="Your name"
                  />
                </View>
                <PillButton label={who ? `Hi, ${who}!` : 'Skip'} icon="arrow-forward" tone={who ? 'dark' : 'paper'} large onPress={next} />
              </Page>
            ) : null}

            {current === 'paper' ? <PaperStep onNext={next} name={who} accent={palette.primary} /> : null}
            {current === 'reminder' ? <ReminderStep onNext={next} /> : null}
            {current === 'backup' ? <BackupStep onNext={next} /> : null}

            {current === 'done' ? (
              <Page title={who ? `All set, ${who}!` : 'All set!'} body="Your notebook is ready. What's one small thing from today?">
                <PillButton label="Write today's page" icon="create-outline" tone="dark" large onPress={() => finish(true)} />
                <PillButton label="Look around first" icon="home-outline" large onPress={() => finish(false)} />
              </Page>
            ) : null}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
      {current === 'done' ? <Confetti colors={[palette.primary, palette.secondary, colors.amber, colors.green]} burstKey={step} /> : null}
    </View>
  );
}

function Page({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ gap: spacing.lg }}>
      <Text style={[typography.title, { color: colors.onDesk, textAlign: 'center' }]}>{title}</Text>
      <Text style={[typography.body, { color: colors.onDeskMuted, textAlign: 'center' }]}>{body}</Text>
      <View style={{ gap: spacing.md, marginTop: spacing.md }}>{children}</View>
    </View>
  );
}

function PaperStep({ onNext, name, accent }: { onNext: () => void; name: string; accent: string }) {
  const theme = useTheme();
  const { spacing, radii, colors } = theme;
  const { look, setLook } = useLook();
  return (
    <Page title="Pick your paper" body={`${name ? `${name}, this` : 'This'} is the page every memory is stuck onto. Dark is the same paper by lamplight.`}>
      <View style={{ backgroundColor: colors.panel, borderRadius: radii.panel, padding: spacing.lg, gap: spacing.lg, boxShadow: theme.shadow(undefined, 1) }}>
        <PaperPicker value={look.paper} tone={look.tone} onChange={(paper) => setLook({ ...look, paper })} />
        <SlidingToggle<PaperTone> options={TONES} value={look.tone} onChange={(tone) => setLook({ ...look, tone })} accent={accent} />
      </View>
      <PillButton label="Looks lovely" icon="arrow-forward" tone="dark" large onPress={onNext} />
    </Page>
  );
}

function ReminderStep({ onNext }: { onNext: () => void }) {
  const theme = useTheme();
  const { spacing, typography, colors, radii } = theme;
  const { data: reminder = DEFAULT_REMINDER } = useReminderSettings();
  const [picking, setPicking] = useState(false);
  const pickerValue = new Date(2000, 0, 1, reminder.hour, reminder.minute);
  const setTime = (d: Date) => settingsRepository.setReminder({ hour: d.getHours(), minute: d.getMinutes() });

  const turnOn = async () => {
    if (!(await requestPermission())) {
      Alert.alert('Notifications are off', 'You can turn them on later in your phone settings.');
      onNext();
      return;
    }
    await settingsRepository.setReminder({ enabled: true });
    successHaptic();
    onNext();
  };

  return (
    <Page title="Letters from the past" body="On days when you have a memory from an earlier year, I'll send you a little letter. When should it arrive?">
      <View style={[styles.center, { backgroundColor: colors.panel, borderRadius: radii.panel, padding: spacing.lg, boxShadow: theme.shadow(undefined, 1) }]}>
        {Platform.OS === 'ios' ? (
          <DateTimePicker value={pickerValue} mode="time" display="spinner" onValueChange={(_, d) => setTime(d)} />
        ) : (
          <PillButton label={formatTime(reminder.hour, reminder.minute)} icon="time-outline" onPress={() => setPicking(true)} accessibilityLabel="Change the time" />
        )}
        <Text style={[typography.small, { color: colors.inkMuted, marginTop: spacing.sm }]}>tap to change the time</Text>
      </View>
      {picking ? (
        <DateTimePicker
          value={pickerValue}
          mode="time"
          onValueChange={(_, d) => {
            setPicking(false);
            setTime(d);
          }}
          onDismiss={() => setPicking(false)}
        />
      ) : null}
      <PillButton label="Yes, send me letters" icon="mail-outline" tone="dark" large onPress={turnOn} />
      <PillButton label="Not now" large onPress={onNext} />
    </Page>
  );
}

function BackupStep({ onNext }: { onNext: () => void }) {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    backupRepository.getStatus().then(setStatus, () => undefined);
  }, []);
  const connect = async () => {
    setBusy(true);
    try {
      if (await backupRepository.connect()) {
        await backupRepository.syncNow();
        successHaptic();
        onNext();
      }
    } catch (error) {
      Alert.alert("Couldn't connect", error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  if (status?.account) {
    return (
      <Page title="Your copy is safe" body={`Backing up to ${status.account}.`}>
        <PillButton label="Lovely" icon="arrow-forward" tone="dark" large onPress={onNext} />
      </Page>
    );
  }
  return (
    <Page title="Keep a copy?" body={`Your memories live on this phone. I can also keep a private copy in your own Google Drive, in a "${status?.folder ?? 'LookBack'}" folder only you can see.`}>
      {status?.available ? <PillButton label={busy ? 'Connecting…' : 'Connect Google Drive'} icon="logo-google" tone="dark" large onPress={connect} disabled={busy} /> : null}
      <PillButton label="Maybe later" large onPress={onNext} />
    </Page>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { alignItems: 'center' },
  note: { transform: [{ rotate: '-1deg' }] },
});
