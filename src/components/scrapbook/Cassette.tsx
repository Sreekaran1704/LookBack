import { memo, useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useTheme, type CassetteStyle } from '../../theme';

interface Props {
  width: number;
  /** Written on the label in the person's hand. */
  title: string;
  /** Printed small on the label, like a tape's length ("0:42"). */
  detail?: string;
  /** How much tape has wound onto the right reel (0–1). */
  played?: number;
  /** The reels turn. */
  spinning?: boolean;
  /** Draw this style instead of the one the person picked (the style picker's previews). */
  style?: CassetteStyle;
}

/** A compact cassette is 100 × 63 (its real proportions); everything below is in those units. */
const RATIO = 0.63;
const HUB = '#F2F2F0';
const HUB_EDGE = '#9C968A';
const HUB_HOLE = '#141414';
const SCREW = '#8C8C90';
const STICKER_SHADE = 'rgba(0,0,0,0.18)';
const SPIN_MS = 1700;
/** The hubs: 42 apart, as on a real cassette. */
const HUB_X = [29, 71];
const HUB_Y = 31.5;
const HUB_R = 6.3;
const PACK_MIN = 9;
const PACK_MAX = 17;

/** A white take-up hub: six teeth round the spindle hole, turning with the tape. */
function Hub({ cx, cy, u, spinStyle }: { cx: number; cy: number; u: number; spinStyle: object }) {
  const r = HUB_R * u;
  return (
    <Animated.View style={[{ position: 'absolute', left: cx - r, top: cy - r, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: HUB, alignItems: 'center', justifyContent: 'center', borderWidth: Math.max(0.5, 0.25 * u), borderColor: HUB_EDGE, backgroundImage: `radial-gradient(circle at 35% 35%, #FFFFFF 0%, ${HUB} 50%, #C9C5BA 100%)` }, spinStyle]}>
      <View style={{ width: 7 * u, height: 7 * u, borderRadius: 4 * u, backgroundColor: HUB_HOLE }} />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <View key={a} style={{ position: 'absolute', width: 1.1 * u, height: 7.2 * u, transform: [{ rotate: `${a}deg` }] }}>
          <View style={{ width: 1.1 * u, height: 1.5 * u, backgroundColor: HUB }} />
        </View>
      ))}
    </Animated.View>
  );
}

/** A tape pack: wound tape in fine rings round a hub. */
function Pack({ cx, cy, r, u, tape }: { cx: number; cy: number; r: number; u: number; tape: string }) {
  return (
    <View style={{ position: 'absolute', left: cx - r * u, top: cy - r * u, width: r * 2 * u, height: r * 2 * u, borderRadius: r * u, backgroundColor: tape, borderWidth: Math.max(0.5, 0.3 * u), borderColor: 'rgba(0,0,0,0.45)', backgroundImage: 'radial-gradient(circle at 40% 35%, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.04) 55%, rgba(0,0,0,0.35) 100%)' }} />
  );
}

/**
 * A realistic compact cassette in the style the person picked (src/theme/cassettes.ts, the same one as the app icon),
 * drawn from plain views so it scales and can sit inside a texture. Solid shells: moulded plastic with a paper label
 * (the "A" box, the title in pen, printed stripes) and a stadium window round the two hubs onto the tape. Clear shells:
 * the tape packs, hubs and corner rollers seen through the plastic, under a paper sticker. Tape moves from the left pack
 * to the right one as it plays; the hubs turn while `spinning`.
 */
