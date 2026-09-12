-- Admin God Mode departmental operating model.
-- Departments are explicit assignable workspaces. God Mode always has full access.

create table if not exists public.admin_department_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  department_key text not null check (department_key in (
    'executive','accommodation','student_opportunities','marketing_corporate_affairs',
    'partnerships_engagements','communications_service','operations',
    'finance_admin','intelligence_analytics','technology_systems'
  )),
  access_level text not null default 'member' check (access_level in ('viewer','member','manager','director')),
  assigned_by uuid references auth.users(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,department_key)
);

create table if not exists public.admin_department_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  target_user_id uuid not null,
  previous_departments text[] not null default '{}',
  new_departments text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_department_assignments enable row level security;
alter table public.admin_department_audit_log enable row level security;

drop policy if exists admin_department_assignments_self_read on public.admin_department_assignments;
create policy admin_department_assignments_self_read
on public.admin_department_assignments for select to authenticated
using (user_id=auth.uid() or (
  public.has_role(auth.uid(),'admin'::public.app_role)
  and coalesce(auth.jwt()->>'aal','aal1')='aal2'
));

drop policy if exists admin_department_audit_admin_read on public.admin_department_audit_log;
create policy admin_department_audit_admin_read
on public.admin_department_audit_log for select to authenticated
using (
  public.has_role(auth.uid(),'admin'::public.app_role)
  and coalesce(auth.jwt()->>'aal','aal1')='aal2'
);

revoke insert,update,delete on public.admin_department_assignments from authenticated,anon;
revoke insert,update,delete on public.admin_department_audit_log from authenticated,anon;

create or replace function public.admin_touch_department_assignment()
returns trigger language plpgsql set search_path=public as $$
begin new.updated_at=now(); return new; end $$;
revoke all on function public.admin_touch_department_assignment() from public,anon,authenticated;
drop trigger if exists trg_admin_department_assignment_touch on public.admin_department_assignments;
create trigger trg_admin_department_assignment_touch
before update on public.admin_department_assignments
for each row execute function public.admin_touch_department_assignment();

create or replace function public.admin_effective_departments(p_user_id uuid)
returns text[]
language sql
stable security definer
set search_path=''
set row_security=off
as $$
  with role_keys as (
    select role::text as role
    from public.user_roles
    where user_id=p_user_id
  ),
  explicit_keys as (
    select department_key
    from public.admin_department_assignments
    where user_id=p_user_id and is_active
  ),
  mapped as (
    select unnest(
      case
        when exists(select 1 from role_keys where role in ('admin','super_admin','developer','owner'))
          then array['executive','accommodation','student_opportunities','marketing_corporate_affairs','partnerships_engagements','communications_service','operations','finance_admin','intelligence_analytics','technology_systems']::text[]
        when exists(select 1 from role_keys where role='operations_lead')
          then array['accommodation','student_opportunities','operations']::text[]
        when exists(select 1 from role_keys where role='commerce_lead')
          then array['finance_admin','operations']::text[]
        when exists(select 1 from role_keys where role='growth_lead')
          then array['marketing_corporate_affairs','partnerships_engagements','intelligence_analytics']::text[]
        when exists(select 1 from role_keys where role='system_operator')
          then array['technology_systems','intelligence_analytics','operations']::text[]
        when exists(select 1 from role_keys where role='tvet_lead')
          then array['student_opportunities','operations']::text[]
        when exists(select 1 from role_keys where role='support_agent')
          then array['communications_service','operations']::text[]
        else '{}'::text[]
      end
    ) department_key
  )
  select coalesce(array_agg(distinct department_key order by department_key),'{}'::text[])
  from (
    select department_key from explicit_keys
    union all
    select department_key from mapped
  ) d;
$$;
revoke all on function public.admin_effective_departments(uuid) from public,anon,authenticated;
grant execute on function public.admin_effective_departments(uuid) to service_role;

create or replace function public.get_my_admin_departments()
returns text[]
language sql
stable security definer
set search_path=''
set row_security=off
as $$
  select case when auth.uid() is null then '{}'::text[]
              else public.admin_effective_departments(auth.uid()) end;
$$;
revoke all on function public.get_my_admin_departments() from public,anon;
grant execute on function public.get_my_admin_departments() to authenticated,service_role;

create or replace function public.has_admin_department_access(p_department_key text)
returns boolean
language sql
stable security definer
set search_path=''
set row_security=off
as $$
  select auth.role()='service_role'
    or (auth.uid() is not null and lower(btrim(coalesce(p_department_key,''))) = any(public.admin_effective_departments(auth.uid())));
$$;
revoke all on function public.has_admin_department_access(text) from public,anon;
grant execute on function public.has_admin_department_access(text) to authenticated,service_role;

