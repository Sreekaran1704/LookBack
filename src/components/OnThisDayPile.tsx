import { useEffect, useMemo, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import type { Entry } from '../data';
import { tapHaptic } from '../lib/haptics';
import { yearsAgoLabel, yearsBetween } from '../lib/dates';
import { fanSlot, swipeTarget } from '../lib/pile';
import { lookForEntry } from '../lib/seeded';
import { useTheme, type Theme } from '../theme';
import { PillButton } from './Buttons';
import { PaperBackground } from './scrapbook/PaperBackground';
import { ScrapObject } from './scrapbook/ScrapObject';

interface Props {
  /** Matches for today, most recent year first. */
  entries: Entry[];
  today: string;
  onOpen: (id: string) => void;
}

/** A horizontal drag this far (and clearly more sideways than vertical) counts as a swipe. */
const SWIPE_MIN_DX = 24;
const SWIPE_DOMINANCE = 1.5;

const FAN_SCALE_FEW = 0.74;
const FAN_SCALE_MANY = 0.6;

/**
 * The "On this day" spread: a pile of past years' objects on a cork board, overlapping and tilted.
 * Tap the pile to fan it out; tap an item to lift, straighten and enlarge it; tap it again to open.
 */
export function OnThisDayPile({ entries, today, onOpen }: Props) {
  const theme = useTheme();
  const { width: screenW } = useWindowDimensions();
  const { spacing, sizes, scrap, motion, colors, typography, radii } = theme;
  const reduceMotion = useReducedMotion();
  const [fanned, setFanned] = useState(false);
  const [lifted, setLifted] = useState<number | null>(null);
  const fan = useSharedValue(0);
  const lift = useSharedValue(0);

  const visible = entries.slice(0, scrap.pileVisible);
  const boardW = screenW - spacing.gutter * 2;
  const itemW = boardW * sizes.pileItemWidthRatio;
  const fanScale = visible.length > 3 ? FAN_SCALE_MANY : FAN_SCALE_FEW;

  useEffect(() => {
    fan.set(reduceMotion ? withTiming(fanned ? 1 : 0, { duration: motion.imageFadeMs }) : withSpring(fanned ? 1 : 0, motion.fan));
  }, [fan, fanned, motion.fan, motion.imageFadeMs, reduceMotion]);
  useEffect(() => {
    lift.set(0);
    if (lifted !== null) lift.set(reduceMotion ? withTiming(1, { duration: motion.imageFadeMs }) : withSpring(1, motion.lift));
  }, [lift, lifted, motion.imageFadeMs, motion.lift, reduceMotion]);

  const total = visible.length;
  // Swipe sideways through the memories: spreads the pile if needed and lifts the neighbour.
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, g) =>
          total > 1 && Math.abs(g.dx) > SWIPE_MIN_DX && Math.abs(g.dx) > Math.abs(g.dy) * SWIPE_DOMINANCE,
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_, g) => {
          const direction: 1 | -1 = g.dx < 0 ? 1 : -1;
          setFanned(true);
          setLifted((current) => {
            const next = swipeTarget(current, direction, total);
            if (next !== current) tapHaptic();
            return next;
          });
        },
      }),
    [total],
  );

  const first = entries[0];
  if (!first) return null;
  const headline = yearsAgoLabel(yearsBetween(first.localDate, today));

  const onItemPress = (index: number, id: string) => {
    if (!fanned && visible.length > 1) {
      setFanned(true);
      return;
    }
    if (lifted === index || visible.length === 1) onOpen(id);
    else setLifted(index);
  };

  return (
    <View>
      <View
        {...swipe.panHandlers}
        style={{
          height: sizes.pileHeight,
          borderRadius: radii.album,
          overflow: 'hidden',
          boxShadow: theme.shadow(colors.corkDark, 1),
        }}
      >
        <PaperBackground variant="cork" />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            if (lifted !== null) setLifted(null);
            else if (fanned) setFanned(false);
          }}
          accessibilityLabel="Stack the memories"
        />
        {visible
          .map((entry, index) => (
            <PileItem
              key={entry.id}
              entry={entry}
              index={index}
              total={visible.length}
              boardW={boardW}
              itemW={itemW}
              fanScale={fanScale}
              fan={fan}
              lift={lift}
              isLifted={lifted === index}
              theme={theme}
              onPress={() => onItemPress(index, entry.id)}
            />
          ))
          .reverse()}
      </View>
      <View style={[styles.footer, { marginTop: spacing.md, gap: spacing.md }]}>
        <Text style={[typography.handLarge, { color: colors.onDesk, flex: 1 }]}>{headline}</Text>
        {visible.length > 1 ? (
          <PillButton
            label={fanned ? 'Tidy up' : `Spread all ${entries.length}`}
            icon={fanned ? 'albums-outline' : 'copy-outline'}
            tone="dark"
            onPress={() => {
              tapHaptic();
              setLifted(null);
              setFanned((f) => !f);
            }}
          />
        ) : null}
      </View>
    </View>
  );
}

interface PileItemProps {
  entry: Entry;
  index: number;
  total: number;
  boardW: number;
  itemW: number;
  fanScale: number;
  fan: SharedValue<number>;
  lift: SharedValue<number>;
  isLifted: boolean;
  theme: Theme;
  onPress: () => void;
}

function PileItem({ entry, index, total, boardW, itemW, fanScale, fan, lift, isLifted, theme, onPress }: PileItemProps) {
  const { scrap, motion, spacing } = theme;
  const look = useMemo(() => lookForEntry(entry, scrap.maxTilt, scrap.maxOffset), [entry, scrap.maxTilt, scrap.maxOffset]);
  const slot = fanSlot(index, total);
  const maxSlot = Math.max(...Array.from({ length: total }, (_, i) => Math.abs(fanSlot(i, total))));
  const fannedW = itemW * fanScale;
  const spread = maxSlot > 0 ? Math.min(fannedW * scrap.fanSpreadRatio * 1.4, (boardW / 2 - fannedW / 2 - spacing.sm) / maxSlot) : 0;

  const pile = {
    x: look.offsetX * 1.5 + (index % 2 ? -1 : 1) * index * scrap.pileOffsetX * 0.6,
    y: index * scrap.pileOffsetY,
    rotate: look.tilt * 1.8,
    scale: 1 - index * 0.03,
  };
  const spreadOut = {
    x: slot * spread,
    y: Math.abs(slot) * scrap.fanLiftY,
    rotate: slot * scrap.fanRotationDeg,
    scale: fanScale,
  };

  const style = useAnimatedStyle(() => {
    const f = fan.get();
    const l = isLifted ? lift.get() : 0;
    const x = pile.x + (spreadOut.x - pile.x) * f;
    const y = pile.y + (spreadOut.y - pile.y) * f;
    const rotate = pile.rotate + (spreadOut.rotate - pile.rotate) * f;
    const scale = pile.scale + (spreadOut.scale - pile.scale) * f;
    return {
      transform: [
        { translateX: x * (1 - l) },
        { translateY: y * (1 - l) - l * spacing.md },
        // Lifting straightens the object (cancel its own tilt too) and enlarges it.
        { rotate: `${rotate * (1 - l) - look.tilt * l}deg` },
        { scale: scale + (fanScale * motion.liftedScale - scale) * l },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        { position: 'absolute', top: spacing.xl, left: (boardW - itemW) / 2, width: itemW, zIndex: isLifted ? 100 : total - index },
        style,
      ]}
    >
      <ScrapObject entry={entry} width={itemW} numberOfLines={5} lift={isLifted ? 2 : 1} sway onPress={onPress} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
