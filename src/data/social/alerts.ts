import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { socialClient } from './client';
import { rpc } from './repository';

/**
 * Alerts like Blip's: when you give someone a page and their LookBack is closed, they get a notification ("Sree has a
 * page for you") through Firebase Cloud Messaging, sent by the server's `alert` function. The alert carries no part of
 * the memory: tapping it opens LookBack, and the page comes across phone to phone.
 */

let listening = false;

/** Tells the server where to reach this phone (its push address), and keeps it current. */
export async function registerForAlerts(): Promise<void> {
  if (Platform.OS !== 'android' || !socialClient) return;
  const { data } = await Notifications.getDevicePushTokenAsync();
  if (typeof data === 'string' && data) await rpc('save_push_token', { p_token: data });
  if (listening) return;
  listening = true;
  Notifications.addPushTokenListener(({ data: next }) => {
    if (typeof next === 'string' && next) void rpc('save_push_token', { p_token: next }).catch(() => undefined);
  });
}

/** Signing out: no more alerts to this phone. */
export async function forgetAlerts(): Promise<void> {
  await rpc('forget_push_token', {}).catch(() => undefined);
}

/** Sends someone the alert that you have a page for them. */
export async function alertPerson(to: string, name: string): Promise<boolean> {
  if (!socialClient) return false;
  const { data, error } = await socialClient.functions.invoke<{ sent?: boolean }>('alert', { body: { to, name } });
  return !error && !!data?.sent;
}
