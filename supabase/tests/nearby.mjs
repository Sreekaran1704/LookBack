import { createRequire } from 'node:module';
const { PGlite } = createRequire(import.meta.url)('@electric-sql/pglite');
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
await db.exec(
  `create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('is_anonymous', coalesce(nullif(current_setting('request.jwt.claim.is_anonymous',true),''),'false')::boolean) $$; grant usage on schema auth to authenticated; grant execute on function auth.uid(), auth.jwt() to authenticated;
   create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security; grant usage on schema storage to authenticated; grant select,insert,delete on storage.objects to authenticated;
   create schema realtime; create table realtime.messages(topic text, extension text, payload jsonb, event text, private boolean, inserted_at timestamptz default now());
   create function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void language sql as $$ insert into realtime.messages(topic, extension, payload, event, private) values (topic, 'broadcast', payload, event, private) $$; alter table realtime.messages enable row level security; grant usage on schema realtime to authenticated; grant select, insert on realtime.messages to authenticated;
   create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic', true) $$; grant execute on function realtime.topic() to authenticated;`,
);
for (const f of ['202611220001_introductions.sql', '202611220002_alerts.sql', '202611220003_alert_grants.sql', '202611220004_hardening.sql', '202611230001_keys.sql', '202611230002_alert_pair_limit.sql', '202611230003_note_recipient.sql'])
  await db.exec(readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8'));
const a = '11111111-1111-4111-8111-111111111111',
  b = '22222222-2222-4222-8222-222222222222';
await db.query('insert into auth.users values ($1),($2)', [a, b]);
async function as(uid, topic = '', anonymous = false) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false), set_config('realtime.topic',$2,false), set_config('request.jwt.claim.is_anonymous',$3,false)", [uid, topic, String(anonymous)]);
  await db.exec('set role authenticated');
}
// Nothing that could hold a memory exists.
await db.exec('reset role');
const left = (await db.query("select table_name from information_schema.tables where table_schema='public'")).rows.map((r) => r.table_name);
assert.deepEqual(left.sort(), ['alert_log', 'nearby_presence', 'note_rate', 'push_tokens']);
assert.equal((await db.query("select count(*)::int n from pg_policies where tablename='objects'")).rows[0].n, 0);
// B is visible nearby; A hears the token and learns who (name and account id); B never sees itself.
const tokB = '0123456789abcdef';
await as(b);
await db.query("select public.announce_nearby($1,'Priya')", [tokB]);
await assert.rejects(db.query('select * from public.nearby_presence'));
await as(a);
assert.deepEqual((await db.query('select * from public.nearby_people($1)', [[tokB, 'ffffffffffffffff']])).rows, [{ token: tokB, user_id: b, name: 'Priya', public_key: null }]);
await as(b);
assert.equal((await db.query('select * from public.nearby_people($1)', [[tokB]])).rows.length, 0);
// Inboxes: nobody writes to them directly (the sender could be faked); A leaves a note through send_note, which signs
// it with A's real id whatever "from" A claims, and only B can listen to it.
await as(a, `inbox:${b}`);
await assert.rejects(db.query("insert into realtime.messages(topic, extension, payload) values ($1, 'broadcast', '{}')", [`inbox:${b}`]));
await db.query('select public.send_note($1, $2)', [b, { t: 'knock', from: b, name: 'Mom' }]);
assert.equal((await db.query('select * from realtime.messages')).rows.length, 0);
await as(b, `inbox:${b}`);
const notes = (await db.query('select payload from realtime.messages')).rows;
assert.equal(notes.length, 1);
assert.equal(notes[0].payload.from, a);
// Not to yourself, not unknown kinds, not huge, not anonymous, not too many.
await as(a);
await assert.rejects(db.query('select public.send_note($1, $2)', [a, { t: 'here' }]));
await assert.rejects(db.query('select public.send_note($1, $2)', [b, { t: 'evil' }]));
await assert.rejects(db.query('select public.send_note($1, $2)', ['55555555-5555-4555-8555-555555555555', { t: 'here' }]), /No such person/);
await assert.rejects(db.query('select public.send_note($1, $2)', [b, { t: 'sdp', sdp: 'x'.repeat(30000) }]));
await as(a, '', true);
await assert.rejects(db.query('select public.send_note($1, $2)', [b, { t: 'here' }]));
await assert.rejects(db.query("select public.announce_nearby('00000000000000aa','Anon')"));
await as(a);
for (let i = 1; i < 120; i++) await db.query('select public.send_note($1, $2)', [b, { t: 'here' }]);
await assert.rejects(db.query('select public.send_note($1, $2)', [b, { t: 'here' }]), /Too many/);
// Names can't carry control characters.
await as(b);
await db.query("select public.announce_nearby($1, $2)", ['00000000000000bb', 'Pri\u0007ya']);
await as(a);
assert.equal((await db.query('select name from public.nearby_people($1)', [['00000000000000bb']])).rows[0].name, 'Priya');
// Leaving makes you invisible.
await as(b);
await db.query('select public.leave_nearby()');
await as(a);
assert.equal((await db.query('select * from public.nearby_people($1)', [[tokB]])).rows.length, 0);
// Push addresses: you can save and forget your own; nobody can read them.
await as(a);
await db.query("select public.save_push_token('token-for-a-0123456789')");
await db.query("select public.save_push_token('token-for-a-again-0123456789')");
await assert.rejects(db.query('select * from public.push_tokens'));
await assert.rejects(db.query('select * from public.alert_log'));
await db.exec('reset role');
assert.equal((await db.query('select token from public.push_tokens where user_id = $1', [a])).rows[0].token, 'token-for-a-again-0123456789');
await as(a);
await db.query('select public.forget_push_token()');
await db.exec('reset role');
assert.equal((await db.query('select count(*)::int n from public.push_tokens')).rows[0].n, 0);
// Alerts are claimed atomically: 6 a minute per sender, 4 an hour per pair, 20 an hour per recipient; only the server.
await as(a);
await assert.rejects(db.query('select public.claim_alert($1,$2)', [a, b]));
await db.exec('reset role; set role service_role');
const claims = [];
for (let i = 0; i < 7; i++) claims.push((await db.query('select public.claim_alert($1,$2) ok', [a, b])).rows[0].ok);
assert.deepEqual(claims, [true, true, true, true, true, true, false]); // 6 a minute per sender
await db.exec('reset role');
await db.query("update public.alert_log set sent_at = now() - interval '2 minutes'");
await db.exec('set role service_role');
for (let i = 0; i < 5; i++) claims.push((await db.query('select public.claim_alert($1,$2) ok', [a, b])).rows[0].ok);
assert.deepEqual(claims.slice(7), [true, true, true, true, false]); // 10 an hour to the same person
assert.equal((await db.query('select public.claim_alert($1,$1) ok', [a])).rows[0].ok, false);
await db.exec('reset role');
const others = Array.from({ length: 21 }, (_, i) => `33333333-3333-4333-8333-${String(i).padStart(12, '0')}`);
for (const o of others) await db.query('insert into auth.users values ($1)', [o]);
await db.exec('set role service_role');
let granted = 0;
for (const o of others) granted += (await db.query('select public.claim_alert($1,$2) ok', [o, b])).rows[0].ok ? 1 : 0;
assert.equal(granted, 10); // 10 from A already this hour + 10 = 20
await db.exec('reset role');
// Deleting your account removes everything the server keeps about you.
await as(b);
await db.query("select public.announce_nearby('0123456789abcdee','Priya')");
await db.query("select public.save_push_token('token-for-b-0123456789')");
await db.query('select public.delete_my_account()');
await db.exec('reset role');
for (const [t, col] of [['auth.users', 'id'], ['public.nearby_presence', 'user_id'], ['public.push_tokens', 'user_id'], ['public.note_rate', 'sender']])
  assert.equal((await db.query(`select count(*)::int n from ${t} where ${col} = $1`, [b])).rows[0].n, 0, t);
assert.equal((await db.query('select count(*)::int n from public.alert_log where recipient = $1 or sender = $1', [b])).rows[0].n, 0);
// Anonymous visitors can't run anything of ours.
const anonCallable = (await db.query("select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')")).rows;
assert.deepEqual(anonCallable, []);
// Phone keys travel with the nearby name (and only well-formed ones).
const keyA = 'K'.repeat(43);
await as(a);
await db.query("select public.announce_nearby('00000000000000cc', 'Sree', $1)", [keyA]);
await assert.rejects(db.query("select public.announce_nearby('00000000000000cc', 'Sree', 'bad key')"));
const c = '44444444-4444-4444-8444-444444444444';
await db.exec('reset role');
await db.query('insert into auth.users values ($1)', [c]);
await as(c);
assert.equal((await db.query('select public_key from public.nearby_people($1)', [['00000000000000cc']])).rows[0].public_key, keyA);
console.log('nearby + inboxes + push addresses + hardening + keys: all checks passed');
