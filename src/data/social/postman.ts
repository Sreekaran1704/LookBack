import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import * as Network from 'expo-network';
import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';
import { RTCPeerConnection, RTCSessionDescription } from 'react-native-webrtc';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { formatDisplayDate } from '../../lib/dates';
import { GIFT_CHUNK, GiftAssembler, hasCandidate, trustKnock, withCandidates, parseHeader, parseSignal, type GiftHeader, type Knock, type SdpNote, type Signal } from '../../lib/giftProtocol';
import { verifyHandshake } from '../../lib/identity';
import { PAGES_CHANNEL_ID } from '../../notifications/scheduler';
import { entriesRepository } from '../entriesRepository';
import { settingsRepository } from '../settingsRepository';
import { sharingRepository, type OutboxItem } from '../sharingRepository';
import { socialClient } from './client';
import { alertPerson, registerForAlerts } from './alerts';
import { myPublicKey, signMine } from './keys';
import { myAccountId, rpc } from './repository';

/**
 * The postman: gives memories phone to phone (see giftProtocol.ts for the conversation), on the same Wi-Fi or across
 * different networks, like Blip. Short notes go through your private inbox on the relay (Supabase: signed with
 * your account by the server, passed on, gone in minutes); the memory itself goes over a direct WebRTC data channel,
 * encrypted end to end (DTLS), whose description each phone signs with its own key, so not even the relay can step in.
 */

/**
 * Public STUN servers: they only tell a phone its own internet address, so phones on different networks can reach each
 * other directly (on the same Wi-Fi they connect locally). No relay: a few mobile networks block direct connections,
 * and then the page waits until you're on the same Wi-Fi. The page never passes through any server.
 */
const ICE_SERVERS = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
/** Local addresses come at once, the internet address within a second or two; this caps a slow network. */
const GATHER_MS = 2500;
/** No progress for this long and the gift is given up (and retried). */
const STALL_MS = 30_000;
/** Pause sending while this much is still queued on the channel, until it drains below the low mark. */
const BUFFER_HIGH = 1024 * 1024;
const BUFFER_LOW = 256 * 1024;
/** How long a knock waits for an answer before the other phone is taken to be closed (and gets an alert). */
const ANSWER_WAIT_MS = 4000;
/** When a gift that didn't go tries again (after that: when they say hello, the app opens, or the network changes). */
const RETRY_MS = [5000, 15_000, 60_000];
/** A knock nobody answered is forgotten after this long on the receiver's screen. */
const KNOCK_TTL_MS = 10 * 60_000;

export type GiftState = 'knocking' | 'connecting' | 'sending' | 'sent' | 'declined' | 'failed';
/**
 * Why a gift is stuck: this phone has no network at all (`offline`), the two phones couldn't reach each other
 * (`unreachable`: a network that blocks direct connections), the other phone isn't the one you added (`changed`:
 * a reinstall, or someone pretending), or their account no longer exists (`gone`: they deleted their sharing account,
 * so they have a new one and need adding again).
 */
export type GiftProblem = 'offline' | 'unreachable' | 'changed' | 'gone';
export interface IncomingGift extends Knock {
  at: number;
  state: 'waiting' | 'receiving' | 'kept' | 'failed';
  progress: number;
  /** Their phone isn't the one you added: it can't be accepted until you scan their code again. */
  changed: boolean;
  problem: GiftProblem | null;
}

let me: string | null = null;
let inbox: RealtimeChannel | null = null;
const outgoing = new Map<string, { state: GiftState; personId: string; problem: GiftProblem | null }>();
const incoming = new Map<string, IncomingGift>();
/** The phone key each incoming gift's connection must be signed with. */
const incomingKeys = new Map<string, string | null>();
const sessions = new Map<string, Session>();
const listeners = new Set<() => void>();
/** Gifts that already sent their alert (one each). */
const alerted = new Set<string>();
const attempts = new Map<string, number>();
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();

