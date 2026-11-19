import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect } from 'react';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import type { VoicePlayer } from '../components/scrapbook/Waveform';

/** How often the player reports where it is (ms); the waveform eases between reports. */
const UPDATE_MS = 100;

/**
 * Plays one voice note (a file:// URI, or null for none). Returns what the waveform needs: how far
 * along it is (a shared value, so only the waveform's clip moves), whether it is playing, and a toggle.
 * At the end it rewinds, ready to be heard again.
 */
export function useVoicePlayback(uri: string | null): VoicePlayer | undefined {
  const player = useAudioPlayer(uri, { updateInterval: UPDATE_MS });
  const status = useAudioPlayerStatus(player);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!uri) return;
    // Plays through the speaker even with the phone on silent: you tapped play.
    setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined);
  }, [uri]);

  useEffect(() => {
    const t = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;
    progress.set(withTiming(t, { duration: status.playing ? UPDATE_MS : 0 }));
  }, [status.currentTime, status.duration, status.playing, progress]);

  useEffect(() => {
    if (!status.didJustFinish) return;
    player.pause();
    player.seekTo(0).catch(() => undefined);
    progress.set(0);
  }, [status.didJustFinish, player, progress]);

  if (!uri) return undefined;
  return {
    progress,
    playing: status.playing,
    toggle: () => {
      if (status.playing) {
        player.pause();
        return;
      }
      // Finished (or nearly): start again from the top.
      if (status.duration > 0 && status.currentTime >= status.duration - 0.05) player.seekTo(0).catch(() => undefined);
      player.play();
    },
  };
}
