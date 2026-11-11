import { entriesRepository, settingsRepository } from '../data';
import { addDays, formatMonthDay, matchesOnThisDay, parseLocalDate, toLocalDate } from '../lib/dates';
import { makeTheme } from '../theme';
import type { TodayWidgetProps } from './TodayWidget';

const LINE_LIMIT = 90;

/** Everything the widget shows, read through the repositories (it runs without the app open). */
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
  const firstLines = entry?.text.trim().split('\n').slice(0, 2).join(' ').slice(0, LINE_LIMIT) ?? '';
  return {
    today: entry ? { id: entry.id, text: firstLines, hasPhoto: entry.photoPath !== null } : null,
    dateLabel: formatMonthDay(todayDate),
    letters: dates.filter((d) => d < todayDate && matchesOnThisDay(d, todayDate)).length,
    streak,
    paper: theme.paper,
    dark: theme.dark,
    year: theme.year(parseLocalDate(todayDate).year),
    ink: theme.colors.ink,
    inkMuted: theme.colors.inkMuted,
    paperWhite: theme.colors.paperWhite,
  };
}
