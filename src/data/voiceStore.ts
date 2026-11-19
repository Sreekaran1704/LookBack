import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

export const VOICE_DIR = 'voices';

function voicesDirectory(): Directory {
  const dir = new Directory(Paths.document, VOICE_DIR);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function extensionOf(uri: string): string {
  const clean = uri.split('?')[0] ?? uri;
  const match = /\.([a-zA-Z0-9]{2,5})$/.exec(clean);
  return (match?.[1] ?? 'm4a').toLowerCase();
}

/**
 * Copies a fresh recording (the recorder writes to the cache, which Android may clear) into the
 * document directory. Returns the path relative to it ('voices/<uuid>.m4a'), which is what is stored.
 */
export async function importVoice(sourceUri: string): Promise<string> {
  const destination = new File(voicesDirectory(), `${Crypto.randomUUID()}.${extensionOf(sourceUri)}`);
  await new File(sourceUri).copy(destination);
  return `${VOICE_DIR}/${destination.name}`;
}

/** Absolute file:// URI for playback. Recomputed each time because the container path can change. */
export function resolveVoiceUri(relativePath: string): string {
  return new File(Paths.document, relativePath).uri;
}

export function deleteVoice(relativePath: string): void {
  try {
    const file = new File(Paths.document, relativePath);
    if (file.exists) file.delete();
  } catch (error) {
    console.warn('[voiceStore] Could not delete voice note', relativePath, error);
  }
}

/** File names of every voice note stored on the phone. */
export function listVoiceNames(): Set<string> {
  return new Set(
    voicesDirectory()
      .list()
      .filter((item): item is File => item instanceof File)
      .map((file) => file.name),
  );
}

/** Writes a voice note fetched from a backup. Returns the relative path. */
export function writeVoiceBytes(name: string, bytes: Uint8Array): string {
  const file = new File(voicesDirectory(), name);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  return `${VOICE_DIR}/${name}`;
}
