import { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { useTheme } from '../../theme';
import { withAlpha } from '../../theme/yearColors';
import { shapeShadow } from './shared';

/** Push pin: glossy colored head with a cast shadow. */
export const Pin = memo(function Pin({ color, style }: { color: string; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const s = theme.sizes.pinHead;
  const box = s * 1.8;
  return (
    <View pointerEvents="none" style={[{ width: box, height: box }, style]}>
      <Svg width={box} height={box} viewBox="0 0 36 36">
        {/* Cast shadow on the paper, offset down-right. */}
        <Ellipse cx={21} cy={23} rx={9} ry={6} fill={withAlpha(theme.colors.shadowBase.slice(0, 7), theme.dark ? 0.5 : 0.25)} />
        <Path d="M 18 18 L 23 27" stroke={theme.colors.metal} strokeWidth={1.6} strokeLinecap="round" />
      </Svg>
      <View style={[{ position: 'absolute', left: 0, top: 0 }, shapeShadow(theme, color)]}>
        <Svg width={box} height={box} viewBox="0 0 36 36">
          <Circle cx={16} cy={15} r={9} fill={color} />
          <Circle cx={13} cy={12} r={3} fill="#FFFFFF" opacity={0.55} />
        </Svg>
      </View>
    </View>
  );
});