function changed() {
  for (const l of listeners) l();
}
/** Calls back whenever a gift (either way) changes. */
export function subscribePostman(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function outgoingState(giftId: string): GiftState | null {
  return outgoing.get(giftId)?.state ?? null;
}
export function outgoingProblem(giftId: string): GiftProblem | null {
  return outgoing.get(giftId)?.problem ?? null;
}
const sentShare = new Map<string, number>();
/** How much of a gift has gone across, 0–1 (1 once they've kept it). */
export function outgoingProgress(giftId: string): number {
  return outgoing.get(giftId)?.state === 'sent' ? 1 : (sentShare.get(giftId) ?? 0);
}
export function incomingGifts(): IncomingGift[] {
  const now = Date.now();
  return [...incoming.values()].filter((g) => g.state !== 'waiting' || now - g.at < KNOCK_TTL_MS).sort((a, b) => b.at - a.at);
}
function setOutgoing(gift: string, personId: string, state: GiftState, problem: GiftProblem | null = null) {
  outgoing.set(gift, { state, personId, problem });
  if (state === 'sent' || state === 'declined') {
    attempts.delete(gift);
    clearTimeout(retryTimers.get(gift));
    retryTimers.delete(gift);
  }
  changed();
}
function setIncoming(gift: string, patch: Partial<IncomingGift>) {
  const g = incoming.get(gift);
  if (!g) return;
  incoming.set(gift, { ...g, ...patch });
  changed();
}

/** A gift that didn't go tries again by itself a few times; after that it waits for a hello, the app, or a network. */
function scheduleRetry(gift: string) {
  if (retryTimers.has(gift)) return;
  const n = attempts.get(gift) ?? 0;
  const wait = RETRY_MS[n];
  if (wait === undefined) return;
  attempts.set(gift, n + 1);
  retryTimers.set(
    gift,
    setTimeout(() => {
      retryTimers.delete(gift);
      const state = outgoing.get(gift)?.state;
      if (state === 'knocking' || state === 'failed') void deliverWaiting(undefined, gift);
    }, wait),
  );
}

/**
 * Passes a short note to someone's inbox (they hear it only if they're online right now). It goes through the
 * server's `send_note`, which signs it with this account's real id: a note's "from" can't be faked.
 */
async function post(to: string, note: Omit<Signal, 'from'> & Record<string, unknown>): Promise<void> {
  if (!socialClient || !me) throw new Error('Sign in to give memories.');
  try {
    // A fresh tag on every note, so a note that arrives twice is only acted on once.
    await rpc('send_note', { p_to: to, p_note: { ...note, n: Crypto.randomUUID() } });
  } catch (e) {
    if (isNoSuchPerson(e)) {
      markGone(to);
      throw new PersonGone();
    }
    throw e;
  }
  if (gone.has(to)) {
    gone = new Set([...gone].filter((id) => id !== to));
    changed();
  }
}

/** The server said this account doesn't exist any more (send_note: 'No such person.', P0002). */
class PersonGone extends Error {}
function isNoSuchPerson(e: unknown): boolean {
  const err = e as { code?: unknown; message?: unknown } | null;
  return !!err && (err.code === 'P0002' || (typeof err.message === 'string' && err.message.includes('No such person')));
}
/** People whose account is gone (they deleted it): their row says so, and pages for them stop trying. */
let gone: ReadonlySet<string> = new Set();
function markGone(id: string) {
  if (gone.has(id)) return;
  gone = new Set([...gone, id]);
  changed();
}
/** The people (account ids) whose account no longer exists, as last heard from the server. */
export function gonePeople(): ReadonlySet<string> {
  return gone;
}

/** Opens your inbox (when signed in) and says hello to your people, so gifts waiting either way can go. */
/** One start at a time: two overlapping starts would open the inbox twice and hear every note twice. */
let starting: Promise<void> | null = null;
export function startPostman(): Promise<void> {
  starting ??= openInbox().finally(() => {
    starting = null;
  });
  return starting;
}
async function openInbox(): Promise<void> {
  if (!socialClient) return;
  const id = await myAccountId();
  if (!id) {
    await stopPostman();
    return;
  }
  if (inbox && me === id) return;
  await stopPostman();
  me = id;
  void warmUp();
  await socialClient.realtime.setAuth();
  // Any channel left on this topic (from a socket that reconnected) goes first.
  for (const c of socialClient.getChannels()) if (c.topic.endsWith(`inbox:${id}`)) await socialClient.removeChannel(c);
  inbox = socialClient
    .channel(`inbox:${id}`, { config: { private: true } })
    .on('broadcast', { event: 'signal' }, ({ payload }) => void hear(payload))
    .subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
      void sayHello();
      // Where alerts can reach this phone while LookBack is closed.
      void registerForAlerts().catch(() => undefined);
    });
}
export async function stopPostman(): Promise<void> {
  for (const s of sessions.values()) s.close();
  sessions.clear();
  for (const t of retryTimers.values()) clearTimeout(t);
  retryTimers.clear();
  if (inbox && socialClient) await socialClient.removeChannel(inbox);
  inbox = null;
  me = null;
}

