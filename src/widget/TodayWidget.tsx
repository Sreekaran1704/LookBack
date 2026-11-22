import { FlexWidget, OverlapWidget, SvgWidget, TextWidget, type HexColor } from 'react-native-android-widget';
import type { IconState } from '../lib/appIcon';
import type { Paper } from '../theme/papers';
import type { YearPalette } from '../theme/yearColors';
import { cassetteSvg } from './cassetteSvg';

export interface TodayWidgetProps {
  /** Today's page, if written: its first lines (or a photo note) and its id. */
  today: { id: string; text: string; hasPhoto: boolean; hasVoice: boolean } | null;
  /** "Nov 11". */
  dateLabel: string;
  /** "Saturday". */
  weekday: string;
  /** How many pages from past years came back today. */
  letters: number;
  /** Days in a row with a page, counting today if written. */
  streak: number;
  /** How far through the year today is (0–1): the tape wound onto the right reel. */
  yearProgress: number;
  /** The cassette's state, the same as the app icon's: whole, waiting, cracked, shattered. */
  state: IconState;
  paper: Paper;
  dark: boolean;
  year: YearPalette;
  ink: string;
  inkMuted: string;
  paperWhite: string;
}

/** The widget's fonts are registered in app.json (react-native-android-widget → fonts). */
const PRINT = 'IMFellEnglish_400Regular_Italic';
const HAND = 'Caveat_600SemiBold';
/** The stage the cassette sits on: near-black, lit from behind in the paper's color. */
const STAGE = '#0B0B0C';
const LETTERING = '#EDE3CC';
const LETTERING_SOFT = 'rgba(237, 227, 204, 0.62)';
const RED = '#C8372B';

const hex = (c: string) => c.slice(0, 7) as HexColor;

/** The glow behind the cassette: a soft pool of the paper's accent, as if a lamp were on it. */
function glow(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200" preserveAspectRatio="none"><defs><radialGradient id="g" cx="0.5" cy="0.42" r="0.6"><stop offset="0" stop-color="${color}" stop-opacity="0.55"/><stop offset="0.55" stop-color="${color}" stop-opacity="0.12"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><rect width="400" height="200" fill="url(#g)"/></svg>`;
}

/** What the label's second line says: today's words, or what state the tape is in. */
function labelLine(p: TodayWidgetProps): string {
  if (p.today) {
    if (p.today.text) return p.today.text.slice(0, 40);
    return p.today.hasVoice ? 'your voice, on tape' : 'a photo, tucked in';
  }
  if (p.state === 'Gone') return 'it broke while you were away';
  if (p.state === 'Missed') return 'cracked. a day went unwritten';
  if (p.state === 'Waiting') return "still blank. what's weighing on you?";
  return 'blank tape, waiting for today';
}

/**
 * The home-screen widget is the diary's cassette, big, on a dark stage lit from behind in the paper's color. Its label is
 * today, in handwriting: the date, and the first words you wrote (or "blank tape, waiting for today"). The tape on its
 * reels is the year so far. It breaks the way the app icon does when days go unwritten, and when a past year has come
 * back a red "a letter waiting" postmark is struck across it. Under it, one line: write or open today, and the letters
 * or the streak. Tap the cassette to write today's page (or open it once written).
 */
export function TodayWidget(props: TodayWidgetProps) {
  const { today, paper } = props;
  const open = today ? `yearbook:///memory/${today.id}` : 'yearbook:///entry';
  const detail = props.streak > 1 ? `${props.streak} DAYS` : 'C·365';
  const tape = cassetteSvg({
    title: `${props.dateLabel} · ${props.weekday}`,
    line: labelLine(props),
    detail,
    state: today ? 'Default' : props.state,
    letters: props.letters,
    played: props.yearProgress,
    hand: HAND,
    print: PRINT,
  });

  return (
    <OverlapWidget style={{ height: 'match_parent', width: 'match_parent', borderRadius: 24, backgroundColor: hex(STAGE) }}>
      <SvgWidget svg={glow(paper.dots)} style={{ height: 'match_parent', width: 'match_parent' }} />
      <FlexWidget style={{ height: 'match_parent', width: 'match_parent', flexDirection: 'column', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8 }}>
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: open }}
          accessibilityLabel={today ? "Open today's page" : "Write today's page"}
          style={{ flex: 1, width: 'match_parent', alignItems: 'center', justifyContent: 'center' }}
        >
          <SvgWidget svg={tape} style={{ height: 'match_parent', width: 'match_parent' }} />
        </FlexWidget>
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <FlexWidget
            clickAction="OPEN_URI"
            clickActionData={{ uri: 'yearbook:///entry' }}
            accessibilityLabel={today ? "Edit today's page" : "Write today's page"}
            style={{ borderRadius: 12, borderWidth: 1, borderColor: hex(paper.dots), paddingHorizontal: 12, paddingVertical: 2 }}
          >
            <TextWidget text={today ? '✎ edit today' : '● record today'} style={{ fontFamily: PRINT, fontSize: 14, color: today ? hex(LETTERING) : hex(RED) }} />
          </FlexWidget>
          {props.letters > 0 ? (
            <TextWidget
              clickAction="OPEN_URI"
              clickActionData={{ uri: 'yearbook:///' }}
              text={props.letters === 1 ? 'a letter from your past self' : `${props.letters} letters from your past self`}
              style={{ fontFamily: PRINT, fontSize: 14, color: hex(paper.dots) }}
            />
          ) : (
            <TextWidget text={props.streak > 1 ? `${props.streak} days on tape` : 'LookBack'} style={{ fontFamily: PRINT, fontSize: 14, color: LETTERING_SOFT }} />
          )}
        </FlexWidget>
      </FlexWidget>
    </OverlapWidget>
  );
}

export const TODAY_WIDGET = 'Today';
