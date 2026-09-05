-- AdminOS Release 1 hardening, applied with the base Release 1 pack.
-- Restrict SECURITY DEFINER helpers to backend/service usage and make Contact 360 RLS-aware.

create or replace view public.adminos_contact_360
with (security_invoker = true)
as
select c.*,
  (select count(*) from public.applications a where a.user_id=c.profile_user_id) as application_count,
  (select max(a.updated_at) from public.applications a where a.user_id=c.profile_user_id) as last_application_activity,
  (select count(*) from public.adminos_prospects p where p.contact_id=c.id) as prospect_count
from public.adminos_contacts c;

revoke all on function public.adminos_resolve_contact(text,text,text,uuid,text,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.adminos_resolve_contact(text,text,text,uuid,text,uuid,jsonb) to service_role;

revoke all on function public.adminos_dispatch_event(uuid) from public, anon, authenticated;
grant execute on function public.adminos_dispatch_event(uuid) to service_role;

revoke all on function public.adminos_is_admin() from public, anon;
grant execute on function public.adminos_is_admin() to authenticated, service_role;
revoke all on function public.adminos_is_staff() from public, anon;
grant execute on function public.adminos_is_staff() to authenticated, service_role;
