import {
  FlexWidget,
  ImageWidget,
  OverlapWidget,
  SvgWidget,
  TextWidget,
  type HexColor,
} from "react-native-android-widget";
import type { IconState } from "../lib/appIcon";
import type { CassetteStyle } from "../theme/cassettes";
import type { Paper } from "../theme/papers";
import type { YearPalette } from "../theme/yearColors";
import { cassetteSvg } from "./cassetteSvg";

export interface TodayWidgetProps {
  /** What today holds, which decides what the widget is: a polaroid, a diary page, the cassette, or a blank tape. */
  kind: "empty" | "words" | "photo" | "voice";
  /** Today's page, if written: its first lines (or a photo note) and its id. */
  today: {
    id: string;
    text: string;
    hasPhoto: boolean;
    hasVoice: boolean;
  } | null;
  /** Today's words, longer (for the diary page). */
  words: string;
  /** Today's photo as a small data URI (for the polaroid). */
  photo: string | null;
  /** "your voice · 0:42". */
  voiceLabel: string | null;
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
  /** The person's cassette (You → Look). */
  cassette: CassetteStyle;
}

/** The widget's fonts are registered in app.json (react-native-android-widget → fonts). */
export const PRINT = "IMFellEnglish_400Regular_Italic";
export const HAND = "Caveat_600SemiBold";
/** The stage the cassette sits on: near-black, lit from behind in the paper's color. */
const STAGE = "#0B0B0C";
const LETTERING = "#EDE3CC";
const LETTERING_SOFT = "#9E978A";
const RED = "#C8372B";
/** Instant film: a matte white card, the print sunk into it. */
const FILM = "#FBFAF5";
const FILM_SHADE = "#E7E3D8";
/** Ink on paper. */
const PEN = "#23304A";
const RULE = "#C9BFAA";
const MARGIN = "#D98A86";

export const hex = (c: string) => c.slice(0, 7) as HexColor;

