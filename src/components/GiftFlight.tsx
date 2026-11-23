import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { Modal, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { arriveHaptic, rejectHaptic, successHaptic } from '../lib/haptics';
import { useTheme, withAlpha } from '../theme';
import type { GiftProblem } from '../data/social/postman';
import { PillButton } from './Buttons';
import { usePeople } from '../hooks/useSharing';
import { portraitFor } from '../lib/portrait';
import { FilmPortrait } from './scrapbook/FilmPortrait';
import { Texture } from './scrapbook/Texture';

/**
 * A page crossing from one phone to the other, the way AirDrop and Blip show it: the other person's seal at the top
 * with radar rings pulsing out while their phone is found, a ring around it filling as the page goes, and the page
 * itself rising out of your hand and flying into them (or, receiving, flying out of them and landing in yours, where
 * it's stamped "kept"). Buttons stay at the foot of the screen, under the thumb.
 */

export type FlightState = 'waiting' | 'connecting' | 'moving' | 'done' | 'failed' | 'declined';

const SEAL = 112;
/** Their portrait's height inside the rings (its corners just clear the progress ring). */
const PORTRAIT_H = 100;
const RING_R = SEAL / 2 + 10;
const RING_SIZE = RING_R * 2 + 8;
const RIPPLES = 3;
const RIPPLE_MS = 2100;
const CARD_W = 210;
const CARD_H = 150;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function Ripple({ index, on, color }: { index: number; on: boolean; color: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (!on) {
      cancelAnimation(t);
      t.set(withTiming(0, { duration: 300 }));
      return;
    }
    t.set(0);
    t.set(withDelay((RIPPLE_MS / RIPPLES) * index, withRepeat(withTiming(1, { duration: RIPPLE_MS, easing: Easing.out(Easing.quad) }), -1, false)));
  }, [on, index, t]);
  const style = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - t.get()) * (t.get() > 0 ? 1 : 0), transform: [{ scale: 1 + t.get() * 2.1 }] }));
  return <Animated.View pointerEvents="none" style={[styles.ripple, { width: SEAL, height: SEAL, borderRadius: SEAL / 2, borderColor: color }, style]} />;
}

