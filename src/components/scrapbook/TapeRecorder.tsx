import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, interpolate, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TapeDeck } from '../../hooks/useTapeDeck';
import { tapHaptic } from '../../lib/haptics';
import { formatVoiceMs } from '../../lib/voice';
import { useTheme } from '../../theme';
import { PillButton } from '../Buttons';
import { ActionRow } from '../Screen';
import { Cassette } from './Cassette';
import type { VoicePlayer } from './Waveform';

/** The little cassette at the head of the deck row, and how much of the screen's width the lifted one takes. */
const MINI_TAPE = 92;
const BIG_SHARE = 0.86;
const BIG_MAX = 420;
const DIM = '#000000';
const DIM_ALPHA = 0.78;
/** Lifting is one eased move (no bounce); putting it down is a little quicker. */
const LIFT_MS = 340;
const PUT_DOWN_MS = 260;
/** The big cassette sits a little above the middle, leaving room for the keys under it. */
const RAISE = 0.12;
const RATIO = 0.63;

/**
 * The lift shared by the deck row and the lifted cassette: its progress (0 on the page, 1 held up), where it starts
 * from (the little cassette's place on screen), and lift / put down. The memory page owns it, so the big cassette can sit
 * over the whole page.
 */
export function useCassetteLift(deck: TapeDeck | undefined) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const fromX = useSharedValue(0);
  const fromY = useSharedValue(0);
  const fromW = useSharedValue(MINI_TAPE);
  const [held, setHeld] = useState(false);
  const lift = (rect: { x: number; y: number; w: number }) => {
    fromX.set(rect.x);
    fromY.set(rect.y);
    fromW.set(rect.w);
    setHeld(true);
    progress.set(withTiming(1, { duration: reduceMotion ? 0 : LIFT_MS, easing: Easing.out(Easing.cubic) }));
  };
  const putDown = () => {
    deck?.stop();
    progress.set(
      withTiming(0, { duration: reduceMotion ? 0 : PUT_DOWN_MS, easing: Easing.inOut(Easing.cubic) }, (done) => {
        if (done) runOnJS(setHeld)(false);
      }),
    );
  };
  return { progress, fromX, fromY, fromW, held, lift, putDown };
}
export type CassetteLift = ReturnType<typeof useCassetteLift>;

/**
 * The voice kept with a memory, on the page: one compact stitched row (the memory's own cassette, then Rewind · Play ·
 * Stop), so it sits on the first screen with the memory. Press Play or Rewind (or the little cassette) and that cassette
 * is lifted out of the row up into the middle of the screen (`LiftedCassette`).
 */
export function TapeRecorder({ width, player, label, deck, lift }: { width: number; player: VoicePlayer; label: string; deck: TapeDeck; lift: CassetteLift }) {
  const { spacing } = useTheme();
  const mini = useRef<ComponentRef<typeof View>>(null);
  const played = player.durationMs ? (player.positionMs ?? 0) / player.durationMs : 0;
  const pickUp = (then?: () => void) => {
    tapHaptic();
    const node = mini.current;
    if (!node) {
      then?.();
      return;
    }
    node.measureInWindow((x: number, y: number, w: number) => {
      lift.lift({ x, y, w: w || MINI_TAPE });
      then?.();
    });
  };
  return (
    <ActionRow
      style={{ width, alignSelf: 'center' }}
      lead={
        <Pressable onPress={() => pickUp()} accessibilityRole="button" accessibilityLabel="Pick up the cassette" style={{ paddingHorizontal: spacing.xs, justifyContent: 'center' }}>
          {/* The little one is the same cassette: while it is held up, its place in the row is empty. */}
          <View ref={mini} collapsable={false} style={{ opacity: lift.held ? 0 : 1 }}>
            <Cassette width={MINI_TAPE} title={label} detail={formatVoiceMs(player.durationMs)} spinning={false} played={played} />
          </View>
        </Pressable>
      }
      actions={[
        { key: 'rewind', icon: 'play-back-outline', label: 'Rewind', onPress: () => pickUp(deck.rewind) },
        { key: 'play', icon: deck.running ? 'pause' : 'play', label: deck.running ? 'Pause' : 'Play', active: deck.running, onPress: () => pickUp(deck.play) },
        { key: 'stop', icon: 'stop-outline', label: 'Stop', onPress: deck.stop },
      ]}
    />
  );
}