/** The glow behind the cassette: a soft pool of the paper's accent, as if a lamp were on it. */
export function glow(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200" preserveAspectRatio="none"><defs><radialGradient id="g" cx="0.5" cy="0.42" r="0.6"><stop offset="0" stop-color="${color}" stop-opacity="0.55"/><stop offset="0.55" stop-color="${color}" stop-opacity="0.12"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><rect width="400" height="200" fill="url(#g)"/></svg>`;
}

/** A ruled diary page: faint blue-grey lines and a red margin, stretched to the card. */
export function ruled(): string {
  const lines = Array.from(
    { length: 9 },
    (_, i) =>
      `<rect x="0" y="${30 + i * 22}" width="400" height="1" fill="${RULE}"/>`,
  ).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="220" viewBox="0 0 400 220" preserveAspectRatio="none">${lines}<rect x="34" y="0" width="1.5" height="220" fill="${MARGIN}"/></svg>`;
}

/** What the blank tape's label says: what state the tape is in. */
function blankLine(p: TodayWidgetProps): string {
  if (p.state === "Gone") return "it broke while you were away";
  if (p.state === "Missed") return "cracked. a day went unwritten";
  if (p.state === "Waiting") return "still blank. what's weighing on you?";
  return "blank tape, waiting for today";
}

/** The foot line: write / edit today on the left, letters from the past or the streak on the right. */
function Foot({ p, light }: { p: TodayWidgetProps; light: boolean }) {
  const soft = light ? hex(p.inkMuted) : hex(LETTERING_SOFT);
  return (
    <FlexWidget
      style={{
        width: "match_parent",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 6,
      }}
    >
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: "yearbook:///entry" }}
        accessibilityLabel={
          p.today ? "Edit today's page" : "Write today's page"
        }
        style={{
          borderRadius: 12,
          borderWidth: 1,
          borderColor: hex(p.paper.dots),
          paddingHorizontal: 12,
          paddingVertical: 2,
        }}
      >
        <TextWidget
          text={p.today ? "✎ edit today" : "● record today"}
          style={{
            fontFamily: PRINT,
            fontSize: 14,
            color: p.today ? (light ? hex(p.ink) : hex(LETTERING)) : hex(RED),
          }}
        />
      </FlexWidget>
      {p.letters > 0 ? (
        <TextWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: "yearbook:///" }}
          text={
            p.letters === 1
              ? "💌 a letter from your past self"
              : `💌 ${p.letters} letters from your past self`
          }
          style={{ fontFamily: PRINT, fontSize: 13, color: hex(p.paper.dots) }}
        />
      ) : (
        <TextWidget
          text={p.streak > 1 ? `${p.streak} days in a row` : `${p.weekday}`}
          style={{ fontFamily: PRINT, fontSize: 14, color: soft }}
        />
      )}
    </FlexWidget>
  );
}

/**
 * The home-screen widget follows what today holds, so it never shows words written onto a tape recorder:
 *   photo  a polaroid of today's photo on the paper, the words (or the date) on its strip
 *   words  a ruled diary page with today's date and the words in pen
 *   voice  the person's cassette, today's recording named on its label, reels a year wound
 *   empty  the blank cassette on its dark stage, breaking like the app icon when days go unwritten
 * Tapping it opens today's page (or writes it).
 */
export function TodayWidget(props: TodayWidgetProps) {
  const { today, paper } = props;
  const open = today ? `yearbook:///memory/${today.id}` : "yearbook:///entry";

  if (props.kind === "photo" && props.photo) {
    const strip =
      props.words.split("\n")[0] || `${props.dateLabel} · ${props.weekday}`;
    return (
      <FlexWidget
        style={{
          height: "match_parent",
          width: "match_parent",
          borderRadius: 24,
          backgroundColor: hex(paper.light),
          flexDirection: "column",
          alignItems: "center",
          paddingHorizontal: 14,
          paddingTop: 12,
          paddingBottom: 8,
        }}
      >
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: open }}
          accessibilityLabel="Open today's page"
          style={{
            flex: 1,
            width: "match_parent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <FlexWidget
            style={{
              backgroundColor: hex(FILM),
              borderRadius: 3,
              padding: 8,
              paddingBottom: 6,
              rotation: -2,
              flexDirection: "column",
              alignItems: "center",
              borderWidth: 1,
              borderColor: hex(FILM_SHADE),
            }}
          >
            <ImageWidget
              image={props.photo as `data:image${string}`}
              imageWidth={150}
              imageHeight={120}
              resizeMode="cover"
              radius={1}
            />
            <TextWidget
              text={strip}
              maxLines={1}
              truncate="END"
              style={{
                fontFamily: HAND,
                fontSize: 17,
                color: hex(PEN),
                marginTop: 4,
                width: 150,
                textAlign: "center",
              }}
            />
          </FlexWidget>
        </FlexWidget>
        <Foot p={props} light />
      </FlexWidget>
    );
  }

  if (props.kind === "words") {
    return (
      <FlexWidget
        style={{
          height: "match_parent",
          width: "match_parent",
          borderRadius: 24,
          backgroundColor: hex(paper.light),
          flexDirection: "column",
          paddingHorizontal: 14,
          paddingTop: 12,
          paddingBottom: 8,
        }}
      >
        <FlexWidget style={{ flex: 1, width: "match_parent" }}>
          <OverlapWidget
            clickAction="OPEN_URI"
            clickActionData={{ uri: open }}
            accessibilityLabel="Open today's page"
            style={{
              height: "match_parent",
              width: "match_parent",
              borderRadius: 6,
              backgroundColor: hex(props.paperWhite),
            }}
          >
            <SvgWidget
              svg={ruled()}
              style={{ height: "match_parent", width: "match_parent" }}
            />
            <FlexWidget
              style={{
                height: "match_parent",
                width: "match_parent",
                flexDirection: "column",
                paddingLeft: 28,
                paddingRight: 12,
                paddingTop: 6,
              }}
            >
              <TextWidget
                text={`${props.weekday}, ${props.dateLabel}`}
                style={{
                  fontFamily: PRINT,
                  fontSize: 13,
                  color: hex(props.inkMuted),
                }}
              />
              <TextWidget
                text={props.words}
                maxLines={5}
                truncate="END"
                style={{
                  fontFamily: HAND,
                  fontSize: 19,
                  color: hex(PEN),
                  marginTop: 2,
                }}
              />
            </FlexWidget>
          </OverlapWidget>
        </FlexWidget>
        <Foot p={props} light />
      </FlexWidget>
    );
  }

  const tape = cassetteSvg({
    title:
      props.kind === "voice"
        ? (props.voiceLabel ?? `${props.dateLabel} · ${props.weekday}`)
        : `${props.dateLabel} · ${props.weekday}`,
    line:
      props.kind === "voice"
        ? `${props.dateLabel} · ${props.weekday}`
        : blankLine(props),
    detail: props.streak > 1 ? `${props.streak} DAYS` : "C·365",
    state: today ? "Default" : props.state,
    letters: props.letters,
    played: props.yearProgress,
    hand: HAND,
    print: PRINT,
    style: props.cassette,
  });
  return (
    <OverlapWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        borderRadius: 24,
        backgroundColor: hex(STAGE),
      }}
    >
      <SvgWidget
        svg={glow(paper.dots)}
        style={{ height: "match_parent", width: "match_parent" }}
      />
      <FlexWidget
        style={{
          height: "match_parent",
          width: "match_parent",
          flexDirection: "column",
          alignItems: "center",
          paddingHorizontal: 14,
          paddingTop: 10,
          paddingBottom: 8,
        }}
      >
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: open }}
          accessibilityLabel={
            today ? "Listen to today's recording" : "Write today's page"
          }
          style={{
            flex: 1,
            width: "match_parent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <SvgWidget
            svg={tape}
            style={{ height: "match_parent", width: "match_parent" }}
          />
        </FlexWidget>
        <Foot p={props} light={false} />
      </FlexWidget>
    </OverlapWidget>
  );
}

export const TODAY_WIDGET = "Today";
