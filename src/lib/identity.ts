/**
 * Each phone's own key, so a page's connection can't be taken over, even by LookBack's server.
 *
 * The two phones agree on a direct, encrypted WebRTC connection by swapping its description (SDP) through the server.
 * That description carries the fingerprint of the encryption key the connection will use, so a server that rewrote it
 * could sit in the middle and read the page. Instead, each phone signs its description with its own Ed25519 key, and
 * the other phone checks the signature against the key it learned when you added that person (from their QR code, or
 * the first time they gave you a page, the way Signal does). A rewritten description fails the check and the
 * connection is dropped.
 *
 * Pure (no React Native imports), tested in __tests__/identity.test.ts. The secret key itself is kept in the phone's
 * secure storage by src/data/social/keys.ts.
 */
import { ed25519 } from '@noble/curves/ed25519.js';

/** A public key as text: 32 bytes, base64url without padding (43 characters). */
const KEY_TEXT = /^[A-Za-z0-9_-]{43}$/;
/** A signature as text: 64 bytes, base64url without padding (86 characters). */
const SIG_TEXT = /^[A-Za-z0-9_-]{86}$/;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function toBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]!;
    if (i + 1 < bytes.length) out += ALPHABET[(n >> 6) & 63]!;
    if (i + 2 < bytes.length) out += ALPHABET[n & 63]!;
  }
  return out;
}

export function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) return null;
  const bytes = new Uint8Array(Math.floor((text.length * 3) / 4));
  let at = 0;
  for (let i = 0; i < text.length; i += 4) {
    const v = [0, 1, 2, 3].map((k) => (i + k < text.length ? ALPHABET.indexOf(text[i + k]!) : 0));
    const n = (v[0]! << 18) | (v[1]! << 12) | (v[2]! << 6) | v[3]!;
    bytes[at++] = (n >> 16) & 255;
    if (i + 2 < text.length) bytes[at++] = (n >> 8) & 255;
    if (i + 3 < text.length) bytes[at++] = n & 255;
  }
  return bytes;
}

export const isPublicKey = (v: unknown): v is string => typeof v === 'string' && KEY_TEXT.test(v);
export const isSignature = (v: unknown): v is string => typeof v === 'string' && SIG_TEXT.test(v);

/** The public key (as text) for a 32-byte secret key. */
export function publicKeyOf(secret: Uint8Array): string {
  return toBase64Url(ed25519.getPublicKey(secret));
}

/** What a signature covers: which gift, who to whom, and the whole connection description. */
export interface Handshake {
  gift: string;
  from: string;
  to: string;
  type: 'offer' | 'answer';
  sdp: string;
}
function handshakeBytes(h: Handshake): Uint8Array {
  return new TextEncoder().encode(['lookback-sdp-v1', h.gift.toLowerCase(), h.from.toLowerCase(), h.to.toLowerCase(), h.type, h.sdp].join('\n'));
}

export function signHandshake(secret: Uint8Array, h: Handshake): string {
  return toBase64Url(ed25519.sign(handshakeBytes(h), secret));
}

/** True only when `sig` is this key's signature over exactly this handshake. */
export function verifyHandshake(publicKey: string, sig: string, h: Handshake): boolean {
  if (!isPublicKey(publicKey) || !isSignature(sig)) return false;
  const key = fromBase64Url(publicKey);
  const signature = fromBase64Url(sig);
  if (!key || !signature) return false;
  try {
    return ed25519.verify(signature, handshakeBytes(h), key, { zip215: false });
  } catch {
    return false;
  }
}
