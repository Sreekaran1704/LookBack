import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'yearbook.db';

/**
 * Ordered migrations. Index i upgrades from user_version i to i + 1.
 * Only ever append; never edit a shipped migration.
 */
const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE IF NOT EXISTS entries (
    id TEXT PRIMARY KEY NOT NULL,
    local_date TEXT NOT NULL,
    text TEXT NOT NULL DEFAULT '',
    photo_uri TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_entries_local_date ON entries (local_date);
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
  // v2: optional scrapbook style. NULL means "derive from the entry id seed".
  `
  ALTER TABLE entries ADD COLUMN object_type TEXT;
  ALTER TABLE entries ADD COLUMN tape_pattern TEXT;
  ALTER TABLE entries ADD COLUMN sticker TEXT;
  `,
  // v3: chosen colors for the sticker and the tape (a style palette name). NULL = the year's color.
  `
  ALTER TABLE entries ADD COLUMN sticker_color TEXT;
  ALTER TABLE entries ADD COLUMN tape_color TEXT;
  `,
  // v4: memories the person deleted, so a Drive sync doesn't bring them back.
  `
  CREATE TABLE IF NOT EXISTS deleted_entries (
    id TEXT PRIMARY KEY NOT NULL,
    deleted_at TEXT NOT NULL
  );
  `,
  // v5: a voice note: its file (relative to the document directory), its waveform (JSON, 0–1 bars) and length.
  `
  ALTER TABLE entries ADD COLUMN voice_uri TEXT;
  ALTER TABLE entries ADD COLUMN voice_wave TEXT;
  ALTER TABLE entries ADD COLUMN voice_ms INTEGER;
  `,
  // v6: a reply to your past self, written when the memory came back a year (or more) later, and when it was written.
  `
  ALTER TABLE entries ADD COLUMN reply TEXT;
  ALTER TABLE entries ADD COLUMN replied_at TEXT;
  `,
  // v7: the words the person writes on their cassette.
  `ALTER TABLE entries ADD COLUMN voice_title TEXT;`,
  // v8: giving memories phone to phone (Blip style). Everything stays on the phone: the people you've added (their
  // account id and name), the memories people gave you (files in received/<id>/), and the gifts still waiting to go.
  `
  CREATE TABLE IF NOT EXISTS people (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    added_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS received_letters (
    id TEXT PRIMARY KEY NOT NULL,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    memory_date TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    voice_title TEXT,
    voice_ms INTEGER,
    photo_path TEXT,
    voice_path TEXT,
    received_at TEXT NOT NULL,
    opened_at TEXT
  );
  CREATE TABLE IF NOT EXISTS outbox (
    id TEXT PRIMARY KEY NOT NULL,
    entry_id TEXT NOT NULL,
    person_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  `,
  // v9: each person's phone key (identity.ts), learned from their code or the first page they gave; pages' connections
  // are signed with it, so even LookBack's server can't step in between.
  `ALTER TABLE people ADD COLUMN public_key TEXT;`,
  // v10: each person's portrait code (lib/portrait.ts), from the pages they give; a page keeps the one it came with.
  `
  ALTER TABLE people ADD COLUMN portrait TEXT;
  ALTER TABLE received_letters ADD COLUMN sender_portrait TEXT;
  `,
];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  // WAL lets reads run alongside a write; NORMAL sync is safe with WAL and skips an fsync per commit.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA temp_store = MEMORY;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version];
    const next = version + 1;
    await db.withTransactionAsync(async () => {
      if (sql) await db.execAsync(sql);
      await db.execAsync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
}

/** Lazily opens and migrates the database. Only the data/ modules should call this. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await migrate(db);
      return db;
    })().catch((error: unknown) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}
