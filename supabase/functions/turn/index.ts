// Hands a signed-in phone a short-lived login for the TURN relay (Cloudflare Realtime TURN), so two phones on networks
// that block direct connections (mobile data, other countries) can still reach each other, like Blip's relay. The relay
// only carries the encrypted stream (DTLS); it can't read a page and keeps nothing.
// Secrets: CLOUDFLARE_TURN_KEY_ID and CLOUDFLARE_TURN_API_TOKEN (Cloudflare dashboard → Realtime → TURN → Create key).
// Without them it answers with no servers, and phones connect directly where the networks allow.
import { createClient } from 'npm:@supabase/supabase-js@2';

/** How long a login lasts (seconds). Phones ask again an hour before it runs out. */
const TTL = 12 * 60 * 60;

const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, { error: 'POST only' });
  const secrets = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>;
  const serverKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? secrets.default ?? Object.values(secrets)[0];
  if (!serverKey) return reply(500, { error: 'No server key.' });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serverKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  const { data: who } = await admin.auth.getUser(jwt);
  if (!who.user || who.user.is_anonymous) return reply(401, { error: 'Sign in first.' });

  const keyId = Deno.env.get('CLOUDFLARE_TURN_KEY_ID');
  const token = Deno.env.get('CLOUDFLARE_TURN_API_TOKEN');
  if (!keyId || !token) return reply(200, { iceServers: [], ttl: TTL });

  const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ttl: TTL }),
  });
  if (!res.ok) return reply(502, { error: `relay ${res.status}` });
  const json = (await res.json()) as { iceServers?: unknown };
  // The answer is either a list of servers or one server object, depending on the endpoint's version.
  const iceServers = Array.isArray(json.iceServers) ? json.iceServers : json.iceServers ? [json.iceServers] : [];
  return reply(200, { iceServers, ttl: TTL });
});
