import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { createChangeEmitter } from './changes';
import { fromBase64Url } from '../lib/identity';
import { getDb } from './db';

/**
 * Giving memories phone to phone, all kept on this phone: the people you've added, the memories people gave you (their
 * files under received/<id>/), and gifts waiting for someone to come online. Nothing here is ever uploaded.
 */

export interface Person {
  /** Their LookBack account id (how the two phones find each other to connect). */
  id: string;
  name: string;
  addedAt: string;
  /** Their phone's key (identity.ts), or null until it's learned. */
  publicKey: string | null;
  /** Their portrait's code (lib/portrait.ts), from their latest page; null until they give one. */
  portrait: string | null;
  /** They've added you too (or you accepted their add): only then can pages go between you. */
  friends: boolean;
  /** When you last removed them, and when they last removed you (lib/friendship.ts); null if never. */
  myCut: string | null;
  theirCut: string | null;
  /** Your best friend: a heart beside their name. */
  best: boolean;
}
export interface ReceivedLetter {
  id: string;
  senderId: string;
  senderName: string;
  /** The giver's portrait code as it was on this page (null from an older app). */
  senderPortrait: string | null;
  memoryDate: string;
  body: string;
  voiceTitle: string | null;
  voiceMs: number | null;
  /** Relative to the document directory, like a diary entry's. */
  photoPath: string | null;
  voicePath: string | null;
  receivedAt: string;
  openedAt: string | null;
}
/**
 * A chat message (lib/chat.ts). Yours: `sending` (not out yet), `sent` (sealed in their mailbox), `delivered`.
 * Theirs: `new` or `read`. A reaction is kept as a `react` message until it's delivered (its body is
 * {"target","emoji"}); the thread doesn't show those.
 */
export interface ChatRow {
  id: string;
  personId: string;
  mine: boolean;
  /** `read` / `unsend` are yours in flight (seen ticks, delete for everyone): kept only until delivered. */
  kind: 'text' | 'voice' | 'react' | 'read' | 'unsend';
  body: string;
  voicePath: string | null;
  voiceMs: number | null;
  voiceWave: number[] | null;
  at: string;
  /** `returned`: it waited sealed a week and was taken back; it goes when you're both online. */
  /** `seen`: yours, and they've seen it (it can't be deleted for everyone any more). */
  state: 'sending' | 'sent' | 'delivered' | 'seen' | 'new' | 'read' | 'returned';
}
/** Someone's latest reaction on a page or message (`from` is 'me' for yours). */
export interface Reaction {
  target: string;
  from: string;
  emoji: string;
  at: string;
}
/** Someone who added you and hasn't been added back (or told not now) yet. */
export interface FriendRequest {
  id: string;
  name: string;
  key: string | null;
  at: number;
}

/** A page you gave someone, and how it went. */
/** `returned`: it waited sealed for 7 days and you took it back off the server; it goes when you're both online. */
export type GivenState = 'waiting' | 'sealed' | 'kept' | 'declined' | 'returned';
export interface GivenPage {
  id: string;
  entryId: string;
  personId: string;
  /** The page's day (null for a give queued before 1.3.3 and since deleted from your diary). */
  memoryDate: string | null;
  givenAt: string;
  state: GivenState;
}

export interface OutboxItem {
  id: string;
  entryId: string;
  personId: string;
  createdAt: string;
}

const RECEIVED_DIR = 'received';
const changes = createChangeEmitter();

interface MessageRow {
  id: string;
  person_id: string;
  mine: number;
  kind: string;
  body: string;
  voice_path: string | null;
  voice_ms: number | null;
  voice_wave: string | null;
  at: string;
  state: string;
}
function toChat(r: MessageRow): ChatRow {
  let wave: number[] | null = null;
  try {
    wave = r.voice_wave ? (JSON.parse(r.voice_wave) as number[]) : null;
  } catch {
    wave = null;
  }
  return {
    id: r.id,
    personId: r.person_id,
    mine: r.mine === 1,
    kind: (['voice', 'react', 'read', 'unsend'] as const).find((k) => k === r.kind) ?? 'text',
    body: r.body,
    voicePath: r.voice_path,
    voiceMs: r.voice_ms,
    voiceWave: wave,
    at: r.at,
    state: (['sending', 'sent', 'delivered', 'seen', 'new', 'read', 'returned'] as const).find((s) => s === r.state) ?? 'new',
  };
}

