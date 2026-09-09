-- ResKonnect 360 Studio V2 · RG1/RG2 helper hardening
-- Keep trigger helpers non-callable from PostgREST and remove anonymous execution from Studio-only helper RPCs.

create or replace function public.touch_virtual_tour_updated_at()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.updated_at=now();
  return new;
end $$;
revoke all on function public.touch_virtual_tour_updated_at() from public,anon,authenticated;

revoke all on function public.virtual_tour_admin_summary() from public,anon;
grant execute on function public.virtual_tour_admin_summary() to authenticated;

revoke all on function public.virtual_tour_can_manage(uuid) from public,anon;
grant execute on function public.virtual_tour_can_manage(uuid) to authenticated,service_role;

revoke all on function public.virtual_tour_can_view_studio(uuid) from public,anon;
grant execute on function public.virtual_tour_can_view_studio(uuid) to authenticated;
