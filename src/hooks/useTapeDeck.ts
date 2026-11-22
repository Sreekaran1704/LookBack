import { useAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { VoicePlayer } from '../components/scrapbook/Waveform';
import { tapHaptic } from '../lib/haptics';

const CLUNK = require('../../assets/sounds/tape-clunk.wav');
const MOTOR_START = require('../../assets/sounds/tape-start.wav');
const MOTOR_STOP = require('../../assets/sounds/tape-stop.wav');
const HISS = require('../../assets/sounds/tape-hiss.wav');
const SCREECH_START = require('../../assets/sounds/tape-screech-start.wav');
const SCREECH_END = require('../../assets/sounds/tape-screech-end.wav');

/** Tape texture belongs to the leader, before the voice begins. */
const HISS_VOLUME = 0.09;
const MOTOR_VOLUME = 0.55;
/** After the key goes down: the motor starts, and a moment later the voice comes off the tape. */
const MOTOR_DELAY_MS = 90;
const VOICE_DELAY_MS = 480;
/** The tape squeals over the head just before the voice comes off it, and again as it runs out or is stopped. */
const SCREECH_LEAD_MS = 220;
const SCREECH_VOLUME = 0.18;

/** Sets up a sound player (outside the component, so the React Compiler sees no hook value being changed). */
function configure(player: AudioPlayer, options: { loop?: boolean; volume?: number }) {
  if (options.loop !== undefined) player.loop = options.loop;
  if (options.volume !== undefined) player.volume = options.volume;
}
function fromTop(player: AudioPlayer) {
  player.seekTo(0).then(() => player.play()).catch(() => undefined);
}

export interface TapeDeck {
  /** PLAY (or, while running, PAUSE): the key clunks down, the motor spins up and the voice comes off the tape. */
  play: () => void;
  /** STOP: the key clunks, the motor winds down and the tape goes back to the start. */
  stop: () => void;
  /** REWIND: back to the start. */
  rewind: () => void;
  /** The tape is moving (spinning up, or playing). */
  running: boolean;
}

/**
 * The tape recorder's mechanics for one voice memory: its key clunks, motor and hiss around the voice player. The
 * recorder's keys and the page's own bar both use it, so pressing Listen in the bar is the same as pressing PLAY.
 */
export function useTapeDeck(player: VoicePlayer | undefined): TapeDeck {
  const clunk = useAudioPlayer(CLUNK);
  const motorStart = useAudioPlayer(MOTOR_START);
  const motorStop = useAudioPlayer(MOTOR_STOP);
  const hiss = useAudioPlayer(HISS);
  const screechStart = useAudioPlayer(SCREECH_START);
  const screechEnd = useAudioPlayer(SCREECH_END);
  const currentPlayer = useRef(player);
  useEffect(() => { currentPlayer.current = player; }, [player]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [rolling, setRolling] = useState(false);
  const playing = player?.playing ?? false;
  const running = rolling || playing;

  useEffect(() => {
    configure(hiss, { loop: true, volume: HISS_VOLUME });
    configure(motorStart, { volume: MOTOR_VOLUME });
    configure(motorStop, { volume: MOTOR_VOLUME });
    configure(screechStart, { volume: SCREECH_VOLUME });
    configure(screechEnd, { volume: SCREECH_VOLUME });
  }, [hiss, motorStart, motorStop, screechStart, screechEnd]);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const wasPlaying = useRef(false);

  // Leaving the page or locking the phone must also cancel a pending motor start.
  useFocusEffect(useCallback(() => {
    const silence = () => {
      wasPlaying.current = false;
      timers.current.forEach(clearTimeout);
      timers.current = [];
      hiss.pause();
      motorStart.pause();
      motorStop.pause();
      clunk.pause();
      screechStart.pause();
      screechEnd.pause();
      currentPlayer.current?.stop?.();
      setRolling(false);
    };
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') silence(); });
    return () => { subscription.remove(); silence(); };
  }, [hiss, motorStart, motorStop, clunk, screechStart, screechEnd]));

  // When the tape runs out by itself, the hiss stops and the motor winds down.
  useEffect(() => {
    if (wasPlaying.current && !playing && !rolling) {
      hiss.pause();
      fromTop(screechEnd);
      fromTop(motorStop);
    }
    wasPlaying.current = playing;
    // Only when the voice starts or stops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const quiet = () => {
    // A stop or pause by hand plays its own wind-down, so the run-out check above mustn't play another.
    wasPlaying.current = false;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    hiss.pause();
    motorStart.pause();
    screechStart.pause();
  };
  const keyDown = () => {
    tapHaptic();
    fromTop(clunk);
  };
  const toStart = () => {
    keyDown();
    quiet();
    setRolling(false);
    if (running) {
      fromTop(screechEnd);
      fromTop(motorStop);
    }
    player?.stop?.();
  };

  return {
    running,
    play: () => {
      if (!player || player.ready === false) return;
      keyDown();
      if (running) {
        // PLAY again is pause: the key pops up.
        quiet();
        setRolling(false);
        if (player.playing) player.toggle();
        fromTop(screechEnd);
        fromTop(motorStop);
        return;
      }
      setRolling(true);
      fromTop(hiss);
      timers.current.push(setTimeout(() => fromTop(motorStart), MOTOR_DELAY_MS));
      timers.current.push(setTimeout(() => fromTop(screechStart), VOICE_DELAY_MS - SCREECH_LEAD_MS));
      timers.current.push(
        setTimeout(() => {
          hiss.pause();
          motorStart.pause();
          screechStart.pause();
          clunk.pause();
          motorStop.pause();
          screechEnd.pause();
          setRolling(false);
          if (!player.playing) player.toggle();
        }, VOICE_DELAY_MS),
      );
    },
    stop: toStart,
    rewind: toStart,
  };
}
