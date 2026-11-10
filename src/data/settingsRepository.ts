import { createChangeEmitter } from './changes';
import { getDb } from './db';
import type { ReminderSettings, BackupInfo } from './types';

export const DEFAULT_REMINDER: ReminderSettings = { enabled: false, hour: 9, minute: 0 };

const KEY_REMINDER = 'reminder';
const KEY_THEME = 'themeMode';
const KEY_BACKUP = 'backup';

const NO_BACKUP: BackupInfo = { account: null, lastBackupAt: null };

export type ThemeModeSetting = 'system' | 'light' | 'dark';

export interface SettingsRepository {
  getReminder(): Promise<ReminderSettings>;
  setReminder(patch: Partial<ReminderSettings>): Promise<ReminderSettings>;
  getThemeMode(): Promise<ThemeModeSetting>;
  setThemeMode(mode: ThemeModeSetting): Promise<void>;
  getBackup(): Promise<BackupInfo>;
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

  return {
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
    async getThemeMode() {
      const db = await getDb();
      const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', KEY_THEME);
      return row?.value === 'light' || row?.value === 'dark' ? row.value : 'system';
    },
    async setThemeMode(mode) {
      const db = await getDb();
      await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', KEY_THEME, mode);
      changes.emit();
    },
    getBackup,
    async setBackup(patch) {
      const db = await getDb();
      const next = { ...(await getBackup()), ...patch };
      await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', KEY_BACKUP, JSON.stringify(next));
      changes.emit();
      return next;
    },
    subscribe: changes.subscribe,
  };
}

export const settingsRepository: SettingsRepository = createSqliteSettingsRepository();
