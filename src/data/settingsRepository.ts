import { createChangeEmitter } from './changes';
import { getDb } from './db';
import { parsePortrait } from '../lib/portrait';
import { parseLook, type Look } from '../theme/papers';
import type { ReminderSettings, BackupInfo } from './types';

export const DEFAULT_REMINDER: ReminderSettings = { enabled: false, hour: 9, minute: 0 };

const KEY_REMINDER = 'reminder';
/** The page look ({ paper, tone }); was 'system' | 'light' | 'dark' before paper colors (parseLook reads both). */
const KEY_THEME = 'themeMode';
const KEY_PROFILE = 'profile';
const KEY_ONBOARDED = 'onboarded';
const KEY_BACKUP = 'backup';
const KEY_AUTO_ACCEPT = 'pagesArriveByThemselves';

const NO_BACKUP: BackupInfo = { account: null, lastBackupAt: null };

export interface Profile {
  /** What the bunny calls you ('' = not given). */
  name: string;
  /** Your portrait's code (`lib/portrait.ts`), or null until you make one. It goes with the pages you give. */
  portrait: string | null;
}

export interface SettingsRepository {
  getReminder(): Promise<ReminderSettings>;
  setReminder(patch: Partial<ReminderSettings>): Promise<ReminderSettings>;
  getLook(): Promise<Look>;
  setLook(look: Look): Promise<void>;
  getProfile(): Promise<Profile>;
  /** Changes only the fields given (setting your name keeps your portrait, and the other way round). */
  setProfile(patch: Partial<Profile>): Promise<void>;
  /** Whether the first-run questions (name, paper, reminder, backup) have been answered. */
  getOnboarded(): Promise<boolean>;
  setOnboarded(done: boolean): Promise<void>;
  getBackup(): Promise<BackupInfo>;
  /** Whether pages from your people come in without asking (on unless turned off). */
  getAutoAccept(): Promise<boolean>;
  setAutoAccept(on: boolean): Promise<void>;
  setBackup(patch: Partial<BackupInfo>): Promise<BackupInfo>;
  subscribe(listener: () => void): () => void;
}

function parseReminder(raw: string | undefined): ReminderSettings {
  if (!raw) return DEFAULT_REMINDER;
  try {
    const value = JSON.parse(raw) as Partial<ReminderSettings>;
    return {
      enabled: typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_REMINDER.enabled,
      hour: typeof value.hour === 'number' ? value.hour : DEFAULT_REMINDER.hour,
      minute: typeof value.minute === 'number' ? value.minute : DEFAULT_REMINDER.minute,
    };
  } catch {
    return DEFAULT_REMINDER;
  }
}

function createSqliteSettingsRepository(): SettingsRepository {
  const changes = createChangeEmitter();

  async function read(key: string): Promise<string | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
    return row?.value ?? null;
  }

  async function write(key: string, value: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, value);
    changes.emit();
  }

  async function getReminder(): Promise<ReminderSettings> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      KEY_REMINDER,
    );
    return parseReminder(row?.value);
  }

  async function getBackup(): Promise<BackupInfo> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', KEY_BACKUP);
    if (!row) return NO_BACKUP;
    try {
      const value = JSON.parse(row.value) as Partial<BackupInfo>;
      return {
        account: typeof value.account === 'string' ? value.account : null,
        lastBackupAt: typeof value.lastBackupAt === 'string' ? value.lastBackupAt : null,
      };
    } catch {
      return NO_BACKUP;
    }
  }

  const repo: SettingsRepository = {
    getReminder,
    async setReminder(patch) {
      const db = await getDb();
      const next = { ...(await getReminder()), ...patch };
      await db.runAsync(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        KEY_REMINDER,
        JSON.stringify(next),
      );
      changes.emit();
      return next;
    },
    async getLook() {
      return parseLook(await read(KEY_THEME));
    },
    async setLook(look) {
      await write(KEY_THEME, JSON.stringify(look));
    },
    async getProfile() {
      try {
        const value = JSON.parse((await read(KEY_PROFILE)) ?? '{}') as Partial<Profile>;
        return { name: typeof value.name === 'string' ? value.name : '', portrait: parsePortrait(value.portrait) ? (value.portrait as string) : null };
      } catch {
        return { name: '', portrait: null };
      }
    },
    async setProfile(patch) {
      const current = await repo.getProfile();
      await write(KEY_PROFILE, JSON.stringify({ ...current, ...patch }));
    },
    async getOnboarded() {
      return (await read(KEY_ONBOARDED)) === '1';
    },
    async setOnboarded(done) {
      await write(KEY_ONBOARDED, done ? '1' : '0');
    },
    getBackup,
    async getAutoAccept() {
      return (await read(KEY_AUTO_ACCEPT)) !== '0';
    },
    async setAutoAccept(on) {
      await write(KEY_AUTO_ACCEPT, on ? '1' : '0');
    },
    async setBackup(patch) {
      const db = await getDb();
      const next = { ...(await getBackup()), ...patch };
      await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', KEY_BACKUP, JSON.stringify(next));
      changes.emit();
      return next;
    },
    subscribe: changes.subscribe,
  };
  return repo;
}

export const settingsRepository: SettingsRepository = createSqliteSettingsRepository();
