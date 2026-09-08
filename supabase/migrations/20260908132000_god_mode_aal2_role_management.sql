create table if not exists public.admin_role_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  target_user_id uuid not null,
  action text not null check (action in ('set_staff_role','revoke_staff_role')),
  previous_roles text[] not null default '{}',
  new_role text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_role_audit_log enable row level security;

revoke all on public.admin_role_audit_log from anon;
revoke insert, update, delete on public.admin_role_audit_log from authenticated;
grant select on public.admin_role_audit_log to authenticated;

drop policy if exists admin_role_audit_aal2_select on public.admin_role_audit_log;
create policy admin_role_audit_aal2_select
on public.admin_role_audit_log
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
);

drop policy if exists "Admins can insert roles" on public.user_roles;
drop policy if exists "Admins can manage roles" on public.user_roles;
drop policy if exists "Admins can update roles" on public.user_roles;
drop policy if exists "Only admins can delete roles" on public.user_roles;
drop policy if exists user_roles_admin_delete on public.user_roles;
drop policy if exists user_roles_admin_insert on public.user_roles;
drop policy if exists user_roles_admin_update on public.user_roles;

create policy user_roles_admin_aal2_insert
on public.user_roles
for insert
to authenticated
with check (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
);

create policy user_roles_admin_aal2_update
on public.user_roles
for update
to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
)
with check (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
);

create policy user_roles_admin_aal2_delete
on public.user_roles
for delete
to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
);

create or replace function public.admin_list_staff_accounts(p_search text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  result jsonb;
begin
  if auth.uid() is null
     or not public.has_role(auth.uid(), 'admin'::public.app_role)
     or coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'God Mode AAL2 authentication required' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.full_name nulls last, row_data.email), '[]'::jsonb)
  into result
  from (
    select
      u.id,
      u.email,
      p.full_name,
      p.student_number,
      u.created_at,
      u.last_sign_in_at,
      (
        select ur.role::text
        from public.user_roles ur
        where ur.user_id = u.id
          and ur.role::text in ('admin','operations_lead','commerce_lead','growth_lead','system_operator','tvet_lead','support_agent')
        order by case ur.role::text
          when 'admin' then 1
          when 'system_operator' then 2
          when 'operations_lead' then 3
          when 'commerce_lead' then 4
          when 'growth_lead' then 5
          when 'tvet_lead' then 6
          when 'support_agent' then 7
          else 99 end
        limit 1
      ) as staff_role,
      coalesce((select array_agg(ur.role::text order by ur.role::text) from public.user_roles ur where ur.user_id = u.id), '{}'::text[]) as all_roles
    from auth.users u
    left join public.profiles p on p.id = u.id
    where p_search is null
       or btrim(p_search) = ''
       or coalesce(u.email, '') ilike '%' || btrim(p_search) || '%'
       or coalesce(p.full_name, '') ilike '%' || btrim(p_search) || '%'
    order by coalesce(p.full_name, u.email)
    limit 250
  ) row_data;

  return result;
end;
$$;

revoke all on function public.admin_list_staff_accounts(text) from public, anon;
grant execute on function public.admin_list_staff_accounts(text) to authenticated;

create or replace function public.admin_set_staff_role(p_user_id uuid, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  clean_role text := nullif(lower(btrim(coalesce(p_role, ''))), 'none');
  previous_roles text[];
  target_email text;
  action_name text;
begin
  if auth.uid() is null
     or not public.has_role(auth.uid(), 'admin'::public.app_role)
     or coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'God Mode AAL2 authentication required' using errcode = '42501';
  end if;

  if p_user_id is null then
    raise exception 'Target user is required' using errcode = '22023';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own God Mode role from this screen' using errcode = '42501';
  end if;

  if clean_role is not null and clean_role not in (
    'admin','operations_lead','commerce_lead','growth_lead','system_operator','tvet_lead','support_agent'
  ) then
    raise exception 'Unsupported staff role: %', clean_role using errcode = '22023';
  end if;

  select email into target_email from auth.users where id = p_user_id;
  if target_email is null then
    raise exception 'Target account was not found' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(role::text order by role::text), '{}'::text[])
  into previous_roles
  from public.user_roles
  where user_id = p_user_id
    and role::text in ('admin','operations_lead','commerce_lead','growth_lead','system_operator','tvet_lead','support_agent');

  delete from public.user_roles
  where user_id = p_user_id
    and role::text in ('admin','operations_lead','commerce_lead','growth_lead','system_operator','tvet_lead','support_agent');

  if clean_role is not null then
    insert into public.user_roles (user_id, role)
    values (p_user_id, clean_role::public.app_role)
    on conflict do nothing;
    action_name := 'set_staff_role';
  else
    action_name := 'revoke_staff_role';
  end if;

  insert into public.admin_role_audit_log (
    actor_user_id, target_user_id, action, previous_roles, new_role, metadata
  ) values (
    auth.uid(), p_user_id, action_name, previous_roles, clean_role,
    jsonb_build_object('target_email', target_email, 'aal', auth.jwt() ->> 'aal')
  );

  return jsonb_build_object(
    'ok', true,
    'user_id', p_user_id,
    'email', target_email,
    'previous_roles', previous_roles,
    'staff_role', clean_role
  );
end;
$$;

revoke all on function public.admin_set_staff_role(uuid, text) from public, anon;
grant execute on function public.admin_set_staff_role(uuid, text) to authenticated;
