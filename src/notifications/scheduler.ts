import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';
import { entriesRepository, resolvePhotoUri, settingsRepository } from '../data';
import { onThisDay, toLocalDate } from '../lib/dates';
import { yearPalette } from '../theme/yearColors';
import { describeMemories, planReminders } from './planner';

/**
 * Android channels can't change their sound once created, so the chime gets a new channel id; the
 * old silent one is removed.
 */
const CHANNEL_ID = 'memories-chime';
const OLD_CHANNEL_IDS = ['memories'];
/** A soft three-note music box (assets/sounds/chime.wav, bundled by the expo-notifications plugin). */
const CHIME = 'chime.wav';
/** A gentle double tap rather than a buzz. */
const VIBRATION = [0, 40, 90, 40];
const MEMORY_KIND = 'memory';
const TEST_DELAY_SECONDS = 3;

let configured = false;
/** Android only: set once our channel exists. Until then, notifications use the default channel. */
let channelReady = false;

/**
 * Call once at startup. Never throws: a notification problem must not stop the app from opening.
 * (Expo Go on Android has been seen to reject setNotificationChannelAsync.)
 */
export async function configureNotifications(): Promise<void> {
  if (configured) return;
  configured = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        // A letter from your past self chimes even with the app open (it's at most once a day).
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Letters from your past self',
        description: 'A little note on days you saved a memory, a year (or more) ago.',
        importance: AndroidImportance.DEFAULT,
        sound: CHIME,
        vibrationPattern: VIBRATION,
        enableVibrate: true,
        lightColor: yearPalette(2025).primary,
      });
      await Promise.all(OLD_CHANNEL_IDS.map((id) => Notifications.deleteNotificationChannelAsync(id).catch(() => undefined)));
      channelReady = true;
    }
  } catch (error) {
    console.warn('[notifications] setup failed; reminders will use the default channel', error);
  }
}

function channelId(): string | undefined {
  return Platform.OS === 'android' && channelReady ? CHANNEL_ID : undefined;
}

export async function hasPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  return current.granted;
}

export async function requestPermission(): Promise<boolean> {
  if (await hasPermission()) return true;
  const result = await Notifications.requestPermissionsAsync();
  return result.granted;
}

async function cancelMemoryNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.kind === MEMORY_KIND)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/**
 * What a memory notification looks like: the bunny (large icon and status-bar icon come from the
 * expo-notifications plugin in app.json), tinted with the memory's year color, the chime, and on
 * iOS the memory's photo as a thumbnail.
 */
function memoryContent(
  item: { title: string; body: string; year: number; photoPath: string | null },
  data: Record<string, string>,
): Notifications.NotificationContentInput {
  return {
    title: item.title,
    body: item.body,
    data,
    color: yearPalette(item.year).primary,
    sound: CHIME,
    vibrate: VIBRATION,
    ...(Platform.OS === 'ios' && item.photoPath
      ? { attachments: [{ identifier: 'photo', url: resolvePhotoUri(item.photoPath), type: null, typeHint: 'public.jpeg' }] }
      : null),
  };
}

let queue: Promise<number> = Promise.resolve(0);

/**
 * Rebuilds the rolling 30-day window from stored entries. Safe to call often
 * (app open, after every save, settings change); calls are serialized.
 * Returns how many notifications are now scheduled.
 */
export function refreshReminders(): Promise<number> {
  queue = queue.catch(() => 0).then(async () => {
    await cancelMemoryNotifications();
    const settings = await settingsRepository.getReminder();
    if (!settings.enabled || !(await hasPermission())) return 0;

    const entries = await entriesRepository.getAll();
    const plan = planReminders(entries, {
      today: toLocalDate(),
      now: new Date(),
      hour: settings.hour,
      minute: settings.minute,
    });
    for (const item of plan) {
      await Notifications.scheduleNotificationAsync({
        identifier: item.identifier,
        content: memoryContent(item, { kind: MEMORY_KIND, localDate: item.localDate }),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: item.fireAt,
          channelId: channelId(),
        },
      });
    }
    return plan.length;
  });
  return queue;
}

/** Dev helper: fires a "one year ago" notification in a few seconds using today's real matches. */
export async function sendTestNotification(): Promise<boolean> {
  if (!(await requestPermission())) return false;
  const today = toLocalDate();
  const matches = onThisDay(await entriesRepository.getAll(), today);
  const content = matches.length
    ? describeMemories(matches, today)
    : {
        title: '💌 A little letter from your past self',
        body: 'One year ago today: (no memory for today yet — seed sample data first) 🐰',
        year: new Date().getFullYear() - 1,
        photoPath: null,
      };
  await Notifications.scheduleNotificationAsync({
    content: memoryContent(content, { kind: 'test', localDate: today }),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: TEST_DELAY_SECONDS,
      channelId: channelId(),
    },
  });
  return true;
}
