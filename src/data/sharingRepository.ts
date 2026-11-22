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
}
export interface ReceivedLetter {
  id: string;
  senderId: string;
  senderName: string;
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
export interface OutboxItem {
  id: string;
  entryId: string;
  personId: string;
  createdAt: string;
}

const RECEIVED_DIR = 'received';
const changes = createChangeEmitter();

interface LetterRow {
  id: string;
  sender_id: string;
  sender_name: string;
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
    const rows = await db.getAllAsync<{ id: string; name: string; added_at: string; public_key: string | null }>('SELECT * FROM people ORDER BY name COLLATE NOCASE');
    return rows.map((r) => ({ id: r.id, name: r.name, addedAt: r.added_at, publicKey: r.public_key }));
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
  async removePerson(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM people WHERE id = ?', id);
    await db.runAsync('DELETE FROM outbox WHERE person_id = ?', id);
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
      `INSERT OR REPLACE INTO received_letters (id, sender_id, sender_name, memory_date, body, voice_title, voice_ms, photo_path, voice_path, received_at, opened_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      letter.id,
      letter.senderId,
      letter.senderName,
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
  /** Throws a received letter away, files and all. */
  async removeLetter(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM received_letters WHERE id = ?', id);
    try {
      const dir = new Directory(Paths.document, RECEIVED_DIR, id);
      if (dir.exists) dir.delete();
    } catch {
      // Already gone.
    }
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
  async queue(entryId: string, personId: string): Promise<string> {
    const db = await getDb();
    const id = Crypto.randomUUID();
    await db.runAsync('INSERT INTO outbox (id, entry_id, person_id, created_at) VALUES (?, ?, ?, ?)', id, entryId, personId, new Date().toISOString());
    changes.emit();
    return id;
  },
  async sent(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM outbox WHERE id = ?', id);
    changes.emit();
  },
};
