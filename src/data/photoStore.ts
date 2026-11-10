import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

const PHOTO_DIR = 'photos';

function photosDirectory(): Directory {
  const dir = new Directory(Paths.document, PHOTO_DIR);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function extensionOf(uri: string): string {
  const clean = uri.split('?')[0] ?? uri;
  const match = /\.([a-zA-Z0-9]{2,5})$/.exec(clean);
  return (match?.[1] ?? 'jpg').toLowerCase();
}

/**
 * Copies a picked or captured photo into the app's document directory so it survives
 * changes to the photo library or cache clears. Returns the path relative to the
 * document directory, which is what gets stored in the database.
 */
export async function importPhoto(sourceUri: string): Promise<string> {
  const name = `${Crypto.randomUUID()}.${extensionOf(sourceUri)}`;
  const destination = new File(photosDirectory(), name);
  await new File(sourceUri).copy(destination);
  return `${PHOTO_DIR}/${name}`;
}

/** Writes raw image bytes (e.g. generated dev photos) into app storage. Returns the relative path. */
export function writePhotoBytes(name: string, bytes: Uint8Array): string {
  const file = new File(photosDirectory(), name);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  return `${PHOTO_DIR}/${name}`;
}

/** Absolute file:// URI for rendering. Recomputed each time because the container path can change. */
export function resolvePhotoUri(relativePath: string): string {
  return new File(Paths.document, relativePath).uri;
}

export function deletePhoto(relativePath: string): void {
  try {
    const file = new File(Paths.document, relativePath);
    if (file.exists) file.delete();
  } catch (error) {
    console.warn('[photoStore] Could not delete photo', relativePath, error);
  }
}

/** File names of every photo stored on the phone. */
export function listPhotoNames(): Set<string> {
  return new Set(
    photosDirectory()
      .list()
      .filter((item): item is File => item instanceof File)
      .map((file) => file.name),
  );
}

export async function readPhotoBytes(relativePath: string): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await new File(Paths.document, relativePath).arrayBuffer());
}
