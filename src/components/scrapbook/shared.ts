import { useId } from 'react';
import { Platform, type ViewStyle } from 'react-native';
import type { Theme } from '../../theme';
import { withAlpha } from '../../theme/yearColors';

/** Stable, SVG-safe id for <Defs> references. */
export function useSvgId(prefix: string): string {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

/**
 * A shadow that follows the drawn shape's alpha (stickers, pins, clips), not its bounding box.
 * In midnight mode it becomes a colored glow.
 */
export function shapeShadow(theme: Theme, color: string, glowing = theme.dark): ViewStyle {
  if (theme.lite) return {};
  const shadowColor = glowing ? color : theme.colors.shadowBase;
  const alpha = glowing ? 0.85 : 0.35;
  const radius = glowing ? 8 : 2;
  const offsetY = glowing ? 0 : 2;
  return Platform.select<ViewStyle>({
    android: {
      filter: [
        {
          dropShadow: {
            offsetX: glowing ? 0 : 1,
            offsetY,
            standardDeviation: radius,
            color: withAlpha(shadowColor.startsWith('#') ? shadowColor : '#000000', alpha),
          },
        },
      ],
    },
    default: {
      shadowColor,
      shadowOpacity: alpha,
      shadowRadius: radius,
      shadowOffset: { width: glowing ? 0 : 1, height: offsetY },
    },
  });
}

export const deg = (value: number) => `${value}deg`;
