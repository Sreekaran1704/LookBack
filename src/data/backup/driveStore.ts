import { fetch } from 'expo/fetch';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

/** The visible folder in the person's Drive that holds the backup. */
export const BACKUP_FOLDER = 'LookBack';
/** What the folder was called before the app was renamed; found and renamed on the next backup. */
const LEGACY_FOLDER = 'Yearbook';

export interface TokenSource {
  get(): Promise<string>;
  /** Called after a 401 with the token that was rejected. */
  refresh(stale: string): Promise<string>;
}

export interface RemoteFile {
  id: string;
  name: string;
}

export interface DriveStore {
  /** Finds the backup folder, creating it on first use. Returns its id. */
  ensureFolder(): Promise<string>;
  list(folderId: string): Promise<RemoteFile[]>;
  readText(fileId: string): Promise<string>;
  readBytes(fileId: string): Promise<Uint8Array>;
  /** Creates the file, or replaces its contents when `existingId` is given. */
  write(folderId: string, name: string, body: string | Uint8Array<ArrayBuffer>, mimeType: string, existingId?: string): Promise<void>;
}

/** Google Drive (REST v3) as plain file storage: one folder, flat list of files. */
export function createDriveStore(tokens: TokenSource): DriveStore {
  async function request(url: string, init: { method?: string; headers?: Record<string, string>; body?: string | Uint8Array<ArrayBuffer> } = {}) {
    let token = await tokens.get();
    const send = () => fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
    let response = await send();
    if (response.status === 401) {
      token = await tokens.refresh(token);
      response = await send();
    }
    if (!response.ok) throw new Error(`Google Drive said no (${response.status}). Try again in a moment.`);
    return response;
  }

  const query = (q: string, extra = '') => `${API}/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent('nextPageToken,files(id,name)')}&pageSize=1000${extra}`;

  return {
    async ensureFolder() {
      // With the drive.file scope only folders this app created are visible, so this never matches someone else's folder.
      const found = await request(
        query(`(name = '${BACKUP_FOLDER}' or name = '${LEGACY_FOLDER}') and mimeType = '${FOLDER_MIME}' and trashed = false`),
      );
      const { files } = (await found.json()) as { files?: RemoteFile[] };
      const existing = files?.find((f) => f.name === BACKUP_FOLDER) ?? files?.[0];
      if (existing) {
        // A backup made before the rename: give the folder the new name, keep its contents.
        if (existing.name !== BACKUP_FOLDER) {
          await request(`${API}/files/${existing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: BACKUP_FOLDER }),
          });
        }
        return existing.id;
      }
      const created = await request(`${API}/files?fields=id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: BACKUP_FOLDER, mimeType: FOLDER_MIME }),
      });
      return ((await created.json()) as { id: string }).id;
    },

    async list(folderId) {
      const all: RemoteFile[] = [];
      let pageToken: string | undefined;
      do {
        const page = await request(query(`'${folderId}' in parents and trashed = false`, pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''));
        const data = (await page.json()) as { files?: RemoteFile[]; nextPageToken?: string };
        all.push(...(data.files ?? []));
        pageToken = data.nextPageToken;
      } while (pageToken);
      return all;
    },

    async readText(fileId) {
      return (await request(`${API}/files/${fileId}?alt=media`)).text();
    },

    async readBytes(fileId) {
      return new Uint8Array(await (await request(`${API}/files/${fileId}?alt=media`)).arrayBuffer());
    },

    async write(folderId, name, body, mimeType, existingId) {
      let id = existingId;
      if (!id) {
        const created = await request(`${API}/files?fields=id`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, parents: [folderId] }),
        });
        id = ((await created.json()) as { id: string }).id;
      }
      await request(`${UPLOAD}/files/${id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': mimeType }, body });
    },
  };
}
