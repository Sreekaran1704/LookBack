/**
 * Giving a memory phone to phone, like Blip: the two phones say hello through a tiny relay (it passes short notes
 * between them and keeps nothing), then connect directly and the memory goes straight across, encrypted end to end.
 *
 *   giver ── knock ─▶ receiver          "Sree wants to give you a page from Nov 21"   (no memory in it)
 *   giver ◀── yes ─── receiver          (or "no")
 *   giver ── sdp ─▶ ◀─ sdp ──            setting up the direct connection (same Wi-Fi or across the internet), each
 *                                       side signed with its phone's key (identity.ts), so nobody in between can
 *                                       step into it
 *   giver ══ header, photo bytes, voice bytes, end ══▶ receiver     (over the direct, encrypted channel)
 *   giver ◀══ kept ══ receiver          it's saved on their phone; the giver crosses it off
 *   (a knock for a gift they already kept gets "had": crossed off too; the same day's page given again is a new
 *   version and replaces the older copy)
 *
 * A phone coming online says "here" to its people, so a gift waiting for them goes as soon as both are around.
 * Pure (no React Native imports), tested in __tests__/giftProtocol.test.ts.
 */

import { isPublicKey, isSignature } from './identity';
import { parseGot, type GotPage } from './friendship';
import { parsePortrait } from './portrait';

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const NAME_MAX = 80;
const BODY_MAX = 100_000;
const TITLE_MAX = 60;
/** The biggest photo or recording a gift may carry. */
export const GIFT_FILE_MAX = 25 * 1024 * 1024;
/** Bytes per message on the direct channel (Android's WebRTC takes up to 256 KB; 64 KB is fast and safe). */
export const GIFT_CHUNK = 64 * 1024;
const SDP_MAX = 20_000;

export interface Knock {
  t: 'knock';
  gift: string;
  from: string;
  name: string;
  date: string;
  photo: boolean;
  voice: boolean;
  /** The giver's phone key (null from an older app). */
  key: string | null;
}
/** One side of the connection: its description (local addresses only), signed with its phone's key. */
export interface SdpNote {
  t: 'sdp';
  gift: string;
  from: string;
  sdp: { type: 'offer' | 'answer'; sdp: string };
  key: string;
  sig: string;
}
/**
 * Someone made you one of their people (`added`), or says hello (`here`): with their name and phone key, so a phone
 * that hasn't added them back can offer to (null from an older app, which sends a bare `here`).
 */
export interface Hello {
  t: 'here' | 'added';
  from: string;
  name: string | null;
  key: string | null;
  /** Whether the sender already counts you as a friend (null from an older app): if not, you say hello back. */
  friend: boolean | null;
  /** When the sender last removed you (null: never; undefined: an older app that doesn't say). */
  cut?: string | null;
  /** Pages the sender got from you, so your phone can list what you gave them (lib/friendship.ts). */
  got: GotPage[];
}
/**
 * `mail`: a sealed envelope for this gift is waiting in your mailbox (lib/mailbox.ts). `seen`: the receiver's phone
 * heard the knock and is asking its person, so the giver waits for the answer instead of sealing it straight away.
 */
/** A chat message sealed for you (lib/chat.ts), small enough to ride in the note: `box` is the envelope, base64url. */
export interface ChatNote {
  t: 'msg';
  gift: string;
  from: string;
  box: string;
}
/** `got`: your phone has the message with this id (the sender's tick). */
export type Signal = Knock | { t: 'yes' | 'no' | 'had' | 'mail' | 'seen' | 'got'; gift: string; from: string } | Hello | SdpNote | ChatNote;
/** The most a sealed message riding in a note may be: base64 makes it a third bigger, and send_note allows 24 KB. */
export const CHAT_BOX_MAX = 16_000;

export interface GiftFile {
  ext: string;
  size: number;
}
/** What goes first on the direct channel: the words, and the sizes of the files that follow (photo, then voice). */
export interface GiftHeader {
  t: 'header';
  gift: string;
  name: string;
  date: string;
  body: string;
  voiceTitle: string | null;
  voiceMs: number | null;
  photo: GiftFile | null;
  voice: GiftFile | null;
  /** The giver's portrait code (lib/portrait.ts); null from an older app, or when it doesn't read. */
  portrait: string | null;
}

const str = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const isId = (v: unknown): v is string => typeof v === 'string' && ID.test(v);
/** A name to show: one line, no control or direction-flipping characters (they could disguise it), 80 at most. */
export const cleanName = (v: unknown) =>
  (typeof v === 'string' ? v.replace(/\s+/g, ' ').replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, '').trim().slice(0, NAME_MAX) : '') || 'Someone';