/** Tells your people you're here (they send what's waiting for you), and knocks for what's waiting for them. */
async function sayHello() {
  const people = await sharingRepository.people();
  await Promise.all(people.map((p) => post(p.id, { t: 'here' }).catch(() => undefined)));
  await deliverWaiting();
}
/** Knocks for every gift still waiting in the outbox (or only those for one person, or one gift). */
export async function deliverWaiting(personId?: string, giftId?: string): Promise<void> {
  if (!me) return;
  for (const item of await sharingRepository.outbox()) {
    if (personId && item.personId !== personId) continue;
    if (giftId && item.id !== giftId) continue;
    const state = outgoing.get(item.id)?.state;
    if (state === 'connecting' || state === 'sending') continue;
    await knock(item).catch(() => {
      setOutgoing(item.id, item.personId, 'knocking');
      scheduleRetry(item.id);
    });
  }
}
/** Gives a memory to someone: queued on this phone, and offered to them right away if they're online. */
export async function giveMemory(entryId: string, personId: string): Promise<string> {
  // Giving the same page to the same person again: it's the one already waiting (offered again now), not another copy.
  const waiting = (await sharingRepository.outbox()).find((o) => o.entryId === entryId && o.personId === personId);
  const gift = waiting?.id ?? (await sharingRepository.queue(entryId, personId));
  alerted.delete(gift);
  attempts.delete(gift);
  const item = waiting ?? (await sharingRepository.outbox()).find((o) => o.id === gift);
  setOutgoing(gift, personId, 'knocking');
  if (item) await knock(item).catch(() => scheduleRetry(gift));
  return gift;
}
async function knock(item: OutboxItem) {
  const entry = (await entriesRepository.getAll()).find((e) => e.id === item.entryId);
  if (!entry) {
    await sharingRepository.sent(item.id);
    return;
  }
  const { name } = await settingsRepository.getProfile();
  setOutgoing(item.id, item.personId, 'knocking', outgoing.get(item.id)?.problem ?? null);
  try {
    await post(item.personId, { t: 'knock', gift: item.id, name: name || 'Someone', date: entry.localDate, photo: !!entry.photoPath, voice: !!entry.voicePath, key: await myPublicKey() });
  } catch (e) {
    // Their account is gone: no knocking, retrying or alerts; the screen says to add them again.
    if (e instanceof PersonGone) {
      setOutgoing(item.id, item.personId, 'failed', 'gone');
      return;
    }
    throw e;
  }
  setTimeout(() => {
    if (outgoing.get(item.id)?.state !== 'knocking') return;
    // No answer: try again shortly, and (once per gift) send an alert, like Blip's: their LookBack is probably closed.
    scheduleRetry(item.id);
    if (alerted.has(item.id)) return;
    alerted.add(item.id);
    void alertPerson(item.personId, name || 'Someone').catch(() => undefined);
  }, ANSWER_WAIT_MS);
}

/** Accept a gift: they connect to you and send it. */
export async function acceptGift(gift: string): Promise<void> {
  const g = incoming.get(gift);
  if (!g || g.state !== 'waiting' || g.changed) return;
  setIncoming(gift, { state: 'receiving', progress: 0, problem: null });
  await warmUp();
  sessions.get(gift)?.close();
  sessions.set(gift, new Session(gift, g.from, 'receiver', incomingKeys.get(gift) ?? null));
  await post(g.from, { t: 'yes', gift }).catch((e: unknown) => {
    setIncoming(gift, { state: 'failed' });
    throw e;
  });
}
export async function declineGift(gift: string): Promise<void> {
  const g = incoming.get(gift);
  incoming.delete(gift);
  incomingKeys.delete(gift);
  changed();
  if (g) await post(g.from, { t: 'no', gift }).catch(() => undefined);
}
/** Forget a finished or failed gift on the receiving side. */
export function dismissGift(gift: string) {
  incoming.delete(gift);
  incomingKeys.delete(gift);
  changed();
}