/** The progress ring around the seal. */
function ProgressRing({ progress, color, track }: { progress: SharedValue<number>; color: string; track: string }) {
  const c = 2 * Math.PI * RING_R;
  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - progress.get()) }));
  return (
    <Svg width={RING_SIZE} height={RING_SIZE} style={StyleSheet.absoluteFill}>
      <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R} stroke={track} strokeWidth={4} fill="none" />
      <AnimatedCircle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_R}
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${c} ${c}`}
        animatedProps={props}
        transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
      />
    </Svg>
  );
}

export function GiftFlight({
  visible,
  direction,
  personId,
  name,
  title,
  line,
  state,
  progress,
  problem,
  onClose,
  onOpen,
}: {
  visible: boolean;
  /** 'out': you're giving it; 'in': it's coming to you. */
  direction: 'out' | 'in';
  /** The other person (their portrait is looked up by their id). */
  personId?: string;
  name: string;
  /** The page's date, as it's written on the card. */
  title: string;
  /** A line of it (giving), or who it's from (receiving). */
  line: string;
  state: FlightState;
  progress: number;
  /** Why it's stuck, if it is: said plainly instead of the usual words. */
  problem?: GiftProblem | null;
  onClose: () => void;
  /** Receiving, once kept: open it. */
  onOpen?: () => void;
}) {
  const theme = useTheme();
  const person = usePeople().find((p) => p.id === personId);
  const { colors, typography, spacing } = theme;
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  // Where the card travels between: your hand (low on the screen) and their seal (high).
  const sealY = insets.top + height * 0.16;
  const handY = height * 0.56;
  const travel = handY - sealY - SEAL / 2;

  const p = useSharedValue(0); // how far the page has gone, 0–1
  const ring = useSharedValue(0);
  const landed = useSharedValue(0); // the finish: into their seal (out) or stamped in your hand (in)
  const shake = useSharedValue(0);
  const sealPop = useSharedValue(0);
  const enter = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      p.set(0);
      ring.set(0);
      landed.set(0);
      enter.set(0);
      return;
    }
    enter.set(reduceMotion ? 1 : withSpring(1, { damping: 16, stiffness: 140 }));
  }, [visible, p, ring, landed, enter, reduceMotion]);

  useEffect(() => {
    if (!visible) return;
    const target = state === 'done' ? 1 : state === 'moving' ? Math.max(0.08, progress) : state === 'connecting' ? 0.04 : 0;
    ring.set(withTiming(target, { duration: 420, easing: Easing.out(Easing.cubic) }));
    // The page leaves your hand as the bytes go (receiving: it comes down as they arrive).
    p.set(withTiming(state === 'done' ? 1 : target * 0.75, { duration: state === 'done' ? 520 : 420, easing: Easing.inOut(Easing.cubic) }));
    if (state === 'done') {
      landed.set(withDelay(380, withTiming(1, { duration: 360, easing: Easing.out(Easing.back(1.6)) })));
      sealPop.set(withDelay(direction === 'out' ? 420 : 0, withSequence(withTiming(1, { duration: 140 }), withSpring(0, { damping: 9 }))));
      const t = setTimeout(direction === 'out' ? successHaptic : arriveHaptic, 420);
      return () => clearTimeout(t);
    }
    if (state === 'failed' || state === 'declined') {
      rejectHaptic();
      p.set(withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }));
      shake.set(withSequence(withTiming(1, { duration: 60 }), withTiming(-1, { duration: 80 }), withTiming(1, { duration: 80 }), withTiming(0, { duration: 60 })));
    }
  }, [visible, state, progress, direction, p, ring, landed, shake, sealPop]);

  const live = state === 'waiting' || state === 'connecting' || state === 'moving';

  const sealStyle = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(enter.get(), [0, 1], [0.6, 1]) + sealPop.get() * 0.12 }], opacity: enter.get() }));
  const cardStyle = useAnimatedStyle(() => {
    const k = p.get();
    // Giving: from your hand up into their seal. Receiving: from their seal down into your hand.
    const along = direction === 'out' ? k : 1 - k;
    const y = -travel * along;
    const scale = direction === 'out' ? interpolate(k, [0, 0.75, 1], [1, 0.62, 0.08]) : interpolate(k, [0, 1], [0.12, 1]);
    const lift = Math.sin(Math.PI * k) * 38; // a gentle arc
    const tilt = (direction === 'out' ? -1 : 1) * interpolate(k, [0, 0.5, 1], [-3, 7, 0]);
    const fade = direction === 'out' ? 1 - landed.get() : interpolate(k, [0, 0.1], [0, 1], 'clamp');
    return {
      opacity: fade * enter.get(),
      transform: [{ translateX: lift + shake.get() * 10 }, { translateY: y }, { rotate: `${tilt}deg` }, { scale }],
    };
  });
  const stampStyle = useAnimatedStyle(() => ({ opacity: direction === 'in' ? landed.get() : 0, transform: [{ scale: interpolate(landed.get(), [0, 1], [2.2, 1]) }, { rotate: '-12deg' }] }));
  const tickStyle = useAnimatedStyle(() => ({ opacity: direction === 'out' ? landed.get() : 0, transform: [{ scale: landed.get() }] }));

  const stuck = problem && (state === 'failed' || state === 'waiting') ? problem : null;
  const problemWords = stuck
    ? {
        gone: { line: `${name}'s account is gone`, sub: 'They deleted their sharing account, so they have a new one now. Add them again (their code, or beside you), then give it to them.' },
        offline: { line: `You're offline`, sub: "It'll go by itself as soon as you're back on Wi-Fi or mobile data." },
        unreachable: { line: `Couldn't reach ${name}'s phone`, sub: 'Some mobile networks block phone-to-phone connections. Trying again… On the same Wi-Fi it always goes.' },
        changed:
          direction === 'out'
            ? { line: `${name}'s phone has changed`, sub: 'To be sure it\'s really them, scan their code again, then give it again.' }
            : { line: `This isn't the phone you know as ${name}`, sub: 'To be sure it\'s really them, scan their code again.' },
      }[stuck]
    : null;
  const words =
    problemWords?.line ??
    (direction === 'out'
      ? {
          waiting: `Waiting for ${name} to accept…`,
          connecting: `${name} accepted · finding their phone…`,
          moving: `Passing it to ${name}… ${Math.round(progress * 100)}%`,
          done: `${name} has it now`,
          failed: `The connection dropped. It'll go when you're both online.`,
          declined: `${name} said not now`,
        }[state]
      : {
          waiting: `Finding ${name}'s phone…`,
          connecting: `Connecting to ${name}'s phone…`,
          moving: `Coming across from ${name}… ${Math.round(progress * 100)}%`,
          done: `It's yours now`,
          failed: `It didn't come through. Ask ${name} to give it again.`,
          declined: `Not now`,
        }[state]);
  const sub = problemWords
    ? problemWords.sub
    : state === 'done'
      ? direction === 'out'
        ? 'Straight from your phone to theirs. Nothing was kept anywhere in between.'
        : 'Kept on this phone only.'
      : live
        ? 'Phone to phone, encrypted. Never online.'
        : '';

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(theme.paper.darkDeep, 0.96) }]}>
        {/* Their seal, with the radar rings and the progress ring. */}
        <Animated.View style={[styles.sealWrap, { top: sealY - RING_SIZE / 2, height: RING_SIZE }, sealStyle]}>
          <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' }}>
            {Array.from({ length: RIPPLES }, (_, i) => (
              <Ripple key={i} index={i} on={live && !reduceMotion} color={colors.gilt} />
            ))}
            <ProgressRing progress={ring} color={colors.gilt} track={withAlpha(colors.paperWhite, 0.15)} />
            <View style={{ alignItems: 'center', justifyContent: 'center', boxShadow: theme.shadow(undefined, 1.4) }}>
              <FilmPortrait portrait={portraitFor(person?.portrait, name)} size={PORTRAIT_H} hole={theme.paper.darkDeep} />
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(colors.green, 0.92) }, tickStyle]}>
                <Ionicons name="checkmark" size={58} color={colors.paperWhite} />
              </Animated.View>
            </View>
          </View>
        </Animated.View>
        <Text style={[typography.heading, styles.center, { color: colors.paperWhite, top: sealY + RING_SIZE / 2 + spacing.sm }]}>
          {direction === 'out' ? `to ${name}` : `from ${name}`}
        </Text>

        {/* The page. */}
        <Animated.View style={[styles.card, { top: handY - CARD_H / 2, left: '50%', marginLeft: -CARD_W / 2, width: CARD_W, height: CARD_H, backgroundColor: colors.panel, padding: spacing.md, boxShadow: theme.shadow(undefined, 2) }, cardStyle]}>
          <Texture kind="paper" opacity={0.55} />
          <View style={{ position: 'absolute', left: 12, top: 0, bottom: 0, width: 1, backgroundColor: colors.marginLine }} />
          <Text numberOfLines={1} style={[typography.caption, { color: colors.sepia, fontSize: 13, lineHeight: 17, paddingLeft: spacing.sm }]}>
            {title}
          </Text>
          <Text numberOfLines={3} style={[typography.hand, { color: colors.inkBlue, fontSize: 19, lineHeight: 23, paddingLeft: spacing.sm, marginTop: spacing.xs }]}>
            {line}
          </Text>
          <Animated.View pointerEvents="none" style={[styles.stamp, { borderColor: colors.sepia }, stampStyle]}>
            <Text style={[typography.small, { color: colors.sepia, fontWeight: '700', letterSpacing: 2, fontSize: 15, lineHeight: 19, paddingRight: 0 }]}>KEPT</Text>
          </Animated.View>
        </Animated.View>

        {/* What's happening, and the buttons, low under the thumb. */}
        <View style={[styles.foot, { paddingBottom: insets.bottom + spacing.lg, paddingHorizontal: spacing.gutter, gap: spacing.sm }]}>
          <Text style={[typography.heading, { color: colors.paperWhite, textAlign: 'center', alignSelf: 'stretch' }]}>{words}</Text>
          {sub ? <Text style={[typography.caption, { color: withAlpha(colors.paperWhite, 0.75), textAlign: 'center', alignSelf: 'stretch' }]}>{sub}</Text> : null}
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
            {direction === 'in' && state === 'done' ? (
              <>
                <PillButton label="Later" grow onPress={onClose} />
                <PillButton label="Open it" icon="mail-open-outline" tone="dark" grow onPress={onOpen ?? onClose} />
              </>
            ) : (
              <PillButton label={live ? 'Hide' : 'Done'} icon={live ? 'chevron-down' : 'checkmark'} tone={live ? 'paper' : 'dark'} grow onPress={onClose} />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sealWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  ripple: { position: 'absolute', borderWidth: 2 },
  center: { position: 'absolute', left: 0, right: 0, textAlign: 'center' },
  card: { position: 'absolute', borderTopLeftRadius: 2, borderBottomLeftRadius: 2, borderTopRightRadius: 6, borderBottomRightRadius: 6, overflow: 'hidden' },
  stamp: { position: 'absolute', right: 14, bottom: 12, borderWidth: 2.5, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  foot: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
});