/**
 * The cassette held up in the middle of the screen, over the dimmed page: it rises out of its place in the deck row,
 * growing as it comes (one eased move, no bounce), its reels turning while it plays, the time under it and the deck's
 * keys below. "Put it down" (or a tap on the dimmed page) lays it back in the row the same way. Always built (invisible)
 * once the memory has arrived, so lifting it never waits on building anything; only a move and a scale animate.
 */
export function LiftedCassette({ lift, label, player, deck }: { lift: CassetteLift; label: string; player: VoicePlayer; deck: TapeDeck }) {
  const theme = useTheme();
  const { colors, typography, spacing } = theme;
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bigW = Math.min(BIG_MAX, W * BIG_SHARE);
  const bigH = bigW * RATIO;
  const left = (W - bigW) / 2;
  const top = H / 2 - bigH / 2 - H * RAISE;
  const played = player.durationMs ? (player.positionMs ?? 0) / player.durationMs : 0;
  const { progress, fromX, fromY, fromW, held } = lift;

  const dimStyle = useAnimatedStyle(() => ({ opacity: progress.get() * DIM_ALPHA }));
  const cassStyle = useAnimatedStyle(() => {
    const p = progress.get();
    const s0 = fromW.get() / bigW;
    const dx = fromX.get() + fromW.get() / 2 - (left + bigW / 2);
    const dy = fromY.get() + (fromW.get() * RATIO) / 2 - (top + bigH / 2);
    return {
      opacity: p > 0.001 ? 1 : 0,
      transform: [{ translateX: dx * (1 - p) }, { translateY: dy * (1 - p) }, { scale: s0 + (1 - s0) * p }, { rotate: `${-2 * p}deg` }],
    };
  });
  const keysStyle = useAnimatedStyle(() => {
    const k = interpolate(progress.get(), [0.45, 1], [0, 1], 'clamp');
    return { opacity: k, transform: [{ translateY: (1 - k) * 18 }] };
  });

  return (
    <View pointerEvents={held ? 'box-none' : 'none'} style={[StyleSheet.absoluteFill, { zIndex: 20 }]} accessibilityElementsHidden={!held} importantForAccessibility={held ? 'auto' : 'no-hide-descendants'}>
      <Pressable accessibilityLabel="Put the cassette down" onPress={lift.putDown} style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: DIM }, dimStyle]} />
      </Pressable>
      <Animated.View style={[{ position: 'absolute', left, top, width: bigW, height: bigH }, cassStyle]}>
        <Pressable onPress={deck.play} accessibilityRole="button" accessibilityLabel={deck.running ? 'Pause' : 'Play'}>
          <Cassette width={bigW} title={label} detail={formatVoiceMs(player.durationMs)} spinning={deck.running} played={played} />
        </Pressable>
      </Animated.View>
      <Animated.View pointerEvents="box-none" style={[{ position: 'absolute', left: spacing.gutter, right: spacing.gutter, top: top + bigH + spacing.lg, gap: spacing.md, paddingBottom: insets.bottom }, keysStyle]}>
        <Text style={[typography.caption, { color: colors.paperWhite, alignSelf: 'stretch', textAlign: 'center' }]}>
          {deck.running ? 'your past self, speaking' : 'press play to listen'} · {formatVoiceMs(player.positionMs)} / {formatVoiceMs(player.durationMs)}{' '}
        </Text>
        <ActionRow
          actions={[
            { key: 'rewind', icon: 'play-back-outline', label: 'Rewind', onPress: deck.rewind },
            { key: 'play', icon: deck.running ? 'pause' : 'play', label: deck.running ? 'Pause' : 'Play', active: deck.running, onPress: deck.play },
            { key: 'stop', icon: 'stop-outline', label: 'Stop', onPress: deck.stop },
          ]}
        />
        <PillButton label="Put it down" icon="arrow-down" large onPress={lift.putDown} />
      </Animated.View>
    </View>
  );
}

/** Re-exported for callers that only need the type of the lift's progress. */
export type LiftProgress = SharedValue<number>;
