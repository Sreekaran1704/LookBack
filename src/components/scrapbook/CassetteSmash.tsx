import { useState } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { thudHaptic } from '../../lib/haptics';
import { Cassette } from './Cassette';

/** Hits it takes to break, how long the pieces take to fall, and the pieces (a grid, each a little uneven). */
const HITS = 4;
const BURST_MS = 900;
const COLS = 3;
const ROWS = 2;
const CRACK = 'rgba(230, 230, 236, 0.85)';
const CRACK_SHADE = 'rgba(0, 0, 0, 0.55)';
/** Bits of tape that spill out when it bursts. */
const TAPE = '#4A2E1F';

/** A few jagged cracks running out from where it was hit. */
function cracksFrom(x: number, y: number, size: number, seed: number): string {
  let d = '';
  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const arms = 4 + Math.floor(rnd() * 3);
  for (let a = 0; a < arms; a++) {
    let angle = (a / arms) * Math.PI * 2 + rnd() * 0.8;
    let px = x;
    let py = y;
    d += `M ${px.toFixed(1)} ${py.toFixed(1)} `;
    const steps = 4 + Math.floor(rnd() * 3);
    for (let i = 0; i < steps; i++) {
      angle += (rnd() - 0.5) * 0.9;
      const len = size * (0.05 + rnd() * 0.07);
      px += Math.cos(angle) * len;
      py += Math.sin(angle) * len;
      d += `L ${px.toFixed(1)} ${py.toFixed(1)} `;
    }
  }
  return d;
}

interface Piece {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  spin: number;
}

/** One broken piece: its part of the cassette, flying out and falling as `burst` runs 0 → 1. */
function Shard({ piece, burst, cassW, cassH, children }: { piece: Piece; burst: SharedValue<number>; cassW: number; cassH: number; children: React.ReactNode }) {
  const style = useAnimatedStyle(() => {
    const t = burst.get();
    const gravity = 900;
    return {
      opacity: t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25,
      transform: [{ translateX: piece.vx * t }, { translateY: piece.vy * t + gravity * t * t }, { rotate: `${piece.spin * t}deg` }],
    };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: piece.x, top: piece.y, width: piece.w, height: piece.h, overflow: 'hidden' }, style]}>
      <View style={{ position: 'absolute', left: -piece.x, top: -piece.y, width: cassW, height: cassH }}>{children}</View>
    </Animated.View>
  );
}

/**
 * Before a voice memory's page can be torn out, its cassette is broken by hand. Strike it: each hit lands with a thud,
 * jolts it, and cracks run out across the plastic from where you hit. On the last hit it bursts: the pieces fly apart
 * and fall away, a few loops of tape spilling with them. Then the page.
 */
export function CassetteSmash({ width, title, detail, onBroken }: { width: number; title: string; detail?: string; onBroken: () => void }) {
  const cassW = width * 0.7;
  const cassH = cassW * 0.63;
  const [cracks, setCracks] = useState<string[]>([]);
  const [broken, setBroken] = useState(false);
  const shake = useSharedValue(0);
  const burst = useSharedValue(0);

  const pieces: Piece[] = Array.from({ length: COLS * ROWS }, (_, i) => {
    const c = i % COLS;
    const r = Math.floor(i / COLS);
    const w = cassW / COLS;
    const h = cassH / ROWS;
    const side = c - (COLS - 1) / 2;
    return { x: c * w, y: r * h, w, h, vx: side * cassW * 0.9 + (r ? 20 : -20), vy: r ? -120 : -320, spin: (side || 0.6) * (r ? 90 : -140) };
  });

  const hit = (e: GestureResponderEvent) => {
    if (broken) return;
    const { locationX, locationY } = e.nativeEvent;
    thudHaptic();
    const next = [...cracks, cracksFrom(locationX, locationY, cassW, cracks.length * 97 + 13)];
    setCracks(next);
    shake.set(withSequence(withTiming(1, { duration: 45 }), withTiming(-0.7, { duration: 60 }), withTiming(0.3, { duration: 50 }), withTiming(0, { duration: 70 })));
    if (next.length >= HITS) {
      setBroken(true);
      burst.set(withTiming(1, { duration: BURST_MS, easing: Easing.out(Easing.quad) }));
      setTimeout(onBroken, BURST_MS + 200);
    }
  };

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() * 7 }, { rotate: `${shake.get() * 2.5}deg` }] }));
  const crackLayer = (
    <Svg width={cassW} height={cassH} style={StyleSheet.absoluteFill} pointerEvents="none">
      {cracks.map((d, i) => (
        <Path key={`s${i}`} d={d} stroke={CRACK_SHADE} strokeWidth={2.2} fill="none" strokeLinejoin="round" transform="translate(0.8 1)" />
      ))}
      {cracks.map((d, i) => (
        <Path key={i} d={d} stroke={CRACK} strokeWidth={1.1} fill="none" strokeLinejoin="round" />
      ))}
    </Svg>
  );
  const face = (
    <>
      <Cassette width={cassW} title={title} detail={detail} played={0.4} />
      {crackLayer}
    </>
  );
  const spillStyle = useAnimatedStyle(() => ({ opacity: burst.get() > 0 ? 1 - burst.get() : 0, transform: [{ translateY: burst.get() * 160 }] }));

  return (
    <View style={{ width, alignItems: 'center' }}>
      <Pressable onPress={hit} disabled={broken} accessibilityRole="button" accessibilityLabel={`Break the cassette, ${HITS - cracks.length} hits left`}>
        <Animated.View style={[{ width: cassW, height: cassH }, shakeStyle]}>
          {broken ? (
            <>
              {/* Tape spilling out of the burst shell. */}
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, spillStyle]}>
                <Svg width={cassW} height={cassH * 2}>
                  <Path d={`M ${cassW * 0.3} ${cassH * 0.5} C ${cassW * 0.1} ${cassH * 1.1}, ${cassW * 0.6} ${cassH * 1.3}, ${cassW * 0.45} ${cassH * 0.7} S ${cassW * 0.8} ${cassH * 1.2}, ${cassW * 0.72} ${cassH * 0.55}`} stroke={TAPE} strokeWidth={5} fill="none" />
                </Svg>
              </Animated.View>
              {pieces.map((p, i) => (
                <Shard key={i} piece={p} burst={burst} cassW={cassW} cassH={cassH}>
                  {face}
                </Shard>
              ))}
            </>
          ) : (
            face
          )}
        </Animated.View>
      </Pressable>
    </View>
  );
}
