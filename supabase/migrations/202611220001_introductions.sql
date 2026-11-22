-- LookBack's server only introduces two phones. It never sees or stores a memory: pages go phone to phone over an
-- encrypted WebRTC connection. What it keeps:
--   * nearby presence: a random Bluetooth token -> who (account id + name), for 10 minutes, while "Left for you" is open;
--   * a private inbox per person (Realtime broadcast "inbox:<account id>") that passes short notes live ("I have a page
--     for you", connection setup) and stores nothing.
-- This is the whole schema (it replaces the earlier letters / handoffs / shared pages migrations, all dropped).

create table public.nearby_presence (
  token text primary key check (token ~ '^[0-9a-f]{16}$'),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  expires_at timestamptz not null default now() + interval '10 minutes'
);
alter table public.nearby_presence enable row level security;
revoke all on public.nearby_presence from anon, authenticated;

-- Be visible nearby under a fresh token (replaces any earlier one of yours).
create function public.announce_nearby(p_token text, p_name text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  delete from public.nearby_presence where user_id = auth.uid() or expires_at <= now();
  insert into public.nearby_presence(token, user_id, name) values (lower(p_token), auth.uid(), p_name);
end $$;

-- Stop being visible.
create function public.leave_nearby() returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.nearby_presence where user_id = auth.uid();
end $$;

-- Who is behind tokens this phone heard (never yourself, never expired, at most 32 at a time).
create function public.nearby_people(p_tokens text[]) returns table(token text, user_id uuid, name text) language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if coalesce(array_length(p_tokens, 1), 0) > 32 then raise exception 'Too many at once.'; end if;
  return query select p.token, p.user_id, p.name from public.nearby_presence p
    where p.token = any(select lower(t) from unnest(p_tokens) t) and p.expires_at > now() and p.user_id <> auth.uid();
end $$;

revoke all on function public.announce_nearby(text, text), public.leave_nearby(), public.nearby_people(text[]) from public, anon;
grant execute on function public.announce_nearby(text, text), public.leave_nearby(), public.nearby_people(text[]) to authenticated;

-- Inboxes: only you can listen to yours; anyone signed in can leave a note in one. Never stored.
create policy "Listen to your own inbox" on realtime.messages for select to authenticated
  using (realtime.messages.extension = 'broadcast' and (select realtime.topic()) = 'inbox:' || (select auth.uid())::text);
create policy "Leave a note in an inbox" on realtime.messages for insert to authenticated
  with check (realtime.messages.extension = 'broadcast' and (select realtime.topic()) ~ '^inbox:[0-9a-f-]{36}$');
