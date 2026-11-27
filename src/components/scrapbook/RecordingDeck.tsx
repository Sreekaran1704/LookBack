import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { formatVoiceMs, VOICE_MAX_MS } from '../../lib/voice';
import { useTheme } from '../../theme';
import { Cassette } from './Cassette';

interface Props {
  width: number;
  /** Milliseconds recorded so far. */
  elapsed: number;
}

/** The deck's face: dark metal, a red REC lamp, a tape counter. */
const DECK = '#1B1B1E';
const DECK_EDGE = '#3A3A3F';
const WELL = '#0D0D0F';
const LAMP_ON = '#FF3B2F';
const LAMP_OFF = '#5A1410';
const DIGITS = '#F2E8CF';
/** Where the tape starts on the right reel, so it is never quite empty. */
const PLAYED_START = 0.04;

/**
 * Recording, the way a cassette deck records: the cassette (the person's own style) sits in the deck's well with its
 * reels turning, tape winding from the full reel onto the empty one across the minute; the REC lamp blinks and the tape
 * counter ticks over. Shown just above the writing page's buttons while recording (the strip under it has the waveform).
 */
export function RecordingDeck({ width, elapsed }: Props) {
  const { typography, spacing } = useTheme();
  const reduceMotion = useReducedMotion();
  const lamp = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    lamp.set(withRepeat(withSequence(withTiming(1, { duration: 450 }), withTiming(0.25, { duration: 450 })), -1, false));
  }, [lamp, reduceMotion]);
  const lampStyle = useAnimatedStyle(() => ({ opacity: lamp.get() }));

  const pad = spacing.md;
  const cassW = Math.round(Math.min(width - pad * 2 - 8, 340));
  const played = Math.min(1, PLAYED_START + (elapsed / VOICE_MAX_MS) * (1 - PLAYED_START));
  const counter = String(Math.floor(elapsed / 1000)).padStart(3, '0');

  return (
    <View style={{ alignItems: 'center', gap: spacing.sm, padding: pad, borderRadius: 14, backgroundColor: DECK, borderWidth: 1, borderColor: DECK_EDGE, backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 40%, rgba(0,0,0,0.3) 100%)', boxShadow: '0px 6px 14px rgba(0,0,0,0.35)' }}>
      {/* The cassette in its well, reels turning. */}
      <View style={{ padding: 4, borderRadius: 8, backgroundColor: WELL, boxShadow: 'inset 0px 2px 6px rgba(0,0,0,0.8)' }}>
        <Cassette width={cassW} title="recording…" detail={formatVoiceMs(elapsed)} played={played} spinning />
      </View>
      {/* REC lamp and the tape counter. */}
      <View style={{ width: cassW, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: LAMP_OFF }}>
            <Animated.View style={[{ width: 12, height: 12, borderRadius: 6, backgroundColor: LAMP_ON, boxShadow: `0px 0px 8px ${LAMP_ON}` }, lampStyle]} />
          </View>
          <Text style={[typography.stamp, { color: DIGITS, fontSize: 12, lineHeight: 15, letterSpacing: 1.5, paddingRight: 0 }]}>REC</Text>
        </View>
        <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, backgroundColor: WELL, borderWidth: 1, borderColor: DECK_EDGE }}>
          <Text style={{ color: DIGITS, fontSize: 14, fontVariant: ['tabular-nums'], letterSpacing: 2, fontFamily: 'monospace' }}>{counter}</Text>
        </View>
      </View>
    </View>
  );
}
