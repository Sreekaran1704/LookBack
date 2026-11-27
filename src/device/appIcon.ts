import { getAppIconName, setAlternateAppIcon, supportsAlternateIcons } from 'expo-alternate-app-icons';
import { Platform } from 'react-native';
import { entriesRepository, settingsRepository } from '../data';
import { iconStateFor, type IconState } from '../lib/appIcon';
import { toLocalDate } from '../lib/dates';
import { iconNameFor } from '../theme/cassettes';

const MOODS: IconState[] = ['Default', 'Waiting', 'Missed', 'Gone'];
/** A mood picked by hand (developer tool) is kept this long before the real one takes over again. */
const MANUAL_HOLD_MS = 10 * 60 * 1000;
let manualUntil = 0;

type IconName = Parameters<typeof setAlternateAppIcon>[0];

/** Developer tool: moves the icon on to its next mood (whole → waiting → cracked → shattered → whole). Returns the new one. */
export async function cycleAppIcon(): Promise<IconState> {
  const { cassette } = await settingsRepository.getLook();
  const current = getAppIconName() ?? null;
  const at = MOODS.findIndex((m) => iconNameFor(cassette, m) === current);
  const next = MOODS[(Math.max(0, at) + 1) % MOODS.length] ?? 'Default';
  manualUntil = Date.now() + MANUAL_HOLD_MS;
  await setAlternateAppIcon(iconNameFor(cassette, next) as IconName);
  return next;
}

/**
 * Switches the launcher icon to the person's cassette (You → Look) in its current state (see lib/appIcon.ts). Only
 * called while the app is in the background (leaving the app, or the widget's half-hourly refresh): on Android the
 * icon is an activity alias, and swapping it in the foreground can close the open screen.
 */
export async function syncAppIcon(now: Date = new Date()): Promise<void> {
  if (!supportsAlternateIcons || Platform.OS === 'web' || now.getTime() < manualUntil) return;
  try {
    const [dates, look] = await Promise.all([entriesRepository.listDates(), settingsRepository.getLook()]);
    const state = iconStateFor(dates, toLocalDate(now), now.getHours());
    const want = iconNameFor(look.cassette, state);
    if ((getAppIconName() ?? null) === want) return;
    await setAlternateAppIcon(want as IconName);
  } catch (error) {
    console.warn('[app icon] could not switch', error);
  }
}
