import { requireSocial, socialClient } from './client';

/** Your account id, or null when signed out (read from the saved session; no network). */
export async function myAccountId(): Promise<string | null> {
  if (!socialClient) return null;
  const { data } = await socialClient.auth.getSession();
  return data.session?.user.id ?? null;
}
export async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await requireSocial().rpc(name, args);
  if (error) throw error;
  return data;
}
