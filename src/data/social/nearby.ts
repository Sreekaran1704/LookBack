import { isPublicKey } from '../../lib/identity';
import { myPublicKey } from './keys';
import { rpc } from './repository';

/** A person heard nearby: the token their phone announces, and who's behind it. */
export interface NearbyPerson {
  token: string;
  id: string;
  name: string;
  /** Their phone key, as their phone told the server (trusted until you scan their code). */
  key: string | null;
}

/** Be visible nearby under this token, with this name. */
export async function announceNearby(token: string, name: string): Promise<void> {
  await rpc('announce_nearby', { p_token: token, p_name: name.trim().slice(0, 80) || 'Someone', p_key: await myPublicKey() });
}
export async function leaveNearby(): Promise<void> {
  await rpc('leave_nearby', {});
}
/** Who is behind tokens heard nearby, in the order heard (closest first). */
export async function namesNearby(tokens: string[]): Promise<NearbyPerson[]> {
  if (tokens.length === 0) return [];
  const rows = ((await rpc('nearby_people', { p_tokens: tokens.slice(0, 32) })) ?? []) as { token: string; user_id: string; name: string; public_key: string | null }[];
  const byToken = new Map(rows.map((r) => [r.token, { token: r.token, id: r.user_id, name: r.name, key: isPublicKey(r.public_key) ? r.public_key : null }]));
  return tokens.flatMap((t) => byToken.get(t) ?? []);
}
