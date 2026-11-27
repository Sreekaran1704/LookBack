/**
 * The sealed mailbox: how a page reaches someone whose phone can't be reached directly right now (offline, asleep in
 * another time zone, or behind a network that blocks direct connections). The giver's phone seals the page so only the
 * receiver's phone can open it, and leaves the envelope in a private box on the server; the receiver's phone picks it
 * up next time it's online, opens it and throws the envelope away.
 *
 *   sealed for them  a fresh X25519 key and the receiver's phone key (their Ed25519 key, as X25519) agree on a secret;
 *                    HKDF-SHA256 turns it into a key; XChaCha20-Poly1305 seals the page (tamper-evident)
 *   signed by you    the giver's phone key signs the envelope (which gift, who to whom, the sealing key, the nonce, a
 *                    hash of the sealed bytes), checked against the key the receiver knows for them
 *
 * The server only ever holds sealed bytes it can't open or change unnoticed. Pure (no React Native imports), tested
 * in __tests__/mailbox.test.ts. The phone's own secret key stays in social/keys.ts.
 */
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { ed25519, x25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { GIFT_FILE_MAX, parseHeader, type GiftHeader } from './giftProtocol';
import { fromBase64Url, isPublicKey, isSignature, toBase64Url } from './identity';

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAGIC = [0x4c, 0x42, 0x4d, 0x31]; // "LBM1"
const CONTEXT = 'lookback-mail-v1';
const HEAD_MAX = 4096;
/** The biggest envelope (a page's words, a photo and a recording, sealed). The server's box refuses more. */
export const MAIL_MAX = 2 * GIFT_FILE_MAX + 200_000;

/** The envelope's outside: who it's from and for, and what's needed to check and open it. */
export interface SealedHead {
  v: 1;
  gift: string;
  from: string;
  to: string;
  /** The giver's phone key (Ed25519, base64url). */
  key: string;
  /** The one-off X25519 key the page was sealed with (base64url). */
  eph: string;
  nonce: string;
  sig: string;
}

const utf8 = (s: string) => new TextEncoder().encode(s);
/** UTF-8 bytes to text (the phone's JS engine may not have TextDecoder). */
function fromUtf8(b: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(b);
  let out = '';
  for (let i = 0; i < b.length; ) {
    const c = b[i++]!;
    let cp = c;
    if (c >= 0xf0) cp = ((c & 7) << 18) | ((b[i++]! & 63) << 12) | ((b[i++]! & 63) << 6) | (b[i++]! & 63);
    else if (c >= 0xe0) cp = ((c & 15) << 12) | ((b[i++]! & 63) << 6) | (b[i++]! & 63);
    else if (c >= 0xc0) cp = ((c & 31) << 6) | (b[i++]! & 63);
    out += String.fromCodePoint(cp);
  }
  return out;
}
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};
const u32 = (n: number) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const readU32 = (b: Uint8Array, at: number) => ((b[at]! << 24) >>> 0) + (b[at + 1]! << 16) + (b[at + 2]! << 8) + b[at + 3]!;

/** Where an envelope lives in the box: under the receiver, then the giver (the server checks the giver is you). */
export function mailPath(to: string, from: string, gift: string): string {
  return `${to.toLowerCase()}/${from.toLowerCase()}/${gift.toLowerCase()}.lbm`;
}
export function parseMailPath(path: string): { to: string; from: string; gift: string } | null {
  const m = /^([0-9a-f-]{36})\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.lbm$/.exec(path.toLowerCase());
  if (!m || !ID.test(m[1]!) || !ID.test(m[2]!) || !ID.test(m[3]!)) return null;
  return { to: m[1]!, from: m[2]!, gift: m[3]! };
}

/** The page inside: its header (as on the direct channel), then the photo's bytes, then the voice's. */
export function packPage(header: GiftHeader, photo: Uint8Array | null, voice: Uint8Array | null): Uint8Array {
  const head = utf8(JSON.stringify(header));
  return concat(u32(head.length), head, photo ?? new Uint8Array(0), voice ?? new Uint8Array(0));
}
export function unpackPage(bytes: Uint8Array, gift: string): { header: GiftHeader; photo: Uint8Array | null; voice: Uint8Array | null } | null {
  if (bytes.length < 4) return null;
  const len = readU32(bytes, 0);
  if (len <= 0 || len > bytes.length - 4) return null;
  let header: GiftHeader | null;
  try {
    header = parseHeader(JSON.parse(fromUtf8(bytes.subarray(4, 4 + len))), gift);
  } catch {
    return null;
  }
  if (!header) return null;
  const photoSize = header.photo?.size ?? 0;
  const voiceSize = header.voice?.size ?? 0;
  if (4 + len + photoSize + voiceSize !== bytes.length) return null;
  const at = 4 + len;
  return {
    header,
    photo: header.photo ? bytes.slice(at, at + photoSize) : null,
    voice: header.voice ? bytes.slice(at + photoSize, at + photoSize + voiceSize) : null,
  };
}

