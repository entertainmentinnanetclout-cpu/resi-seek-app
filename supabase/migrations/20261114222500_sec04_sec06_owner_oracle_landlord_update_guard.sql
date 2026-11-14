-- SEC-04 / SEC-06: close anonymous owner-oracle and protect application updates from residence/staff role misuse.
-- Preserve genuine landlord "under review / documents required" feedback, and all
-- established admin, accommodation-department and service-role workflows.

create or replace function public.is_application_owner(
 _application_id uuid,_user_id uuid default auth.uid()
) returns boolean
language sql stable security definer
set search_path='' set row_security='off'
as $function$
 select (
  auth.role()='service_role'
  or (auth.uid() is not null and _user_id=auth.uid())
 ) and exists(
  select 1 from public.applications a
  where a.id=_application_id and a.user_id=_user_id
 );
$function$;
revoke all on function public.is_application_owner(uuid,uuid) from public,anon,authenticated;
grant execute on function public.is_application_owner(uuid,uuid) to authenticated,service_role;

create or replace function reskonnect_internal.rk_application_landlord_field_guard()
returns trigger language plpgsql security definer set search_path='' as $function$
begin
 if tg_op<>'UPDATE' then return new; end if;

 -- Internal service and SQL scheduler actions remain separate trusted channels.
 -- A browser cannot spoof session_user=postgres or auth.role()='service_role'.
 if auth.role()='service_role' or (
   auth.role() is null and session_user in('postgres','supabase_admin')
 ) then return new; end if;

 if auth.uid() is null then
  raise exception 'An authenticated actor is required to update an application'
   using errcode='42501';
 end if;

 -- Final admission/placement decisions stay with ResKonnect and its assigned
 -- internal accommodation department. Existing approval/document triggers remain.
 if coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false)
    or coalesce(public.has_admin_department_access('accommodation'),false) then
  return new;
 end if;

 -- A landlord may only advise on THEIR existing residence application, never
 -- reassign student/residence, mark approval/rejection or rewrite money fields.
 if old.residence_id is null or not coalesce(
    public.is_authorized_residence_user(old.residence_id),false
  ) then
  raise exception 'Residence portal access denied' using errcode='42501';
 end if;
 if old.status in('approved','conditionally_approved','rejected','withdrawn','confirmed','cancelled') then
  raise exception 'Final application decisions cannot be changed by a residence'
   using errcode='42501';
 end if;
 if new.status is distinct from old.status and
    new.status not in('under_review','documents_required') then
  raise exception 'Residence may only submit review or missing-document feedback'
   using errcode='42501';
 end if;
 if (
  to_jsonb(new)-array['notes','status','updated_at']
 ) is distinct from (
  to_jsonb(old)-array['notes','status','updated_at']
 ) then
  raise exception 'Residence may not change protected application fields'
   using errcode='42501';
 end if;
 if length(coalesce(new.notes,''))>16000 then
  raise exception 'Residence review note is too long' using errcode='22023';
 end if;
 return new;
end
$function$;
revoke all on function reskonnect_internal.rk_application_landlord_field_guard()
 from public,anon,authenticated;
drop trigger if exists aa_rk_application_landlord_field_guard on public.applications;
create trigger aa_rk_application_landlord_field_guard
 before update on public.applications
 for each row execute function reskonnect_internal.rk_application_landlord_field_guard();

-- Handover exports already run with security_invoker=on; they contain student
-- identifiers and must not accidentally become anonymous Data API surfaces.
revoke all on table public.handover_remediation_queue_v from public,anon;
revoke all on table public.residence_handover_export_v from public,anon;

notify pgrst,'reload schema';
