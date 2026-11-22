import { Image } from 'expo-image';
import { memo, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, useAnimatedReaction, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { Entry } from '../../data';
import { resolvePhotoUri } from '../../data';
import { formatDisplayDate } from '../../lib/dates';
import { planPolaroidWords } from '../../lib/polaroid';
import { useTheme } from '../../theme';
import { Texture } from './Texture';

/** The photograph follows a horizontal finger movement, then settles on one of its two sides.
 * Vertical movement remains available for reading and scrolling; the paper's corners also turn it. */
export const MemoryCard = memo(function MemoryCard({ entry, width, back, onTurn }: { entry: Entry; width: number; back: boolean; onTurn: () => void }) {
  const { typography, colors } = useTheme();
  const reduced = useReducedMotion();
  const [facingBack, setFacingBack] = useState(back);
  const y = useSharedValue(back ? 180 : 0);
  const startAngle = useSharedValue(back ? 180 : 0);
  const turning = useSharedValue(false);
  const photo = entry.photoPath ? resolvePhotoUri(entry.photoPath) : null;
  const words = planPolaroidWords(entry.text, 28, photo ? 2 : 9);
  const height = width * (photo ? (words.back ? 1.34 : entry.text.trim() ? 1.27 : 1.18) : 1.2);
  useEffect(() => {
    y.set(withTiming(nearestSide(y.get(), back), { duration: reduced ? 0 : 480, easing: Easing.inOut(Easing.cubic) }));
  }, [back, reduced, y]);
  const settle = (target: number, changed: boolean) => {
    'worklet';
    turning.set(true);
    y.set(withTiming(target, { duration: reduced ? 0 : 320, easing: Easing.out(Easing.cubic) }, (finished) => {
      turning.set(false);
      if (finished && changed) scheduleOnRN(onTurn);
    }));
  };
  const turnCorner = (direction: number) => {
    if (turning.get()) return;
    settle(nearestSide(y.get(), back) + direction * 180, true);
  };
  const pan = usePanGesture({
    activeOffsetX: [-10, 10],
    failOffsetY: [-16, 16],
    onActivate: () => {
      cancelAnimation(y);
      turning.set(false);
      startAngle.set(nearestSide(y.get(), back));
    },
    onUpdate: (event) => {
      // A leftward pull turns left, a rightward pull turns right, including from the back.
      const delta = Math.max(-180, Math.min(180, event.translationX / (width * 0.85) * 180));
      y.set(startAngle.get() + delta);
    },
    onDeactivate: (event) => {
      const changed = Math.abs(event.translationX) > width * 0.25 || Math.abs(event.velocityX) > 650;
      const direction = (Math.abs(event.velocityX) > 650 ? event.velocityX : event.translationX) >= 0 ? 1 : -1;
      settle(startAngle.get() + (changed ? direction * 180 : 0), changed);
    },
  });
  useAnimatedReaction(
    () => Math.cos(y.get() * Math.PI / 180) < 0,
    (rear, previous) => { if (rear !== previous) scheduleOnRN(setFacingBack, rear); },
  );
  const frontStyle = useAnimatedStyle(() => ({ opacity: Math.cos(y.get() * Math.PI / 180) >= 0 ? 1 : 0, transform: [{ perspective: 1100 }, { rotateY: `${y.get()}deg` }] }));
  const backStyle = useAnimatedStyle(() => ({ opacity: Math.cos(y.get() * Math.PI / 180) < 0 ? 1 : 0, transform: [{ perspective: 1100 }, { rotateY: `${y.get() + 180}deg` }] }));
  const paper = { width, height, backgroundColor: colors.paperWhite, padding: 14, borderRadius: 2, boxShadow: '0px 12px 18px -8px rgba(35,25,15,0.45), 1px 2px 1px rgba(35,25,15,0.2)' };
  return (
    <GestureDetector gesture={pan}>
      <View collapsable={false} style={{ width, height }}>
      <Animated.View pointerEvents={facingBack ? 'none' : 'auto'} style={[paper, { position: 'absolute' }, frontStyle]}>
        <Texture kind="paper" opacity={0.7} radius={2} />
        {photo ? <Image source={{ uri: photo }} contentFit="cover" cachePolicy="memory-disk" style={{ width: width - 28, height: width - 28, backgroundColor: colors.kraft }} /> : <Text style={[typography.caption, { color: colors.sepia, marginBottom: 16 }]}>{formatDisplayDate(entry.localDate)}</Text>}
        <Text numberOfLines={photo ? 2 : 9} style={[typography.hand, { color: colors.inkBlue, fontSize: 24, lineHeight: 28, marginTop: photo ? 10 : 0, flex: 1 }]}>{words.front ?? words.teaser ?? ''}{words.back ? '…' : ''}</Text>
        {words.back ? <Pressable onPress={onTurn} accessibilityRole="button" accessibilityLabel="P.T.O. Turn over to read all your words" style={{ minHeight: 44, justifyContent: 'center' }}><Text style={[typography.caption, { color: colors.sepia, textAlign: 'right' }]}>P.T.O. ↪</Text></Pressable> : <Text style={[typography.caption, { color: colors.sepia, fontSize: 13, textAlign: 'right' }]}>{photo ? formatDisplayDate(entry.localDate) : 'kept for your future self'}</Text>}
      </Animated.View>
      <Animated.View pointerEvents={facingBack ? 'auto' : 'none'} style={[paper, { position: 'absolute', backgroundColor: colors.paper }, backStyle]}>
        <Texture kind="paper" opacity={0.75} radius={2} />
        <Text style={[typography.caption, { color: colors.sepia, marginBottom: 12 }]}>{formatDisplayDate(entry.localDate)} · on the back</Text>
        <ScrollView nestedScrollEnabled style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
          <Text selectable style={[typography.hand, { color: colors.inkBlue, fontSize: 25, lineHeight: 32 }]}>{entry.text.trim() || 'No words that day. Just a moment, kept.'}</Text>
        </ScrollView>
        <Text style={[typography.caption, { color: colors.sepia, fontSize: 13, textAlign: 'right', marginTop: 8 }]}>from the person you were then</Text>
      </Animated.View>
      {([-1, 1] as const).flatMap((side) => ([false, true] as const).map((bottom) => (
        <Pressable key={`${side}-${bottom}`} onPress={() => turnCorner(side)} accessibilityRole="button" accessibilityLabel={`Turn the ${side < 0 ? 'left' : 'right'} corner of the memory`} hitSlop={4}
          style={{ position: 'absolute', width: 44, height: 44, [side < 0 ? 'left' : 'right']: 0, [bottom ? 'bottom' : 'top']: 0 }} />
      )))}
      </View>
    </GestureDetector>
  );
});

/** Use the nearest equivalent face so a leftward turn never gets animated back around the other way. */
function nearestSide(angle: number, back: boolean): number {
  'worklet';
  const face = back ? 180 : 0;
  return Math.round((angle - face) / 360) * 360 + face;
}
