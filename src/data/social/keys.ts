import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { fromBase64Url, publicKeyOf, signHandshake, toBase64Url, type Handshake } from '../../lib/identity';
import { openEnvelope, sealPage, type SealedHead } from '../../lib/mailbox';

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

/** Seals a page for someone's phone (their phone key), signed with this phone's key (see lib/mailbox.ts). */
export async function sealForThem(o: { gift: string; from: string; to: string; recipientKey: string; page: Uint8Array }): Promise<Uint8Array> {
  const { secret } = await load();
  return sealPage({ ...o, senderSecret: secret, random: (n) => Crypto.getRandomBytes(n) });
}

/** Opens an envelope sealed for this phone, if it was signed by `senderKey`. Null if it can't be. */
export async function openForMe(o: { head: SealedHead; sealed: Uint8Array; me: string; senderKey: string }): Promise<Uint8Array | null> {
  const { secret } = await load();
  return openEnvelope({ ...o, recipientSecret: secret });
}
