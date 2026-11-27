/**
 * Chat between friends (on the person page, once at least one page has passed between them): text, voice and
 * reactions, and quoting lines into today's page. Pure module (no React Native imports), tested in
 * __tests__/chat.test.ts.
 *
 * A message travels sealed for the other phone (lib/mailbox.ts sealPage, the same as a page in the mailbox): inside a
 * short note when both are online, or left in the sealed mailbox when not (voice always goes that way). Inside the
 * seal it is `CHAT_MAGIC`, one line of JSON, then the recording's bytes for a voice message. Pages and messages share
 * the mailbox; the magic tells them apart.
 */

export const CHAT_MAGIC = 'LBCHAT1\n';
/** The longest text message. */
export const TEXT_MAX = 2000;
/** The longest voice message (the same minute as a voice memory). */
export const VOICE_MAX_MS = 60_000;
/** The reactions offered (a reaction of '' takes yours away). */
export const REACTIONS = ['❤️', '😂', '😮', '😢', '😍', '👍'] as const;

export type ChatMessage =
  | { kind: 'text'; id: string; at: string; text: string }
  | { kind: 'voice'; id: string; at: string; ms: number; wave: number[]; ext: string }
  | { kind: 'react'; id: string; at: string; target: string; emoji: string }
  /** "I've seen these" (their ticks turn to seen; a seen message can't be deleted for everyone). */
  | { kind: 'read'; id: string; at: string; ids: string[] }
  /** Delete for everyone: take this message of mine away on your phone (and your Drive). */
  | { kind: 'unsend'; id: string; at: string; target: string };

/** The most message ids one "read" carries. */
export const READ_MAX = 200;

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const enc = new TextEncoder();
const dec = new TextDecoder();
const MAGIC = enc.encode(CHAT_MAGIC);

/** Message (and, for voice, the recording) → the bytes that get sealed. */
export function packChat(m: ChatMessage, audio: Uint8Array | null = null): Uint8Array {
  const head = enc.encode(`${JSON.stringify(m)}\n`);
  const body = m.kind === 'voice' && audio ? audio : new Uint8Array(0);
  const out = new Uint8Array(MAGIC.length + head.length + body.length);
  out.set(MAGIC, 0);
  out.set(head, MAGIC.length);
  out.set(body, MAGIC.length + head.length);
  return out;
}

/** Whether opened bytes are a chat message (and not a page). */
export function isChat(bytes: Uint8Array): boolean {
  return bytes.length > MAGIC.length && MAGIC.every((b, i) => bytes[i] === b);
}

/** Opened bytes → the message (checked) and a voice message's recording. Null if it isn't a valid message. */
export function unpackChat(bytes: Uint8Array, expectedId?: string): { message: ChatMessage; audio: Uint8Array | null } | null {
  if (!isChat(bytes)) return null;
  const rest = bytes.subarray(MAGIC.length);
  const nl = rest.indexOf(10);
  if (nl < 0 || nl > 8000) return null;
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(dec.decode(rest.subarray(0, nl))) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!raw || typeof raw.id !== 'string' || !ID.test(raw.id) || typeof raw.at !== 'string' || raw.at.length > 40) return null;
  if (expectedId && raw.id.toLowerCase() !== expectedId.toLowerCase()) return null;
  const id = raw.id.toLowerCase();
  const at = raw.at;
  if (raw.kind === 'text') {
    if (typeof raw.text !== 'string' || !raw.text.trim() || raw.text.length > TEXT_MAX) return null;
    return { message: { kind: 'text', id, at, text: raw.text }, audio: null };
  }
  if (raw.kind === 'react') {
    if (typeof raw.target !== 'string' || !ID.test(raw.target) || typeof raw.emoji !== 'string') return null;
    if (raw.emoji !== '' && !(REACTIONS as readonly string[]).includes(raw.emoji)) return null;
    return { message: { kind: 'react', id, at, target: raw.target.toLowerCase(), emoji: raw.emoji }, audio: null };
  }
  if (raw.kind === 'read') {
    const ids = Array.isArray(raw.ids) ? raw.ids.filter((v): v is string => typeof v === 'string' && ID.test(v)).slice(0, READ_MAX).map((v) => v.toLowerCase()) : [];
    if (!ids.length) return null;
    return { message: { kind: 'read', id, at, ids }, audio: null };
  }
  if (raw.kind === 'unsend') {
    if (typeof raw.target !== 'string' || !ID.test(raw.target)) return null;
    return { message: { kind: 'unsend', id, at, target: raw.target.toLowerCase() }, audio: null };
  }
  if (raw.kind === 'voice') {
    const ms = typeof raw.ms === 'number' && Number.isFinite(raw.ms) ? Math.min(Math.max(0, Math.round(raw.ms)), VOICE_MAX_MS) : 0;
    const wave = Array.isArray(raw.wave) ? raw.wave.filter((v): v is number => typeof v === 'number' && Number.isFinite(v)).slice(0, 200).map((v) => Math.min(1, Math.max(0, v))) : [];
    const ext = typeof raw.ext === 'string' && /^[a-z0-9]{1,5}$/.test(raw.ext) ? raw.ext : 'm4a';
    const audio = rest.subarray(nl + 1);
    if (audio.length === 0 || audio.length > 5 * 1024 * 1024) return null;
    return { message: { kind: 'voice', id, at, ms, wave, ext }, audio: new Uint8Array(audio) };
  }
  return null;
}

/**
 * Whether a message of yours can still be deleted for everyone: only until they've seen it (and never theirs).
 */
export function canUnsend(m: { mine: boolean; state: string }): boolean {
  return m.mine && m.state !== 'seen';
}

/** Chat opens once at least one page has passed between the two of you (either way). */
export function chatUnlocked(pagesFromThem: number, pagesToThem: number): boolean {
  return pagesFromThem + pagesToThem > 0;
}

/** Each person's latest reaction on one thing (a later one replaces theirs; '' takes it away). */
export function reactionsOn<R extends { target: string; from: string; emoji: string; at: string }>(target: string, all: readonly R[]): R[] {
  const latest = new Map<string, R>();
  for (const r of all) {
    if (r.target !== target) continue;
    const seen = latest.get(r.from);
    if (!seen || r.at >= seen.at) latest.set(r.from, r);
  }
  return [...latest.values()].filter((r) => r.emoji !== '').sort((a, b) => a.at.localeCompare(b.at));
}

/** Lines picked to quote, each with who wrote it, as one quote for a diary page. */
export function formatQuote(lines: readonly { text: string; who: string }[]): string {
  const out: string[] = [];
  for (const l of lines) {
    const text = l.text.trim();
    if (!text) continue;
    out.push(`“${text}” — ${l.who}`);
  }
  return out.join('\n');
}

/** Adds a quote to the end of a page's words (a blank line between), or starts the page with it. */
export function appendQuote(existing: string, quote: string): string {
  const q = quote.trim();
  if (!q) return existing;
  const e = existing.trimEnd();
  return e ? `${e}\n\n${q}` : q;
}
