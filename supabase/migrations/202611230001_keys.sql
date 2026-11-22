-- Phone keys for nearby (November 23, 2026). Each phone has its own key (the app's lib/identity.ts) and signs its half
-- of a page's connection with it, so even this server can't step in between. Someone added from nearby learns the
-- other phone's key here, alongside the name; it lives only as long as the nearby row (10 minutes).

alter table public.nearby_presence add column public_key text check (public_key ~ '^[A-Za-z0-9_-]{43}$');

drop function public.announce_nearby(text, text);
create function public.announce_nearby(p_token text, p_name text, p_key text default null) returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := public.require_user();
begin
  if p_key is not null and p_key !~ '^[A-Za-z0-9_-]{43}$' then raise exception 'Bad key.'; end if;
  delete from public.nearby_presence where user_id = me or expires_at <= now();
  insert into public.nearby_presence(token, user_id, name, public_key)
    values (lower(p_token), me, coalesce(nullif(regexp_replace(btrim(p_name), '[[:cntrl:]]', '', 'g'), ''), 'Someone'), p_key);
end $$;

drop function public.nearby_people(text[]);
create function public.nearby_people(p_tokens text[]) returns table(token text, user_id uuid, name text, public_key text) language plpgsql security definer set search_path = '' as $$
declare me uuid := public.require_user();
begin
  if coalesce(array_length(p_tokens, 1), 0) > 32 then raise exception 'Too many at once.'; end if;
  return query select p.token, p.user_id, p.name, p.public_key from public.nearby_presence p
    where p.token = any(select lower(t) from unnest(p_tokens) t) and p.expires_at > now() and p.user_id <> me;
end $$;

revoke all on function public.announce_nearby(text, text, text), public.nearby_people(text[]) from public, anon;
grant execute on function public.announce_nearby(text, text, text), public.nearby_people(text[]) to authenticated;
