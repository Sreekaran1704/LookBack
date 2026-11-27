-- The sealed mailbox (src/lib/mailbox.ts): when two phones can't reach each other directly (one is offline, asleep in
-- another time zone, or on a network that blocks direct connections), the giver leaves the page sealed for the
-- receiver's phone in a private storage box. Only that phone can open it; it is deleted once picked up.
-- Envelopes live at mailbox/<receiver>/<giver>/<gift>.lbm.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mailbox', 'mailbox', false, 52428800, array['application/octet-stream'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Whether this account may leave an envelope for p_to: signed in (not anonymous), not to yourself, to an account
-- that exists, and fewer than 60 of yours already waiting there (so nobody can fill someone's box).
create or replace function public.mailbox_can_leave(p_to text) returns boolean language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then return false; end if;
  if p_to is null or p_to = me::text then return false; end if;
  if not exists (select 1 from auth.users where id::text = p_to) then return false; end if;
  return (select count(*) from storage.objects where bucket_id = 'mailbox' and name like p_to || '/' || me::text || '/%') < 60;
end $$;
revoke all on function public.mailbox_can_leave(text) from public, anon;
grant execute on function public.mailbox_can_leave(text) to authenticated;

-- Giver: leaves an envelope only under <them>/<me>/ (the path's giver must be you; the server can't be told otherwise).
create policy "mailbox: leave an envelope" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'mailbox'
    and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.mailbox_can_leave((storage.foldername(name))[1])
  );
-- Giver: may replace an envelope they left (the same page sealed again).
create policy "mailbox: replace your envelope" on storage.objects for update to authenticated
  using (bucket_id = 'mailbox' and (storage.foldername(name))[2] = auth.uid()::text)
  with check (bucket_id = 'mailbox' and (storage.foldername(name))[2] = auth.uid()::text);
-- Receiver: sees and takes what's for them; giver: sees and can take back what they left.
create policy "mailbox: see yours" on storage.objects for select to authenticated
  using (bucket_id = 'mailbox' and ((storage.foldername(name))[1] = auth.uid()::text or (storage.foldername(name))[2] = auth.uid()::text));
create policy "mailbox: take yours" on storage.objects for delete to authenticated
  using (bucket_id = 'mailbox' and ((storage.foldername(name))[1] = auth.uid()::text or (storage.foldername(name))[2] = auth.uid()::text));

-- A short "there's an envelope for you" note, so a phone that is online picks it up at once.
create or replace function public.send_note(p_to uuid, p_note jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_user();
  used int;
begin
  if p_to is null or p_to = me then raise exception 'Who to?'; end if;
  -- Their account is gone (deleted, so they have a new one now): say so, rather than pass a note nobody will hear.
  if not exists (select 1 from auth.users where id = p_to) then raise exception 'No such person.' using errcode = 'P0002'; end if;
  if jsonb_typeof(p_note) <> 'object' or octet_length(p_note::text) > 24000 then raise exception 'Note too big.'; end if;
  if coalesce(p_note ->> 't', '') not in ('here', 'knock', 'yes', 'no', 'had', 'sdp', 'ice', 'mail') then raise exception 'Unknown note.'; end if;
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
