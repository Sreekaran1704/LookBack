/**
 * Shared pages in the Google Drive backup: the pages people gave you (with their photo and recording), the pages you
 * gave and how each went, and your people (so a restore keeps your friends). They go in their own file,
 * `shared.json`, beside the diary's `yearbook.json` in the same private folder; older app versions don't know it and
 * leave it alone. Pure module (no React Native imports), tested in __tests__/sharedBackup.test.ts.
 *
 * Merging is a union: a page kept on either side is kept, unless either side threw it away (`removed`, e.g. replaced
 * by a newer version of the same day from the same person). Nothing here ever touches LookBack's own server.
 */

export const SHARED_MANIFEST_NAME = 'shared.json';
export const SHARED_VERSION = 1;

export interface SharedLetter {
  id: string;
  senderId: string;
  senderName: string;
  senderPortrait: string | null;
  memoryDate: string;
  body: string;
  voiceTitle: string | null;
  voiceMs: number | null;
  /** On the phone: received/<id>/photo.jpg; in Drive: the file named by `sharedFileName`. */
  photoPath: string | null;
  voicePath: string | null;
  receivedAt: string;
  openedAt: string | null;
}
export interface SharedGiven {
  id: string;
  entryId: string;
  personId: string;
  memoryDate: string | null;
  givenAt: string;
  state: string;
}
export interface SharedPerson {
  id: string;
  name: string;
  addedAt: string;
  publicKey: string | null;
  portrait: string | null;
  friends: boolean;
}
/** A chat message (text or voice; reactions travel separately). Voice files: `chat/<id>.<ext>` → `chat-<id>.<ext>`. */
export interface SharedMessage {
  id: string;
  personId: string;
  mine: boolean;
  kind: 'text' | 'voice';
  body: string;
  voicePath: string | null;
  voiceMs: number | null;
  voiceWave: number[] | null;
  at: string;
}
export interface SharedReaction {
  target: string;
  from: string;
  emoji: string;
  at: string;
}
export interface SharedManifest {
  version: number;
  exportedAt: string;
  letters: SharedLetter[];
  given: SharedGiven[];
  people: SharedPerson[];
  /** Added with chat; older copies lack them (read as []). */
  messages: SharedMessage[];
  reactions: SharedReaction[];
  /** Ids of letters thrown away on some phone: never brought back. */
  removed: string[];
}

const str = (v: unknown): v is string => typeof v === 'string';
const strOrNull = (v: unknown): string | null => (str(v) ? v : null);
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const ID = /^[0-9a-zA-Z-]{1,64}$/;

/** The Drive file name for a shared page's photo or recording ('received/<id>/photo.jpg' → 'shared-<id>-photo.jpg'). */
export function sharedFileName(path: string): string | null {
  const m = /^received\/([0-9a-zA-Z-]{1,64})\/((?:photo|voice)\.[a-z0-9]{1,5})$/.exec(path);
  if (m) return `shared-${m[1]}-${m[2]}`;
  const c = /^chat\/([0-9a-zA-Z-]{1,64}\.[a-z0-9]{1,5})$/.exec(path);
  return c ? `chat-${c[1]}` : null;
}

export function buildShared(o: { letters: readonly SharedLetter[]; given: readonly SharedGiven[]; people: readonly SharedPerson[]; removed: readonly string[]; exportedAt: string; messages?: readonly SharedMessage[]; reactions?: readonly SharedReaction[] }): SharedManifest {
  return {
    version: SHARED_VERSION,
    exportedAt: o.exportedAt,
    letters: [...o.letters].sort((a, b) => a.id.localeCompare(b.id)),
    given: [...o.given].sort((a, b) => a.id.localeCompare(b.id)),
    people: [...o.people].sort((a, b) => a.id.localeCompare(b.id)),
    messages: [...(o.messages ?? [])].sort((a, b) => a.id.localeCompare(b.id)),
    reactions: [...(o.reactions ?? [])].sort((a, b) => `${a.target}${a.from}`.localeCompare(`${b.target}${b.from}`)),
    removed: [...new Set(o.removed)].sort(),
  };
}

