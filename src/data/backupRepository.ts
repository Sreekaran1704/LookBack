import { BACKUP_FOLDER, createDriveStore } from './backup/driveStore';
import {
  chooseGoogleAccount,
  getAccessToken,
  googleConfigured,
  refreshAccessToken,
  restoreGoogleAccount,
  signOutOfGoogle,
} from './backup/googleAuth';
import { entriesRepository } from './entriesRepository';
import { listPhotoNames, readPhotoBytes, writePhotoBytes } from './photoStore';
import { settingsRepository } from './settingsRepository';
import {
  LOCAL_ONLY_PREFIX,
  MANIFEST_NAME,
  buildManifest,
  mergeEntries,
  parseManifest,
  photoName,
  planPhotos,
} from '../lib/backup';

export interface BackupStatus {
  /** False when this build has no Google client id, so backup cannot be offered. */
  available: boolean;
  account: string | null;
  lastBackupAt: string | null;
  /** Name of the folder in the person's Drive. */
  folder: string;
}

export interface BackupResult {
  /** Entries that came down to this phone. */
  restored: number;
  /** Photos sent to / fetched from Drive. */
  photosUploaded: number;
  photosDownloaded: number;
  total: number;
}

/**
 * Private backup to the person's own Google Drive. The rest of the app only sees this interface;
 * Drive, sign-in and the file system stay behind it.
 */
export interface BackupRepository {
  getStatus(): Promise<BackupStatus>;
  /** Lets the person choose a Google account. Returns its email, or null if they backed out. */
  connect(): Promise<string | null>;
  disconnect(): Promise<void>;
  /** Two-way sync: brings down what the phone is missing, sends up what Drive is missing. */
  syncNow(): Promise<BackupResult>;
  /** Syncs quietly if connected and the last backup is older than a day. Never throws. */
  syncIfDue(): Promise<void>;
}

const AUTO_SYNC_EVERY_MS = 20 * 60 * 60 * 1000;
const MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', webp: 'image/webp' };
const mimeOf = (name: string) => MIME[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';

function createBackupRepository(): BackupRepository {
  const drive = createDriveStore({ get: getAccessToken, refresh: refreshAccessToken });
  let running: Promise<BackupResult> | null = null;

  async function sync(): Promise<BackupResult> {
    const folderId = await drive.ensureFolder();
    const remoteFiles = await drive.list(folderId);
    const remoteByName = new Map(remoteFiles.map((f) => [f.name, f]));
    const manifestFile = remoteByName.get(MANIFEST_NAME);
    const remoteEntries = manifestFile ? parseManifest(await drive.readText(manifestFile.id)).entries : [];

    const local = (await entriesRepository.getAll()).filter((e) => !e.id.startsWith(LOCAL_ONLY_PREFIX));
    const plan = mergeEntries(local, remoteEntries);
    const photos = planPhotos(plan.merged, listPhotoNames(), new Set(remoteByName.keys()));

    // Bring photos down before the entries that show them.
    for (const path of photos.download) {
      const file = remoteByName.get(photoName(path));
      if (file) writePhotoBytes(photoName(path), await drive.readBytes(file.id));
    }
    for (const id of plan.removeLocal) await entriesRepository.remove(id);
    for (const entry of plan.writeLocal) await entriesRepository.insertRaw(entry);

    // Send photos up before the manifest that refers to them, so a backup is never half-written.
    for (const path of photos.upload) {
      await drive.write(folderId, photoName(path), await readPhotoBytes(path), mimeOf(path));
    }
    if (plan.remoteChanged || !manifestFile) {
      const manifest = buildManifest(plan.merged, new Date().toISOString());
      await drive.write(folderId, MANIFEST_NAME, JSON.stringify(manifest), 'application/json', manifestFile?.id);
    }

    await settingsRepository.setBackup({ lastBackupAt: new Date().toISOString() });
    return {
      restored: plan.writeLocal.length,
      photosUploaded: photos.upload.length,
      photosDownloaded: photos.download.length,
      total: plan.merged.length,
    };
  }

  function syncNow(): Promise<BackupResult> {
    // One sync at a time: a second tap joins the one in flight.
    running ??= sync().finally(() => {
      running = null;
    });
    return running;
  }

  return {
    async getStatus() {
      const info = await settingsRepository.getBackup();
      return { available: googleConfigured, account: info.account, lastBackupAt: info.lastBackupAt, folder: BACKUP_FOLDER };
    },

    async connect() {
      const account = await chooseGoogleAccount();
      if (account) await settingsRepository.setBackup({ account, lastBackupAt: null });
      return account;
    },

    async disconnect() {
      await signOutOfGoogle();
      await settingsRepository.setBackup({ account: null, lastBackupAt: null });
    },

    syncNow,

    async syncIfDue() {
      try {
        const info = await settingsRepository.getBackup();
        if (!googleConfigured || !info.account) return;
        if (info.lastBackupAt && Date.now() - new Date(info.lastBackupAt).getTime() < AUTO_SYNC_EVERY_MS) return;
        if (!(await restoreGoogleAccount())) return;
        await syncNow();
      } catch (error) {
        console.warn('[backup] automatic backup failed', error);
      }
    },
  };
}

export const backupRepository: BackupRepository = createBackupRepository();
