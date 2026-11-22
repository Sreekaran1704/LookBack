import { Image, StyleSheet, type ImageStyle, type StyleProp } from 'react-native';

/** Textures painted by scripts/make-textures.mjs. */
const PAPER = require('../../../assets/textures/paper.png');
const LEATHER = require('../../../assets/textures/leather.png');
const WOOD = require('../../../assets/textures/wood.png');

/**
 * The feel of a material laid over a surface: `paper` (fibres, specks, a faint cloudiness) and `leather` (pebbled
 * grain) tile across it; `wood` is one walnut board stretched to fill. It fills its parent and takes no touches;
 * give it the parent's corner radius. One image each, shared by every surface, so it costs little.
 */
export function Texture({ kind, opacity = 1, radius, style }: { kind: 'paper' | 'leather' | 'wood'; opacity?: number; radius?: number; style?: StyleProp<ImageStyle> }) {
  const source = kind === 'paper' ? PAPER : kind === 'leather' ? LEATHER : WOOD;
  return (
    <Image
      source={source}
      resizeMode={kind === 'wood' ? 'cover' : 'repeat'}
      pointerEvents="none"
      fadeDuration={0}
      style={[StyleSheet.absoluteFill, { width: undefined, height: undefined, opacity, borderRadius: radius }, style]}
    />
  );
}
