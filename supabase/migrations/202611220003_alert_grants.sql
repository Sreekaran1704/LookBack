-- The alert function runs as service_role (the project's secret key). It reads push addresses and keeps the small
-- alert log; nobody else can touch either table.
grant select, delete on public.push_tokens to service_role;
grant select, insert, delete on public.alert_log to service_role;