/** A note from the relay, checked: anything malformed (or from yourself) is null and ignored. */
export function parseSignal(raw: unknown, me: string): Signal | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (!isId(m.from) || m.from.toLowerCase() === me.toLowerCase()) return null;
  const from = m.from.toLowerCase();
  if (m.t === 'here' || m.t === 'added') {
    const name = typeof m.name === 'string' && m.name.trim() ? cleanName(m.name) : null;
    const key = isPublicKey(m.key) ? m.key : null;
    // "added" is only worth anything with a name to show.
    if (m.t === 'added' && !name) return null;
    const cut = typeof m.c === 'string' && m.c.length <= 40 ? m.c : m.c === null ? null : undefined;
    return { t: m.t, from, name, key, friend: typeof m.f === 'boolean' ? m.f : null, ...(cut === undefined ? {} : { cut }), got: parseGot(m.got) };
  }
  if (!isId(m.gift)) return null;
  const gift = m.gift.toLowerCase();
  switch (m.t) {
    case 'knock':
      if (typeof m.date !== 'string' || !DATE.test(m.date)) return null;
      return { t: 'knock', gift, from, name: cleanName(m.name), date: m.date, photo: m.photo === true, voice: m.voice === true, key: isPublicKey(m.key) ? m.key : null };
    case 'yes':
    case 'no':
    case 'had':
    case 'mail':
    case 'seen':
    case 'got':
      return { t: m.t, gift, from };
    case 'msg':
      if (typeof m.box !== 'string' || m.box.length > CHAT_BOX_MAX * 1.4 || !/^[A-Za-z0-9_-]+$/.test(m.box)) return null;
      return { t: 'msg', gift, from, box: m.box };
    case 'sdp': {
      const sdp = m.sdp as Record<string, unknown> | undefined;
      if (!sdp || (sdp.type !== 'offer' && sdp.type !== 'answer') || !str(sdp.sdp, SDP_MAX)) return null;
      // Unsigned connection setup is never used: it could come from anyone in the middle.
      if (!isPublicKey(m.key) || !isSignature(m.sig)) return null;
      return { t: 'sdp', gift, from, sdp: { type: sdp.type, sdp: sdp.sdp }, key: m.key, sig: m.sig };
    }
    default:
      return null;
  }
}

/**
 * How far to trust a knock. Someone you added with a known phone key must knock from that phone (`changed` if not);
 * their pages come in by themselves when `autoAccept` is on. Anyone else (or someone whose key you don't know yet)
 * asks first, and their connection must be signed with the key in their knock. `expectedKey` is the key the
 * connection must then be signed with (null: an older app that sent none).
 */
export function trustKnock(savedKey: string | null | undefined, knockKey: string | null, autoAccept: boolean): { changed: boolean; auto: boolean; expectedKey: string | null } {
  const changed = !!savedKey && knockKey !== savedKey;
  return { changed, auto: !!savedKey && !changed && autoAccept, expectedKey: savedKey ?? knockKey };
}

/**
 * The description with the addresses the phone found added in (react-native-webrtc can hand back a description from
 * before they were found: when finding them is quick, its "done" arrives before the description is saved, and the
 * saved copy has none). A page's connection has one media section (one data channel), so they go at its end.
 */
export function withCandidates(sdp: string, candidates: string[]): string {
  const have = new Set(sdp.split(/\r?\n/).filter((l) => l.startsWith('a=candidate:')).map((l) => l.slice(2)));
  const add = [...new Set(candidates.map((c) => c.replace(/^a=/, '').trim()))].filter((c) => c.startsWith('candidate:') && !have.has(c));
  if (add.length === 0) return sdp;
  const body = sdp.replace(/(\r?\n)*$/, '');
  return `${body}\r\n${add.map((c) => `a=${c}`).join('\r\n')}\r\n`;
}

/** Whether a connection description offers any address to reach it on (none: the phone has no network at all). */
export const hasCandidate = (sdp: string) => sdp.split(/\r?\n/).some((line) => line.startsWith('a=candidate:'));

function parseFile(v: unknown, kind: 'photo' | 'voice'): GiftFile | null | undefined {
  if (v === null || v === undefined) return null;
  const f = v as Record<string, unknown>;
  const allowed = kind === 'photo' ? ['jpg', 'jpeg', 'png', 'webp', 'heic'] : ['m4a', 'mp4', 'aac', '3gp', 'wav'];
  if (typeof f.ext !== 'string' || !allowed.includes(f.ext.toLowerCase())) return undefined;
  if (typeof f.size !== 'number' || !Number.isInteger(f.size) || f.size <= 0 || f.size > GIFT_FILE_MAX) return undefined;
  return { ext: f.ext.toLowerCase(), size: f.size };
}

