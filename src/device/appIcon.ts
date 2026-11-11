import { getAppIconName, setAlternateAppIcon, supportsAlternateIcons } from 'expo-alternate-app-icons';
import { Platform } from 'react-native';
import { entriesRepository } from '../data';
import { iconStateFor, type IconState } from '../lib/appIcon';
import { toLocalDate } from '../lib/dates';

const MOODS: (IconState | null)[] = [null, 'Waiting', 'Missed', 'Gone'];
/** A mood picked by hand (developer tool) is kept this long before the real one takes over again. */
const MANUAL_HOLD_MS = 10 * 60 * 1000;
let manualUntil = 0;

/** Developer tool: moves the icon on to its next mood (happy → pleading → crying → wailing → happy). Returns the new one. */
export async function cycleAppIcon(): Promise<IconState> {
  const current = getAppIconName() ?? null;
  const next = MOODS[(MOODS.indexOf(current as IconState | null) + 1) % MOODS.length] ?? null;
  manualUntil = Date.now() + MANUAL_HOLD_MS;
  await setAlternateAppIcon(next);
  return next ?? 'Default';
}

/**
 * Switches the launcher icon to the bunny's current mood (see lib/appIcon.ts). Only called while the
 * app is in the background (leaving the app, or the widget's half-hourly refresh): on Android the
 * icon is an activity alias, and swapping it in the foreground can close the open screen.
 */
export async function syncAppIcon(now: Date = new Date()): Promise<void> {
  if (!supportsAlternateIcons || Platform.OS === 'web' || now.getTime() < manualUntil) return;
  try {
    const dates = await entriesRepository.listDates();
    const state = iconStateFor(dates, toLocalDate(now), now.getHours());
    const want = state === 'Default' ? null : state;
    if ((getAppIconName() ?? null) === want) return;
    await setAlternateAppIcon(want);
  } catch (error) {
    console.warn('[app icon] could not switch', error);
  }
}