interface LetterRow {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_portrait: string | null;
  memory_date: string;
  body: string;
  voice_title: string | null;
  voice_ms: number | null;
  photo_path: string | null;
  voice_path: string | null;
  received_at: string;
  opened_at: string | null;
}
const toLetter = (r: LetterRow): ReceivedLetter => ({
  id: r.id,
  senderId: r.sender_id,
  senderName: r.sender_name,
  senderPortrait: r.sender_portrait ?? null,
  memoryDate: r.memory_date,
  body: r.body,
  voiceTitle: r.voice_title,
  voiceMs: r.voice_ms,
  photoPath: r.photo_path,
  voicePath: r.voice_path,
  receivedAt: r.received_at,
  openedAt: r.opened_at,
});

export const sharingRepository = {
  subscribe: changes.subscribe,

  async people(): Promise<Person[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<{ id: string; name: string; added_at: string; public_key: string | null; portrait: string | null; friends: number | null; mine: string | null; theirs: string | null; best: number | null }>(
      'SELECT people.*, cuts.mine, cuts.theirs FROM people LEFT JOIN cuts ON cuts.person_id = people.id ORDER BY name COLLATE NOCASE',
    );
    return rows.map((r) => ({ id: r.id, name: r.name, addedAt: r.added_at, publicKey: r.public_key, portrait: r.portrait ?? null, friends: r.friends === 1, myCut: r.mine ?? null, theirCut: r.theirs ?? null, best: r.best === 1 }));
  },
  async setBest(id: string, best: boolean): Promise<void> {
    const db = await getDb();
    await db.runAsync('UPDATE people SET best = ? WHERE id = ?', best ? 1 : 0, id.toLowerCase());
    changes.emit();
  },
  /** When you last removed this person (kept after they're gone), for the hellos you send them. */
  async myCut(id: string): Promise<string | null> {
    const db = await getDb();
    return (await db.getFirstAsync<{ mine: string | null }>('SELECT mine FROM cuts WHERE person_id = ?', id.toLowerCase()))?.mine ?? null;
  },
  /** When they last removed you, as their hello says (null: never). */
  async setTheirCut(id: string, at: string | null): Promise<void> {
    const db = await getDb();
    const r = await db.runAsync(
      'INSERT INTO cuts (person_id, theirs) VALUES (?, ?) ON CONFLICT(person_id) DO UPDATE SET theirs = excluded.theirs WHERE cuts.theirs IS NOT excluded.theirs',
      id.toLowerCase(),
      at,
    );
    if (r.changes > 0) changes.emit();
  },
  /** They have you too: pages can go both ways now. Returns true if that's news. */
  async markFriends(id: string): Promise<boolean> {
    const db = await getDb();
    const r = await db.runAsync('UPDATE people SET friends = 1 WHERE id = ? AND friends = 0', id.toLowerCase());
    if (r.changes > 0) changes.emit();
    return r.changes > 0;
  },
  async person(id: string): Promise<Person | null> {
    return (await sharingRepository.people()).find((p) => p.id === id.toLowerCase()) ?? null;
  },
  /**
   * Adds someone (or updates their name), with their phone key when it's known. A key from their code (`scanned`,
   * shown to you in person or sent by them) always wins; a key `learned` over the internet (nearby, their first page)
   * is only kept when you didn't have one, so nobody can quietly swap it later.
   */
  async addPerson(id: string, name: string, key: string | null = null, trust: 'scanned' | 'learned' = 'learned'): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO people (id, name, added_at, public_key) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name,
         public_key = CASE WHEN ? = 'scanned' AND excluded.public_key IS NOT NULL THEN excluded.public_key ELSE COALESCE(people.public_key, excluded.public_key) END`,
      id.toLowerCase(),
      name.trim().slice(0, 80) || 'Someone',
      new Date().toISOString(),
      key,
      trust,
    );
    changes.emit();
  },
  /** Keeps the portrait someone's page came with (a newer page brings their newer portrait). */
  async setPortrait(id: string, portrait: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('UPDATE people SET portrait = ? WHERE id = ?', portrait, id.toLowerCase());
    changes.emit();
  },
  async removePerson(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM people WHERE id = ?', id);
    // What you gave them stays (it shows again if you're friends again and only one of you removed the other).
    await db.runAsync('DELETE FROM outbox WHERE person_id = ?', id);
    await db.runAsync("UPDATE given SET state = 'declined' WHERE person_id = ? AND state IN ('waiting', 'returned')", id);
    await db.runAsync('INSERT INTO cuts (person_id, mine) VALUES (?, ?) ON CONFLICT(person_id) DO UPDATE SET mine = excluded.mine', id.toLowerCase(), new Date().toISOString());
    changes.emit();
  },

  async letters(): Promise<ReceivedLetter[]> {
    const db = await getDb();
    return (await db.getAllAsync<LetterRow>('SELECT * FROM received_letters ORDER BY received_at DESC')).map(toLetter);
  },
  async letter(id: string): Promise<ReceivedLetter | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<LetterRow>('SELECT * FROM received_letters WHERE id = ?', id);
    return row ? toLetter(row) : null;
  },
  /** Where a received letter's files go: received/<letter id>/photo.jpg and voice.m4a. */
  letterFile(letterId: string, name: string): { file: File; path: string } {
    const dir = new Directory(Paths.document, RECEIVED_DIR, letterId);
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    return { file: new File(dir, name), path: `${RECEIVED_DIR}/${letterId}/${name}` };
  },
  /** A stored file's address for showing it (photos/…, received/…, chat/…; relative to the documents folder). */
  fileUri(path: string): string {
    return new File(Paths.document, path).uri;
  },
  /** Saves a picture of picked chat bubbles (a JPEG, as base64) in the cache; returns its address for saving to a page. */
  async saveSnapshot(base64: string): Promise<string> {
    const bytes = fromBase64Url(base64.replace(/\s/g, '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
    if (!bytes) throw new Error("Couldn't make the picture.");
    const file = new File(Paths.cache, `lookback-quote-${Date.now()}.jpg`);
    await file.write(bytes);
    return file.uri;
  },
  /** Saves your code (a PNG, as base64) where the share sheet can pick it up; returns its address. */
  async saveCodeImage(base64: string): Promise<string> {
    const bytes = fromBase64Url(base64.replace(/\s/g, '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
    if (!bytes) throw new Error("Couldn't make the picture of your code.");
    const file = new File(Paths.cache, 'lookback-my-code.png');
    if (file.exists) file.delete();
    await file.write(bytes);
    return file.uri;
  },
  /** Keeps a letter that has fully arrived (its files are already written). */
  async keepLetter(letter: Omit<ReceivedLetter, 'receivedAt' | 'openedAt'>): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO received_letters (id, sender_id, sender_name, sender_portrait, memory_date, body, voice_title, voice_ms, photo_path, voice_path, received_at, opened_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      letter.id,
      letter.senderId,
      letter.senderName,
      letter.senderPortrait,
      letter.memoryDate,
      letter.body,
      letter.voiceTitle,
      letter.voiceMs,
      letter.photoPath,
      letter.voicePath,
      new Date().toISOString(),
    );
    changes.emit();
  },
  async markOpened(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('UPDATE received_letters SET opened_at = COALESCE(opened_at, ?) WHERE id = ?', new Date().toISOString(), id);
    changes.emit();
  },
  /** Throws a received letter away, files and all (remembered, so a Drive restore doesn't bring it back). */
  async removeLetter(id: string, { remember = true }: { remember?: boolean } = {}): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM received_letters WHERE id = ?', id);
    if (remember) await db.runAsync('INSERT OR IGNORE INTO removed_letters (id, removed_at) VALUES (?, ?)', id, new Date().toISOString());
    try {
      const dir = new Directory(Paths.document, RECEIVED_DIR, id);
      if (dir.exists) dir.delete();
    } catch {
      // Already gone.
    }
    changes.emit();
  },
  /**
   * You both removed each other at some point: the pages from before `since` are deleted (what they gave you, and
   * your list of what you gave them). Returns how many went.
   */
  async purgeHistory(personId: string, since: string): Promise<number> {
    const db = await getDb();
    const id = personId.toLowerCase();
    const old = await db.getAllAsync<{ id: string }>('SELECT id FROM received_letters WHERE sender_id = ? AND received_at < ?', id, since);
    for (const l of old) await sharingRepository.removeLetter(l.id);
    const r = await db.runAsync('DELETE FROM given WHERE person_id = ? AND given_at < ?', id, since);
    const m = await db.runAsync('DELETE FROM messages WHERE person_id = ? AND at < ?', id, since);
    if (r.changes + m.changes > 0) changes.emit();
    return old.length + r.changes + m.changes;
  },
  // ---- chat

  async messages(personId: string): Promise<ChatRow[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<MessageRow>('SELECT * FROM messages WHERE person_id = ? ORDER BY at', personId.toLowerCase());
    return rows.map(toChat);
  },
  /** Every text and voice message (for the Drive backup). */
  async allMessages(): Promise<ChatRow[]> {
    const db = await getDb();
    return (await db.getAllAsync<MessageRow>("SELECT * FROM messages WHERE kind IN ('text', 'voice') ORDER BY at")).map(toChat);
  },
  /** Yours that haven't reached them yet (retried on hellos and app open). */
  async undelivered(): Promise<ChatRow[]> {
    const db = await getDb();
    return (await db.getAllAsync<MessageRow>("SELECT * FROM messages WHERE mine = 1 AND state IN ('sending', 'sent', 'returned') ORDER BY at")).map(toChat);
  },
  async addMessage(m: ChatRow): Promise<boolean> {
    const db = await getDb();
    const r = await db.runAsync(
      'INSERT OR IGNORE INTO messages (id, person_id, mine, kind, body, voice_path, voice_ms, voice_wave, at, state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      m.id, m.personId.toLowerCase(), m.mine ? 1 : 0, m.kind, m.body, m.voicePath, m.voiceMs, m.voiceWave ? JSON.stringify(m.voiceWave) : null, m.at, m.state,
    );
    if (r.changes > 0) changes.emit();
    return r.changes > 0;
  },
  async setMessageState(id: string, state: ChatRow['state']): Promise<void> {
    const db = await getDb();
    // Never backwards: delivered stays delivered.
    const r = await db.runAsync("UPDATE messages SET state = ? WHERE id = ? AND state NOT IN ('delivered', 'seen', 'read')", state, id);
    if (r.changes > 0) changes.emit();
  },
  /** Marks their messages read; returns the ids that were new (to tell them they've been seen). */
  async markChatRead(personId: string): Promise<string[]> {
    const db = await getDb();
    const fresh = await db.getAllAsync<{ id: string }>("SELECT id FROM messages WHERE person_id = ? AND mine = 0 AND state = 'new'", personId.toLowerCase());
    if (!fresh.length) return [];
    await db.runAsync("UPDATE messages SET state = 'read' WHERE person_id = ? AND mine = 0 AND state = 'new'", personId.toLowerCase());
    changes.emit();
    return fresh.map((r) => r.id);
  },
  /** They've seen these messages of yours. */
  async markSeen(personId: string, ids: readonly string[]): Promise<void> {
    if (!ids.length) return;
    const db = await getDb();
    const r = await db.runAsync(
      `UPDATE messages SET state = 'seen' WHERE mine = 1 AND person_id = ? AND id IN (${ids.map(() => '?').join(',')})`,
      personId.toLowerCase(),
      ...ids,
    );
    if (r.changes > 0) changes.emit();
  },
  /** One message: the row, its recording, and (remembered) so a Drive restore doesn't bring it back. */
  async message(id: string): Promise<ChatRow | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<MessageRow>('SELECT * FROM messages WHERE id = ?', id);
    return row ? toChat(row) : null;
  },
  async deleteMessage(id: string): Promise<void> {
    const db = await getDb();
    const row = await db.getFirstAsync<MessageRow>('SELECT * FROM messages WHERE id = ?', id);
    await db.runAsync('DELETE FROM messages WHERE id = ?', id);
    await db.runAsync("DELETE FROM reactions WHERE target = ?", id);
    await db.runAsync('INSERT OR IGNORE INTO removed_letters (id, removed_at) VALUES (?, ?)', id, new Date().toISOString());
    if (row?.voice_path) {
      try {
        const f = new File(Paths.document, row.voice_path);
        if (f.exists) f.delete();
      } catch {
        // Already gone.
      }
    }
    changes.emit();
  },
  /** Unread messages per person. */
  async unreadMessages(): Promise<Map<string, number>> {
    const db = await getDb();
    const rows = await db.getAllAsync<{ person_id: string; n: number }>("SELECT person_id, COUNT(*) AS n FROM messages WHERE mine = 0 AND state = 'new' AND kind IN ('text', 'voice') GROUP BY person_id");
    return new Map(rows.map((r) => [r.person_id, r.n]));
  },
  /** Where a voice message's recording lives: chat/<id>.<ext>. */
  chatFile(id: string, ext: string): { file: File; path: string } {
    const dir = new Directory(Paths.document, 'chat');
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    return { file: new File(dir, `${id}.${ext}`), path: `chat/${id}.${ext}` };
  },
  async setReaction(r: Reaction): Promise<void> {
    const db = await getDb();
    const res = await db.runAsync(
      'INSERT INTO reactions (target, from_id, emoji, at) VALUES (?, ?, ?, ?) ON CONFLICT(target, from_id) DO UPDATE SET emoji = excluded.emoji, at = excluded.at WHERE excluded.at >= reactions.at',
      r.target, r.from, r.emoji, r.at,
    );
    if (res.changes > 0) changes.emit();
  },
  async reactions(): Promise<Reaction[]> {
    const db = await getDb();
    return (await db.getAllAsync<{ target: string; from_id: string; emoji: string; at: string }>("SELECT * FROM reactions WHERE emoji != ''")).map((r) => ({ target: r.target, from: r.from_id, emoji: r.emoji, at: r.at }));
  },

  // ---- friend requests

  async requests(): Promise<FriendRequest[]> {
    const db = await getDb();
    return (await db.getAllAsync<{ id: string; name: string; public_key: string | null; at: string }>('SELECT * FROM requests ORDER BY at')).map((r) => ({ id: r.id, name: r.name, key: r.public_key, at: Date.parse(r.at) || 0 }));
  },
  async addRequest(r: { id: string; name: string; key: string | null }): Promise<void> {
    const db = await getDb();
    const res = await db.runAsync('INSERT OR IGNORE INTO requests (id, name, public_key, at) VALUES (?, ?, ?, ?)', r.id.toLowerCase(), r.name, r.key, new Date().toISOString());
    if (res.changes > 0) changes.emit();
  },
  async removeRequest(id: string): Promise<void> {
    const db = await getDb();
    const res = await db.runAsync('DELETE FROM requests WHERE id = ?', id.toLowerCase());
    if (res.changes > 0) changes.emit();
  },

  /** Ids of received letters thrown away on this phone. */
  async removedLetters(): Promise<string[]> {
    const db = await getDb();
    return (await db.getAllAsync<{ id: string }>('SELECT id FROM removed_letters')).map((r) => r.id);
  },
  /** Puts back a letter from the Drive backup, as it was (its files are already written). */
  async restoreLetter(l: ReceivedLetter): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR IGNORE INTO received_letters (id, sender_id, sender_name, sender_portrait, memory_date, body, voice_title, voice_ms, photo_path, voice_path, received_at, opened_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      l.id, l.senderId, l.senderName, l.senderPortrait, l.memoryDate, l.body, l.voiceTitle, l.voiceMs, l.photoPath, l.voicePath, l.receivedAt, l.openedAt,
    );
    changes.emit();
  },
  /** Puts back (or moves on) a page you gave, from the Drive backup. */
  async restoreGiven(g: GivenPage): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      'INSERT INTO given (id, entry_id, person_id, memory_date, given_at, state) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET state = excluded.state',
      g.id, g.entryId, g.personId, g.memoryDate, g.givenAt, g.state,
    );
    changes.emit();
  },
  /** Puts back someone from the Drive backup (their key and portrait, and whether you were friends). */
  async restorePerson(p: Omit<Person, 'myCut' | 'theirCut' | 'best'>): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO people (id, name, added_at, public_key, portrait, friends) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET friends = MAX(people.friends, excluded.friends), public_key = COALESCE(people.public_key, excluded.public_key), portrait = COALESCE(people.portrait, excluded.portrait)`,
      p.id, p.name, p.addedAt || new Date().toISOString(), p.publicKey, p.portrait, p.friends ? 1 : 0,
    );
    changes.emit();
  },
  /** Drops files left by a transfer that never finished. */
  discardPartial(letterId: string): void {
    try {
      const dir = new Directory(Paths.document, RECEIVED_DIR, letterId);
      if (dir.exists) dir.delete();
    } catch {
      // Nothing to drop.
    }
  },

  async outbox(): Promise<OutboxItem[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<{ id: string; entry_id: string; person_id: string; created_at: string }>('SELECT * FROM outbox ORDER BY created_at');
    return rows.map((r) => ({ id: r.id, entryId: r.entry_id, personId: r.person_id, createdAt: r.created_at }));
  },
  /** Queues a memory for someone; returns the gift's id (which becomes the letter's id on their phone). */
  async queue(entryId: string, personId: string, memoryDate: string | null = null): Promise<string> {
    const db = await getDb();
    const id = Crypto.randomUUID();
    const now = new Date().toISOString();
    await db.runAsync('INSERT INTO outbox (id, entry_id, person_id, created_at) VALUES (?, ?, ?, ?)', id, entryId, personId, now);
    await db.runAsync('INSERT OR IGNORE INTO given (id, entry_id, person_id, memory_date, given_at) VALUES (?, ?, ?, ?, ?)', id, entryId, personId, memoryDate, now);
    changes.emit();
    return id;
  },
  /** Every page you gave this person (or everyone, with no id), newest first. */
  async given(personId?: string): Promise<GivenPage[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<{ id: string; entry_id: string; person_id: string; memory_date: string | null; given_at: string; state: string }>(
      personId ? 'SELECT * FROM given WHERE person_id = ? ORDER BY given_at DESC' : 'SELECT * FROM given ORDER BY given_at DESC',
      ...(personId ? [personId.toLowerCase()] : []),
    );
    const states: readonly string[] = ['waiting', 'sealed', 'kept', 'declined', 'returned'];
    return rows.map((r) => ({ id: r.id, entryId: r.entry_id, personId: r.person_id, memoryDate: r.memory_date, givenAt: r.given_at, state: (states.includes(r.state) ? r.state : 'waiting') as GivenState }));
  },
  /** How a page you gave went (a kept or declined page stays that way). */
  async setGiven(id: string, state: GivenState): Promise<void> {
    const db = await getDb();
    const r = await db.runAsync("UPDATE given SET state = ? WHERE id = ? AND state NOT IN ('kept', 'declined')", state, id);
    if (r.changes > 0) changes.emit();
  },
  async sent(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM outbox WHERE id = ?', id);
    changes.emit();
  },
};
