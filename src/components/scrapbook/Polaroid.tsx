import { Image } from 'expo-image';
import { memo, useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme';
import { deg } from './shared';

interface PolaroidProps {
  width: number;
  uri: string | null;
  caption?: string;
  /** Shadow tint (year color). */
  tint: string;
  /** Fade from white to the photo, like an instant photo developing. */
  develop?: boolean;
  captionTilt?: number;
  lift?: number;
}

/** White instant-photo frame with a thicker bottom edge and a handwritten caption. */
export const Polaroid = memo(function Polaroid({
  width,
  uri,
  caption,
  tint,
  develop = false,
  captionTilt = -2,
  lift = 1,
}: PolaroidProps) {
  const theme = useTheme();
  const { colors, sizes, typography, spacing, motion } = theme;
  const border = sizes.polaroidBorder;
  const photo = width - border * 2;
  const reduceMotion = useReducedMotion();
  const fog = useSharedValue(develop ? 1 : 0);

  useEffect(() => {
    if (!develop) return;
    fog.set(1);
    fog.set(withTiming(0, { duration: reduceMotion ? motion.imageFadeMs : motion.photoDevelopMs }));
  }, [develop, uri, fog, motion.imageFadeMs, motion.photoDevelopMs, reduceMotion]);
  const fogStyle = useAnimatedStyle(() => ({ opacity: fog.get() }));

  return (
    <View
      style={{
        width,
        backgroundColor: colors.paperWhite,
        padding: border,
        paddingBottom: 0,
        borderRadius: theme.radii.paper,
        boxShadow: theme.shadow(tint, lift),
      }}
    >
      <View style={{ width: photo, height: photo, backgroundColor: colors.inkFaint, overflow: 'hidden' }}>
        {uri ? (
          <Image source={{ uri }} recyclingKey={uri} cachePolicy="memory" style={{ width: photo, height: photo }} contentFit="cover" transition={motion.imageFadeMs} />
        ) : null}
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', inset: 0, backgroundColor: colors.paperWhite }, fogStyle]}
        />
      </View>
      <View style={{ height: sizes.polaroidCaption, justifyContent: 'center', paddingHorizontal: spacing.xs }}>
        {caption ? (
          <Text
            numberOfLines={1}
            style={[typography.hand, { color: colors.ink, transform: [{ rotate: deg(captionTilt) }] }]}
          >
            {caption}
          </Text>
        ) : null}
      </View>
    </View>
  );
});

interface TapedPhotoProps {
  width: number;
  uri: string;
  tint: string;
  /** Show black photo corners instead of relying on tape. */
  corners?: boolean;
  lift?: number;
}

const CORNER = 18;

/** A plain print with a thin white border, held by photo corners or tape. */
export const TapedPhoto = memo(function TapedPhoto({ width, uri, tint, corners = false, lift = 1 }: TapedPhotoProps) {
  const theme = useTheme();
  const { colors, spacing, motion } = theme;
  const inner = width - spacing.xs * 2;
  const height = inner * 1.25;
  const cornerColor = theme.colors.ink;
  const corner = (rotation: number, pos: object) => (
    <View style={[{ position: 'absolute', width: CORNER, height: CORNER, transform: [{ rotate: deg(rotation) }] }, pos]}>
      <Svg width={CORNER} height={CORNER}>
        <Path d={`M0 0 L${CORNER} 0 L0 ${CORNER} Z`} fill={cornerColor} opacity={0.85} />
      </Svg>
    </View>
  );
  return (
    <View
      style={{
        width,
        padding: spacing.xs,
        backgroundColor: colors.paperWhite,
        boxShadow: theme.shadow(tint, lift),
      }}
    >
      <Image source={{ uri }} recyclingKey={uri} cachePolicy="memory" style={{ width: inner, height }} contentFit="cover" transition={motion.imageFadeMs} />
      {corners ? (
        <>
          {corner(0, { left: -2, top: -2 })}
          {corner(90, { right: -2, top: -2 })}
          {corner(180, { right: -2, bottom: -2 })}
          {corner(270, { left: -2, bottom: -2 })}
        </>
      ) : null}
    </View>
  );
});
