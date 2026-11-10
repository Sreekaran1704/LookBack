import { memo } from 'react';
import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { withAlpha } from '../../theme/yearColors';
import { deg } from './shared';

interface Props {
  text: string;
  color: string;
  angle?: number;
  large?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Rubber-stamp look: double border, uppercase letter-spaced text, slightly faded and rotated.
 * A second, offset impression of the frame makes it feel imperfect. Glowing ink in midnight mode.
 */
export const DateStamp = memo(function DateStamp({ text, color, angle = -6, large = false, style }: Props) {
  const theme = useTheme();
  const { spacing, radii, typography, opacity } = theme;
  const textStyle: TextStyle = {
    ...(large ? typography.stampLarge : typography.stamp),
    color,
    textTransform: 'uppercase',
    ...(theme.dark ? { textShadowColor: withAlpha(color, 0.8), textShadowRadius: 8 } : null),
  };
  const frame: ViewStyle = { borderWidth: 2, borderColor: color, borderRadius: radii.paper * 2 };

  return (
    <View pointerEvents="none" style={[{ transform: [{ rotate: deg(angle) }], opacity: opacity.stampInk }, style]}>
      {/* Faint second impression, a hair off. */}
      <View style={[frame, { position: 'absolute', top: 1, left: 1.5, right: -1.5, bottom: -1, opacity: 0.35 }]} />
      <View style={[frame, { padding: spacing.xxs }]}>
        <View
          style={{
            borderWidth: 1,
            borderColor: color,
            borderStyle: 'dashed',
            borderRadius: radii.paper,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xxs,
          }}
        >
          {/* simple break strategy: Android's default drops the last word of a shrink-wrapped Caveat label ("JAN 31, 2025" → "JAN 31,"). */}
          <Text numberOfLines={1} textBreakStrategy="simple" style={textStyle}>
            {text}
          </Text>
        </View>
      </View>
    </View>
  );
});
