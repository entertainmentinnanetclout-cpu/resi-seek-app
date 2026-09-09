-- ResKonnect 360 Studio V2 · RG3/RG4 post-activation security hardening.
-- Keeps release metadata authenticated-only and prevents direct RPC execution of
-- the trigger-only scene entitlement guard.

alter table public.virtual_tour_release_registry enable row level security;
grant select on public.virtual_tour_release_registry to authenticated;

do $$ begin
  if not exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='virtual_tour_release_registry'
      and policyname='virtual_tour_release_registry_authenticated_read'
  ) then
    create policy virtual_tour_release_registry_authenticated_read
      on public.virtual_tour_release_registry
      for select
      to authenticated
      using (true);
  end if;
end $$;

revoke all on function public.virtual_tour_enforce_scene_entitlement() from public, anon, authenticated;
grant execute on function public.virtual_tour_enforce_scene_entitlement() to service_role;
