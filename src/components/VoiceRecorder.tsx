import Ionicons from '@expo/vector-icons/Ionicons';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, type RecordingOptions } from 'expo-audio';
import { useEffect, useState } from 'react';
import { Alert, Keyboard, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { toggleHaptic } from '../lib/haptics';
import { formatVoiceMs, levelFromDb, shapeWaveform, VOICE_MAX_MS, WAVE_BARS } from '../lib/voice';
import { useTheme } from '../theme';
import { ActionRow, type BarAction } from './Screen';
import { sheetIn, sheetOut } from './transitions';
import { Waveform, type VoicePlayer } from './scrapbook/Waveform';

/** A recording made on the writing page, not saved yet (or the saved one, while editing). */
export interface VoiceDraft {
  uri: string;
  wave: number[];
  ms: number;
}

/** A voice note is a few words said out loud: one channel, speech quality, small in backups. */
const OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 64000,
  isMeteringEnabled: true,
};
/** How often the level meter is read while recording (ms). */
const METER_MS = 80;

export interface VoiceRecording {
  recording: boolean;
  elapsed: number;
  /** Levels (0–1) read so far, one per METER_MS. */
  levels: number[];
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

/**
 * Records a voice note: \`start\` asks for the microphone the first time, \`stop\` hands the finished
 * recording (with its waveform) to \`onDone\`. Stops by itself at a minute.
 */
export function useVoiceRecording(onDone: (draft: VoiceDraft) => void): VoiceRecording {
  const recorder = useAudioRecorder(OPTIONS);
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [recording, setRecording] = useState(false);

  // Each meter reading becomes one more sliver of the waveform.
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => {
      const status = recorder.getStatus();
      if (!status.isRecording) return;
      setLevels((l) => [...l, levelFromDb(status.metering)]);
      setElapsed(status.durationMillis);
    }, METER_MS);
    return () => clearInterval(timer);
  }, [recording, recorder]);

  async function start() {
    Keyboard.dismiss();
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Microphone is off', 'Allow microphone access in Settings to record a voice note.');
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      setLevels([]);
      setElapsed(0);
      recorder.record();
      setRecording(true);
      toggleHaptic(true);
    } catch (error) {
      Alert.alert("Couldn't record", error instanceof Error ? error.message : String(error));
    }
  }

  async function stop() {
    if (!recording) return;
    const ms = Math.max(elapsed, recorder.getStatus().durationMillis);
    try {
      await recorder.stop();
    } finally {
      setRecording(false);
      setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
    }
    toggleHaptic(false);
    const uri = recorder.uri;
    // Too short to be anything (a slip of the finger): keep what was there.
    if (!uri || ms < 500) return;
    onDone({ uri, ms, wave: shapeWaveform(levels, WAVE_BARS) });
  }

  // A minute is plenty for one small thing.
  useEffect(() => {
    if (recording && elapsed >= VOICE_MAX_MS) void stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, elapsed]);

  return { recording, elapsed, levels, start, stop };
}

/**
 * A slim strip just above the writing page's buttons, made like them (One UI style, every button
 * labelled): while recording, the waveform drawing itself as you speak, the time, and Done; once
 * recorded, its length, then Listen, Re-record and Remove. Nothing otherwise (Voice in the bar below
 * starts a recording). It eases up into place and away again.
 */
export function VoiceStrip({ rec, value, player, onRemove, accent }: { rec: VoiceRecording; value: VoiceDraft | null; player?: VoicePlayer; onRemove: () => void; accent: string }) {
  const theme = useTheme();
  const { colors, spacing, sizes, typography } = theme;
  const reduceMotion = useReducedMotion();
  const [waveW, setWaveW] = useState(0);
  const pulse = useSharedValue(0);
  /** While recording the waveform is all "heard": full color, the heart on the newest bar. */
  const full = useSharedValue(1);

  useEffect(() => {
    if (!rec.recording || reduceMotion) {
      pulse.set(0);
      return;
    }
    pulse.set(withRepeat(withTiming(1, { duration: theme.motion.buddyBobMs / 2, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [rec.recording, reduceMotion, pulse, theme.motion.buddyBobMs]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: 1 - pulse.get() * 0.6, transform: [{ scale: 1 + pulse.get() * 0.25 }] }));

  if (!rec.recording && !value) return null;
  const waveH = sizes.circleButton * 0.55;
  const live = rec.levels.slice(-WAVE_BARS);
  const liveWave = [...Array.from({ length: WAVE_BARS - live.length }, () => 0.06), ...live];

  const lead = rec.recording ? (
    <View style={{ flex: 2.6, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.md }}>
      <Animated.View style={[{ width: sizes.iconSmall, height: sizes.iconSmall, borderRadius: sizes.iconSmall / 2, backgroundColor: accent }, dotStyle]} />
      <View style={{ flex: 1, height: waveH }} onLayout={(e) => setWaveW(e.nativeEvent.layout.width)}>
        {waveW > 0 ? <Waveform wave={liveWave} width={waveW} height={waveH} color={accent} progress={full} playing /> : null}
      </View>
      <Text style={[typography.label, { color: colors.ink }]}>{formatVoiceMs(rec.elapsed)} </Text>
    </View>
  ) : value ? (
    <View style={{ flex: 1, alignItems: 'center', gap: 1 }}>
      <Ionicons name="mic" size={sizes.icon} color={accent} />
      <Text numberOfLines={1} style={[typography.small, { color: colors.inkMuted, alignSelf: 'stretch', textAlign: 'center' }]}>
        {formatVoiceMs(value.ms)}
      </Text>
    </View>
  ) : null;

  const actions: BarAction[] = rec.recording
    ? [{ key: 'done', icon: 'stop', label: 'Done', primary: accent, accessibilityLabel: 'Stop recording', onPress: () => void rec.stop() }]
    : [
        ...(player
          ? [{ key: 'listen', icon: player.playing ? ('pause' as const) : ('play' as const), label: player.playing ? 'Pause' : 'Listen', tint: accent, active: player.playing, onPress: player.toggle }]
          : []),
        {
          key: 'again',
          icon: 'mic-outline',
          label: 'Re-record',
          accessibilityLabel: 'Record the voice note again',
          onPress: () => {
            if (player?.playing) player.toggle();
            void rec.start();
          },
        },
        { key: 'remove', icon: 'trash-outline', label: 'Remove', accessibilityLabel: 'Remove the voice note', onPress: onRemove },
      ];

  return (
    <Animated.View entering={sheetIn(reduceMotion)} exiting={sheetOut(reduceMotion)} style={{ marginHorizontal: spacing.gutter }}>
      <ActionRow lead={lead} actions={actions} tapes={false} />
    </Animated.View>
  );
}
