import { FlexWidget, ImageWidget, OverlapWidget, SvgWidget, TextWidget, type ColorProp, type HexColor } from 'react-native-android-widget';
import type { Paper } from '../theme/papers';
import type { YearPalette } from '../theme/yearColors';

export interface TodayWidgetProps {
  /** Today's page, if written: its first lines (or a photo note) and its id. */
  today: { id: string; text: string; hasPhoto: boolean } | null;
  /** "Nov 11". */
  dateLabel: string;
  /** How many letters from past years are waiting today. */
  letters: number;
  /** Days in a row with a page, counting today if written. */
  streak: number;
  paper: Paper;
  dark: boolean;
  year: YearPalette;
  /** Ink and paper-white from the theme tokens. */
  ink: string;
  inkMuted: string;
  paperWhite: string;
}

const HAND_BOLD = 'Caveat_700Bold';
const HAND = 'Caveat_600SemiBold';
const BUNNY = {
  wave: require('../../assets/buddy/wave.png'),
  cheer: require('../../assets/buddy/cheer.png'),
  plead: require('../../assets/buddy/happy.png'),
};
const BUNNY_PX = 92;
const TAPE_W = 86;
const TAPE_H = 22;
const DOT_GAP = 14;

/** Dotted page, drawn as SVG so the widget is the same paper as the app. */
function dots(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="220"><defs><pattern id="d" width="${DOT_GAP}" height="${DOT_GAP}" patternUnits="userSpaceOnUse"><circle cx="${DOT_GAP / 2}" cy="${DOT_GAP / 2}" r="1.1" fill="${color}" fill-opacity="0.35"/></pattern></defs><rect width="400" height="220" fill="url(#d)"/></svg>`;
}

/** A strip of striped washi tape. */
function tape(color: string, stripe: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TAPE_W}" height="${TAPE_H}"><defs><pattern id="s" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="8" fill="${stripe}" fill-opacity="0.55"/></pattern></defs><path d="M2 1 L${TAPE_W - 2} 0 L${TAPE_W} 4 L${TAPE_W - 3} 8 L${TAPE_W} 13 L${TAPE_W - 2} ${TAPE_H} L1 ${TAPE_H - 1} L3 15 L0 10 L3 5 Z" fill="${color}" fill-opacity="0.9"/><path d="M2 1 L${TAPE_W - 2} 0 L${TAPE_W} 4 L${TAPE_W - 3} 8 L${TAPE_W} 13 L${TAPE_W - 2} ${TAPE_H} L1 ${TAPE_H - 1} L3 15 L0 10 L3 5 Z" fill="url(#s)"/></svg>`;
}

const hex = (c: string) => c.slice(0, 7) as HexColor;

/**
 * The home-screen widget: a taped paper card on the person's own paper color with the bunny. Empty
 * day: the bunny waves and asks for today's small thing, and the whole card opens the writing page.
 * Written: today's first lines on a note with "edit" underneath; tapping the note opens it.
 */
export function TodayWidget(props: TodayWidgetProps) {
  const { today, paper, dark, year } = props;
  const page = hex(dark ? paper.dark : paper.light);
  const onPage = hex(dark ? props.paperWhite : props.ink);
  const onPageMuted: ColorProp = dark ? 'rgba(255, 255, 255, 0.7)' : hex(props.inkMuted);
  const open = today ? `yearbook:///memory/${today.id}` : 'yearbook:///entry';

  return (
    <OverlapWidget style={{ height: 'match_parent', width: 'match_parent', borderRadius: 24, backgroundColor: page }}>
      <SvgWidget svg={dots(dark ? '#FFFFFF' : paper.dots)} style={{ height: 'match_parent', width: 'match_parent' }} />
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: open }}
        accessibilityLabel={today ? "Open today's memory" : "Write today's memory"}
        style={{ height: 'match_parent', width: 'match_parent', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 }}
      >
        <ImageWidget image={today ? BUNNY.cheer : BUNNY.wave} imageWidth={BUNNY_PX} imageHeight={BUNNY_PX} />
        <FlexWidget style={{ flex: 1, height: 'match_parent', flexDirection: 'column', justifyContent: 'center', marginLeft: 6 }}>
          <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TextWidget text={today ? 'today ✓' : 'today'} style={{ fontFamily: HAND_BOLD, fontSize: 22, color: today ? hex('#2DB86A') : onPage }} />
            <TextWidget text={props.dateLabel} style={{ fontFamily: HAND, fontSize: 17, color: onPageMuted }} />
          </FlexWidget>
          {today ? (
            // Today's note on a little white card.
            <FlexWidget
              style={{
                width: 'match_parent',
                backgroundColor: hex(props.paperWhite),
                borderRadius: 6,
                borderLeftWidth: 3,
                borderLeftColor: hex(year.primary),
                paddingHorizontal: 10,
                paddingVertical: 6,
                marginTop: 2,
              }}
            >
              <TextWidget
                text={today.text || (today.hasPhoto ? 'a photo you saved 📷' : 'a moment you saved')}
                maxLines={2}
                truncate="END"
                style={{ fontFamily: HAND, fontSize: 18, color: hex(props.ink) }}
              />
            </FlexWidget>
          ) : (
            <TextWidget text="What's one small thing from today?" maxLines={2} style={{ fontFamily: HAND, fontSize: 19, color: onPage, marginTop: 2 }} />
          )}
          <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
            <FlexWidget
              clickAction="OPEN_URI"
              clickActionData={{ uri: 'yearbook:///entry' }}
              accessibilityLabel={today ? "Edit today's memory" : "Write today's memory"}
              style={{ backgroundColor: hex(today ? '#2DB86A' : year.primary), borderRadius: 16, paddingHorizontal: 12, paddingVertical: 3 }}
            >
              <TextWidget text={today ? '✎ edit' : '+ add today'} style={{ fontFamily: HAND_BOLD, fontSize: 17, color: hex(props.paperWhite) }} />
            </FlexWidget>
            {props.letters > 0 ? (
              <TextWidget
                clickAction="OPEN_URI"
                clickActionData={{ uri: 'yearbook:///' }}
                text={props.letters === 1 ? '💌 a letter!' : `💌 ${props.letters} letters!`}
                style={{ fontFamily: HAND_BOLD, fontSize: 17, color: hex(year.primary) }}
              />
            ) : props.streak > 1 ? (
              <TextWidget text={`${props.streak} days 🔥`} style={{ fontFamily: HAND_BOLD, fontSize: 17, color: onPageMuted }} />
            ) : null}
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>
      {/* Taped to the home screen. */}
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'center' }}>
        <SvgWidget svg={tape(year.primary, '#FFFFFF')} style={{ width: TAPE_W, height: TAPE_H, rotation: -3 }} />
      </FlexWidget>
    </OverlapWidget>
  );
}

export const TODAY_WIDGET = 'Today';
