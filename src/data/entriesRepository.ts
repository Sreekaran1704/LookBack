import * as Crypto from 'expo-crypto';
import { createChangeEmitter } from './changes';
import { getDb } from './db';
import { deletePhoto, importPhoto } from './photoStore';
import type { Entry, SaveEntryInput } from './types';
import { isValidLocalDate, type LocalDate } from '../lib/dates';

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
  /** Inserts an entry as-is (used by the dev seeder and, later, restore). */
  insertRaw(entry: Entry): Promise<void>;
  remove(id: string): Promise<void>;
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
}

const COLUMNS = 'id, local_date, text, photo_uri, created_at, updated_at, object_type, tape_pattern, sticker, sticker_color, tape_color';
const PLACEHOLDERS = '?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?';

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
  };
}

function rowValues(e: Entry) {
  return [e.id, e.localDate, e.text, e.photoPath, e.createdAt, e.updatedAt, e.objectType, e.tapePattern, e.sticker, e.stickerColor, e.tapeColor] as const;
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

    async saveForDate({ id, localDate, text, photo, style }) {
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
          'UPDATE entries SET text = ?, photo_uri = ?, updated_at = ?, object_type = ?, tape_pattern = ?, sticker = ?, sticker_color = ?, tape_color = ? WHERE id = ?',
          trimmed,
          photoPath,
          now,
          nextStyle.objectType,
          nextStyle.tapePattern,
          nextStyle.sticker,
          nextStyle.stickerColor,
          nextStyle.tapeColor,
          existing.id,
        );
        saved = { ...existing, text: trimmed, photoPath, updatedAt: now, ...nextStyle };
      } else {
        saved = {
          id: id ?? Crypto.randomUUID(),
          localDate,
          text: trimmed,
          photoPath,
          createdAt: now,
          updatedAt: now,
          ...nextStyle,
        };
        await db.runAsync(`INSERT INTO entries (${COLUMNS}) VALUES (${PLACEHOLDERS})`, ...rowValues(saved));
      }

      if (photoToDelete && photoToDelete !== photoPath) deletePhoto(photoToDelete);
      changes.emit();
      return saved;
    },

    async insertRaw(entry) {
      const db = await getDb();
      await db.runAsync(`INSERT OR REPLACE INTO entries (${COLUMNS}) VALUES (${PLACEHOLDERS})`, ...rowValues(entry));
      changes.emit();
    },

    async remove(id) {
      const db = await getDb();
      const existing = await getById(id);
      if (!existing) return;
      await db.runAsync('DELETE FROM entries WHERE id = ?', id);
      if (existing.photoPath) deletePhoto(existing.photoPath);
      changes.emit();
    },

    subscribe: changes.subscribe,
  };
}

export const entriesRepository: EntriesRepository = createSqliteEntriesRepository();

/** A fresh entry id, for screens that need to know a new entry's id before saving it. */
export function newEntryId(): string {
  return Crypto.randomUUID();
}
