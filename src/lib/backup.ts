/**
 * Backup format and merge rules. Pure module (no React Native imports), so it can be tested and
 * reused by any storage provider (Google Drive first).
 *
 * A backup is one manifest file (every entry as JSON) plus the photo and voice files, named as they
 * are on the phone. Restoring merges rather than overwrites, so backing up from two phones is safe.
 */
import { isValidLocalDate, type LocalDate } from './dates';
import { parseWave } from './voice';

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
  /** Voice note (added later; older backups lack it, read as null): 'voices/<name>', its waveform, its length. */
  voicePath: string | null;
  voiceWave: number[] | null;
  voiceMs: number | null;
  /** A reply to your past self (added later; older backups lack it, read as null). */
  reply: string | null;
  repliedAt: string | null;
  voiceTitle?: string | null;
}

/** A memory the person deleted, kept so a sync doesn't bring it back from another copy. */
export interface Tombstone {
  id: string;
  deletedAt: string;
}

export interface BackupManifest {
  version: number;
  exportedAt: string;
  entries: BackupEntry[];
  /** Added after v1 shipped; older backups lack it (read as []). Older apps ignore it. */
  deleted: Tombstone[];
}

export function buildManifest(entries: readonly BackupEntry[], exportedAt: string, deleted: readonly Tombstone[] = []): BackupManifest {
  return {
    version: BACKUP_VERSION,
    exportedAt,
    entries: [...entries].sort((a, b) => a.localDate.localeCompare(b.localDate)),
    deleted: [...deleted].sort((a, b) => a.id.localeCompare(b.id)),
  };
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
      voicePath: strOrNull(e.voicePath),
      voiceWave: parseWave(e.voiceWave),
      voiceMs: typeof e.voiceMs === 'number' && Number.isFinite(e.voiceMs) ? e.voiceMs : null,
      reply: strOrNull(e.reply),
      repliedAt: strOrNull(e.repliedAt),
      voiceTitle: strOrNull(e.voiceTitle),
    });
  }
  const deleted: Tombstone[] = [];
  for (const item of Array.isArray(data.deleted) ? (data.deleted as unknown[]) : []) {
    const t = item as Partial<Tombstone> | null;
    if (t && str(t.id) && str(t.deletedAt)) deleted.push({ id: t.id, deletedAt: t.deletedAt });
  }
  return { version: data.version, exportedAt: str(data.exportedAt) ? data.exportedAt : '', entries, deleted };
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
  /** Every deletion either side knows about (latest time per id). */
  deleted: Tombstone[];
  /** Deletions the phone hasn't recorded yet. */
  newLocalTombstones: Tombstone[];
  /** Photos and voice notes of deleted memories that no kept memory uses: remove them from the backup. */
  orphanPhotos: string[];
}

/** Union of both sides' deletions; the later time wins for an id. */
function mergeTombstones(a: readonly Tombstone[], b: readonly Tombstone[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const t of [...a, ...b]) {
    const seen = out.get(t.id);
    if (!seen || t.deletedAt > seen) out.set(t.id, t.deletedAt);
  }
  return out;
}

/** The entry edited most recently wins; ties go to the phone. */
function newer(local: BackupEntry, remote: BackupEntry): BackupEntry {
  return remote.updatedAt > local.updatedAt ? remote : local;
}

/**
 * Two-way merge. Same id: the most recently edited copy wins. Different ids on the same day
 * (the same day written on two phones): the most recently edited one is kept, because the app
 * holds one entry per day. A deletion beats any copy edited before it (an edit made after the
 * deletion, on another phone, wins and the memory stays).
 */
export function mergeEntries(
  local: readonly BackupEntry[],
  remote: readonly BackupEntry[],
  localDeleted: readonly Tombstone[] = [],
  remoteDeleted: readonly Tombstone[] = [],
): MergePlan {
  const byDay = new Map<LocalDate, BackupEntry>();
  const localById = new Map(local.map((e) => [e.id, e]));
  const remoteById = new Map(remote.map((e) => [e.id, e]));
  const tombstones = mergeTombstones(localDeleted, remoteDeleted);
  const isDeleted = (e: BackupEntry) => {
    const at = tombstones.get(e.id);
    return at !== undefined && at >= e.updatedAt;
  };

  for (const entry of local) {
    if (isDeleted(entry)) continue;
    const current = byDay.get(entry.localDate);
    byDay.set(entry.localDate, current ? newer(current, entry) : entry);
  }
  for (const entry of remote) {
    if (isDeleted(entry)) continue;
    const current = byDay.get(entry.localDate);
    byDay.set(entry.localDate, current ? newer(current, entry) : entry);
  }

  const merged = [...byDay.values()].sort((a, b) => a.localDate.localeCompare(b.localDate));
  const keptIds = new Set(merged.map((e) => e.id));
  const same = (a: BackupEntry | undefined, b: BackupEntry) => a !== undefined && a.updatedAt === b.updatedAt;

  const deleted = [...tombstones].map(([id, deletedAt]) => ({ id, deletedAt })).sort((a, b) => a.id.localeCompare(b.id));
  const localKnown = new Map(localDeleted.map((t) => [t.id, t.deletedAt]));
  const remoteKnown = new Map(remoteDeleted.map((t) => [t.id, t.deletedAt]));
  const keptFiles = new Set(merged.flatMap(entryFiles));
  const orphanPhotos = [
    ...new Set(
      [...local, ...remote]
        .filter((e) => !keptIds.has(e.id) && isDeleted(e))
        .flatMap(entryFiles)
        .filter((p) => !keptFiles.has(p)),
    ),
  ];

  return {
    merged,
    writeLocal: merged.filter((e) => !same(localById.get(e.id), e)),
    removeLocal: local.filter((e) => !keptIds.has(e.id)).map((e) => e.id),
    remoteChanged:
      merged.length !== remote.length ||
      merged.some((e) => !same(remoteById.get(e.id), e)) ||
      deleted.some((t) => remoteKnown.get(t.id) !== t.deletedAt),
    deleted,
    newLocalTombstones: deleted.filter((t) => localKnown.get(t.id) !== t.deletedAt),
    orphanPhotos,
  };
}

/** The files a memory keeps beside the manifest: its photo and its voice note. */
export function entryFiles(e: BackupEntry): string[] {
  return [e.photoPath, e.voicePath].filter((p): p is string => p !== null && p !== '');
}

/** File name of a stored photo or voice path ('photos/abc.jpg' → 'abc.jpg'). */
export function photoName(photoPath: string): string {
  return photoPath.split('/').pop() ?? photoPath;
}

export interface PhotoPlan {
  /** Photo paths the phone needs from the backup. */
  download: string[];
  /** Photo paths the backup is missing. */
  upload: string[];
}

/** Which photo and voice files have to move, given what each side already holds (by file name). */
export function planPhotos(merged: readonly BackupEntry[], localNames: ReadonlySet<string>, remoteNames: ReadonlySet<string>): PhotoPlan {
  const paths = [...new Set(merged.flatMap(entryFiles))];
  return {
    download: paths.filter((p) => !localNames.has(photoName(p)) && remoteNames.has(photoName(p))),
    upload: paths.filter((p) => localNames.has(photoName(p)) && !remoteNames.has(photoName(p))),
  };
}
