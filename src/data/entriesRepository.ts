import * as Crypto from 'expo-crypto';
import { createChangeEmitter } from './changes';
import { getDb } from './db';
import { deletePhoto, importPhoto } from './photoStore';
import { deleteVoice, importVoice } from './voiceStore';
import type { Entry, SaveEntryInput } from './types';
import { LOCAL_ONLY_PREFIX, type Tombstone } from '../lib/backup';
import { isValidLocalDate, type LocalDate } from '../lib/dates';
import { encodeWave, parseWave } from '../lib/voice';

/**
 * The only way the app reads or writes entries. UI code must not touch SQLite or the file
 * system directly. A future Drive backup plugs in behind this interface.
 */
export interface EntriesRepository {
  getAll(): Promise<Entry[]>;
  getById(id: string): Promise<Entry | null>;
  getByDate(localDate: LocalDate): Promise<Entry | null>;
  getByYear(year: number): Promise<Entry[]>;
  count(): Promise<number>;
  /** Every day that has a page, newest first (cheap: for the app icon's mood and the widget). */
  listDates(): Promise<LocalDate[]>;
  /** Creates or updates the single entry for that day. */
  saveForDate(input: SaveEntryInput): Promise<Entry>;
  /** Writes back to your past self on a memory that came back (empty text takes the reply away). */
  writeBack(id: string, reply: string): Promise<Entry>;
  labelVoice(id: string, title: string): Promise<void>;
  /** Inserts an entry as-is (used by the dev seeder and, later, restore). */
  insertRaw(entry: Entry): Promise<void>;
  /**
   * Deletes an entry, its photo and its voice note. By default it is remembered as deleted, so a backup sync
   * removes it everywhere instead of restoring it; sync itself passes `{ remember: false }`.
   */
  remove(id: string, options?: { remember?: boolean }): Promise<void>;
  /** Deletions remembered on this phone (for backup sync). */
  listDeleted(): Promise<Tombstone[]>;
  /** Records deletions learned from a backup. */
  recordDeleted(tombstones: readonly Tombstone[]): Promise<void>;
  subscribe(listener: () => void): () => void;
}

interface EntryRow {
  id: string;
  local_date: string;
  text: string;
  photo_uri: string | null;
  created_at: string;
  updated_at: string;
  object_type: string | null;
  tape_pattern: string | null;
  sticker: string | null;
  sticker_color: string | null;
  tape_color: string | null;
  voice_uri: string | null;
  voice_wave: string | null;
  voice_ms: number | null;
  reply: string | null;
  replied_at: string | null;
  voice_title: string | null;
}

const COLUMNS = 'id, local_date, text, photo_uri, created_at, updated_at, object_type, tape_pattern, sticker, sticker_color, tape_color, voice_uri, voice_wave, voice_ms, reply, replied_at, voice_title';
const PLACEHOLDERS = '?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?';

function toEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    localDate: row.local_date,
    text: row.text,
    photoPath: row.photo_uri,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    objectType: row.object_type,
    tapePattern: row.tape_pattern,
    sticker: row.sticker,
    stickerColor: row.sticker_color,
    tapeColor: row.tape_color,
    voicePath: row.voice_uri,
    voiceWave: parseWave(row.voice_wave),
    voiceMs: row.voice_ms,
    reply: row.reply,
    repliedAt: row.replied_at,
    voiceTitle: row.voice_title ?? null,
  };
}

function rowValues(e: Entry) {
  return [e.id, e.localDate, e.text, e.photoPath, e.createdAt, e.updatedAt, e.objectType, e.tapePattern, e.sticker, e.stickerColor, e.tapeColor, e.voicePath, encodeWave(e.voiceWave), e.voiceMs, e.reply, e.repliedAt, e.voiceTitle ?? null] as const;
}