/** Reads `shared.json`; anything malformed is skipped rather than failing the whole backup. */
export function parseShared(json: string): SharedManifest {
  const raw = JSON.parse(json) as Partial<Record<keyof SharedManifest, unknown>> | null;
  if (!raw || typeof raw.version !== 'number') throw new Error('Not a LookBack shared-pages backup.');
  const list = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]).filter((x) => x && typeof x === 'object') : []);
  const letters: SharedLetter[] = list(raw.letters)
    .filter((l) => str(l.id) && ID.test(l.id) && str(l.senderId) && str(l.memoryDate) && str(l.receivedAt))
    .map((l) => ({
      id: l.id as string,
      senderId: l.senderId as string,
      senderName: str(l.senderName) ? l.senderName : 'Someone',
      senderPortrait: strOrNull(l.senderPortrait),
      memoryDate: l.memoryDate as string,
      body: str(l.body) ? l.body : '',
      voiceTitle: strOrNull(l.voiceTitle),
      voiceMs: numOrNull(l.voiceMs),
      photoPath: str(l.photoPath) && sharedFileName(l.photoPath) ? l.photoPath : null,
      voicePath: str(l.voicePath) && sharedFileName(l.voicePath) ? l.voicePath : null,
      receivedAt: l.receivedAt as string,
      openedAt: strOrNull(l.openedAt),
    }));
  const given: SharedGiven[] = list(raw.given)
    .filter((g) => str(g.id) && str(g.entryId) && str(g.personId) && str(g.givenAt))
    .map((g) => ({ id: g.id as string, entryId: g.entryId as string, personId: g.personId as string, memoryDate: strOrNull(g.memoryDate), givenAt: g.givenAt as string, state: str(g.state) ? g.state : 'waiting' }));
  const people: SharedPerson[] = list(raw.people)
    .filter((p) => str(p.id) && str(p.name))
    .map((p) => ({ id: p.id as string, name: p.name as string, addedAt: str(p.addedAt) ? p.addedAt : '', publicKey: strOrNull(p.publicKey), portrait: strOrNull(p.portrait), friends: p.friends === true }));
  const removed = Array.isArray(raw.removed) ? (raw.removed as unknown[]).filter(str) : [];
  const messages: SharedMessage[] = list(raw.messages)
    .filter((m) => str(m.id) && ID.test(m.id) && str(m.personId) && str(m.at) && (m.kind === 'text' || m.kind === 'voice'))
    .map((m) => ({
      id: m.id as string,
      personId: m.personId as string,
      mine: m.mine === true,
      kind: m.kind as 'text' | 'voice',
      body: str(m.body) ? m.body : '',
      voicePath: str(m.voicePath) && sharedFileName(m.voicePath) ? m.voicePath : null,
      voiceMs: numOrNull(m.voiceMs),
      voiceWave: Array.isArray(m.voiceWave) ? (m.voiceWave as unknown[]).filter((v): v is number => typeof v === 'number').slice(0, 200) : null,
      at: m.at as string,
    }));
  const reactions: SharedReaction[] = list(raw.reactions)
    .filter((r) => str(r.target) && str(r.from) && str(r.emoji) && str(r.at))
    .map((r) => ({ target: r.target as string, from: r.from as string, emoji: r.emoji as string, at: r.at as string }));
  return { version: raw.version, exportedAt: str(raw.exportedAt) ? raw.exportedAt : '', letters, given, people, removed, messages, reactions };
}

/** How far a given page got: a later step always wins when two copies disagree. */
const GIVEN_RANK: Record<string, number> = { waiting: 0, returned: 1, sealed: 2, declined: 3, kept: 3 };

export interface SharedPlan {
  messagesToPhone: SharedMessage[];
  /** Messages deleted on another phone (for me, or for everyone). */
  messagesRemoveOnPhone: string[];
  messagesToDrive: SharedMessage[];
  reactionsToPhone: SharedReaction[];
  /** Letters the phone doesn't have (bring their files down first). */
  lettersToPhone: SharedLetter[];
  /** Letters the phone has that Drive doesn't (send their files up). */
  lettersToDrive: SharedLetter[];
  /** Letters the phone should throw away (removed on another phone). */
  removeOnPhone: string[];
  givenToPhone: SharedGiven[];
  peopleToPhone: SharedPerson[];
  /** What Drive should hold afterwards. */
  manifest: SharedManifest;
  /** Drive's copy is out of date. */
  driveChanged: boolean;
}

