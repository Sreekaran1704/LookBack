import { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import type { Entry } from '../../data';
import { tearHaptic, thudHaptic } from '../../lib/haptics';
import { useTheme, withAlpha } from '../../theme';
import { PillButton } from '../Buttons';
import { PaperBackground } from './PaperBackground';
import { ScrapObject } from './ScrapObject';
import { CassetteSmash } from './CassetteSmash';
import { formatDisplayDate } from '../../lib/dates';
import { formatVoiceMs } from '../../lib/voice';

/**
 * Tearing a page out, by hand (after the "Tear out this page?" warning). A perforated strip runs down the middle of
 * the page, with a little paper pull-tab hanging from its top, swaying. Pull the tab down and the strip tears off
 * following your finger, one perforation at a time (each one a small varied tick, so it feels like paper ripping),
 * folding down under your finger while the two halves of the page part. Reach the bottom and the halves fall away:
 * the memory is deleted. Let go early and the strip zips back; "Keep it" backs out. A voice memory's cassette is broken
 * first, struck until it bursts (`CassetteSmash`), then the page is torn.
 */

/** The strip: its width, the perforation holes along both edges, and the folded flap that hangs under the finger. */
const STRIP = 26;
const HOLE = 3.2;
const HOLE_GAP = 12;
const FLAP_MAX = 64;
/** The pull-tab hanging from the top of the strip, and how it sways while it waits. */
const TAB_W = 46;
const TAB_H = 40;
const SWAY_DEG = 6;
const SWAY_MS = 1300;
/** The halves part a little as the tear runs (degrees, at the top), then fall away. */
const PART_DEG = 3;
const FALL_MS = 700;
const GONE_HOLD_MS = 1000;
/** Let go with the tear this far down (or past the bottom) and the page comes away. */
const DONE_AT = 0.94;
/** The leather dimmed under the page, and the darker back of the paper on the folded strip. */
const DIM = '#000000';
const PAPER_BACK = 'rgba(0, 0, 0, 0.12)';

/** Where one half of the page is: parting as the tear runs (`p`, 0–1), then falling away (`f`, 0–1). */
function halfMotion(p: number, fallen: number, dir: -1 | 1, W: number, H: number) {
  'worklet';
  const f = Easing.in(Easing.quad)(fallen);
  return {
    opacity: interpolate(fallen, [0, 0.7, 1], [1, 1, 0], Extrapolation.CLAMP),
    transform: [{ translateX: dir * (p * 4 + f * W * 0.4) }, { translateY: f * H * 0.5 }, { rotate: `${dir * (p * PART_DEG + f * 24)}deg` }],
  };
}

interface Props {
  entry: Entry;
  /** The page came away: delete the memory now. */
  onDone: () => void;
  /** "Keep it": back out without deleting. */
  onCancel?: () => void;
}

export function ShredAway({ entry, onDone, onCancel }: Props) {
  const theme = useTheme();
  const { colors, typography, spacing, motion } = theme;
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [pageH, setPageH] = useState(0);
  const [torn, setTorn] = useState(false);
  // A voice memory's tape is pulled out (and snaps) before its page can be torn.
  const [stage, setStage] = useState<'tape' | 'page'>(entry.voicePath && !reduceMotion ? 'tape' : 'page');
  const done = useRef(false);
  const tornRef = useRef(false);
  /** How far down the page the tear has run (points). */
  const tear = useSharedValue(0);
  const hole = useSharedValue(0);
  const fall = useSharedValue(0);
  const sway = useSharedValue(0);
  const holding = useSharedValue(0);
  /**
   * The page's height and whether it has come away, kept where the gesture's callbacks run: they can hold an older
   * copy of this component's state (the height before the page was measured), so they read these instead.
   */
  const pageHv = useSharedValue(0);
  const ripped = useSharedValue(0);

  const pageW = W * 0.72;
  const left = (W - pageW) / 2;
  const top = H * 0.24;
  const mid = pageW / 2;

  // The tab sways gently while it hangs there waiting.
  useEffect(() => {
    if (reduceMotion) return;
    sway.set(withRepeat(withSequence(withTiming(1, { duration: SWAY_MS, easing: Easing.inOut(Easing.sin) }), withTiming(-1, { duration: SWAY_MS, easing: Easing.inOut(Easing.sin) })), -1, true));
  }, [sway, reduceMotion]);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };
  const comeAway = () => {
    if (done.current || tornRef.current) return;
    tornRef.current = true;
    setTorn(true);
    thudHaptic();
    tear.set(withTiming(pageHv.get(), { duration: 120 }));
    fall.set(withTiming(1, { duration: reduceMotion ? 1 : FALL_MS, easing: Easing.in(Easing.quad) }));
    setTimeout(finish, (reduceMotion ? 0 : FALL_MS) + GONE_HOLD_MS);
  };

  const pan = usePanGesture({
    onActivate: () => {
      holding.set(withTiming(1, { duration: 120 }));
    },
    onUpdate: (e) => {
      const h = pageHv.get();
      if (h <= 0 || ripped.get() > 0) return;
      // The tear follows the finger down, one to one.
      const y = Math.max(0, Math.min(h, e.translationY));
      tear.set(y);
      // Each perforation that gives is a tick (only going down: tearing, not mending).
      const n = Math.floor(y / HOLE_GAP);
      if (n > hole.get()) {
        hole.set(n);
        scheduleOnRN(tearHaptic, n);
      }
      if (y >= h) {
        ripped.set(1);
        scheduleOnRN(comeAway);
      }
    },
    onDeactivate: () => {
      holding.set(withTiming(0, { duration: 160 }));
      if (ripped.get() > 0) return;
      const h = pageHv.get();
      if (h > 0 && tear.get() >= h * DONE_AT) {
        ripped.set(1);
        scheduleOnRN(comeAway);
        return;
      }
      // Let go early: the strip zips back up.
      hole.set(0);
      tear.set(withSpring(0, motion.lift));
    },
  });

  const leftHalf = useAnimatedStyle(() => halfMotion(pageHv.get() > 0 ? tear.get() / pageHv.get() : 0, fall.get(), -1, W, H));
  const rightHalf = useAnimatedStyle(() => halfMotion(pageHv.get() > 0 ? tear.get() / pageHv.get() : 0, fall.get(), 1, W, H));
  // What is left of the strip below the tear.
  const stripStyle = useAnimatedStyle(() => ({ top: tear.get(), height: Math.max(0, pageHv.get() - tear.get()), opacity: 1 - fall.get() }));
  const stripInner = useAnimatedStyle(() => ({ transform: [{ translateY: -tear.get() }] }));
  // The torn-off strip, folded down under the finger.
  const flapStyle = useAnimatedStyle(() => ({ top: tear.get(), height: Math.min(tear.get(), FLAP_MAX), opacity: 1 - fall.get() }));
  // The tab: hangs over the top edge while waiting; once pulled it rides at the end of the folded strip, under the finger.
  const tabStyle = useAnimatedStyle(() => {
    const t = tear.get();
    return {
      opacity: 1 - fall.get(),
      transform: [{ translateY: t + Math.min(t, FLAP_MAX) }, { rotate: `${(1 - holding.get()) * sway.get() * SWAY_DEG}deg` }, { scale: 1 + holding.get() * 0.06 }],
    };
  });
  const hintStyle = useAnimatedStyle(() => ({ opacity: interpolate(tear.get(), [0, 30], [1, 0], Extrapolation.CLAMP) }));

  const holes = pageH > 0 ? Math.floor(pageH / HOLE_GAP) : 0;
  const perforations = [mid - STRIP / 2, mid + STRIP / 2].map((x) =>
    Array.from({ length: holes }, (_, i) => (
      <View key={`${x}-${i}`} style={{ position: 'absolute', left: x - HOLE / 2, top: HOLE_GAP * (i + 0.5) - HOLE / 2, width: HOLE, height: HOLE, borderRadius: HOLE / 2, backgroundColor: colors.deskDeep, opacity: 0.85 }} />
    )),
  );
  const page = <ScrapObject entry={entry} width={pageW} numberOfLines={6} raster={false} />;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onCancel ?? finish}>
      {/* A Modal is its own window on Android: gestures inside it need their own root. */}
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <PaperBackground variant="dots" desk />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(DIM, 0.25) }]} />

        <View style={{ position: 'absolute', left: spacing.gutter, right: spacing.gutter, top: insets.top + spacing.xl, gap: spacing.xs }}>
          <Text style={[typography.headline, { color: colors.giltBright, textAlign: 'center', alignSelf: 'stretch' }]}>{stage === 'tape' ? 'Break the tape ' : torn ? 'Torn out. ' : 'Pull the strip '}</Text>
          <Text style={[typography.caption, { color: colors.onDeskMuted, textAlign: 'center', alignSelf: 'stretch' }]}>
            {stage === 'tape' ? 'First the voice. Strike the cassette until it breaks.' : torn ? "It won't come back." : 'Take the tab and pull it all the way down to tear the page out.'}
          </Text>
        </View>

        {/* Measures the page once (off screen). */}
        <View style={{ position: 'absolute', left: -W * 2, width: pageW, opacity: 0 }} onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            pageHv.set(h);
            setPageH(h);
          }} pointerEvents="none">
          {page}
        </View>

        {stage === 'tape' ? (
          <View style={{ position: 'absolute', left: 0, top: top - spacing.xl, width: W, height: H * 0.62 }}>
            <CassetteSmash width={W} title={formatDisplayDate(entry.localDate)} detail={formatVoiceMs(entry.voiceMs)} onBroken={() => setStage('page')} />
          </View>
        ) : null}

        {pageH > 0 && stage === 'page' ? (
          <GestureDetector gesture={pan}>
            <View style={{ position: 'absolute', left, top: top - TAB_H, width: pageW, height: pageH + TAB_H * 2 }}>
              <View style={{ position: 'absolute', left: 0, top: TAB_H, width: pageW, height: pageH }} pointerEvents="none">
                {/* Left and right halves of the page, either side of the strip. */}
                <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: mid - STRIP / 2, height: pageH, overflow: 'hidden', transformOrigin: 'right bottom' }, leftHalf]}>
                  {page}
                </Animated.View>
                <Animated.View style={[{ position: 'absolute', left: mid + STRIP / 2, top: 0, width: mid - STRIP / 2, height: pageH, overflow: 'hidden', transformOrigin: 'left bottom' }, rightHalf]}>
                  <View style={{ marginLeft: -(mid + STRIP / 2) }}>{page}</View>
                </Animated.View>
                {/* The strip still in the page, below the tear, with its perforations. */}
                <Animated.View style={[{ position: 'absolute', left: mid - STRIP / 2, width: STRIP, overflow: 'hidden' }, stripStyle]}>
                  <Animated.View style={[{ marginLeft: -(mid - STRIP / 2) }, stripInner]}>
                    {page}
                    <View style={StyleSheet.absoluteFill}>{perforations}</View>
                  </Animated.View>
                </Animated.View>
                {/* The torn-off part, folded down: the back of the paper, with the torn edge at its fold. */}
                <Animated.View
                  style={[
                    {
                      position: 'absolute',
                      left: mid - STRIP / 2,
                      width: STRIP,
                      backgroundColor: colors.paper,
                      borderBottomLeftRadius: 2,
                      borderBottomRightRadius: 2,
                      borderTopWidth: 1.5,
                      borderTopColor: withAlpha(colors.ink, 0.25),
                      borderStyle: 'dashed',
                      boxShadow: `0px 4px 6px rgba(0,0,0,0.35), inset 0px 0px 0px 100px ${PAPER_BACK}`,
                    },
                    flapStyle,
                  ]}
                />
              </View>
              {/* The pull-tab: a rounded paper tab hanging over the top of the strip, swaying a little. */}
              <Animated.View
                pointerEvents="none"
                style={[
                  {
                    position: 'absolute',
                    left: mid - TAB_W / 2,
                    top: TAB_H * 0.2,
                    width: TAB_W,
                    height: TAB_H,
                    borderRadius: 10,
                    borderTopLeftRadius: 3,
                    borderTopRightRadius: 3,
                    backgroundColor: colors.paperWhite,
                    borderWidth: 1,
                    borderColor: withAlpha(colors.ink, 0.2),
                    alignItems: 'center',
                    justifyContent: 'center',
                    transformOrigin: 'top',
                    boxShadow: '0px 4px 8px rgba(0,0,0,0.4)',
                  },
                  tabStyle,
                ]}
              >
                <Text style={[typography.stamp, { color: colors.sepia, fontSize: 10, letterSpacing: 1.4, paddingRight: 0 }]}>PULL</Text>
                <Text style={[typography.stamp, { color: colors.sepia, fontSize: 11, lineHeight: 12, paddingRight: 0 }]}>↓</Text>
              </Animated.View>
            </View>
          </GestureDetector>
        ) : null}

        {!torn && pageH > 0 && stage === 'page' ? (
          <Animated.Text style={[typography.caption, { position: 'absolute', left: 0, right: 0, top: top + pageH + spacing.xl, color: colors.onDeskMuted, textAlign: 'center' }, hintStyle]}>
            pull the tab down
          </Animated.Text>
        ) : null}

        {/* Backing out, at the foot where a thumb reaches it. */}
        {!torn && onCancel ? (
          <View style={{ position: 'absolute', left: spacing.gutter, right: spacing.gutter, bottom: insets.bottom + spacing.lg }}>
            <PillButton label="Keep it" icon="heart-outline" large onPress={onCancel} />
          </View>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}
