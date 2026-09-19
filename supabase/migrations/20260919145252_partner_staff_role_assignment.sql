-- Dedicated partner administration roles are not equivalent to platform-wide admin.
create table if not exists public.rk_partner_staff_roles (
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('application','residence')),
 is_active boolean not null default true,
 assigned_by uuid references auth.users(id),
 assigned_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(user_id,kind)
);
alter table public.rk_partner_staff_roles enable row level security;
create policy rk_partner_staff_role_self_or_god_read on public.rk_partner_staff_roles
 for select to authenticated using (user_id=auth.uid() or
 (public.has_role(auth.uid(),'admin'::public.app_role) and coalesce(auth.jwt()->>'aal','aal1')='aal2'));
revoke all on public.rk_partner_staff_roles from anon,authenticated;
grant select on public.rk_partner_staff_roles to authenticated;

create or replace function public.rk_partner_staff(p_kind text)
returns boolean language sql stable security definer set search_path='' set row_security=off as $$
 select auth.role()='service_role' or (
 auth.uid() is not null and p_kind in ('application','residence')
 and coalesce(auth.jwt()->>'aal','aal1')='aal2'
 and (public.has_role(auth.uid(),'admin'::public.app_role)
  or exists(select 1 from public.rk_partner_staff_roles r
    where r.user_id=auth.uid() and r.kind=p_kind and r.is_active)
  or public.has_admin_department_access(case when p_kind='application' then 'student_opportunities' else 'accommodation' end))
 );
$$;
revoke all on function public.rk_partner_staff(text) from public;
grant execute on function public.rk_partner_staff(text) to anon,authenticated,service_role;

create or replace function public.rk_admin_set_partner_staff_role(p_user_id uuid,p_kind text,p_enabled boolean)
returns void language plpgsql security definer set search_path='' set row_security=off as $$
declare v_previous boolean;
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2'
 or not public.has_role(auth.uid(),'admin'::public.app_role) then
   raise exception 'God Mode with verified 2FA required' using errcode='42501';
 end if;
 if p_user_id is null or p_user_id=auth.uid() or p_kind not in ('application','residence') or p_enabled is null
   or not exists(select 1 from auth.users where id=p_user_id) then
   raise exception 'Select another valid registered account and operational role' using errcode='42501';
 end if;
 select is_active into v_previous from public.rk_partner_staff_roles where user_id=p_user_id and kind=p_kind for update;
 insert into public.rk_partner_staff_roles(user_id,kind,is_active,assigned_by)
 values(p_user_id,p_kind,p_enabled,auth.uid())
 on conflict(user_id,kind) do update set is_active=excluded.is_active,assigned_by=auth.uid(),updated_at=now();
 insert into public.admin_department_audit_log(actor_user_id,target_user_id,previous_departments,new_departments,metadata)
 values(auth.uid(),p_user_id,'{}'::text[],'{}'::text[],jsonb_build_object('partner_operational_role',p_kind,'previous',v_previous,'enabled',p_enabled));
end $$;
revoke all on function public.rk_admin_set_partner_staff_role(uuid,text,boolean) from public,anon;
grant execute on function public.rk_admin_set_partner_staff_role(uuid,text,boolean) to authenticated;