create or replace function public.get_user_staff_role(_user_id uuid)
returns text
language sql
stable security definer
set search_path=''
set row_security=off
as $$
  select case
    when auth.role()='service_role' or _user_id=auth.uid() then coalesce((
      select role::text
      from public.user_roles
      where user_id=_user_id
        and role::text in ('admin','super_admin','developer','owner','operations_lead','commerce_lead','growth_lead','system_operator','tvet_lead','support_agent')
      order by case role::text
        when 'admin' then 1 when 'super_admin' then 2 when 'developer' then 3 when 'owner' then 4
        when 'system_operator' then 5 when 'operations_lead' then 6 when 'commerce_lead' then 7
        when 'growth_lead' then 8 when 'tvet_lead' then 9 when 'support_agent' then 10 else 99 end
      limit 1
    ), case when exists(
      select 1 from public.admin_department_assignments
      where user_id=_user_id and is_active
    ) then 'department_staff' end)
    else null
  end;
$$;

create or replace function public.admin_list_staff_accounts(p_search text default null)
returns jsonb
language plpgsql security definer
set search_path=public,auth
set row_security=off
as $$
declare result jsonb;
begin
  if auth.uid() is null
     or not public.has_role(auth.uid(),'admin'::public.app_role)
     or coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then
    raise exception 'God Mode AAL2 authentication required' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.full_name nulls last,row_data.email),'[]'::jsonb)
  into result
  from (
    select
      u.id,u.email,p.full_name,p.student_number,u.created_at,u.last_sign_in_at,
      (
        select ur.role::text from public.user_roles ur
        where ur.user_id=u.id and ur.role::text in ('admin','operations_lead','commerce_lead','growth_lead','system_operator','tvet_lead','support_agent')
        order by case ur.role::text when 'admin' then 1 when 'system_operator' then 2 when 'operations_lead' then 3 when 'commerce_lead' then 4 when 'growth_lead' then 5 when 'tvet_lead' then 6 when 'support_agent' then 7 else 99 end limit 1
      ) staff_role,
      coalesce((select array_agg(ur.role::text order by ur.role::text) from public.user_roles ur where ur.user_id=u.id),'{}'::text[]) all_roles,
      coalesce((select array_agg(a.department_key order by a.department_key) from public.admin_department_assignments a where a.user_id=u.id and a.is_active),'{}'::text[]) departments,
      public.admin_effective_departments(u.id) effective_departments
    from auth.users u
    left join public.profiles p on p.id=u.id
    where p_search is null or btrim(p_search)='' or coalesce(u.email,'') ilike '%'||btrim(p_search)||'%' or coalesce(p.full_name,'') ilike '%'||btrim(p_search)||'%'
    order by coalesce(p.full_name,u.email)
    limit 250
  ) row_data;
  return result;
end $$;
revoke all on function public.admin_list_staff_accounts(text) from public,anon;
grant execute on function public.admin_list_staff_accounts(text) to authenticated;

create or replace function public.admin_set_department_assignments(p_user_id uuid,p_departments text[])
returns jsonb
language plpgsql security definer
set search_path=public,auth
set row_security=off
as $$
declare
  allowed constant text[]:=array['executive','accommodation','student_opportunities','marketing_corporate_affairs','partnerships_engagements','communications_service','operations','finance_admin','intelligence_analytics','technology_systems'];
  clean text[];
  previous text[];
  bad text;
begin
  if auth.uid() is null
     or not public.has_role(auth.uid(),'admin'::public.app_role)
     or coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then
    raise exception 'God Mode AAL2 authentication required' using errcode='42501';
  end if;
  if p_user_id is null then raise exception 'Target user is required'; end if;
  if p_user_id=auth.uid() then raise exception 'You cannot change your own department access from this screen' using errcode='42501'; end if;
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'Target account was not found'; end if;

  select coalesce(array_agg(distinct lower(btrim(x)) order by lower(btrim(x))),'{}'::text[])
  into clean from unnest(coalesce(p_departments,'{}'::text[])) x where nullif(btrim(x),'') is not null;

  select x into bad from unnest(clean) x where not (x=any(allowed)) limit 1;
  if bad is not null then raise exception 'Unsupported department: %',bad; end if;

  select coalesce(array_agg(department_key order by department_key),'{}'::text[])
  into previous from public.admin_department_assignments where user_id=p_user_id and is_active;

  delete from public.admin_department_assignments where user_id=p_user_id;
  insert into public.admin_department_assignments(user_id,department_key,access_level,assigned_by)
  select p_user_id,x,'member',auth.uid() from unnest(clean) x;

  insert into public.admin_department_audit_log(actor_user_id,target_user_id,previous_departments,new_departments,metadata)
  values(auth.uid(),p_user_id,previous,clean,jsonb_build_object('aal',auth.jwt()->>'aal'));

  return jsonb_build_object('ok',true,'user_id',p_user_id,'departments',clean,'effective_departments',public.admin_effective_departments(p_user_id));
end $$;
revoke all on function public.admin_set_department_assignments(uuid,text[]) from public,anon;
grant execute on function public.admin_set_department_assignments(uuid,text[]) to authenticated;

create index if not exists idx_admin_department_assignments_user on public.admin_department_assignments(user_id,is_active,department_key);
