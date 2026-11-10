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
