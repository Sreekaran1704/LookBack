import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, useEffect } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { toggleHaptic } from '../../lib/haptics';
import { formatVoiceMs, MIN_BAR, WAVE_BARS } from '../../lib/voice';
import { useTheme } from '../../theme';
import { mixHex } from '../../theme/yearColors';

/** A voice memory being listened to: how far along it is (0–1), and a way to start or stop it. */
export interface VoicePlayer {
  progress: SharedValue<number>;
  playing: boolean;
  ready?: boolean;
  toggle: () => void;
  /** Stop and wind back to the start (the tape recorder's STOP and REWIND). */
  stop?: () => void;
  /** Where it is and how long it is, in ms (for tape winding). */
  positionMs?: number;
  durationMs?: number;
}

/** Share of each bar's slot that is ink (the rest is the gap between bars). */
const BAR_FILL = 0.6;
/** Bars not heard yet are a pale wash of the color. */
const UNPLAYED = 0.32;
/** The tops of the bars are lighter, like light falling on them. */
const BAR_LIGHT = 0.45;
/** The little heart that rides along as it plays (share of the waveform's height), and its breathing. */
const HEART_SHARE = 0.5;
const HEART_PULSE_MS = 700;
const HEART_PATH = 'M12 21s-7.5-4.6-9.6-9.1C.8 8.4 2.9 4.5 6.7 4.5c2.1 0 3.6 1.2 4.3 2.6.7-1.4 2.2-2.6 4.3-2.6 3.8 0 5.9 3.9 4.3 7.4C19.5 16.4 12 21 12 21z';

function Bars({ wave, width, height, color, faded = false }: { wave: readonly number[]; width: number; height: number; color: string; faded?: boolean }) {
  const slot = width / wave.length;
  const barW = Math.max(2, slot * BAR_FILL);
  // Native views with a gradient (drawn on the GPU): an SVG is painted on the CPU, and these redraw as you listen.
  const fill = `linear-gradient(180deg, ${mixHex(color, '#FFFFFF', BAR_LIGHT)} 0%, ${color} 55%, ${mixHex(color, '#FFFFFF', BAR_LIGHT * 0.4)} 100%)`;
  return (
    <View style={{ width, height, flexDirection: 'row', alignItems: 'center', opacity: faded ? UNPLAYED : 1 }}>
      {wave.map((v, i) => (
        <View key={i} style={{ width: slot, alignItems: 'center' }}>
          <View style={{ width: barW, height: Math.max(barW, height * v), borderRadius: barW / 2, backgroundImage: fill }} />
        </View>
      ))}
    </View>
  );
}

/**
 * A voice memory's waveform: soft rounded capsules with light on their tops, loud where the voice was
 * loud. With a `progress` (0–1), the part already heard fills in with the full color (only a clip moves,
 * nothing is redrawn) and a little heart rides along at the playhead, breathing while it `plays`. While
 * recording, pass progress 1 and `playing`: the heart sits on the newest bar.
 */
export const Waveform = memo(function Waveform({
  wave,
  width,
  height,
  color,
  progress,
  playing = false,
  heart: withHeart = true,
}: {
  wave: readonly number[] | null;
  width: number;
  height: number;
  color: string;
  progress?: SharedValue<number>;
  playing?: boolean;
  /** The little heart at the playhead (off for the live waveform while recording). */
  heart?: boolean;
}) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const bars = wave && wave.length > 0 ? wave : Array.from({ length: WAVE_BARS }, () => MIN_BAR);
  const heart = Math.max(10, height * HEART_SHARE);
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!playing || reduceMotion) {
      pulse.set(withTiming(0, { duration: HEART_PULSE_MS / 2 }));
      return;
    }
    pulse.set(withRepeat(withTiming(1, { duration: HEART_PULSE_MS, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [playing, reduceMotion, pulse]);
  const played = useAnimatedStyle(() => ({ width: (progress ? progress.get() : 0) * width }));
  const heartStyle = useAnimatedStyle(() => {
    const p = progress ? progress.get() : 0;
    return {
      opacity: playing || p > 0.001 ? 1 : 0,
      transform: [{ translateX: p * width - heart / 2 }, { scale: 1 + pulse.get() * 0.18 }],
    };
  });
  return (
    <View style={{ width, height }}>
      <Bars wave={bars} width={width} height={height} color={color} faded />
      {progress ? (
        <>
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, height, overflow: 'hidden' }, played]}>
            <Bars wave={bars} width={width} height={height} color={color} />
          </Animated.View>
          {withHeart ? (
            <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: (height - heart) / 2, width: heart, height: heart }, heartStyle]}>
              <Svg width={heart} height={heart} viewBox="0 0 24 24">
                <Path d={HEART_PATH} fill={color} stroke={colors.paperWhite} strokeWidth={2.4} strokeLinejoin="round" />
              </Svg>
            </Animated.View>
          ) : null}
        </>
      ) : null}
    </View>
  );
});

/**
 * The listening row on a voice memory: a round play button, the waveform, and how long it is.
 * Without a `player` (piles, thumbnails, the writing page) it is just drawn; the button does nothing.
 */
export function VoiceRow({
  wave,
  ms,
  width,
  height,
  color,
  player,
  style,
}: {
  wave: readonly number[] | null;
  ms: number | null;
  width: number;
  height: number;
  color: string;
  player?: VoicePlayer;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, typography, spacing } = useTheme();
  const button = Math.round(height * 0.86);
  const label = formatVoiceMs(ms);
  const fontSize = Math.max(11, height * 0.42);
  // Room for "0:07" in handwriting.
  const labelW = fontSize * 1.9;
  const waveW = Math.max(0, width - button - labelW - spacing.sm * 2);
  return (
    <View style={[{ width, height, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, style]}>
      <PlayButton size={button} color={color} player={player} label={label} />
      <Waveform wave={wave} width={waveW} height={height} color={color} progress={player?.progress} playing={player?.playing} />
      <Text numberOfLines={1} style={[typography.hand, { color: colors.inkMuted, fontSize, lineHeight: fontSize * 1.15, width: labelW, textAlign: 'right' }]}>
        {label}
      </Text>
    </View>
  );
}

/** The round play / pause button of a voice memory. Without a `player` it is only drawn. */
export function PlayButton({ size, color, player, label }: { size: number; color: string; player?: VoicePlayer; label: string }) {
  const { colors, spacing } = useTheme();
  const icon = (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={player?.playing ? 'pause' : 'play'} size={size * 0.5} color={colors.paperWhite} style={{ marginLeft: player?.playing ? 0 : size * 0.06 }} />
    </View>
  );
  if (!player) return icon;
  return (
    <Pressable
      onPress={() => {
        toggleHaptic(!player.playing);
        player.toggle();
      }}
      hitSlop={spacing.md}
      accessibilityRole="button"
      accessibilityLabel={player.playing ? 'Pause the voice note' : `Play the voice note, ${label}`}
    >
      {icon}
    </Pressable>
  );
}
