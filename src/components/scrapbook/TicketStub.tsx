import { memo, useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { useTheme } from '../../theme';

interface Props {
  width: number;
  text: string;
  /** Paper color of the ticket (a year tint). */
  paper: string;
  /** Ink/accent color (the year's primary). */
  accent: string;
  /** Small label on the stub side, e.g. the year. */
  stubLabel: string;
  serial: string;
  lift?: number;
}

const STUB_RATIO = 0.22;
const PERF_DOT = 1.6;
/** Below this width the ticket uses smaller type. */
const COMPACT_WIDTH = 230;
/** Long enough to hold the rotated stub label without wrapping. */
const STUB_LABEL_BOX = 120;

/** Ticket outline with semicircle notches punched out of both sides at the perforation. */
function ticketPath(w: number, h: number, notch: number, perfX: number): string {
  const r = 6;
  const cy = h / 2;
  return [
    `M ${r} 0`,
    `L ${perfX - notch} 0`,
    `A ${notch} ${notch} 0 0 0 ${perfX + notch} 0`,
    `L ${w - r} 0`,
    `Q ${w} 0 ${w} ${r}`,
    `L ${w} ${cy - notch}`,
    `A ${notch} ${notch} 0 0 0 ${w} ${cy + notch}`,
    `L ${w} ${h - r}`,
    `Q ${w} ${h} ${w - r} ${h}`,
    `L ${perfX + notch} ${h}`,
    `A ${notch} ${notch} 0 0 0 ${perfX - notch} ${h}`,
    `L ${r} ${h}`,
    `Q 0 ${h} 0 ${h - r}`,
    `L 0 ${cy + notch}`,
    `A ${notch} ${notch} 0 0 0 0 ${cy - notch}`,
    `L 0 ${r}`,
    `Q 0 0 ${r} 0 Z`,
  ].join(' ');
}

/** Ticket stub for short quotes: perforated edge and punched notches. */
export const TicketStub = memo(function TicketStub({ width, text, paper, accent, stubLabel, serial, lift = 1 }: Props) {
  const theme = useTheme();
  const { sizes, spacing, typography, colors } = theme;
  const [height, setHeight] = useState(0);
  const notch = sizes.ticketNotch;
  const stubW = width * STUB_RATIO;
  const onLayout = (e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height);
  const compact = width < COMPACT_WIDTH;
  const perfDots = height > 0 ? Math.floor((height - notch * 2) / sizes.ticketPerfGap) : 0;

  return (
    <View
      onLayout={onLayout}
      style={{
        width,
        minHeight: notch * 8,
        flexDirection: 'row',
        // Shadow drawn by a soft filter in the shape below; boxShadow would show the notches as square.
      }}
    >
      {height > 0 ? (
        <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
          <Path d={ticketPath(width, height, notch, stubW)} fill={theme.dark ? colors.paper : paper} />
          <Path d={ticketPath(width, height, notch, stubW)} fill="none" stroke={accent} strokeWidth={1.4} opacity={0.55} />
          {/* Perforation: a single dotted line (round caps on near-zero dashes draw dots). */}
          {perfDots > 0 ? (
            <Line
              x1={stubW}
              x2={stubW}
              y1={notch + sizes.ticketPerfGap * 0.5}
              y2={notch + sizes.ticketPerfGap * (perfDots - 0.5)}
              stroke={accent}
              strokeWidth={PERF_DOT * 2}
              strokeLinecap="round"
              strokeDasharray={`0.01 ${sizes.ticketPerfGap}`}
              opacity={0.6}
            />
          ) : null}
          <Line x1={stubW + 10} x2={width - 12} y1={height - 14} y2={height - 14} stroke={accent} strokeWidth={1} opacity={0.4} />
        </Svg>
      ) : null}
      <View style={{ width: stubW, alignItems: 'center', justifyContent: 'center' }}>
        {/* Rotated label in a wide box so it never wraps inside the narrow stub. */}
        <View style={{ position: 'absolute', width: STUB_LABEL_BOX, alignItems: 'center', transform: [{ rotate: '-90deg' }] }}>
          <Text numberOfLines={1} style={[typography.stamp, { color: accent }]}>
            {stubLabel}
          </Text>
        </View>
      </View>
      <View style={{ flex: 1, paddingVertical: spacing.lg, paddingLeft: spacing.md, paddingRight: spacing.lg, gap: spacing.xs }}>
        <Text numberOfLines={1} style={[typography.small, { color: accent, letterSpacing: 1.2 }]}>
          {compact ? `Nº ${serial}` : `ADMIT ONE · Nº ${serial}`}
        </Text>
        <Text style={[compact ? typography.label : typography.ticket, { color: colors.ink }]}>{text}</Text>
      </View>
      {/* Tight paper shadow under the shape. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: notch,
          right: notch,
          top: notch / 2,
          bottom: 0,
          zIndex: -1,
          boxShadow: theme.shadow(accent, lift),
          borderRadius: notch,
        }}
      />
    </View>
  );
});
