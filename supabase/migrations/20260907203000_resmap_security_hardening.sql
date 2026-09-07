-- ResMap security hardening after the Release 1-4 location audit.
-- Keep public discovery capabilities public, but remove unintended definer/view privileges
-- and direct execution of internal trigger functions.

-- Views should respect the caller's RLS context instead of the view owner's privileges.
alter view public.adminos_resmap_geo_readiness set (security_invoker = true);
alter view public.adminos_resmap_location_issues set (security_invoker = true);
alter view public.resmap_discovery_readiness set (security_invoker = true);

revoke all on public.adminos_resmap_geo_readiness from public, anon, authenticated;
grant select on public.adminos_resmap_geo_readiness to authenticated, service_role;

revoke all on public.adminos_resmap_location_issues from public, anon, authenticated;
grant select on public.adminos_resmap_location_issues to authenticated, service_role;

revoke all on public.resmap_discovery_readiness from public, anon, authenticated;
grant select on public.resmap_discovery_readiness to anon, authenticated, service_role;

-- Deterministic helpers do not need an ambient/mutable search path.
alter function public.resmap_clean_address_text(text) set search_path = public, pg_catalog;
alter function public.resmap_canonical_city_for_campus(text,text) set search_path = public, pg_catalog;
alter function public.resmap_canonical_province_for_campus(text,text) set search_path = public, pg_catalog;

-- Internal trigger functions are invoked by PostgreSQL triggers, never directly by clients.
revoke execute on function public.resmap_prepare_residence_location() from public, anon, authenticated, service_role;
revoke execute on function public.resmap_queue_residence_geocode() from public, anon, authenticated, service_role;
revoke execute on function public.resmap_sync_campus_geo() from public, anon, authenticated, service_role;
revoke execute on function public.resmap_sync_residence_geo() from public, anon, authenticated, service_role;

-- Authenticated-only interactive actions. Both functions also enforce auth.uid() internally.
revoke execute on function public.resmap_hold_room(uuid,integer,text) from public, anon;
grant execute on function public.resmap_hold_room(uuid,integer,text) to authenticated, service_role;
revoke execute on function public.resmap_join_group(text) from public, anon;
grant execute on function public.resmap_join_group(text) to authenticated, service_role;

-- Nearby lookup is read-only and does not require owner privileges.
alter function public.resmap_nearby_residences(double precision,double precision,integer,integer) security invoker;
revoke execute on function public.resmap_nearby_residences(double precision,double precision,integer,integer) from public;
grant execute on function public.resmap_nearby_residences(double precision,double precision,integer,integer) to anon, authenticated, service_role;

-- Feed analytics can safely run as the caller under a tightly constrained INSERT policy.
-- This avoids exposing a public SECURITY DEFINER function for routine analytics events.
alter function public.resmap_log_feed_event(uuid,text,text,jsonb) security invoker;
revoke all on public.resmap_feed_events from anon, authenticated;
grant insert on public.resmap_feed_events to anon, authenticated;
grant usage, select on sequence public.resmap_feed_events_id_seq to anon, authenticated;

drop policy if exists "resmap feed constrained insert" on public.resmap_feed_events;
create policy "resmap feed constrained insert"
on public.resmap_feed_events
for insert
to anon, authenticated
with check (
  event_type in ('view','save','map','tour','apply','reserve','share','skip')
  and (user_id is null or user_id = auth.uid())
  and (visitor_hash is null or length(visitor_hash) <= 128)
  and exists (
    select 1 from public.residences r
    where r.id = residence_id
      and coalesce(r.is_visible,true) = true
  )
);

revoke execute on function public.resmap_log_feed_event(uuid,text,text,jsonb) from public;
grant execute on function public.resmap_log_feed_event(uuid,text,text,jsonb) to anon, authenticated, service_role;
