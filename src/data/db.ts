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
  // v11: pages only go between friends: someone you added who has added you too (or whose add you accepted). Anyone
  // who already gave you a page has you, so they start as friends; the rest find out with their next hello.
  `
  ALTER TABLE people ADD COLUMN friends INTEGER NOT NULL DEFAULT 0;
  UPDATE people SET friends = 1 WHERE id IN (SELECT DISTINCT sender_id FROM received_letters);
  -- The pages you gave each person and how each went (waiting / sealed / kept / declined), for their page in Shared.
  -- Gives from before this version weren't kept anywhere once delivered; the ones still on their way are copied in.
  CREATE TABLE IF NOT EXISTS given (
    id TEXT PRIMARY KEY NOT NULL,
    entry_id TEXT NOT NULL,
    person_id TEXT NOT NULL,
    memory_date TEXT,
    given_at TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'waiting'
  );
  INSERT OR IGNORE INTO given (id, entry_id, person_id, given_at) SELECT id, entry_id, person_id, created_at FROM outbox;
  -- Received pages thrown away (e.g. replaced by a newer version), so a Drive restore never brings them back.
  CREATE TABLE IF NOT EXISTS removed_letters (id TEXT PRIMARY KEY NOT NULL, removed_at TEXT NOT NULL);
  `,
  // v12: when you last removed someone (`mine`) and when they last removed you (`theirs`, from their hellos). Kept
  // after removing them: if you both did, your pages start over (lib/friendship.ts).
  `
  CREATE TABLE IF NOT EXISTS cuts (person_id TEXT PRIMARY KEY NOT NULL, mine TEXT, theirs TEXT);
  `,
  // v13: chat between friends (lib/chat.ts): text and voice messages and reactions (also kept as messages until
  // delivered), each person's latest reaction on a page or message, and friend requests ("added you") kept until
  // answered.
  `
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY NOT NULL,
    person_id TEXT NOT NULL,
    mine INTEGER NOT NULL,
    kind TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    voice_path TEXT,
    voice_ms INTEGER,
    voice_wave TEXT,
    at TEXT NOT NULL,
    state TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS messages_person ON messages (person_id, at);
  CREATE TABLE IF NOT EXISTS reactions (
    target TEXT NOT NULL,
    from_id TEXT NOT NULL,
    emoji TEXT NOT NULL,
    at TEXT NOT NULL,
    PRIMARY KEY (target, from_id)
  );
  CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, public_key TEXT, at TEXT NOT NULL);
  `,
  // v14: a best friend's heart (yours to give, kept on this phone).
  `ALTER TABLE people ADD COLUMN best INTEGER NOT NULL DEFAULT 0;`,
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
