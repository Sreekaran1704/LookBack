-- Alerts, like Blip's "someone sent you something": when you give a page and their LookBack is closed, their phone
-- gets a push notification ("Sree has a page for you") through Firebase Cloud Messaging. Tapping it opens LookBack and
-- the page comes across phone to phone as always. The server keeps only each phone's push address; the alert carries
-- no memory, no date, no words.

create table public.push_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token text not null check (char_length(token) between 20 and 4096),
  updated_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;

-- This phone's push address (replaces the earlier one).
create function public.save_push_token(p_token text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  insert into public.push_tokens(user_id, token) values (auth.uid(), p_token)
    on conflict (user_id) do update set token = excluded.token, updated_at = now();
end $$;

-- Signing out: stop alerts to this phone.
create function public.forget_push_token() returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.push_tokens where user_id = auth.uid();
end $$;

revoke all on function public.save_push_token(text), public.forget_push_token() from public, anon;
grant execute on function public.save_push_token(text), public.forget_push_token() to authenticated;

-- How many alerts each person sent recently (the alert function allows a few a minute, so nobody can flood a phone).
create table public.alert_log (
  sender uuid not null references auth.users(id) on delete cascade,
  recipient uuid not null,
  sent_at timestamptz not null default now()
);
create index alert_log_sender_time on public.alert_log (sender, sent_at);
alter table public.alert_log enable row level security;
revoke all on public.alert_log from anon, authenticated;
