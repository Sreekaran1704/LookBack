import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

/** Room around the content for shadows, tape and stickers that hang outside its box. */
const BLEED = 28;

/**
 * Draws its children once into a GPU texture, so scrolling and moving them is just moving a picture
 * instead of re-drawing blurred shadows and SVG every frame. The texture is padded (and pulled back
 * with a negative margin, so layout is unchanged) because a texture clips whatever hangs outside it.
 * Only for content that sits still: anything animating inside would re-draw the texture every frame.
 */
export function Raster({ children, style, enabled = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; enabled?: boolean }) {
  if (!enabled) return <>{children}</>;
  return (
    // collapsable={false}: a view with only layout styles is otherwise flattened away, and the texture with it.
    <View collapsable={false} renderToHardwareTextureAndroid shouldRasterizeIOS style={[{ margin: -BLEED, padding: BLEED }, style]}>
      {children}
    </View>
  );
}
