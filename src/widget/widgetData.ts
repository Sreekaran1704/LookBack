import { entriesRepository, settingsRepository, widgetPhoto } from '../data';
import { sharingRepository } from '../data/sharingRepository';
import { iconStateFor } from '../lib/appIcon';
import { addDays, formatMonthDay, matchesOnThisDay, parseLocalDate, toLocalDate, yearProgress } from '../lib/dates';
import { formatVoiceMs } from '../lib/voice';
import { cassetteStyle, makeTheme } from '../theme';
import type { PersonWidgetProps } from './PersonWidget';
import type { TodayWidgetProps } from './TodayWidget';

const LINE_LIMIT = 90;
const WORDS_LIMIT = 220;

/** Everything the Today widget shows, read through the repositories (it runs without the app open). */
export async function loadTodayWidget(now: Date = new Date()): Promise<TodayWidgetProps> {
  const todayDate = toLocalDate(now);
  const [entry, dates, look] = await Promise.all([
    entriesRepository.getByDate(todayDate),
    entriesRepository.listDates(),
    settingsRepository.getLook(),
  ]);
  const theme = makeTheme(look);
  let streak = 0;
  for (let d = entry ? todayDate : addDays(todayDate, -1); dates.includes(d); d = addDays(d, -1)) streak += 1;
  const text = entry?.text.trim() ?? '';
  // What the widget shows follows what today holds: a photo first (the strongest picture), then a voice note, then words.
  const photo = entry?.photoPath ? await widgetPhoto(entry.photoPath) : null;
  const kind: TodayWidgetProps['kind'] = !entry ? 'empty' : photo ? 'photo' : entry.voicePath ? 'voice' : 'words';
  return {
    kind,
    today: entry ? { id: entry.id, text: text.split('\n').slice(0, 2).join(' ').slice(0, LINE_LIMIT), hasPhoto: entry.photoPath !== null, hasVoice: entry.voicePath !== null } : null,
    words: text.slice(0, WORDS_LIMIT),
    photo,
    voiceLabel: entry?.voicePath ? `${entry.voiceTitle || 'your voice'} · ${formatVoiceMs(entry.voiceMs)}` : null,
    dateLabel: formatMonthDay(todayDate),
    weekday: now.toLocaleDateString('en-US', { weekday: 'long' }),
    yearProgress: yearProgress(todayDate),
    state: iconStateFor(dates, todayDate, now.getHours()),
    letters: dates.filter((d) => d < todayDate && matchesOnThisDay(d, todayDate)).length,
    streak,
    paper: theme.paper,
    dark: theme.dark,
    year: theme.year(parseLocalDate(todayDate).year),
    ink: theme.colors.ink,
    inkMuted: theme.colors.inkMuted,
    paperWhite: theme.colors.paperWhite,
    cassette: cassetteStyle(look.cassette),
  };
}

/** "just now", "2h ago", "yesterday", "3 days ago", "Nov 14". */
export function sinceLabel(iso: string, now: Date = new Date()): string {
  const ms = now.getTime() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 2) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return formatMonthDay(toLocalDate(new Date(iso)));
}

/**
 * The "From your person" widget: the newest page from the person picked for it on their page in Shared (or, until
 * someone is picked, whoever gave you something last).
 */
export async function loadPersonWidget(now: Date = new Date()): Promise<PersonWidgetProps> {
  const [letters, people, look, pinned] = await Promise.all([
    sharingRepository.letters(),
    sharingRepository.people(),
    settingsRepository.getLook(),
    settingsRepository.getWidgetPerson(),
  ]);
  const theme = makeTheme(look);
  const newest = [...letters].sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));
  const personId = pinned ?? newest[0]?.senderId ?? people[0]?.id ?? null;
  const letter = personId ? (newest.find((l) => l.senderId === personId) ?? null) : null;
  const person = people.find((p) => p.id === personId) ?? null;
  const name = person?.name ?? letter?.senderName ?? null;
  const photo = letter?.photoPath ? await widgetPhoto(letter.photoPath) : null;
  return {
    personId,
    name,
    letter: letter
      ? {
          id: letter.id,
          words: letter.body.trim().slice(0, WORDS_LIMIT),
          photo,
          voiceLabel: letter.voicePath ? `${letter.voiceTitle || 'their voice'} · ${formatVoiceMs(letter.voiceMs)}` : null,
          since: sinceLabel(letter.receivedAt, now),
          unread: !letter.openedAt,
          day: formatMonthDay(letter.memoryDate),
        }
      : null,
    paper: theme.paper,
    cassette: cassetteStyle(look.cassette),
  };
}