/** Tags of notes already heard (the last few hundred). */
const heard = new Set<string>();
/** Gifts whose knock or "yes" is being dealt with right now: a second copy waits its turn and finds it done. */
const handling = new Set<string>();
function firstTime(raw: unknown): boolean {
  const tag = raw && typeof raw === 'object' ? (raw as { n?: unknown }).n : undefined;
  if (typeof tag !== 'string') return true;
  if (heard.has(tag)) return false;
  heard.add(tag);
  if (heard.size > 500) heard.delete(heard.values().next().value as string);
  return true;
}

async function hear(raw: unknown) {
  if (!me || !firstTime(raw)) return;
  const note = parseSignal(raw, me);
  if (!note) return;
  if (note.t === 'knock' || note.t === 'yes') {
    const key = `${note.t}:${note.gift}`;
    if (handling.has(key)) return;
    handling.add(key);
    try {
      await handle(note);
    } finally {
      handling.delete(key);
    }
    return;
  }
  await handle(note);
}

async function handle(note: Signal) {
  switch (note.t) {
    case 'here':
      await deliverWaiting(note.from);
      return;
    case 'knock': {
      const known = incoming.get(note.gift);
      if (known && known.state !== 'failed') return;
      // Already kept: this very gift (their "kept" got lost). Tell them, so it leaves their outbox. A page from a day
      // you already have from them, given again, is a new version (edited, a recording added): it comes in and
      // replaces the older copy once kept.
      const kept = (await sharingRepository.letters()).some((l) => l.id === note.gift);
      if (kept) {
        await post(note.from, { t: 'had', gift: note.gift }).catch(() => undefined);
        return;
      }
      // Another copy of a page already on screen (waiting or coming across): one question at a time.
      if ([...incoming.values()].some((g) => g.from === note.from && g.date === note.date && (g.state === 'waiting' || g.state === 'receiving'))) return;
      // Someone you already know shows under the name you know them by, and must come from the phone you know.
      const friend = await sharingRepository.person(note.from);
      // Pages from your people (whose phone you know) come in by themselves, like Blip: decided before anything shows,
      // so no question flashes up.
      const { changed: keyChanged, auto, expectedKey } = trustKnock(friend?.publicKey, note.key, await settingsRepository.getAutoAccept());
      incomingKeys.set(note.gift, expectedKey);
      incoming.set(note.gift, { ...note, name: friend?.name ?? note.name, at: Date.now(), state: 'waiting', progress: 0, changed: keyChanged, problem: keyChanged ? 'changed' : null });
      if (auto) await acceptGift(note.gift).catch(() => undefined);
      else changed();
      return;
    }
    case 'yes': {
      const item = (await sharingRepository.outbox()).find((o) => o.id === note.gift && o.personId === note.from);
      if (!item || sessions.has(note.gift)) return;
      const person = await sharingRepository.person(note.from);
      await warmUp();
      const session = new Session(note.gift, note.from, 'giver', person?.publicKey ?? null, item);
      sessions.set(note.gift, session);
      void session.offer();
      return;
    }
    case 'no':
    case 'had': {
      const item = (await sharingRepository.outbox()).find((o) => o.id === note.gift && o.personId === note.from);
      if (!item) return;
      await sharingRepository.sent(note.gift);
      setOutgoing(note.gift, note.from, note.t === 'no' ? 'declined' : 'sent');
      return;
    }
    case 'sdp': {
      const session = sessions.get(note.gift);
      if (session && session.peer === note.from) await session.signal(note);
      return;
    }
  }
}

/**
 * Android's WebRTC starts watching the phone's networks with its first connection, and that first one finds no
 * addresses at all (measured: the first page after a fresh start always failed, the retry always went). So once per
 * run, before the first real connection, a throwaway one looks for addresses and is closed.
 */
let warm: Promise<void> | null = null;
function warmUp(): Promise<void> {
  warm ??= (async () => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    try {
      pc.createDataChannel('warm');
      const found = new Promise<void>((resolve) => {
        pc.addEventListener('icecandidate', () => resolve());
        setTimeout(resolve, GATHER_MS);
      });
      await pc.setLocalDescription(await pc.createOffer({}));
      await found;
    } catch {
      warm = null; // try again next time
    } finally {
      pc.close();
    }
  })();
  return warm;
}

