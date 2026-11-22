import { memo, useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../theme';

interface Props {
  width: number;
  /** A black shell with a paper label (TDK-style), or a clear see-through shell showing the tape inside. */
  shell?: 'black' | 'clear';
  /** Written on the label in the person's hand. */
  title: string;
  /** Under the window, like a length printed on the band ("0:42"). */
  detail?: string;
  /** How much tape has wound onto the right reel (0–1). */
  played?: number;
  /** The reels turn. */
  spinning?: boolean;
}

/** A compact cassette is 100 × 63 (its real proportions); everything below is in those units. */
const RATIO = 0.63;
const SHELL_BLACK = '#1C1C1E';
const SHELL_BLACK_EDGE = '#3A3A3D';
const SHELL_CLEAR = 'rgba(215, 218, 224, 0.42)';
const SHELL_CLEAR_EDGE = 'rgba(255, 255, 255, 0.55)';
const LABEL = '#F4F1EA';
const BAND = '#E9DFC4';
const BAND_STRIPE = '#C8372B';
const TAPE = '#4A2E1F';
const TAPE_EDGE = '#2E1C12';
const HUB = '#F2F2F0';
const HUB_TOOTH = '#BDBDBB';
const LEADER = '#D9372B';
const SCREW = '#8C8C90';
const INK = '#23304A';
const SPIN_MS = 1700;
/** The black shell's window (in the 100 × 63 units). */
const WIN_L = 14;
const WIN_R = 86;
const WIN_T = 21.5;
const WIN_B = 41;
const WINDOW = '#2A211C';
const WINDOW_EDGE = '#55555A';

/** A white take-up hub with six teeth round a dark centre, turning with the tape. */
function Hub({ left, top, r, u, clear = false, spinStyle }: { left: number; top: number; r: number; u: number; clear?: boolean; spinStyle: object }) {
  return (
    <Animated.View style={[{ position: 'absolute', left, top, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: HUB, alignItems: 'center', justifyContent: 'center', boxShadow: `inset 0px 0px 0px ${0.6 * u}px ${HUB_TOOTH}` }, spinStyle]}>
      <View style={{ width: r * 0.95, height: r * 0.95, borderRadius: r, backgroundColor: clear ? '#3A3A3A' : '#1A1A1A' }} />
      {[0, 60, 120].map((a) => (
        <View key={a} style={{ position: 'absolute', width: 1.3 * u, height: r * 1.3, backgroundColor: HUB, transform: [{ rotate: `${a}deg` }] }} />
      ))}
    </Animated.View>
  );
}

/**
 * A realistic 90s compact cassette, drawn from plain views (so it scales and can sit inside a texture): the shell with
 * its corner screws, a paper label with an "A" box and the title in handwriting, the window with two hubs and the
 * brown tape wound on them (moving from left to right as it plays), the printed band, and the trapezoid at the foot
 * with its holes. `clear` is the see-through shell: the tape packs and a red leader show through.
 */
export const Cassette = memo(function Cassette({ width, shell = 'black', title, detail, played = 0.15, spinning = false }: Props) {
  const theme = useTheme();
  const { typography } = theme;
  const reduceMotion = useReducedMotion();
  const u = width / 100;
  const h = width * RATIO;
  const clear = shell === 'clear';
  const spin = useSharedValue(0);

  useEffect(() => {
    if (!spinning || reduceMotion) {
      cancelAnimation(spin);
      return;
    }
    spin.set(withRepeat(withTiming(spin.get() + 360, { duration: SPIN_MS, easing: Easing.linear }), -1, false));
  }, [spinning, reduceMotion, spin]);
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-spin.get()}deg` }] }));

  const hubR = 7.5 * u;
  const hubY = 31 * u;
  const hubs = [29 * u, 71 * u];
  const packMin = 9 * u;
  const packMax = 17 * u;
  const packs = [packMin + (packMax - packMin) * (1 - played), packMin + (packMax - packMin) * played];

  const screw = (left: number, top: number) => (
    <View key={`${left}-${top}`} style={{ position: 'absolute', left, top, width: 3.6 * u, height: 3.6 * u, borderRadius: 2 * u, backgroundColor: SCREW, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 2.4 * u, height: 0.5 * u, backgroundColor: '#555', transform: [{ rotate: '45deg' }] }} />
    </View>
  );

  return (
    <View
      style={{
        width,
        height: h,
        borderRadius: 3 * u,
        backgroundColor: clear ? SHELL_CLEAR : SHELL_BLACK,
        borderWidth: Math.max(1, 0.6 * u),
        borderColor: clear ? SHELL_CLEAR_EDGE : SHELL_BLACK_EDGE,
        overflow: 'hidden',
        backgroundImage: clear
          ? 'linear-gradient(135deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.05) 40%, rgba(255,255,255,0.25) 100%)'
          : 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 30%, rgba(0,0,0,0.25) 100%)',
        boxShadow: `0px ${2 * u}px ${4 * u}px rgba(0,0,0,0.35)`,
      }}
    >
      {clear ? (
        <>
          {/* Through a clear shell: the tape packs, the red leader and the turning hubs, all on show. */}
          {hubs.map((x, i) => (
            <View key={`pack-${i}`} style={{ position: 'absolute', left: x - (packs[i] ?? packMin), top: hubY - (packs[i] ?? packMin), width: (packs[i] ?? packMin) * 2, height: (packs[i] ?? packMin) * 2, borderRadius: 40 * u, backgroundColor: TAPE, borderWidth: 0.6 * u, borderColor: TAPE_EDGE, opacity: 0.9 }} />
          ))}
          <View style={{ position: 'absolute', left: 44 * u, top: 27 * u, width: 12 * u, height: 7 * u, backgroundColor: LEADER, opacity: 0.85 }} />
          {hubs.map((x, i) => (
            <Hub key={`hub-${i}`} left={x - hubR} top={hubY - hubR} r={hubR} u={u} clear spinStyle={spinStyle} />
          ))}
        </>
      ) : (
        <>
          {/* A black shell's face: the long smoked window across its middle, the tape packs and white hubs seen through
              it, a bevel round its edge and a glint across the plastic. */}
          <View style={{ position: 'absolute', left: WIN_L * u, top: WIN_T * u, width: (WIN_R - WIN_L) * u, height: (WIN_B - WIN_T) * u, borderRadius: 2.2 * u, overflow: 'hidden', backgroundColor: WINDOW, borderWidth: 0.6 * u, borderColor: WINDOW_EDGE }}>
            {hubs.map((x, i) => (
              <View key={`pack-${i}`} style={{ position: 'absolute', left: x - WIN_L * u - (packs[i] ?? packMin), top: hubY - WIN_T * u - (packs[i] ?? packMin), width: (packs[i] ?? packMin) * 2, height: (packs[i] ?? packMin) * 2, borderRadius: 40 * u, backgroundColor: TAPE, borderWidth: 0.5 * u, borderColor: TAPE_EDGE, backgroundImage: `radial-gradient(circle, ${TAPE} 40%, ${TAPE_EDGE} 100%)` }} />
            ))}
            {/* The tape running across the bottom of the window between the packs. */}
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 1.5 * u, height: 0.9 * u, backgroundColor: TAPE }} />
            {hubs.map((x, i) => (
              <Hub key={`hub-${i}`} left={x - WIN_L * u - hubR} top={hubY - WIN_T * u - hubR} r={hubR} u={u} spinStyle={spinStyle} />
            ))}
            {/* The smoked plastic over it all, and its glint. */}
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundImage: 'linear-gradient(160deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.04) 35%, rgba(0,0,0,0.25) 100%)' }} />
          </View>
        </>
      )}

      {/* The paper label across the top: the "A" box and the title in handwriting on its line, a red printed stripe under it. */}
      <View style={{ position: 'absolute', left: 6 * u, right: 6 * u, top: 17.6 * u, height: 1.6 * u, backgroundColor: BAND_STRIPE, opacity: clear ? 0.8 : 1 }} />
      <View style={{ position: 'absolute', left: 6 * u, right: 6 * u, top: 4 * u, height: 13.6 * u, borderRadius: 1.2 * u, backgroundColor: LABEL, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 * u, gap: 2 * u, opacity: clear ? 0.92 : 1 }}>
        <View style={{ width: 7 * u, height: 7 * u, backgroundColor: '#4A2A3A', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: LABEL, fontSize: 5 * u, lineHeight: 6 * u, fontWeight: '700' }}>A</Text>
        </View>
        <View style={{ flex: 1, height: 10 * u, justifyContent: 'flex-end' }}>
          <Text numberOfLines={1} style={[typography.hand, { color: INK, fontSize: 8 * u, lineHeight: 9.5 * u, paddingRight: 0 }]}>
            {title}
          </Text>
          <View style={{ height: 0.4 * u, backgroundColor: '#9A9A9A' }} />
        </View>
      </View>

      {/* The printed band under the window. */}
      {!clear ? (
        <View style={{ position: 'absolute', left: 6 * u, right: 6 * u, top: 44 * u, height: 7 * u, borderRadius: 0.8 * u, backgroundColor: BAND, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 * u, justifyContent: 'space-between', overflow: 'hidden' }}>
          <Text style={[typography.stamp, { color: '#2A2118', fontSize: 4 * u, lineHeight: 5 * u, letterSpacing: 0.4 * u, paddingRight: 0 }]}>LOOKBACK</Text>
          <View style={{ position: 'absolute', left: 40 * u, top: 0, bottom: 0, width: 12 * u, backgroundColor: BAND_STRIPE, opacity: 0.85 }} />
          <Text style={[typography.stamp, { color: '#2A2118', fontSize: 4 * u, lineHeight: 5 * u, letterSpacing: 0.2 * u, paddingRight: 0 }]}>{detail ?? 'C·60'}</Text>
        </View>
      ) : null}

      {/* The trapezoid at the foot, with its holes. */}
      <View style={{ position: 'absolute', left: 20 * u, right: 20 * u, bottom: 0, height: 9 * u, borderTopLeftRadius: 2 * u, borderTopRightRadius: 2 * u, backgroundColor: clear ? 'rgba(200,200,206,0.4)' : '#141416', borderWidth: 0.4 * u, borderColor: clear ? SHELL_CLEAR_EDGE : SHELL_BLACK_EDGE, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ width: (i === 1 || i === 2 ? 2.5 : 3.5) * u, height: (i === 1 || i === 2 ? 2.5 : 3.5) * u, borderRadius: 2 * u, backgroundColor: clear ? 'rgba(40,40,44,0.5)' : '#050505' }} />
        ))}
      </View>

      {[screw(1.5 * u, 1.5 * u), screw(width - 5.5 * u, 1.5 * u), screw(1.5 * u, h - 5.5 * u), screw(width - 5.5 * u, h - 5.5 * u), screw(width / 2 - 1.8 * u, h - 13.5 * u)]}
    </View>
  );
});