export function mergeShared(local: Omit<SharedManifest, 'version' | 'messages' | 'reactions'> & { messages?: SharedMessage[]; reactions?: SharedReaction[] }, remote: SharedManifest | null, now: string): SharedPlan {
  const localMessages = new Map((local.messages ?? []).map((m) => [m.id, m]));
  const remoteMessages = new Map((remote?.messages ?? []).map((m) => [m.id, m]));
  const removedIds = new Set([...local.removed, ...(remote?.removed ?? [])]);
  const messages = new Map([...remoteMessages, ...localMessages].filter(([id]) => !removedIds.has(id)));
  const reactions = new Map<string, SharedReaction>();
  for (const r of [...(remote?.reactions ?? []), ...(local.reactions ?? [])]) {
    const k = `${r.target}|${r.from}`;
    const seen = reactions.get(k);
    if (!seen || r.at >= seen.at) reactions.set(k, r);
  }
  const localReactions = new Map((local.reactions ?? []).map((r) => [`${r.target}|${r.from}`, r]));
  const removed = new Set([...local.removed, ...(remote?.removed ?? [])]);
  const remoteLetters = new Map((remote?.letters ?? []).map((l) => [l.id, l]));
  const localLetters = new Map(local.letters.map((l) => [l.id, l]));
  const letters = new Map<string, SharedLetter>();
  for (const l of [...(remote?.letters ?? []), ...local.letters]) if (!removed.has(l.id)) letters.set(l.id, { ...l, openedAt: localLetters.get(l.id)?.openedAt ?? l.openedAt });

  const given = new Map<string, SharedGiven>();
  for (const g of [...(remote?.given ?? []), ...local.given]) {
    const seen = given.get(g.id);
    if (!seen || (GIVEN_RANK[g.state] ?? 0) >= (GIVEN_RANK[seen.state] ?? 0)) given.set(g.id, g);
  }
  const localGiven = new Map(local.given.map((g) => [g.id, g]));

  const people = new Map<string, SharedPerson>();
  for (const p of [...(remote?.people ?? []), ...local.people]) {
    const seen = people.get(p.id);
    people.set(p.id, seen ? { ...p, friends: p.friends || seen.friends, publicKey: p.publicKey ?? seen.publicKey, portrait: p.portrait ?? seen.portrait } : p);
  }
  const localPeople = new Set(local.people.map((p) => p.id));

  const manifest = buildShared({ letters: [...letters.values()], given: [...given.values()], people: [...people.values()], removed: [...removed], exportedAt: now, messages: [...messages.values()], reactions: [...reactions.values()] });
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const driveChanged = !remote || !same({ ...manifest, exportedAt: '' }, { ...buildShared({ ...remote, exportedAt: '' }) });
  return {
    messagesToPhone: [...messages.values()].filter((m) => !localMessages.has(m.id)),
    messagesRemoveOnPhone: [...localMessages.keys()].filter((id) => removedIds.has(id)),
    messagesToDrive: [...messages.values()].filter((m) => !remoteMessages.has(m.id)),
    reactionsToPhone: [...reactions.entries()].filter(([k, r]) => localReactions.get(k)?.at !== r.at).map(([, r]) => r),
    lettersToPhone: [...letters.values()].filter((l) => !localLetters.has(l.id)),
    lettersToDrive: [...letters.values()].filter((l) => !remoteLetters.has(l.id)),
    removeOnPhone: local.letters.filter((l) => removed.has(l.id)).map((l) => l.id),
    givenToPhone: [...given.values()].filter((g) => !localGiven.has(g.id) || localGiven.get(g.id)!.state !== g.state),
    peopleToPhone: [...people.values()].filter((p) => !localPeople.has(p.id) || (p.friends && !local.people.find((q) => q.id === p.id)?.friends)),
    manifest,
    driveChanged,
  };
}