/** Resolves once the phone has found its own addresses (instant on a local network), or after `ms` at most. */
function gathered(pc: RTCPeerConnection, ms: number): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    const timer = setTimeout(resolve, ms);
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState !== 'complete') return;
      clearTimeout(timer);
      resolve();
    });
  });
}

/** One gift on its way, either direction: the direct connection and what goes over it. */
class Session {
  private readonly pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  private channel: ReturnType<RTCPeerConnection['createDataChannel']> | null = null;
  private header: GiftHeader | null = null;
  private assembler: GiftAssembler | null = null;
  private done = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** The key their side was signed with (pinned on their person once the page has gone). */
  private theirKey: string | null = null;
  /** Every address this phone found for the connection, as it found them. */
  private readonly found: string[] = [];

  constructor(
    readonly gift: string,
    readonly peer: string,
    private readonly role: 'giver' | 'receiver',
    /** The key their side must be signed with; null = learn it from them (first page with someone). */
    private readonly expectedKey: string | null,
    private readonly item?: OutboxItem,
  ) {
    this.alive();
    this.pc.addEventListener('icecandidate', (e) => {
      const c = (e as unknown as { candidate: { candidate?: string } | null }).candidate;
      if (c?.candidate) this.found.push(c.candidate);
    });
    this.pc.addEventListener('connectionstatechange', () => {
      if (this.pc.connectionState === 'failed') this.fail('unreachable');
    });
    if (role === 'receiver') {
      this.pc.addEventListener('datachannel', (e) => {
        this.channel = (e as unknown as { channel: NonNullable<Session['channel']> }).channel;
        this.channel.binaryType = 'arraybuffer';
        this.channel.addEventListener('message', (m) => void this.receive((m as unknown as { data: string | ArrayBuffer }).data));
      });
    }
  }

