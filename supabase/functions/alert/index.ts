// Sends one alert, "Sree has a page for you", to a person whose LookBack is closed (Firebase Cloud Messaging v1).
// Called by the giver's app with its own session; the alert carries no part of the memory.
// Secrets: FCM_SERVICE_ACCOUNT (the Firebase service account JSON). SUPABASE_URL and SUPABASE_SECRET_KEYS are built in
// (this project uses the new API keys, so there is no SUPABASE_SERVICE_ROLE_KEY).
import { createClient } from 'npm:@supabase/supabase-js@2';

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ServiceAccount = { client_email: string; private_key: string; project_id: string };

function b64url(data: ArrayBuffer | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

let cached: { token: string; until: number } | null = null;
async function googleToken(sa: ServiceAccount): Promise<string> {
  if (cached && cached.until > Date.now() + 60_000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${claims}`));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claims}.${b64url(sig)}` }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`google token: ${json.error ?? res.status}`);
  cached = { token: json.access_token, until: Date.now() + json.expires_in * 1000 };
  return cached.token;
}

/** A name fit for a notification title: no control or direction-flipping characters, one line, 40 letters at most. */
function cleanName(name: unknown): string {
  if (typeof name !== 'string') return 'Someone';
  const plain = name.replace(/\s+/g, ' ').replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, '').trim();
  return [...plain].slice(0, 40).join('') || 'Someone';
}

const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, { error: 'POST only' });
  const secrets = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>;
  const serverKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? secrets.default ?? Object.values(secrets)[0];
  if (!serverKey) return reply(500, { error: 'No server key.' });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serverKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  const { data: who } = await admin.auth.getUser(jwt);
  const sender = who.user?.id;
  if (!sender || who.user?.is_anonymous) return reply(401, { error: 'Sign in first.' });

  const { to, name } = await req.json().catch(() => ({}));
  if (typeof to !== 'string' || !ID.test(to) || to === sender) return reply(400, { error: 'Who to?' });
  const from = cleanName(name);
  const recipient = to.toLowerCase();

  // Counted in the database in one step (per sender, per recipient, per pair), before anything is sent.
  const { data: allowed, error: claim } = await admin.rpc('claim_alert', { p_sender: sender, p_recipient: recipient });
  if (claim) {
    console.error('claim_alert failed', claim.message);
    return reply(500, { error: 'Try again later.' });
  }
  if (!allowed) return reply(429, { error: 'Too many alerts; wait a while.' });

  const { data: row, error: lookup } = await admin.from('push_tokens').select('token').eq('user_id', recipient).maybeSingle();
  if (lookup) console.error('push token lookup failed', lookup.message);
  if (!row?.token) return reply(200, { sent: false, reason: lookup ? 'lookup-failed' : 'no-device' });

  const sa = JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT') ?? '{}') as ServiceAccount;
  const access = await googleToken(sa);
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token: row.token,
        notification: { title: `💌 ${from} has a page for you`, body: 'Open LookBack to receive it, straight from their phone.' },
        data: { kind: 'page-offer', sender },
        android: { priority: 'HIGH', notification: { channel_id: 'pages', tag: `page-${sender}` } },
      },
    }),
  });
  if (!res.ok) console.error('fcm send failed', res.status, (await res.clone().text()).slice(0, 300));
  // Old address (the app was reinstalled): forget it.
  if (res.status === 404) await admin.from('push_tokens').delete().eq('user_id', recipient);
  return reply(200, { sent: res.ok, status: res.status });
});
