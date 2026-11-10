/**
 * Backup format and merge rules. Pure module (no React Native imports), so it can be tested and
 * reused by any storage provider (Google Drive first).
 *
 * A backup is one manifest file (every entry as JSON) plus the photo files, named as they are on
 * the phone. Restoring merges rather than overwrites, so backing up from two phones is safe.
 */
import { isValidLocalDate, type LocalDate } from './dates';

export const BACKUP_VERSION = 1;
export const MANIFEST_NAME = 'yearbook.json';
/** Sample entries from the developer tools carry this id prefix and never leave the phone. */
export const LOCAL_ONLY_PREFIX = 'seed-';

export interface BackupEntry {
  id: string;
  localDate: LocalDate;
  text: string;
  /** Path relative to the app's document directory ('photos/<name>'), or null. */
  photoPath: string | null;
  createdAt: string;
  updatedAt: string;
  objectType: string | null;
  tapePattern: string | null;
  sticker: string | null;
  /** Added after v1 shipped; older backups simply lack them (read as null). */
  stickerColor: string | null;
  tapeColor: string | null;
}

export interface BackupManifest {
  version: number;
  exportedAt: string;
  entries: BackupEntry[];
}

export function buildManifest(entries: readonly BackupEntry[], exportedAt: string): BackupManifest {
  return { version: BACKUP_VERSION, exportedAt, entries: [...entries].sort((a, b) => a.localDate.localeCompare(b.localDate)) };
}

const str = (v: unknown): v is string => typeof v === 'string';
const strOrNull = (v: unknown): string | null => (str(v) ? v : null);

/** Reads a manifest written by this or an older version of the app. Throws if it is not a LookBack backup. */
export function parseManifest(json: string): BackupManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('The backup file is not readable.');
  }
  const data = raw as Partial<BackupManifest> | null;
  if (!data || typeof data.version !== 'number' || !Array.isArray(data.entries)) throw new Error('This is not a LookBack backup.');
  if (data.version > BACKUP_VERSION) throw new Error('This backup was made by a newer version of LookBack. Update the app to restore it.');
  const entries: BackupEntry[] = [];
  for (const item of data.entries as unknown[]) {
    const e = item as Partial<BackupEntry> | null;
    // Skip rows that could not be stored anyway, rather than failing the whole restore.
    if (!e || !str(e.id) || !str(e.localDate) || !isValidLocalDate(e.localDate) || !str(e.createdAt) || !str(e.updatedAt)) continue;
    entries.push({
      id: e.id,
      localDate: e.localDate,
      text: str(e.text) ? e.text : '',
      photoPath: strOrNull(e.photoPath),
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      objectType: strOrNull(e.objectType),
      tapePattern: strOrNull(e.tapePattern),
      sticker: strOrNull(e.sticker),
      stickerColor: strOrNull(e.stickerColor),
      tapeColor: strOrNull(e.tapeColor),
    });
  }
  return { version: data.version, exportedAt: str(data.exportedAt) ? data.exportedAt : '', entries };
}

export interface MergePlan {
  /** What both sides hold once the sync is done: one entry per day. */
  merged: BackupEntry[];
  /** Entries to write on the phone (new, or newer in the backup). */
  writeLocal: BackupEntry[];
  /** Ids to remove from the phone because the backup holds a newer entry for the same day. */
  removeLocal: string[];
  /** True when the backup's manifest is missing something the phone has, so it must be re-uploaded. */
  remoteChanged: boolean;
}

/** The entry edited most recently wins; ties go to the phone. */
function newer(local: BackupEntry, remote: BackupEntry): BackupEntry {
  return remote.updatedAt > local.updatedAt ? remote : local;
}

/**
 * Two-way merge. Same id: the most recently edited copy wins. Different ids on the same day
 * (the same day written on two phones): the most recently edited one is kept, because the app
 * holds one entry per day.
 */
export function mergeEntries(local: readonly BackupEntry[], remote: readonly BackupEntry[]): MergePlan {
  const byDay = new Map<LocalDate, BackupEntry>();
  const localById = new Map(local.map((e) => [e.id, e]));
  const remoteById = new Map(remote.map((e) => [e.id, e]));

  for (const entry of local) {
    const current = byDay.get(entry.localDate);
    byDay.set(entry.localDate, current ? newer(current, entry) : entry);
  }
  for (const entry of remote) {
    const current = byDay.get(entry.localDate);
    byDay.set(entry.localDate, current ? newer(current, entry) : entry);
  }

  const merged = [...byDay.values()].sort((a, b) => a.localDate.localeCompare(b.localDate));
  const keptIds = new Set(merged.map((e) => e.id));
  const same = (a: BackupEntry | undefined, b: BackupEntry) => a !== undefined && a.updatedAt === b.updatedAt;

  return {
    merged,
    writeLocal: merged.filter((e) => !same(localById.get(e.id), e)),
    removeLocal: local.filter((e) => !keptIds.has(e.id)).map((e) => e.id),
    remoteChanged: merged.length !== remote.length || merged.some((e) => !same(remoteById.get(e.id), e)),
  };
}

/** File name of a stored photo path ('photos/abc.jpg' → 'abc.jpg'). */
export function photoName(photoPath: string): string {
  return photoPath.split('/').pop() ?? photoPath;
}

export interface PhotoPlan {
  /** Photo paths the phone needs from the backup. */
  download: string[];
  /** Photo paths the backup is missing. */
  upload: string[];
}

/** Which photo files have to move, given what each side already holds (by file name). */
export function planPhotos(merged: readonly BackupEntry[], localNames: ReadonlySet<string>, remoteNames: ReadonlySet<string>): PhotoPlan {
  const paths = [...new Set(merged.map((e) => e.photoPath).filter((p): p is string => p !== null))];
  return {
    download: paths.filter((p) => !localNames.has(photoName(p)) && remoteNames.has(photoName(p))),
    upload: paths.filter((p) => localNames.has(photoName(p)) && !remoteNames.has(photoName(p))),
  };
}
