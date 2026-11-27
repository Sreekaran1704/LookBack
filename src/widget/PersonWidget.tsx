import { FlexWidget, ImageWidget, OverlapWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import type { CassetteStyle } from '../theme/cassettes';
import type { Paper } from '../theme/papers';
import { cassetteSvg } from './cassetteSvg';
import { HAND, hex, PRINT } from './TodayWidget';

export interface PersonWidgetProps {
  /** Whose pages it shows (null: no one to show yet). */
  personId: string | null;
  name: string | null;
  /** Their newest page to you. */
  letter: {
    id: string;
    words: string;
    photo: string | null;
    voiceLabel: string | null;
    /** "2h ago". */
    since: string;
    unread: boolean;
    /** The day the page is from ("Nov 14"). */
    day: string;
  } | null;
  paper: Paper;
  cassette: CassetteStyle;
}

/** Love-letter colors: blush paper, rose ink, a red wax seal. */
const BLUSH = '#F8E9E4';
const BLUSH_DEEP = '#EED4CC';
const NOTE = '#FFFBF5';
const ROSE = '#9E3B4A';
const ROSE_SOFT = '#B7707B';
const PEN = '#3A2A55';
const FILM = '#FBFAF5';

/** A red wax seal pressed with a heart. */
function seal(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><defs><radialGradient id="w" cx="0.38" cy="0.32" r="0.7"><stop offset="0" stop-color="#E0565E"/><stop offset="0.6" stop-color="#A8222E"/><stop offset="1" stop-color="#6E1018"/></radialGradient></defs><path d="M40 4 C52 6 58 2 66 12 C76 20 74 30 76 40 C78 52 70 58 64 66 C56 76 48 74 40 76 C28 78 22 72 14 66 C4 58 6 50 4 40 C2 28 10 22 16 14 C24 4 30 6 40 4 Z" fill="url(#w)"/><circle cx="40" cy="40" r="25" fill="none" stroke="#6E1018" stroke-opacity="0.5" stroke-width="2"/><path d="M40 54 C28 45 24 39 24 33 C24 27 29 24 33 24 C36.5 24 39 26 40 29 C41 26 43.5 24 47 24 C51 24 56 27 56 33 C56 39 52 45 40 54 Z" fill="#7E1420" fill-opacity="0.75"/><path d="M30 20 C34 16 40 15 45 16" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;
}

/** Soft hearts drifting up the corner of the paper. */
function hearts(): string {
  const heart = (x: number, y: number, s: number, o: number) =>
    `<path transform="translate(${x} ${y}) scale(${s})" d="M10 17 C4 12.5 1 9.5 1 6 C1 3 3.5 1 6 1 C7.8 1 9.2 2 10 3.6 C10.8 2 12.2 1 14 1 C16.5 1 19 3 19 6 C19 9.5 16 12.5 10 17 Z" fill="${ROSE_SOFT}" fill-opacity="${o}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240" viewBox="0 0 400 240" preserveAspectRatio="xMaxYMin slice">${heart(352, 18, 1.1, 0.35)}${heart(372, 52, 0.7, 0.25)}${heart(338, 70, 0.55, 0.2)}${heart(20, 200, 0.8, 0.18)}</svg>`;
}

/**
 * "From your person": the newest page your person gave you, kept on your home screen like a note tucked in a mirror's
 * frame. Blush paper with soft hearts, their name in handwriting by a red wax seal, when it came. Their page as it is:
 * a polaroid for a photo, their words in pen on a little note, or their cassette for a recording. A new one says so.
 * Tap to open it. Until they give you something, it waits for them.
 */
export function PersonWidget(p: PersonWidgetProps) {
  const name = p.name ?? 'your person';
  const open = p.letter ? `yearbook:///letter/${p.letter.id}` : p.personId ? `yearbook:///person/${p.personId}` : 'yearbook:///shared';
  const l = p.letter;

  let body;
  if (!l) {
    body = (
      <FlexWidget style={{ flex: 1, width: 'match_parent', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <TextWidget
          text={p.name ? `When ${p.name} gives you a page,` : 'Add your person in Shared,'}
          style={{ fontFamily: HAND, fontSize: 20, color: hex(PEN), textAlign: 'center' }}
        />
        <TextWidget text="it lands right here. ♡" style={{ fontFamily: HAND, fontSize: 20, color: hex(ROSE), textAlign: 'center' }} />
      </FlexWidget>
    );
  } else if (l.photo) {
    body = (
      <FlexWidget style={{ flex: 1, width: 'match_parent', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        <FlexWidget style={{ backgroundColor: hex(FILM), borderRadius: 3, padding: 7, paddingBottom: 5, rotation: 2, flexDirection: 'column', alignItems: 'center', borderWidth: 1, borderColor: hex(BLUSH_DEEP) }}>
          <ImageWidget image={l.photo as `data:image${string}`} imageWidth={132} imageHeight={104} resizeMode="cover" radius={1} />
          <TextWidget text={l.words.split('\n')[0] || l.day} maxLines={1} truncate="END" style={{ fontFamily: HAND, fontSize: 16, color: hex(PEN), marginTop: 3, width: 132, textAlign: 'center' }} />
        </FlexWidget>
      </FlexWidget>
    );
  } else if (l.voiceLabel && !l.words) {
    const tape = cassetteSvg({ title: l.voiceLabel, line: `from ${name} · tap to listen`, detail: l.day, state: 'Default', letters: 0, played: 0.3, hand: HAND, print: PRINT, style: p.cassette });
    body = (
      <FlexWidget style={{ flex: 1, width: 'match_parent', alignItems: 'center', justifyContent: 'center' }}>
        <SvgWidget svg={tape} style={{ height: 'match_parent', width: 'match_parent' }} />
      </FlexWidget>
    );
  } else {
    body = (
      <FlexWidget style={{ flex: 1, width: 'match_parent', backgroundColor: hex(NOTE), borderRadius: 6, borderWidth: 1, borderColor: hex(BLUSH_DEEP), paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'column' }}>
        <TextWidget text={l.words || l.voiceLabel || ''} maxLines={5} truncate="END" style={{ fontFamily: HAND, fontSize: 19, color: hex(PEN) }} />
        {l.voiceLabel ? <TextWidget text={`▶ ${l.voiceLabel}`} style={{ fontFamily: PRINT, fontSize: 12, color: hex(ROSE), marginTop: 2 }} /> : null}
      </FlexWidget>
    );
  }

  return (
    <OverlapWidget clickAction="OPEN_URI" clickActionData={{ uri: open }} accessibilityLabel={l ? `Open the page from ${name}` : `Pages from ${name}`} style={{ height: 'match_parent', width: 'match_parent', borderRadius: 24, backgroundColor: hex(BLUSH) }}>
      <SvgWidget svg={hearts()} style={{ height: 'match_parent', width: 'match_parent' }} />
      <FlexWidget style={{ height: 'match_parent', width: 'match_parent', flexDirection: 'column', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10 }}>
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <SvgWidget svg={seal()} style={{ width: 30, height: 30 }} />
          <FlexWidget style={{ flex: 1, flexDirection: 'column', marginLeft: 8 }}>
            <TextWidget text={`from ${name}`} maxLines={1} truncate="END" style={{ fontFamily: HAND, fontSize: 21, color: hex(ROSE) }} />
            <TextWidget text={l ? (l.unread ? `a new page for you · ${l.since}` : `${l.since} · a page from ${l.day}`) : 'nothing yet'} maxLines={1} style={{ fontFamily: PRINT, fontSize: 12, color: hex(ROSE_SOFT) }} />
          </FlexWidget>
        </FlexWidget>
        {body}
      </FlexWidget>
    </OverlapWidget>
  );
}

export const PERSON_WIDGET = 'Person';
