-- Hardening (November 22, 2026). Before this, a note in an inbox said who it was from, and the server took its word:
-- anyone signed in could send a note "from" anyone. Now notes go through `send_note`, which writes the sender's real
-- account id onto every note, checks its size and kind, and limits how many one person can send. Also:
--   * only real (Google) accounts count: anonymous sessions can't use anything;
--   * alerts are counted inside the database in one step (no burst can slip past the limit), per sender, per
--     recipient and per pair, so nobody can flood one phone even with several accounts;
--   * `delete_my_account` removes your account and everything the server keeps about you.
-- Still true: no memory ever reaches this server.

-- The signed-in person, or an error. Anonymous sign-ins (if ever switched on in the dashboard) are refused.
create function public.require_user() returns uuid language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then raise exception 'Sign in first.'; end if;
  return me;
end $$;
revoke all on function public.require_user() from public, anon;
grant execute on function public.require_user() to authenticated;

-- Existing functions now use it (same bodies otherwise).
create or replace function public.announce_nearby(p_token text, p_name text) returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := public.require_user();
begin
  delete from public.nearby_presence where user_id = me or expires_at <= now();
  insert into public.nearby_presence(token, user_id, name)
    values (lower(p_token), me, coalesce(nullif(regexp_replace(btrim(p_name), '[[:cntrl:]]', '', 'g'), ''), 'Someone'));
end $$;

create or replace function public.nearby_people(p_tokens text[]) returns table(token text, user_id uuid, name text) language plpgsql security definer set search_path = '' as $$
declare me uuid := public.require_user();
begin
  if coalesce(array_length(p_tokens, 1), 0) > 32 then raise exception 'Too many at once.'; end if;
  return query select p.token, p.user_id, p.name from public.nearby_presence p
    where p.token = any(select lower(t) from unnest(p_tokens) t) and p.expires_at > now() and p.user_id <> me;
end $$;

create or replace function public.save_push_token(p_token text) returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := public.require_user();
begin
  insert into public.push_tokens(user_id, token) values (me, p_token)
    on conflict (user_id) do update set token = excluded.token, updated_at = now();
end $$;

-- Inboxes: nobody writes to realtime.messages directly any more (that's where the sender could be faked).
drop policy if exists "Leave a note in an inbox" on realtime.messages;

-- How many notes each person sent in the current minute (only a count; not who to, not what).
create table public.note_rate (
  sender uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  sent int not null
);
alter table public.note_rate enable row level security;
revoke all on public.note_rate from anon, authenticated;

-- Passes a note to someone's inbox, signed with your real account id. Notes are only the handshake (knock, yes/no,
-- connection setup), never a memory. A page transfer takes a few dozen notes; 120 a minute leaves plenty of room.
create function public.send_note(p_to uuid, p_note jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_user();
  used int;
begin
  if p_to is null or p_to = me then raise exception 'Who to?'; end if;
  if jsonb_typeof(p_note) <> 'object' or octet_length(p_note::text) > 24000 then raise exception 'Note too big.'; end if;
  if coalesce(p_note ->> 't', '') not in ('here', 'knock', 'yes', 'no', 'had', 'sdp', 'ice') then raise exception 'Unknown note.'; end if;
  insert into public.note_rate as r (sender, window_start, sent) values (me, date_trunc('minute', now()), 1)
    on conflict (sender) do update set
      sent = case when r.window_start = excluded.window_start then r.sent + 1 else 1 end,
      window_start = excluded.window_start
    returning sent into used;
  if used > 120 then raise exception 'Too many notes; wait a minute.'; end if;
  perform realtime.send(p_note - 'from' || jsonb_build_object('from', me), 'signal', 'inbox:' || p_to::text, true);
  -- Realtime keeps broadcast rows for a few days; ours are only needed for a moment. Tidy up now and then.
  if random() < 0.05 then
    begin
      delete from realtime.messages where topic like 'inbox:%' and inserted_at < now() - interval '2 minutes';
    exception when others then null;
    end;
  end if;
end $$;
revoke all on function public.send_note(uuid, jsonb) from public, anon;
grant execute on function public.send_note(uuid, jsonb) to authenticated;

-- Alerts: claimed atomically by the alert function before it sends anything (service_role only).
create index if not exists alert_log_recipient_time on public.alert_log (recipient, sent_at);
create function public.claim_alert(p_sender uuid, p_recipient uuid) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_sender is null or p_recipient is null or p_sender = p_recipient then return false; end if;
  -- One sender at a time, so parallel requests can't all slip under the limit.
  perform pg_advisory_xact_lock(hashtextextended(p_sender::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(p_recipient::text, 1));
  if (select count(*) from public.alert_log where sender = p_sender and sent_at > now() - interval '1 minute') >= 6
    or (select count(*) from public.alert_log where sender = p_sender and sent_at > now() - interval '1 hour') >= 30
    or (select count(*) from public.alert_log where sender = p_sender and recipient = p_recipient and sent_at > now() - interval '1 hour') >= 4
    or (select count(*) from public.alert_log where recipient = p_recipient and sent_at > now() - interval '1 hour') >= 20
  then return false; end if;
  insert into public.alert_log(sender, recipient) values (p_sender, p_recipient);
  delete from public.alert_log where sent_at < now() - interval '1 day';
  return true;
end $$;
revoke all on function public.claim_alert(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_alert(uuid, uuid) to service_role;

-- Delete my account: everything the server keeps about you goes (your sign-in, push address, nearby name, counts,
-- and alerts sent to you). Your diary and Drive backup are untouched; they were never here.
create function public.delete_my_account() returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := public.require_user();
begin
  delete from public.alert_log where recipient = me;
  delete from auth.users where id = me; -- cascades to nearby_presence, push_tokens, alert_log (sent), note_rate
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- New functions in public must never be callable by anonymous visitors by default.
alter default privileges in schema public revoke execute on functions from public, anon;
