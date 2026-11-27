-- LookBack 1.3.3: two more short notes.
--   seen  : "my phone heard your knock and is asking me", so the giver waits for the Accept instead of sealing the
--           page into the mailbox after four seconds.
--   added : "I added you", with the sender's name and phone key, so the other phone can offer "Add back".
-- Only the list of note kinds changes; everything else is send_note exactly as in 202611260001_mailbox.sql.
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
  if coalesce(p_note ->> 't', '') not in ('here', 'knock', 'yes', 'no', 'had', 'sdp', 'ice', 'mail', 'seen', 'added') then raise exception 'Unknown note.'; end if;
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
