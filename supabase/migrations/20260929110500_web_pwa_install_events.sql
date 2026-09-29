-- Extend governed first-party growth telemetry for PWA installation UX.
drop policy if exists "anon capture public growth events" on public.growth_events;
create policy "anon capture public growth events"
on public.growth_events
for insert to anon
with check (
  user_id is null
  and source = 'web'
  and event_type = any (array[
    'page_view'::text,
    'accommodation_search'::text,
    'pwa_install_prompt'::text,
    'pwa_install'::text,
    'pwa_install_dismissed'::text
  ])
  and octet_length(metadata::text) <= 8192
  and (
    creator_id is null
    or exists (
      select 1 from public.creator_partners cp
      where cp.id = growth_events.creator_id
        and cp.status = 'active'
    )
  )
);

drop policy if exists "authenticated capture own growth events" on public.growth_events;
create policy "authenticated capture own growth events"
on public.growth_events
for insert to authenticated
with check (
  (user_id is null or user_id = auth.uid())
  and source = 'web'
  and event_type = any (array[
    'page_view'::text,
    'accommodation_search'::text,
    'pwa_install_prompt'::text,
    'pwa_install'::text,
    'pwa_install_dismissed'::text
  ])
  and octet_length(metadata::text) <= 8192
  and (
    creator_id is null
    or exists (
      select 1 from public.creator_partners cp
      where cp.id = growth_events.creator_id
        and cp.status = 'active'
    )
  )
);
