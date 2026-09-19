-- PostgreSQL ON CONFLICT(event_key) requires an inferable unique index.
-- A full unique index still permits any number of NULL event_key legacy rows.
drop index if exists public.notifications_event_key_unique;
create unique index notifications_event_key_unique on public.notifications(event_key);
