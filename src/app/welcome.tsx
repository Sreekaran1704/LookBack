import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { stepIn, stepOut } from '../components/transitions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PillButton } from '../components/Buttons';
import { ActionBar, type BarAction } from '../components/Screen';
import { SlideSwitch } from '../components/Hardware';
import { PaperPicker } from '../components/Pickers';
import { PortraitBuddy, usePortraitFace, usePortraitHop } from '../components/PortraitBuddy';
import { PortraitChoices } from '../components/PortraitChoices';
import { Buddy } from '../components/scrapbook/Buddy';
import { FilmPortrait } from '../components/scrapbook/FilmPortrait';
import { PaperBackground } from '../components/scrapbook/PaperBackground';
import { accountRepository, backupRepository, DEFAULT_REMINDER, settingsRepository, type BackupStatus } from '../data';
import { useProfile, useReminderSettings, useToday } from '../hooks/useData';
import { parseLocalDate } from '../lib/dates';
import { encodePortrait, portraitFor, randomPortrait, type Portrait } from '../lib/portrait';
import { successHaptic } from '../lib/haptics';
import { requestPermission } from '../notifications/scheduler';
import { useLook, useTheme, type PaperTone } from '../theme';

const STEPS = ['hello', 'name', 'portrait', 'paper', 'reminder', 'backup', 'done'] as const;
/** How tall your portrait is on the first run's portrait step. */
const PORTRAIT_H = 170;

const TONES = [
  { value: 'light', label: 'Day', icon: 'sunny-outline' },
  { value: 'dark', label: 'Night', icon: 'moon-outline' },
] as const;

function formatTime(hour: number, minute: number): string {
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * First run (and "Read the first page again" in Settings): the diary's first pages, one at a time, under its stamp:
 * what the diary is for, whose it is (your name), its paper and day or lamplight (the whole app changes as you
 * pick), when letters from the past should arrive, and whether to keep a copy in Google Drive. Each answer is saved
 * as soon as it's given, so leaving halfway keeps what was chosen.
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

  // Your portrait while you make it; until the first change, the saved one (or the one your name would give you).
  const [portraitEdits, setPortrait] = useState<Portrait | null>(null);
  const portrait = portraitEdits ?? portraitFor(profile?.portrait, name.trim());
  // Scroll the choices and the little you hops out of the film to the bottom right, pulling faces as you change things.
  const { filmRef, onScroll, out, reset: resetHop } = usePortraitHop();
  const { face } = usePortraitFace(portrait);
  useEffect(() => {
    resetHop();
    // Each step starts at its top, with the film.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const next = () => {
    if (current === 'name') settingsRepository.setProfile({ name: name.trim() }).catch(() => undefined);
    if (current === 'portrait') settingsRepository.setProfile({ portrait: encodePortrait(portrait) }).catch(() => undefined);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => (step === 0 ? router.back() : setStep((s) => s - 1));
  const finish = async (write: boolean) => {
    await settingsRepository.setOnboarded(true);
    if (write) router.replace('/entry');
    else router.back();
  };

  const who = name.trim();
  // The step's main button lives in the bar, so it is always on screen (never under the keyboard or below the fold).
  const onward: BarAction | null =
    current === 'hello'
      ? { key: 'begin', icon: 'arrow-forward', label: 'Begin', primary: colors.gilt, onPress: next }
      : current === 'name'
        ? { key: 'name', icon: 'arrow-forward', label: who ? `${who}'s diary` : 'Skip', primary: who ? colors.gilt : undefined, onPress: next }
        : current === 'portrait'
          ? { key: 'portrait', icon: 'arrow-forward', label: 'This is me', primary: colors.gilt, onPress: next }
          : current === 'paper'
            ? { key: 'paper', icon: 'arrow-forward', label: 'This one', primary: colors.gilt, onPress: next }
            : null;
  const barActions: BarAction[] = [
    ...(step > 0 && current !== 'done' ? [{ key: 'back', icon: 'chevron-back' as const, label: 'Back', onPress: back }] : []),
    ...(current === 'portrait' ? [{ key: 'surprise', icon: 'shuffle' as const, label: 'Surprise', accessibilityLabel: 'Surprise me: a whole new portrait', onPress: () => setPortrait(randomPortrait()) }] : []),
    ...(onward ? [onward] : []),
  ];
  const entering = stepIn(reduceMotion);
  const exiting = stepOut(reduceMotion);

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground variant="dots" desk />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={[styles.top, { paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.gutter, gap: spacing.md }]}>
          <View style={{ width: sizes.circleButton }} />
          {/* Progress: a row of small gilt diamonds, filled as you go. */}
          <View style={[styles.row, { flex: 1, justifyContent: 'center', gap: spacing.md }]} accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((s, i) => (
              <View key={s} style={{ width: 9, height: 9, transform: [{ rotate: '45deg' }], borderWidth: 1, borderColor: colors.gilt, backgroundColor: i <= step ? colors.gilt : 'transparent' }} />
            ))}
          </View>
          <View style={{ width: sizes.circleButton }} />
        </View>

        <View style={{ flex: 1 }}>
        <Animated.ScrollView keyboardShouldPersistTaps="handled" onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ flexGrow: 1, padding: spacing.gutter, paddingBottom: insets.bottom + spacing.xl }}>
          <Animated.View key={current} entering={entering} exiting={exiting} style={{ flex: 1, gap: spacing.xl }}>
            {current === 'portrait' ? null : (
              <View style={{ alignItems: 'center' }}>
                <Buddy size={current === 'hello' || current === 'done' ? sizes.buddy * 1.4 : sizes.buddy * 0.8} bump={step} />
              </View>
            )}

            {current === 'hello' ? (
              <Page
                title="This is your diary"
                body="Write down what's weighing on you, or say it out loud onto a tape. A year from today it comes back to you, so you can see how it feels now."
              >
              </Page>
            ) : null}

            {current === 'name' ? (
              <Page title="Whose diary is this?" body="A first name, for the cover. You can skip this.">
                <View style={{ backgroundColor: colors.paper, borderRadius: 3, padding: spacing.lg, boxShadow: theme.shadow(undefined, 1) }}>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="your name"
                    placeholderTextColor={colors.inkMuted}
                    autoFocus
                    returnKeyType="next"
                    onSubmitEditing={next}
                    maxLength={24}
                    style={[typography.handLarge, { color: colors.inkBlue, textAlign: 'center' }]}
                    accessibilityLabel="Your name"
                  />
                </View>
              </Page>
            ) : null}

            {current === 'portrait' ? (
              <Page title="And what do you look like?" body="Make a little portrait of yourself. It goes with the pages you give, so your people know they're from you. Change it any time on You.">
                <Animated.View ref={filmRef} collapsable={false} style={{ alignSelf: 'center' }}>
                  <FilmPortrait portrait={portrait} size={PORTRAIT_H} hole={colors.desk} face={face} />
                </Animated.View>
                <PortraitChoices value={portrait} onChange={setPortrait} />
              </Page>
            ) : null}

            {current === 'paper' ? <PaperStep onNext={next} name={who} accent={palette.primary} /> : null}
            {current === 'reminder' ? <ReminderStep onNext={next} /> : null}
            {current === 'backup' ? <BackupStep onNext={next} /> : null}

            {current === 'done' ? (
              <Page title={who ? `Ready, ${who}` : 'Ready'} body="Your diary is ready. What's weighing on you today?">
                <PillButton label="Write today's page" icon="create-outline" tone="dark" large onPress={() => finish(true)} />
                <PillButton label="Look around first" icon="home-outline" large onPress={() => finish(false)} />
              </Page>
            ) : null}
          </Animated.View>
        </Animated.ScrollView>
        {current === 'portrait' ? <PortraitBuddy portrait={portrait} out={out} /> : null}
        </View>
        {/* Back and the step's own way on, at the foot where a thumb reaches them, riding up with the keyboard. */}
        {barActions.length > 0 ? <ActionBar withNavBar={false} actions={barActions} /> : null}
      </KeyboardAvoidingView>
    </View>
  );
}