export const Cassette = memo(function Cassette({ width, title, detail, played = 0.15, spinning = false, style }: Props) {
  const theme = useTheme();
  const { typography } = theme;
  const look = style ?? theme.cassette;
  const reduceMotion = useReducedMotion();
  const u = width / 100;
  const h = width * RATIO;
  const spin = useSharedValue(0);

  useEffect(() => {
    if (!spinning || reduceMotion) {
      cancelAnimation(spin);
      return;
    }
    spin.set(withRepeat(withTiming(spin.get() + 360, { duration: SPIN_MS, easing: Easing.linear }), -1, false));
  }, [spinning, reduceMotion, spin]);
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-spin.get()}deg` }] }));

  const packs = [PACK_MIN + (PACK_MAX - PACK_MIN) * (1 - played), PACK_MIN + (PACK_MAX - PACK_MIN) * played];
  const [lit, body, shade] = look.shell;

  const screw = (l: number, t: number) => (
    <View key={`${l}-${t}`} style={{ position: 'absolute', left: (l - 1.6) * u, top: (t - 1.6) * u, width: 3.2 * u, height: 3.2 * u, borderRadius: 2 * u, backgroundColor: SCREW, backgroundImage: 'radial-gradient(circle at 35% 35%, #F4F4F4 0%, #A6A6A6 55%, #555555 100%)', alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: 2 * u, height: 0.3 * u, backgroundColor: '#2A2A2A' }} />
      <View style={{ position: 'absolute', width: 0.3 * u, height: 2 * u, backgroundColor: '#2A2A2A' }} />
    </View>
  );

  /** The writing on the label or sticker: the "A" box, the title in pen on its line, the length printed small. */
  const writing = (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 2 * u, paddingHorizontal: 2.5 * u, paddingBottom: 1.2 * u }}>
      <View style={{ width: 5.5 * u, height: 5.5 * u, marginBottom: 1.4 * u, backgroundColor: look.side, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: look.label, fontSize: 4.2 * u, lineHeight: 5 * u, fontWeight: '700' }}>A</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[typography.hand, { color: look.ink, fontSize: 8 * u, lineHeight: 9.5 * u, paddingRight: 0 }]}>
          {title}
        </Text>
        <View style={{ height: Math.max(0.5, 0.25 * u), backgroundColor: look.ink, opacity: 0.35 }} />
      </View>
      {detail ? <Text style={[typography.stamp, { position: 'absolute', right: 2.5 * u, top: 1 * u, color: look.ink, opacity: 0.6, fontSize: 3.6 * u, lineHeight: 4.4 * u, paddingRight: 0 }]}>{detail}</Text> : null}
    </View>
  );

  const foot = (
    <View style={{ position: 'absolute', left: 19 * u, right: 19 * u, bottom: 0, height: 11 * u, borderTopLeftRadius: 1.5 * u, borderTopRightRadius: 1.5 * u, backgroundColor: look.clear ? 'rgba(255,255,255,0.08)' : look.foot, borderWidth: Math.max(0.5, 0.3 * u), borderBottomWidth: 0, borderColor: look.clear ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', paddingTop: 2 * u }}>
      {[3.2, 3.4, 5, 3.4, 3.2].map((s, i) => (
        <View key={i} style={{ width: s * u, height: (i === 2 ? 3.2 : s) * u, borderRadius: i === 1 || i === 3 ? 2 * u : 0.5 * u, backgroundColor: 'rgba(5,5,5,0.85)' }} />
      ))}
    </View>
  );

  if (look.clear) {
    return (
      <View style={{ width, height: h, borderRadius: 3.5 * u, overflow: 'hidden', backgroundColor: body, backgroundImage: `linear-gradient(135deg, ${lit} 0%, ${body} 60%, ${shade} 100%)`, borderWidth: Math.max(1, 0.7 * u), borderColor: look.edge, boxShadow: `0px ${2 * u}px ${4 * u}px rgba(0,0,0,0.4)` }}>
        {/* Through the clear shell: the tape packs, the tape round the corner rollers, the hubs. */}
        {HUB_X.map((x, i) => <Pack key={x} cx={x * u} cy={HUB_Y * u} r={packs[i] ?? PACK_MIN} u={u} tape={look.tape} />)}
        <View style={{ position: 'absolute', left: 12 * u, right: 12 * u, top: 58 * u, height: Math.max(1, 0.8 * u), backgroundColor: '#1A120C' }} />
        {[10.5, 89.5].map((x) => (
          <View key={x} style={{ position: 'absolute', left: (x - 2.5) * u, top: 53.5 * u, width: 5 * u, height: 5 * u, borderRadius: 3 * u, backgroundColor: look.accent, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 1.6 * u, height: 1.6 * u, borderRadius: 1 * u, backgroundColor: '#F2F2F2' }} />
          </View>
        ))}
        {HUB_X.map((x) => <Hub key={x} cx={x * u} cy={HUB_Y * u} u={u} spinStyle={spinStyle} />)}
        {/* The frosted plastic over it (clearer in the window), its moulded window frame and a broad reflection. */}
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundImage: 'linear-gradient(150deg, rgba(255,255,255,0) 18%, rgba(255,255,255,0.16) 32%, rgba(255,255,255,0) 46%, rgba(255,255,255,0.06) 70%, rgba(255,255,255,0) 80%)' }} />
        <View pointerEvents="none" style={{ position: 'absolute', left: 23 * u, top: 23.5 * u, width: 54 * u, height: 15.5 * u, borderRadius: 2 * u, borderWidth: Math.max(0.5, 0.3 * u), borderColor: 'rgba(255,255,255,0.45)' }} />
        {foot}
        {/* The paper sticker across the top. */}
        <View style={{ position: 'absolute', left: 7.5 * u, right: 7.5 * u, top: 4 * u, height: 11.5 * u, borderRadius: 0.6 * u, backgroundColor: look.label, boxShadow: `0px ${0.3 * u}px ${0.5 * u}px ${STICKER_SHADE}` }}>{writing}</View>
        {[screw(4, 4), screw(96, 4), screw(4, 59), screw(96, 59), screw(50, 49.3)]}
      </View>
    );
  }

  return (
    <View style={{ width, height: h, borderRadius: 4 * u, overflow: 'hidden', backgroundColor: body, backgroundImage: `linear-gradient(180deg, ${lit} 0%, ${body} 45%, ${shade} 100%)`, borderWidth: Math.max(1, 0.5 * u), borderColor: look.edge, boxShadow: `0px ${2 * u}px ${4 * u}px rgba(0,0,0,0.35)` }}>
      {/* The paper label: the writing strip on top, printed stripes behind the window. */}
      <View style={{ position: 'absolute', left: 7 * u, right: 7 * u, top: 4.5 * u, height: 41.5 * u, borderRadius: 1.6 * u, overflow: 'hidden', backgroundColor: look.label, boxShadow: `0px ${0.3 * u}px ${0.5 * u}px ${STICKER_SHADE}` }}>
        <View style={{ height: 13 * u }}>{writing}</View>
        {look.stripes.length > 1 ? (
          <View style={{ position: 'absolute', left: 0, right: 0, top: 17 * u, height: 18.8 * u }}>
            {look.stripes.map((s) => <View key={s} style={{ flex: 1, backgroundColor: s }} />)}
          </View>
        ) : look.stripes[0] ? (
          <>
            <View style={{ position: 'absolute', left: 0, right: 0, top: 13.9 * u, height: 2 * u, backgroundColor: look.stripes[0] }} />
            <View style={{ position: 'absolute', left: 0, right: 0, top: 37 * u, height: 1.1 * u, backgroundColor: look.stripes[0], opacity: 0.8 }} />
          </>
        ) : null}
      </View>
      {/* The window: a stadium round the two hubs, smoky plastic onto the tape. */}
      <View style={{ position: 'absolute', left: 19.5 * u, top: 23.5 * u, width: 61 * u, height: 16 * u, borderRadius: 8 * u, overflow: 'hidden', backgroundColor: look.window, borderWidth: Math.max(0.5, 0.6 * u), borderColor: '#0E0B09' }}>
        {HUB_X.map((x, i) => <Pack key={x} cx={(x - 19.5) * u} cy={(HUB_Y - 23.5) * u} r={packs[i] ?? PACK_MIN} u={u} tape={look.tape} />)}
        {HUB_X.map((x) => <Hub key={x} cx={(x - 19.5) * u} cy={(HUB_Y - 23.5) * u} u={u} spinStyle={spinStyle} />)}
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundImage: 'linear-gradient(160deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.03) 40%, rgba(0,0,0,0.2) 100%)' }} />
      </View>
      {foot}
      {[screw(4, 4), screw(96, 4), screw(4, 59), screw(96, 59), screw(50, 48.8)]}
    </View>
  );
});
