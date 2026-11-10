import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { mulberry32 } from '../../lib/seeded';
import { useTheme } from '../../theme';

interface Piece {
  vx: number;
  vy: number;
  spin: number;
  color: string;
  round: boolean;
}

const GRAVITY = 900;
const SPEED = 520;

/** A one-shot confetti burst in the given colors. Fires each time `burstKey` changes. */
export const Confetti = memo(function Confetti({ colors, burstKey }: { colors: string[]; burstKey: number }) {
  const { sizes, motion } = useTheme();
  const t = useSharedValue(0);
  const pieces = useMemo<Piece[]>(() => {
    const rnd = mulberry32(burstKey + 1);
    return Array.from({ length: sizes.confettiCount }, (_, i) => {
      const angle = -Math.PI / 2 + (rnd() - 0.5) * Math.PI * 1.1;
      const speed = SPEED * (0.5 + rnd() * 0.6);
      return {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        spin: (rnd() - 0.5) * 900,
        color: colors[i % colors.length] ?? '#FFFFFF',
        round: rnd() > 0.6,
      };
    });
  }, [burstKey, colors, sizes.confettiCount]);

  useEffect(() => {
    if (burstKey === 0) return;
    t.set(0);
    t.set(withTiming(1, { duration: motion.confettiMs, easing: Easing.linear }));
  }, [burstKey, motion.confettiMs, t]);

  if (burstKey === 0) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
      {pieces.map((p, i) => (
        <ConfettiPiece key={`${burstKey}-${i}`} piece={p} t={t} duration={motion.confettiMs / 1000} size={sizes.confettiPiece} />
      ))}
    </View>
  );
});

function ConfettiPiece({ piece, t, duration, size }: { piece: Piece; t: SharedValue<number>; duration: number; size: number }) {
  const style = useAnimatedStyle(() => {
    const s = t.get() * duration;
    return {
      opacity: t.get() < 0.8 ? 1 : (1 - t.get()) * 5,
      transform: [
        { translateX: piece.vx * s },
        { translateY: piece.vy * s + 0.5 * GRAVITY * s * s },
        { rotate: `${piece.spin * s}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: piece.round ? size : size * 0.45,
          borderRadius: piece.round ? size / 2 : 1,
          backgroundColor: piece.color,
        },
        style,
      ]}
    />
  );
}