function Page({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ gap: spacing.lg }}>
      <Text style={[typography.title, { color: colors.giltBright, textAlign: 'center' }]}>{title}</Text>
      <Text style={[typography.printItalic, { color: colors.onDeskMuted, textAlign: 'center', fontSize: 19, lineHeight: 27 }]}>{body}</Text>
      <View style={{ gap: spacing.md, marginTop: spacing.md }}>{children}</View>
    </View>
  );
}

function PaperStep({ onNext, name, accent }: { onNext: () => void; name: string; accent: string }) {
  const theme = useTheme();
  const { spacing, radii, colors } = theme;
  const { look, setLook } = useLook();
  return (
    <Page title="Choose your paper" body={`${name ? `${name}, pick` : 'Pick'} the paper your diary is written on. Lamplight is the same paper at night.`}>
      <View style={{ backgroundColor: colors.panel, borderRadius: radii.panel, padding: spacing.lg, gap: spacing.lg, boxShadow: theme.shadow(undefined, 1) }}>
        <PaperPicker value={look.paper} tone={look.tone} onChange={(paper) => setLook({ ...look, paper })} />
        <SlideSwitch<PaperTone> options={TONES} value={look.tone} onChange={(tone) => setLook({ ...look, tone })} />
      </View>
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
    <Page title="Letters from the past" body="On days when a page from an earlier year comes back, the diary sends you a quiet letter. When should it arrive?">
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
      if (await accountRepository.connect()) {
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
        <PillButton label="Go on" icon="arrow-forward" tone="dark" large onPress={onNext} />
      </Page>
    );
  }
  return (
    <Page title="Keep a copy?" body={`Your diary lives on this phone. Connect Google to keep a private copy in your own Drive (a "${status?.folder ?? 'LookBack'}" folder only you can see) and to let people you trust give you pages.`}>
      {status?.available ? <PillButton label={busy ? 'Connecting…' : 'Connect Google'} icon="logo-google" tone="dark" large onPress={connect} disabled={busy} /> : null}
      <PillButton label="Maybe later" large onPress={onNext} />
    </Page>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { alignItems: 'center' },
});
