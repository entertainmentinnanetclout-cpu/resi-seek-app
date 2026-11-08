-- A single server-side admission decision for all residence application entry points.
-- Default closed for all residences and years. Existing records remain unchanged.
create table if not exists public.residence_application_intake (
 residence_id uuid not null references public.residences(id) on delete cascade,
 academic_year integer not null check (academic_year between 2026 and 2100),
 is_open boolean not null default false,
 private_only boolean not null default true,
 opens_on date not null,
 closes_on date not null,
 updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now(),
 primary key (residence_id, academic_year),
 constraint intake_window_dates check (closes_on >= opens_on and closes_on <= opens_on + 370)
);
alter table public.residence_application_intake enable row level security;
revoke all on public.residence_application_intake from public,anon,authenticated;
grant select on public.residence_application_intake to anon,authenticated;
grant insert,update,delete on public.residence_application_intake to authenticated;
grant all on public.residence_application_intake to service_role;
drop policy if exists intake_public_schedule_read on public.residence_application_intake;
create policy intake_public_schedule_read on public.residence_application_intake
 for select to anon,authenticated using (true);
drop policy if exists intake_admin_create on public.residence_application_intake;
create policy intake_admin_create on public.residence_application_intake
 for insert to authenticated with check (
   public.has_role((select auth.uid()),'admin'::public.app_role)
   and updated_by=(select auth.uid())
 );
drop policy if exists intake_admin_update on public.residence_application_intake;
create policy intake_admin_update on public.residence_application_intake
 for update to authenticated
 using (public.has_role((select auth.uid()),'admin'::public.app_role))
 with check (
   public.has_role((select auth.uid()),'admin'::public.app_role)
   and updated_by=(select auth.uid())
 );
drop policy if exists intake_admin_delete on public.residence_application_intake;
create policy intake_admin_delete on public.residence_application_intake
 for delete to authenticated
 using (public.has_role((select auth.uid()),'admin'::public.app_role));

-- The trigger also catches pending pre-login applications and direct API inserts.
create or replace function public.enforce_residence_application_intake()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare v_open boolean;
begin
 select true into v_open
 from public.residence_application_intake rule
 join public.residences r on r.id=rule.residence_id
 where rule.residence_id=new.residence_id
   and rule.academic_year=new.academic_year
   and rule.is_open=true
   and current_date between rule.opens_on and rule.closes_on
   and (not rule.private_only or lower(coalesce(new.funding_type,''))='private')
   and (not rule.private_only or r.accepts_private=true)
 limit 1;
 if coalesce(v_open,false) is not true then
   raise exception 'Accommodation applications are currently closed. Please use the 2027 reservation page if available.'
   using errcode='P0001';
 end if;
 return new;
end;
$function$;
revoke all on function public.enforce_residence_application_intake() from public,anon,authenticated;
drop trigger if exists trg_reskonnect_enforce_application_intake on public.applications;
create trigger trg_reskonnect_enforce_application_intake
 before insert on public.applications
 for each row execute function public.enforce_residence_application_intake();
create index if not exists residence_application_intake_open_year_idx
  on public.residence_application_intake(academic_year,is_open) where is_open=true;

-- Safely revoke an access assignment without deleting an auth identity that
-- might also be a student, admin, or owner of another active portal.
create or replace function public.admin_delete_residence_portal(_residence_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid;
begin
 if not public.has_role(auth.uid(),'admin'::public.app_role) then
   raise exception 'Admin role required' using errcode='42501';
 end if;
 delete from public.residence_portal_accounts
  where residence_id=_residence_id returning user_id into v_uid;
 if not found then raise exception 'Residence portal assignment not found' using errcode='P0002'; end if;
 if v_uid is not null and not exists(select 1 from public.residence_portal_accounts where user_id=v_uid) then
   delete from public.user_roles
    where user_id=v_uid and role='residence_portal'::public.app_role;
 end if;
 return jsonb_build_object('success',true,'residence_id',_residence_id,'auth_identity_preserved',true);
end;
$function$;
revoke all on function public.admin_delete_residence_portal(uuid) from public,anon;
grant execute on function public.admin_delete_residence_portal(uuid) to authenticated,service_role;
