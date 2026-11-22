import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { fromBase64Url, publicKeyOf, signHandshake, toBase64Url, type Handshake } from '../../lib/identity';

/**
 * This phone's own key (see lib/identity.ts). The secret half never leaves the phone's secure storage (Android
 * Keystore-backed); only the public half is shared, in your code and with the pages you give.
 */
const STORE_KEY = 'lookback.identity.v1';
let cached: { secret: Uint8Array; publicKey: string } | null = null;

async function load(): Promise<{ secret: Uint8Array; publicKey: string }> {
  if (cached) return cached;
  let secret = fromBase64Url((await SecureStore.getItemAsync(STORE_KEY)) ?? '');
  if (!secret || secret.length !== 32) {
    secret = Crypto.getRandomBytes(32);
    await SecureStore.setItemAsync(STORE_KEY, toBase64Url(secret));
  }
  cached = { secret, publicKey: publicKeyOf(secret) };
  return cached;
}

/** This phone's public key (made the first time it's needed). */
export async function myPublicKey(): Promise<string> {
  return (await load()).publicKey;
}

/** Signs one side of a page's connection. */
export async function signMine(h: Handshake): Promise<string> {
  return signHandshake((await load()).secret, h);
}
