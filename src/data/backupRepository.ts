import { BACKUP_FOLDER, createDriveStore } from './backup/driveStore';
import {
  chooseGoogleAccount,
  getAccessToken,
  googleConfigured,
  refreshAccessToken,
  restoreGoogleAccount,
} from './backup/googleAuth';
import { File, Paths } from 'expo-file-system';
import { entriesRepository } from './entriesRepository';
import { sharingRepository } from './sharingRepository';
import { listPhotoNames, readPhotoBytes, writePhotoBytes } from './photoStore';
import { settingsRepository } from './settingsRepository';
import { VOICE_DIR, listVoiceNames, writeVoiceBytes } from './voiceStore';
import {
  LOCAL_ONLY_PREFIX,
  MANIFEST_NAME,
  buildManifest,
  mergeEntries,
  parseManifest,
  photoName,
  planPhotos,
} from '../lib/backup';
import { historySince } from '../lib/friendship';
import { SHARED_MANIFEST_NAME, mergeShared, parseShared, sharedFileName } from '../lib/sharedBackup';

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
  /** Two-way sync: brings down what the phone is missing, sends up what Drive is missing. */
  syncNow(): Promise<BackupResult>;
  /** Syncs quietly if connected and the last backup is older than a day. Never throws. */
  syncIfDue(): Promise<void>;
}

