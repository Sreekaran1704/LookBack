import { PermissionsAndroid, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

interface LookBackNearbyModule {
  isReady(): boolean;
  startAnnouncing(token: string): void;
  stopAnnouncing(): void;
  startListening(): void;
  stopListening(): void;
  heardTokens(): string[];
  openSettings(): void;
}

const native = Platform.OS === 'android' ? requireOptionalNativeModule<LookBackNearbyModule>('LookBackNearby') : null;

/** Nearby giving works on this phone at all (Android with Bluetooth Low Energy, for now). */
export const nearbySupported = native !== null;

/** Asks for the Bluetooth permissions nearby giving needs. True when granted. */
export async function allowNearby(): Promise<boolean> {
  if (!native || Platform.OS !== 'android') return false;
  const wanted =
    Number(Platform.Version) >= 31
      ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const result = await PermissionsAndroid.requestMultiple(wanted);
  return wanted.every((p) => result[p] === PermissionsAndroid.RESULTS.GRANTED);
}
/** Bluetooth is on. */
export function bluetoothReady(): boolean {
  return native?.isReady() ?? false;
}
export function startAnnouncing(token: string): void {
  native?.startAnnouncing(token);
}
export function stopAnnouncing(): void {
  native?.stopAnnouncing();
}
export function startListening(): void {
  native?.startListening();
}
export function stopListening(): void {
  native?.stopListening();
}
/** Tokens heard in the last few seconds, closest first. */
export function heardTokens(): string[] {
  return native?.heardTokens() ?? [];
}
export function openBluetoothSettings(): void {
  native?.openSettings();
}

