import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  measure,
  runOnJS,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { changedParts, reactionTo, type Portrait, type PortraitExpression } from '../lib/portrait';
import { useTheme } from '../theme';
import { PortraitSticker } from './scrapbook/FilmPortrait';
import { EASE_IN, EASE_OUT } from './transitions';

/** How long a passing face stays before the chosen one comes back. */
const FACE_MS = 1300;
/** What the little you says with each face. */
const SAYS: Record<PortraitExpression, string> = { wow: 'ooh!', wink: 'nice', joy: 'love it', blink: 'hm?' };
const STICKER = 84;

/**
 * The face the portrait pulls when something changes (lib/portrait.ts `reactionTo`), for a moment, then back to the
 * chosen one; `tick` counts the changes (each one is a little hop).
 */
export function usePortraitFace(portrait: Portrait | null): { face: PortraitExpression | null; word: string | null; tick: number } {
  const before = useRef(portrait);
  const [state, setState] = useState<{ face: PortraitExpression | null; tick: number }>({ face: null, tick: 0 });
  useEffect(() => {
    const was = before.current;
    before.current = portrait;
    // The first portrait to arrive (the saved one loading) isn't a change you made.
    // (A portrait rebuilt with the same choices is no change either.)
    if (!was || !portrait || changedParts(was, portrait).length === 0) return;
    const face = reactionTo(was, portrait);
    setState((s) => ({ face, tick: s.tick + 1 }));
    if (!face) return;
    const t = setTimeout(() => setState((s) => ({ ...s, face: null })), FACE_MS);
    return () => clearTimeout(t);
  }, [portrait]);
  return { face: state.face, word: state.face ? SAYS[state.face] : null, tick: state.tick };
}

/**
 * Watches the big film portrait while the choices scroll: once it has gone off the top, `out` turns to 1 and the
 * little you hops out beside the choices; scroll back up and it hops home. Put `filmRef` on the film's view and
 * `onScroll` on an Animated.ScrollView (scrollEventThrottle 16).
 */
export function usePortraitHop() {
  const insets = useSafeAreaInsets();
  const filmRef = useAnimatedRef<View>();
  const out = useSharedValue(0);
  const isOut = useSharedValue(false);
  const reduceMotion = useReducedMotion();
  const top = insets.top + 40;
  const onScroll = useAnimatedScrollHandler({
    onScroll: () => {
      const m = measure(filmRef);
      if (!m) return;
      // Out once most of the film (its face) has gone under the top of the page.
      const gone = m.pageY + m.height * 0.45 < top;
      if (gone === isOut.get()) return;
      isOut.set(gone);
      out.set(withTiming(gone ? 1 : 0, { duration: reduceMotion ? 160 : gone ? 520 : 320, easing: gone ? EASE_OUT : EASE_IN }));
    },
  });
  /** Back in the film (a new page with the film at the top). */
  const reset = () => {
    isOut.set(false);
    out.set(0);
  };
  return { filmRef, onScroll, out, reset };
}

/**
 * The little you: a round sticker of the portrait that hops out of the film (from up and to the left, in an arc) and
 * sits at the bottom right beside the choices, pulling a face and saying a word as you change things. Place it
 * absolutely (bottom right) over the scrolling choices. Tapping it is just for fun: it hops and blinks.
 */
export function PortraitBuddy({ portrait, out }: { portrait: Portrait; out: SharedValue<number> }) {
  const { colors, typography, spacing } = useTheme();
  const reduceMotion = useReducedMotion();
  const { face, word, tick } = usePortraitFace(portrait);
  const [poke, setPoke] = useState(0);
  const hop = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion || (tick === 0 && poke === 0)) return;
    hop.set(withSequence(withTiming(-16, { duration: 150, easing: EASE_OUT }), withTiming(0, { duration: 220, easing: EASE_IN })));
  }, [tick, poke, reduceMotion, hop]);
  const [blink, setBlink] = useState(false);
  // Only touchable while it's out (hidden, it would still catch taps meant for the choices).
  const [touchable, setTouchable] = useState(false);
  useAnimatedReaction(
    () => out.get() > 0.5,
    (now, before) => {
      if (now !== before) runOnJS(setTouchable)(now);
    },
  );

  const style = useAnimatedStyle(() => {
    const p = out.get();
    if (reduceMotion) return { opacity: p, transform: [] };
    // From where the film was (up and to the left), over a little arc, down to its place.
    return {
      opacity: Math.min(1, p * 3),
      transform: [
        { translateX: (1 - p) * -120 },
        { translateY: (1 - p) * -320 - Math.sin(p * Math.PI) * 70 + hop.get() },
        { scale: 0.55 + 0.45 * p },
        { rotate: `${(1 - p) * -25}deg` },
      ],
    };
  });
  const bubble = useAnimatedStyle(() => ({ opacity: out.get() > 0.95 ? 1 : 0 }));

  return (
    <Animated.View pointerEvents={touchable ? 'box-none' : 'none'} style={[{ position: 'absolute', right: spacing.gutter, bottom: spacing.md, alignItems: 'flex-end' }, style]}>
      {word ? (
        <Animated.View style={[{ backgroundColor: colors.panel, borderRadius: 10, paddingHorizontal: spacing.sm, paddingVertical: 2, marginBottom: 4, marginRight: 8, boxShadow: '0px 2px 6px rgba(0,0,0,0.18)' }, bubble]}>
          <Text style={[typography.handSmall, { color: colors.ink, textAlign: 'center', minWidth: 52 }]}>{word} </Text>
        </Animated.View>
      ) : null}
      <Pressable
        accessibilityLabel="Your portrait"
        onPress={() => {
          setPoke((n) => n + 1);
          setBlink(true);
          setTimeout(() => setBlink(false), 260);
        }}
        style={{ borderRadius: STICKER / 2, boxShadow: '0px 6px 14px rgba(0,0,0,0.28)' }}
      >
        <PortraitSticker portrait={portrait} size={STICKER} face={blink ? 'blink' : face} />
      </Pressable>
    </Animated.View>
  );
}