const AUTO_SYNC_EVERY_MS = 20 * 60 * 60 * 1000;
const MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', webp: 'image/webp', m4a: 'audio/mp4', mp4: 'audio/mp4', '3gp': 'audio/3gpp', aac: 'audio/aac' };
const mimeOf = (name: string) => MIME[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';

function createBackupRepository(): BackupRepository {
  const drive = createDriveStore({ get: getAccessToken, refresh: refreshAccessToken });
  let running: Promise<BackupResult> | null = null;

  async function sync(): Promise<BackupResult> {
    // Tapped "Back up now" but Google signed this phone out (e.g. after a reinstall): ask once, here.
    if (!restoreGoogleAccount()) {
      const account = await chooseGoogleAccount();
      if (!account) throw new Error('Pick your Google account to back up.');
      await settingsRepository.setBackup({ account });
    }
    const folderId = await drive.ensureFolder();
    const remoteFiles = await drive.list(folderId);
    const remoteByName = new Map(remoteFiles.map((f) => [f.name, f]));
    const manifestFile = remoteByName.get(MANIFEST_NAME);
    const remote = manifestFile ? parseManifest(await drive.readText(manifestFile.id)) : null;

    const local = (await entriesRepository.getAll()).filter((e) => !e.id.startsWith(LOCAL_ONLY_PREFIX));
    const plan = mergeEntries(local, remote?.entries ?? [], await entriesRepository.listDeleted(), remote?.deleted ?? []);
    const photos = planPhotos(plan.merged, new Set([...listPhotoNames(), ...listVoiceNames()]), new Set(remoteByName.keys()));

    // Bring photos and voice notes down before the entries that show them.
    for (const path of photos.download) {
      const file = remoteByName.get(photoName(path));
      if (!file) continue;
      const bytes = await drive.readBytes(file.id);
      if (path.startsWith(`${VOICE_DIR}/`)) writeVoiceBytes(photoName(path), bytes);
      else writePhotoBytes(photoName(path), bytes);
    }
    await entriesRepository.recordDeleted(plan.newLocalTombstones);
    for (const id of plan.removeLocal) await entriesRepository.remove(id, { remember: false });
    for (const entry of plan.writeLocal) await entriesRepository.insertRaw(entry);

    // Send photos and voice notes up before the manifest that refers to them, so a backup is never half-written.
    for (const path of photos.upload) {
      await drive.write(folderId, photoName(path), await readPhotoBytes(path), mimeOf(path));
    }
    if (plan.remoteChanged || !manifestFile) {
      const manifest = buildManifest(plan.merged, new Date().toISOString(), plan.deleted);
      await drive.write(folderId, MANIFEST_NAME, JSON.stringify(manifest), 'application/json', manifestFile?.id);
    }
    // Only after the manifest stops pointing at them: photos of deleted memories leave the Drive too.
    for (const path of plan.orphanPhotos) {
      const file = remoteByName.get(photoName(path));
      if (file) await drive.remove(file.id);
    }

    await syncShared(folderId, remoteByName);

    await settingsRepository.setBackup({ lastBackupAt: new Date().toISOString() });
    return {
      restored: plan.writeLocal.length,
      photosUploaded: photos.upload.length,
      photosDownloaded: photos.download.length,
      total: plan.merged.length,
    };
  }

  /**
   * Shared pages (given to you and by you) and your people, in `shared.json` plus their files, in the same private
   * folder: they live only on the phones and in each person's own Drive, never on LookBack's server.
   */
  async function syncShared(folderId: string, remoteByName: Map<string, { id: string; name: string }>) {
    const file = remoteByName.get(SHARED_MANIFEST_NAME);
    let remote = null;
    try {
      remote = file ? parseShared(await drive.readText(file.id)) : null;
    } catch {
      remote = null; // A damaged copy is rewritten from the phone.
    }
    const letters = await sharingRepository.letters();
    const plan = mergeShared(
      {
        exportedAt: '',
        letters,
        given: await sharingRepository.given(),
        people: await sharingRepository.people(),
        removed: await sharingRepository.removedLetters(),
        messages: (await sharingRepository.allMessages()).map((m) => ({ id: m.id, personId: m.personId, mine: m.mine, kind: m.kind === 'voice' ? 'voice' : 'text', body: m.body, voicePath: m.voicePath, voiceMs: m.voiceMs, voiceWave: m.voiceWave, at: m.at })),
        reactions: await sharingRepository.reactions(),
      },
      remote,
      new Date().toISOString(),
    );
    // Down: each missing page's files first, then the page.
    for (const l of plan.lettersToPhone) {
      const fetch = async (path: string | null) => {
        const name = path ? sharedFileName(path) : null;
        const remoteFile = name ? remoteByName.get(name) : undefined;
        if (!path || !remoteFile) return null;
        const target = sharingRepository.letterFile(l.id, path.split('/').pop()!);
        target.file.write(await drive.readBytes(remoteFile.id));
        return target.path;
      };
      const photoPath = await fetch(l.photoPath);
      const voicePath = await fetch(l.voicePath);
      await sharingRepository.restoreLetter({ ...l, photoPath, voicePath });
    }
    for (const id of plan.removeOnPhone) await sharingRepository.removeLetter(id);
    // Messages back from Drive (a voice message's recording first), and reactions.
    for (const m of plan.messagesToPhone) {
      let voicePath: string | null = null;
      const name = m.voicePath ? sharedFileName(m.voicePath) : null;
      const remoteFile = name ? remoteByName.get(name) : undefined;
      if (m.voicePath && remoteFile) {
        const ext = m.voicePath.split('.').pop() ?? 'm4a';
        const target = sharingRepository.chatFile(m.id, ext);
        target.file.write(await drive.readBytes(remoteFile.id));
        voicePath = target.path;
      }
      await sharingRepository.addMessage({ ...m, voicePath, state: m.mine ? 'delivered' : 'read' });
    }
    for (const r of plan.reactionsToPhone) await sharingRepository.setReaction(r);
    for (const id of plan.messagesRemoveOnPhone) await sharingRepository.deleteMessage(id);
    for (const p of plan.peopleToPhone) await sharingRepository.restorePerson(p);
    for (const g of plan.givenToPhone) {
      const state = (['waiting', 'sealed', 'kept', 'declined', 'returned'] as const).find((s) => s === g.state) ?? 'waiting';
      await sharingRepository.restoreGiven({ ...g, state });
    }
    // Friends who both removed each other started over: what came back from Drive from before goes again.
    const cutOff = new Map<string, string>();
    for (const p of await sharingRepository.people()) {
      const since = historySince(p.myCut, p.theirCut);
      if (!since) continue;
      cutOff.set(p.id, since);
      await sharingRepository.purgeHistory(p.id, since);
    }
    // …and leaves Drive's copy too.
    if (cutOff.size) {
      const kept = (person: string, at: string) => !cutOff.has(person) || at >= cutOff.get(person)!;
      const before = plan.manifest.letters.length + plan.manifest.given.length;
      plan.manifest.removed = [...new Set([...plan.manifest.removed, ...plan.manifest.letters.filter((l) => !kept(l.senderId, l.receivedAt)).map((l) => l.id)])].sort();
      plan.manifest.letters = plan.manifest.letters.filter((l) => kept(l.senderId, l.receivedAt));
      plan.manifest.given = plan.manifest.given.filter((g) => kept(g.personId, g.givenAt));
      plan.manifest.messages = plan.manifest.messages.filter((m) => kept(m.personId, m.at));
      if (plan.manifest.letters.length + plan.manifest.given.length !== before) plan.driveChanged = true;
    }
    // Up: files before the manifest that names them.
    for (const path of plan.messagesToDrive.map((m) => m.voicePath)) {
      const name = path ? sharedFileName(path) : null;
      if (!path || !name || remoteByName.has(name)) continue;
      const local = new File(Paths.document, path);
      if (local.exists) await drive.write(folderId, name, await local.bytes(), mimeOf(path));
    }
    for (const l of plan.lettersToDrive) {
      for (const path of [l.photoPath, l.voicePath]) {
        const name = path ? sharedFileName(path) : null;
        if (!path || !name || remoteByName.has(name)) continue;
        const local = new File(Paths.document, path);
        if (!local.exists) continue;
        await drive.write(folderId, name, await local.bytes(), mimeOf(path));
      }
    }
    if (plan.driveChanged) await drive.write(folderId, SHARED_MANIFEST_NAME, JSON.stringify(plan.manifest), 'application/json', file?.id);
    // Only after the manifest stops naming them: the files of pages thrown away leave Drive too.
    const gone = new Set(plan.manifest.removed);
    for (const f of remoteByName.values()) {
      const m = /^shared-(.+)-(?:photo|voice)\.[a-z0-9]+$/.exec(f.name);
      if (m && gone.has(m[1]!)) await drive.remove(f.id);
    }
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


    syncNow,

    async syncIfDue() {
      try {
        const info = await settingsRepository.getBackup();
        if (!googleConfigured || !info.account) return;
        if (info.lastBackupAt && Date.now() - new Date(info.lastBackupAt).getTime() < AUTO_SYNC_EVERY_MS) return;
        // Never show a Google sheet here: no saved session means wait for "Back up now".
        if (!restoreGoogleAccount()) return;
        await syncNow();
      } catch (error) {
        console.warn('[backup] automatic backup failed', error);
      }
    },
  };
}

export const backupRepository: BackupRepository = createBackupRepository();