  /** Something happened: the gift isn't stuck (it's given up only after STALL_MS with no progress at all). */
  private alive() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.fail('unreachable'), STALL_MS);
  }

  /** Our side of the connection, with every address found, signed with this phone's key. */
  private async describe(type: 'offer' | 'answer'): Promise<boolean> {
    await gathered(this.pc, GATHER_MS);
    let sdp = withCandidates(this.pc.localDescription?.sdp ?? '', this.found);
    // None found yet (the networks were still waking up): the giver looks again, twice, before calling it offline.
    for (let again = 0; again < 2 && !hasCandidate(sdp) && type === 'offer' && !this.done; again++) {
      await new Promise((r) => setTimeout(r, 700));
      await this.pc.setLocalDescription(await this.pc.createOffer({ iceRestart: true }));
      // Wait for addresses from this new round (the old round's "done" may still be showing).
      for (let waited = 0; waited < GATHER_MS && this.found.length === 0; waited += 100) await new Promise((r) => setTimeout(r, 100));
      await new Promise((r) => setTimeout(r, 300));
      sdp = withCandidates(this.pc.localDescription?.sdp ?? '', this.found);
    }
    if (!hasCandidate(sdp)) {
      this.fail('offline');
      return false;
    }
    if (!me) return false;
    const sig = await signMine({ gift: this.gift, from: me, to: this.peer, type, sdp });
    await post(this.peer, { t: 'sdp', gift: this.gift, sdp: { type, sdp }, key: await myPublicKey(), sig });
    return true;
  }

  /** Giver: opens the channel and offers the connection. */
  async offer() {
    try {
      setOutgoing(this.gift, this.peer, 'connecting');
      const channel = this.pc.createDataChannel('gift', { ordered: true });
      this.channel = channel;
      channel.binaryType = 'arraybuffer';
      channel.bufferedAmountLowThreshold = BUFFER_LOW;
      channel.addEventListener('open', () => void this.send());
      channel.addEventListener('message', (m) => {
        const data = (m as unknown as { data: unknown }).data;
        if (typeof data === 'string' && data === '{"t":"kept"}') void this.kept();
      });
      await this.pc.setLocalDescription(await this.pc.createOffer({}));
      await this.describe('offer');
    } catch {
      this.fail('unreachable');
    }
  }

  /** Their signed side of the connection: checked, then used. */
  async signal(note: SdpNote) {
    if (this.done || !me) return;
    try {
      // From the phone you know (or, the first time, the phone that knocked), signed over exactly this connection.
      const key = this.expectedKey ?? note.key;
      if (note.key !== key || !verifyHandshake(key, note.sig, { gift: this.gift, from: note.from, to: me, type: note.sdp.type, sdp: note.sdp.sdp })) {
        this.fail('changed');
        return;
      }
      // Only one description from them per connection (a repeat is ignored, never applied twice).
      if (note.sdp.type !== (this.role === 'giver' ? 'answer' : 'offer') || this.theirKey) return;
      this.theirKey = key;
      const sdp = note.sdp.sdp;
      if (!hasCandidate(sdp)) {
        this.fail('unreachable');
        return;
      }
      this.alive();
      await this.pc.setRemoteDescription(new RTCSessionDescription({ type: note.sdp.type, sdp }));
      if (this.role === 'receiver') {
        await this.pc.setLocalDescription(await this.pc.createAnswer());
        await this.describe('answer');
      }
    } catch {
      this.fail('unreachable');
    }
  }

  /** Waits until the channel's queue has drained below the low mark. */
  private drained(channel: NonNullable<Session['channel']>): Promise<void> {
    if (channel.bufferedAmount <= BUFFER_HIGH) return Promise.resolve();
    return new Promise((resolve) => {
      const go = () => {
        channel.removeEventListener('bufferedamountlow', go);
        resolve();
      };
      channel.addEventListener('bufferedamountlow', go);
      // In case the event was missed, look again shortly.
      setTimeout(go, 250);
    });
  }

  /** Giver: the words first, then the photo's bytes, then the voice's (read a chunk at a time), then "end". */
  private async send() {
    const channel = this.channel;
    const item = this.item;
    if (!channel || !item) return;
    try {
      setOutgoing(this.gift, this.peer, 'sending');
      this.alive();
      const entry = (await entriesRepository.getAll()).find((e) => e.id === item.entryId);
      if (!entry) throw new Error('gone');
      const { name, portrait } = await settingsRepository.getProfile();
      const files: { kind: 'photo' | 'voice'; file: File }[] = [];
      if (entry.photoPath) files.push({ kind: 'photo', file: new File(Paths.document, entry.photoPath) });
      if (entry.voicePath) files.push({ kind: 'voice', file: new File(Paths.document, entry.voicePath) });
      const ext = (f: File) => f.name.split('.').pop()?.toLowerCase() ?? '';
      const describe = (kind: 'photo' | 'voice') => {
        const f = files.find((x) => x.kind === kind)?.file;
        return f && f.exists ? { ext: ext(f), size: f.size } : null;
      };
      const header: GiftHeader = {
        t: 'header',
        gift: this.gift,
        name: name || 'Someone',
        date: entry.localDate,
        body: entry.text,
        voiceTitle: entry.voiceTitle ?? null,
        voiceMs: entry.voiceMs,
        photo: describe('photo'),
        voice: describe('voice'),
        portrait,
      };
      channel.send(JSON.stringify(header));
      const total = (header.photo?.size ?? 0) + (header.voice?.size ?? 0);
      let sent = 0;
      let shown = 0;
      for (const { kind, file } of files) {
        const size = header[kind]?.size;
        if (!size) continue;
        const handle = file.open();
        try {
          for (let at = 0; at < size; at += GIFT_CHUNK) {
            await this.drained(channel);
            if (this.done) return;
            const chunk = await handle.readBytes(Math.min(GIFT_CHUNK, size - at));
            channel.send(chunk);
            sent += chunk.length;
            this.alive();
            // Tell the screen every few percent, not every chunk.
            if (total && sent / total - shown >= 0.04) {
              shown = sent / total;
              sentShare.set(this.gift, shown * 0.95);
              changed();
            }
          }
        } finally {
          handle.close();
        }
      }
      channel.send('{"t":"end"}');
    } catch {
      this.fail('unreachable');
    }
  }

  /** Receiver: header, bytes, end; then keep it and say "kept". */
  private async receive(data: string | ArrayBuffer) {
    if (this.done) return;
    try {
      this.alive();
      if (typeof data !== 'string') {
        if (!this.assembler || !this.assembler.add(new Uint8Array(data))) throw new Error('too much');
        setIncoming(this.gift, { progress: this.assembler.progress });
        return;
      }
      const message = JSON.parse(data) as { t?: string };
      if (message.t === 'header') {
        this.header = parseHeader(message, this.gift);
        if (!this.header) throw new Error('bad header');
        this.assembler = new GiftAssembler(this.header);
        return;
      }
      if (message.t !== 'end' || !this.header || !this.assembler?.complete) throw new Error('out of order');
      const h = this.header;
      const write = (kind: 'photo' | 'voice') => {
        const meta = h[kind];
        const bytes = this.assembler?.file(kind);
        if (!meta || !bytes) return null;
        const { file, path } = sharingRepository.letterFile(this.gift, `${kind}.${meta.ext}`);
        file.write(bytes);
        return path;
      };
      const photoPath = write('photo');
      const voicePath = write('voice');
      const known = await sharingRepository.person(this.peer);
      const senderName = known?.name ?? h.name;
      const older = (await sharingRepository.letters()).filter((l) => l.senderId === this.peer && l.memoryDate === h.date && l.id !== this.gift);
      await sharingRepository.keepLetter({ id: this.gift, senderId: this.peer, senderName, senderPortrait: h.portrait, memoryDate: h.date, body: h.body, voiceTitle: h.voiceTitle, voiceMs: h.voiceMs, photoPath, voicePath });
      // The page they gave again replaces the copy you had of that day (only after the new one is safely kept).
      for (const old of older) await sharingRepository.removeLetter(old.id).catch(() => undefined);
      // They're one of your people now, with the phone key their page was signed with.
      await sharingRepository.addPerson(this.peer, senderName, this.theirKey);
      if (h.portrait) await sharingRepository.setPortrait(this.peer, h.portrait);
      this.channel?.send('{"t":"kept"}');
      this.finish();
      setIncoming(this.gift, { state: 'kept', progress: 1 });
      void tellKept(this.gift, senderName, h.date);
      // Let "kept" leave before the connection closes.
      setTimeout(() => this.close(), 1500);
    } catch {
      sharingRepository.discardPartial(this.gift);
      this.fail('unreachable');
    }
  }

  private async kept() {
    this.finish();
    await sharingRepository.sent(this.gift);
    // The first page to someone added from nearby: remember the phone key their side was signed with.
    const person = await sharingRepository.person(this.peer);
    if (person && !person.publicKey && this.theirKey) await sharingRepository.addPerson(person.id, person.name, this.theirKey);
    setOutgoing(this.gift, this.peer, 'sent');
    this.close();
  }

  private finish() {
    this.done = true;
    if (this.timer) clearTimeout(this.timer);
  }
  private fail(problem: GiftProblem) {
    if (this.done) return;
    this.finish();
    if (this.role === 'giver') {
      setOutgoing(this.gift, this.peer, 'failed', problem);
      // A phone that changed won't sign the right way next time either: that needs a fresh scan, not a retry.
      if (problem !== 'changed') scheduleRetry(this.gift);
    } else {
      sharingRepository.discardPartial(this.gift);
      setIncoming(this.gift, { state: 'failed', problem });
    }
    this.close();
  }
  close() {
    if (this.timer) clearTimeout(this.timer);
    this.done = true;
    try {
      this.channel?.close();
      this.pc.close();
    } catch {
      // Already closed.
    }
    if (sessions.get(this.gift) === this) sessions.delete(this.gift);
  }
}

/** A page came in while you were elsewhere: say so (in the app, the flight already shows it). */
async function tellKept(gift: string, name: string, date: string) {
  if (AppState.currentState === 'active') return;
  await Notifications.scheduleNotificationAsync({
    content: { title: `💌 ${name} gave you a page`, body: `A page from ${formatDisplayDate(date)}, kept on this phone.`, data: { kind: 'page-kept', gift } },
    trigger: { channelId: PAGES_CHANNEL_ID },
  }).catch(() => undefined);
}

/** Starts over with a gift that's stuck, from now (attempts reset). */
function retryAll() {
  attempts.clear();
  void deliverWaiting().catch(() => undefined);
}

// Back in front: reopen the inbox (the socket may have dropped) and offer what's waiting.
AppState.addEventListener('change', (state) => {
  if (state === 'active') void startPostman().then(retryAll).catch(() => undefined);
});
// Back online, or on another network: what was waiting can go now.
Network.addNetworkStateListener(({ isConnected }) => {
  if (isConnected && AppState.currentState === 'active') retryAll();
});