/** The header that opens a gift on the direct channel, checked (it names files the receiver will write). */
export function parseHeader(raw: unknown, gift: string): GiftHeader | null {
  if (!raw || typeof raw !== 'object') return null;
  const h = raw as Record<string, unknown>;
  if (h.t !== 'header' || h.gift !== gift) return null;
  if (typeof h.date !== 'string' || !DATE.test(h.date) || !str(h.body, BODY_MAX)) return null;
  const photo = parseFile(h.photo, 'photo');
  const voice = parseFile(h.voice, 'voice');
  if (photo === undefined || voice === undefined) return null;
  const voiceTitle = str(h.voiceTitle, TITLE_MAX) && h.voiceTitle.trim() ? h.voiceTitle.trim() : null;
  const voiceMs = typeof h.voiceMs === 'number' && Number.isFinite(h.voiceMs) && h.voiceMs >= 0 ? Math.round(h.voiceMs) : null;
  const portrait = parsePortrait(h.portrait) ? (h.portrait as string) : null;
  return { t: 'header', gift, name: cleanName(h.name), date: h.date, body: h.body, voiceTitle, voiceMs, photo, voice, portrait };
}

/** Where incoming bytes go, in order: the photo's bytes first, then the voice's. */
export class GiftAssembler {
  private readonly parts: { kind: 'photo' | 'voice'; size: number; chunks: Uint8Array[]; got: number }[];
  constructor(header: GiftHeader) {
    this.parts = [];
    if (header.photo) this.parts.push({ kind: 'photo', size: header.photo.size, chunks: [], got: 0 });
    if (header.voice) this.parts.push({ kind: 'voice', size: header.voice.size, chunks: [], got: 0 });
  }
  /** Takes the next chunk; false if it's more than the header promised (the gift is then thrown away). */
  add(chunk: Uint8Array): boolean {
    let rest = chunk;
    for (const part of this.parts) {
      if (rest.length === 0) return true;
      const room = part.size - part.got;
      if (room <= 0) continue;
      const take = rest.subarray(0, room);
      part.chunks.push(take.slice());
      part.got += take.length;
      rest = rest.subarray(take.length);
    }
    return rest.length === 0;
  }
  /** How much has arrived, 0–1. */
  get progress(): number {
    const total = this.parts.reduce((s, p) => s + p.size, 0);
    return total === 0 ? 1 : this.parts.reduce((s, p) => s + p.got, 0) / total;
  }
  get complete(): boolean {
    return this.parts.every((p) => p.got === p.size);
  }
  /** The finished file of a kind, or null if the gift has none. */
  file(kind: 'photo' | 'voice'): Uint8Array | null {
    const part = this.parts.find((p) => p.kind === kind);
    if (!part) return null;
    const out = new Uint8Array(part.size);
    let at = 0;
    for (const c of part.chunks) {
      out.set(c, at);
      at += c.length;
    }
    return out;
  }
}

/** A knock nobody's phone answered within this long: their LookBack is closed, so the page is sealed for them. */
export const KNOCK_UNHEARD_MS = 4000;
/** Their phone heard it and is asking them: wait this long for their Accept before sealing it instead. */
export const KNOCK_ASKING_MS = 60_000;

/**
 * When a knocked page goes into the mailbox instead: after a few seconds if their phone never said it heard (closed,
 * asleep, an older app), but only after a minute if it did (they're looking at the question right now).
 */
export function sealAfterMs(heard: boolean): number {
  return heard ? KNOCK_ASKING_MS : KNOCK_UNHEARD_MS;
}

/**
 * Whether a hello / "added you" from someone should offer "add them back": they aren't one of your people yet, you
 * haven't said not now to them, and they told you who they are (an older app's bare hello has no name).
 */
/**
 * Whether a hello from someone you have deserves a hello back: you've only just become friends, or they don't know
 * you are yet (an older app sends no flag and never needs one). The reply says you are, so it stops after one round.
 */
export function helloBack(newlyFriends: boolean, note: Hello): boolean {
  return newlyFriends || note.friend === false;
}

export function offerAddBack(note: Hello, known: boolean, dismissed: ReadonlySet<string>): boolean {
  return !known && !dismissed.has(note.from) && !!note.name;
}
