/**
 * The link that adds you to someone's LookBack, shown as a QR code: yearbook://add?u=<account id>&n=<name>&k=<phone
 * key>. It carries only who you are (never a memory), so it's safe to show or send anywhere. The phone key lets their
 * phone check that pages really come from yours (lib/identity.ts); a link from an older app has none. Pure (no React Native imports), tested in
 * __tests__/personLink.test.ts.
 */
import { isPublicKey } from './identity';

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAME_MAX = 80;

export interface PersonCard {
  id: string;
  name: string;
  /** Their phone key, or null (an older link). */
  key: string | null;
}

export function personLink(id: string, name: string, key?: string | null): string {
  const base = `yearbook://add?u=${encodeURIComponent(id.toLowerCase())}&n=${encodeURIComponent(name.trim().slice(0, NAME_MAX) || 'Someone')}`;
  return isPublicKey(key) ? `${base}&k=${key}` : base;
}

/** The person in something scanned: our link only. Anything else (another app's QR code, a web address) is null. */
export function parsePersonLink(scanned: string | null | undefined): PersonCard | null {
  if (!scanned) return null;
  const text = scanned.trim();
  if (!/^yearbook:\/\/\/?add\?/i.test(text)) return null;
  const params = new Map<string, string>();
  for (const pair of text.slice(text.indexOf('?') + 1).split('#')[0]?.split('&') ?? []) {
    const at = pair.indexOf('=');
    if (at <= 0) continue;
    try {
      params.set(pair.slice(0, at), decodeURIComponent(pair.slice(at + 1).replace(/\+/g, ' ')));
    } catch {
      return null;
    }
  }
  const id = params.get('u') ?? '';
  if (!ID.test(id)) return null;
  const name = (params.get('n') ?? '').trim().slice(0, NAME_MAX) || 'Someone';
  const key = params.get('k');
  return { id: id.toLowerCase(), name, key: isPublicKey(key) ? key : null };
}