function createSqliteEntriesRepository(): EntriesRepository {
  const changes = createChangeEmitter();

  async function getByDate(localDate: LocalDate): Promise<Entry | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<EntryRow>(
      `SELECT ${COLUMNS} FROM entries WHERE local_date = ? ORDER BY created_at ASC LIMIT 1`,
      localDate,
    );
    return row ? toEntry(row) : null;
  }

  async function getById(id: string): Promise<Entry | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<EntryRow>(`SELECT ${COLUMNS} FROM entries WHERE id = ?`, id);
    return row ? toEntry(row) : null;
  }

  return {
    async getAll() {
      const db = await getDb();
      const rows = await db.getAllAsync<EntryRow>(
        `SELECT ${COLUMNS} FROM entries ORDER BY local_date DESC, created_at DESC`,
      );
      return rows.map(toEntry);
    },

    getById,
    getByDate,

    async getByYear(year) {
      const db = await getDb();
      const rows = await db.getAllAsync<EntryRow>(
        `SELECT ${COLUMNS} FROM entries WHERE local_date LIKE ? ORDER BY local_date DESC`,
        `${year}-%`,
      );
      return rows.map(toEntry);
    },

    async count() {
      const db = await getDb();
      const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM entries');
      return row?.n ?? 0;
    },

    async listDates() {
      const db = await getDb();
      const rows = await db.getAllAsync<{ local_date: string }>('SELECT DISTINCT local_date FROM entries ORDER BY local_date DESC');
      return rows.map((r) => r.local_date);
    },

    async saveForDate({ id, localDate, text, photo, voice = { kind: 'keep' }, style }) {
      if (!isValidLocalDate(localDate)) throw new Error(`Invalid local date: ${localDate}`);
      const db = await getDb();
      const existing = await getByDate(localDate);
      const now = new Date().toISOString();

      let photoPath = existing?.photoPath ?? null;
      let photoToDelete: string | null = null;
      if (photo.kind === 'set') {
        photoToDelete = photoPath;
        photoPath = await importPhoto(photo.sourceUri);
      } else if (photo.kind === 'remove') {
        photoToDelete = photoPath;
        photoPath = null;
      }

      let voicePath = existing?.voicePath ?? null;
      let voiceWave = existing?.voiceWave ?? null;
      let voiceMs = existing?.voiceMs ?? null;
      let voiceToDelete: string | null = null;
      if (voice.kind === 'set') {
        voiceToDelete = voicePath;
        voicePath = await importVoice(voice.sourceUri);
        voiceWave = voice.wave;
        voiceMs = Math.round(voice.ms);
      } else if (voice.kind === 'remove') {
        voiceToDelete = voicePath;
        voicePath = null;
        voiceWave = null;
        voiceMs = null;
      }

      const trimmed = text.trim();
      const nextStyle = {
        objectType: style?.objectType !== undefined ? style.objectType : (existing?.objectType ?? null),
        tapePattern: style?.tapePattern !== undefined ? style.tapePattern : (existing?.tapePattern ?? null),
        sticker: style?.sticker !== undefined ? style.sticker : (existing?.sticker ?? null),
        stickerColor: style?.stickerColor !== undefined ? style.stickerColor : (existing?.stickerColor ?? null),
        tapeColor: style?.tapeColor !== undefined ? style.tapeColor : (existing?.tapeColor ?? null),
      };
      let saved: Entry;
      if (existing) {
        await db.runAsync(
          'UPDATE entries SET text = ?, photo_uri = ?, updated_at = ?, object_type = ?, tape_pattern = ?, sticker = ?, sticker_color = ?, tape_color = ?, voice_uri = ?, voice_wave = ?, voice_ms = ? WHERE id = ?',
          trimmed,
          photoPath,
          now,
          nextStyle.objectType,
          nextStyle.tapePattern,
          nextStyle.sticker,
          nextStyle.stickerColor,
          nextStyle.tapeColor,
          voicePath,
          encodeWave(voiceWave),
          voiceMs,
          existing.id,
        );
        saved = { ...existing, text: trimmed, photoPath, voicePath, voiceWave, voiceMs, updatedAt: now, ...nextStyle };
      } else {
        saved = {
          id: id ?? Crypto.randomUUID(),
          localDate,
          text: trimmed,
          photoPath,
          voicePath,
          voiceWave,
          voiceMs,
          reply: null,
          repliedAt: null,
          createdAt: now,
          updatedAt: now,
          ...nextStyle,
        };
        await db.runAsync(`INSERT INTO entries (${COLUMNS}) VALUES (${PLACEHOLDERS})`, ...rowValues(saved));
      }

      if (photoToDelete && photoToDelete !== photoPath) deletePhoto(photoToDelete);
      if (voiceToDelete && voiceToDelete !== voicePath) deleteVoice(voiceToDelete);
      changes.emit();
      return saved;
    },

    async labelVoice(id, title) {
      const existing = await getById(id);
      if (!existing?.voicePath) throw new Error('This memory has no recording.');
      const db = await getDb();
      await db.runAsync('UPDATE entries SET voice_title = ?, updated_at = ? WHERE id = ?', title.trim().slice(0, 60) || null, new Date().toISOString(), id);
      changes.emit();
    },

    async writeBack(id, reply) {
      const db = await getDb();
      const existing = await getById(id);
      if (!existing) throw new Error('That memory is no longer here.');
      const now = new Date().toISOString();
      const trimmed = reply.trim();
      const next = trimmed.length > 0 ? trimmed : null;
      const repliedAt = next ? now : null;
      await db.runAsync('UPDATE entries SET reply = ?, replied_at = ?, updated_at = ? WHERE id = ?', next, repliedAt, now, id);
      changes.emit();
      return { ...existing, reply: next, repliedAt, updatedAt: now };
    },

    async insertRaw(entry) {
      const db = await getDb();
      await db.runAsync(`INSERT OR REPLACE INTO entries (${COLUMNS}) VALUES (${PLACEHOLDERS})`, ...rowValues(entry));
      changes.emit();
    },

    async remove(id, options) {
      const db = await getDb();
      const existing = await getById(id);
      if (!existing) return;
      const remember = (options?.remember ?? true) && !id.startsWith(LOCAL_ONLY_PREFIX);
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM entries WHERE id = ?', id);
        if (remember) {
          await db.runAsync('INSERT OR REPLACE INTO deleted_entries (id, deleted_at) VALUES (?, ?)', id, new Date().toISOString());
        }
      });
      if (existing.photoPath) deletePhoto(existing.photoPath);
      if (existing.voicePath) deleteVoice(existing.voicePath);
      changes.emit();
    },

    async listDeleted() {
      const db = await getDb();
      const rows = await db.getAllAsync<{ id: string; deleted_at: string }>('SELECT id, deleted_at FROM deleted_entries');
      return rows.map((r) => ({ id: r.id, deletedAt: r.deleted_at }));
    },

    async recordDeleted(tombstones) {
      if (tombstones.length === 0) return;
      const db = await getDb();
      await db.withTransactionAsync(async () => {
        for (const t of tombstones) {
          await db.runAsync('INSERT OR REPLACE INTO deleted_entries (id, deleted_at) VALUES (?, ?)', t.id, t.deletedAt);
        }
      });
    },

    subscribe: changes.subscribe,
  };
}

export const entriesRepository: EntriesRepository = createSqliteEntriesRepository();

/** A fresh entry id, for screens that need to know a new entry's id before saving it. */
export function newEntryId(): string {
  return Crypto.randomUUID();
}
