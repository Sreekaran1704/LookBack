import { fetch } from 'expo/fetch';
import type { File } from 'expo-file-system';
import { mailPath, parseMailPath } from '../../lib/mailbox';
import { requireSocial } from './client';

/**
 * The sealed mailbox's box on the server (Supabase Storage, private bucket `mailbox`, see
 * supabase/migrations/202611260001_mailbox.sql): envelopes at <receiver>/<giver>/<gift>.lbm. What goes in is already
 * sealed for the receiver's phone (lib/mailbox.ts); this only moves bytes in and out.
 */
const BUCKET = 'mailbox';
/** Bytes per read when loading a file to seal. */
const READ_CHUNK = 256 * 1024;

/** A file's whole contents. */
export async function readAll(file: File): Promise<Uint8Array> {
  const size = file.size;
  const out = new Uint8Array(size);
  const handle = file.open();
  try {
    for (let at = 0; at < size; ) {
      const chunk = await handle.readBytes(Math.min(READ_CHUNK, size - at));
      if (chunk.length === 0) break;
      out.set(chunk, at);
      at += chunk.length;
    }
  } finally {
    handle.close();
  }
  return out;
}

/** Leaves (or replaces) an envelope for `to`. */
export async function leaveEnvelope(to: string, from: string, gift: string, bytes: Uint8Array): Promise<void> {
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const { error } = await requireSocial().storage.from(BUCKET).upload(mailPath(to, from, gift), body, { contentType: 'application/octet-stream', upsert: true });
  if (error) throw error;
}

/** Every envelope waiting for this account, as paths. */
export async function envelopesFor(me: string): Promise<string[]> {
  const box = requireSocial().storage.from(BUCKET);
  const { data: givers, error } = await box.list(me.toLowerCase(), { limit: 100 });
  if (error) throw error;
  const paths: string[] = [];
  for (const giver of givers ?? []) {
    const { data: files } = await box.list(`${me.toLowerCase()}/${giver.name}`, { limit: 100 });
    for (const f of files ?? []) {
      const path = `${me.toLowerCase()}/${giver.name}/${f.name}`;
      if (parseMailPath(path)) paths.push(path);
    }
  }
  return paths;
}

/** An envelope's bytes. */
export async function fetchEnvelope(path: string): Promise<Uint8Array> {
  const { data, error } = await requireSocial().storage.from(BUCKET).createSignedUrl(path, 120);
  if (error || !data?.signedUrl) throw error ?? new Error('No link to the envelope.');
  const res = await fetch(data.signedUrl);
  if (!res.ok) throw new Error(`envelope ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Throws an envelope away (once its page is kept, or turned down). */
export async function removeEnvelope(path: string): Promise<void> {
  await requireSocial().storage.from(BUCKET).remove([path]);
}
