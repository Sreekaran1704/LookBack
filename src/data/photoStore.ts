import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

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

/** Longest side a saved photo keeps. Plenty for a full-screen view on any phone, and quick to decode. */
const MAX_PHOTO_PX = 1600;
const PHOTO_QUALITY = 0.82;

/**
 * Copies a picked or captured photo into the app's document directory so it survives changes to the
 * photo library or cache clears. Camera photos are often 4000 px or more; every polaroid decoding one
 * of those to show it a few hundred pixels wide is what made photo-heavy pages stutter, so the photo
 * is shrunk to MAX_PHOTO_PX once, here, and saved as a JPEG (a fraction of the size, also in backups).
 * Returns the path relative to the document directory, which is what gets stored in the database.
 */
export async function importPhoto(sourceUri: string): Promise<string> {
  const name = `${Crypto.randomUUID()}.jpg`;
  const destination = new File(photosDirectory(), name);
  try {
    const original = await ImageManipulator.manipulate(sourceUri).renderAsync();
    const longest = Math.max(original.width, original.height);
    const context = ImageManipulator.manipulate(sourceUri);
    if (longest > MAX_PHOTO_PX) context.resize(original.width >= original.height ? { width: MAX_PHOTO_PX } : { height: MAX_PHOTO_PX });
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: PHOTO_QUALITY });
    await new File(saved.uri).move(destination);
  } catch (error) {
    // Can't read it as an image here (an unusual format): keep the original as it is.
    console.warn('[photoStore] Could not shrink photo, keeping the original', error);
    const fallback = new File(photosDirectory(), `${Crypto.randomUUID()}.${extensionOf(sourceUri)}`);
    await new File(sourceUri).copy(fallback);
    return `${PHOTO_DIR}/${fallback.name}`;
  }
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
