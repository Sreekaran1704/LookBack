-- Alerts from one person to the same person: 10 an hour (was 4). Giving a handful of pages to a friend whose app is
-- closed used up 4 quickly. The other limits stay: 6 a minute and 30 an hour per sender, 20 an hour per recipient.

create or replace function public.claim_alert(p_sender uuid, p_recipient uuid) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_sender is null or p_recipient is null or p_sender = p_recipient then return false; end if;
  -- One sender at a time, so parallel requests can't all slip under the limit.
  perform pg_advisory_xact_lock(hashtextextended(p_sender::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(p_recipient::text, 1));
  if (select count(*) from public.alert_log where sender = p_sender and sent_at > now() - interval '1 minute') >= 6
    or (select count(*) from public.alert_log where sender = p_sender and sent_at > now() - interval '1 hour') >= 30
    or (select count(*) from public.alert_log where sender = p_sender and recipient = p_recipient and sent_at > now() - interval '1 hour') >= 10
    or (select count(*) from public.alert_log where recipient = p_recipient and sent_at > now() - interval '1 hour') >= 20
  then return false; end if;
  insert into public.alert_log(sender, recipient) values (p_sender, p_recipient);
  delete from public.alert_log where sent_at < now() - interval '1 day';
  return true;
end $$;