function signedBytes(h: Omit<SealedHead, 'sig'>, sealed: Uint8Array): Uint8Array {
  return utf8([CONTEXT, h.gift, h.from, h.to, h.key, h.eph, h.nonce, toBase64Url(sha256(sealed))].join('\n'));
}
function sealKey(shared: Uint8Array, eph: Uint8Array, theirs: Uint8Array): Uint8Array {
  return hkdf(sha256, shared, concat(eph, theirs), utf8(CONTEXT), 32);
}
const aad = (gift: string, from: string, to: string) => utf8(`${CONTEXT}\n${gift}\n${from}\n${to}`);

/**
 * Seals a page for one person's phone and signs it with yours. `random(n)` gives n random bytes (the phone's secure
 * random). Returns the whole envelope as bytes.
 */
export function sealPage(o: { gift: string; from: string; to: string; senderSecret: Uint8Array; recipientKey: string; page: Uint8Array; random: (n: number) => Uint8Array }): Uint8Array {
  const gift = o.gift.toLowerCase();
  const from = o.from.toLowerCase();
  const to = o.to.toLowerCase();
  const theirEd = fromBase64Url(o.recipientKey);
  if (!isPublicKey(o.recipientKey) || !theirEd) throw new Error('No phone key for them yet.');
  const theirs = ed25519.utils.toMontgomery(theirEd);
  const ephSecret = o.random(32);
  const eph = x25519.getPublicKey(ephSecret);
  const key = sealKey(x25519.getSharedSecret(ephSecret, theirs), eph, theirs);
  const nonce = o.random(24);
  const sealed = xchacha20poly1305(key, nonce, aad(gift, from, to)).encrypt(o.page);
  const unsigned = { v: 1 as const, gift, from, to, key: toBase64Url(ed25519.getPublicKey(o.senderSecret)), eph: toBase64Url(eph), nonce: toBase64Url(nonce) };
  const sig = toBase64Url(ed25519.sign(signedBytes(unsigned, sealed), o.senderSecret));
  const head = utf8(JSON.stringify({ ...unsigned, sig }));
  return concat(new Uint8Array(MAGIC), u32(head.length), head, sealed);
}

/** Reads an envelope's outside (without opening it). Null if it isn't a well-formed envelope. */
export function readEnvelope(bytes: Uint8Array): { head: SealedHead; sealed: Uint8Array } | null {
  if (bytes.length < 8 || bytes.length > MAIL_MAX || MAGIC.some((b, i) => bytes[i] !== b)) return null;
  const len = readU32(bytes, 4);
  if (len <= 0 || len > HEAD_MAX || 8 + len >= bytes.length) return null;
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(fromUtf8(bytes.subarray(8, 8 + len))) as Record<string, unknown>;
  } catch {
    return null;
  }
  const ok =
    raw.v === 1 &&
    typeof raw.gift === 'string' &&
    ID.test(raw.gift) &&
    typeof raw.from === 'string' &&
    ID.test(raw.from) &&
    typeof raw.to === 'string' &&
    ID.test(raw.to) &&
    isPublicKey(raw.key) &&
    isPublicKey(raw.eph) &&
    typeof raw.nonce === 'string' &&
    fromBase64Url(raw.nonce)?.length === 24 &&
    isSignature(raw.sig);
  if (!ok) return null;
  return { head: raw as unknown as SealedHead, sealed: bytes.slice(8 + len) };
}

/**
 * Opens an envelope meant for this phone: the signature must be by `senderKey` (the key you know for them; the
 * envelope's own key the first time), and the seal must be unbroken. Returns the page's bytes, or null.
 */
export function openEnvelope(o: { head: SealedHead; sealed: Uint8Array; me: string; recipientSecret: Uint8Array; senderKey: string }): Uint8Array | null {
  const { head, sealed } = o;
  if (head.to !== o.me.toLowerCase() || head.key !== o.senderKey) return null;
  const { sig, ...unsigned } = head;
  const senderEd = fromBase64Url(head.key);
  const signature = fromBase64Url(sig);
  const eph = fromBase64Url(head.eph);
  const nonce = fromBase64Url(head.nonce);
  if (!senderEd || !signature || !eph || !nonce) return null;
  try {
    if (!ed25519.verify(signature, signedBytes(unsigned, sealed), senderEd, { zip215: false })) return null;
    const mineX = ed25519.utils.toMontgomerySecret(o.recipientSecret);
    const theirs = x25519.getPublicKey(mineX);
    const key = sealKey(x25519.getSharedSecret(mineX, eph), eph, theirs);
    return xchacha20poly1305(key, nonce, aad(head.gift, head.from, head.to)).decrypt(sealed);
  } catch {
    return null;
  }
}
