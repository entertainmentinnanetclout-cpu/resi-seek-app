-- Android/web reliability release: collapse client access-resolution into one authenticated RPC
-- and remove anonymous push-subscription table privileges.

create or replace function public.get_my_access_context()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with partnership as (
    select public.get_my_partnership_role('tumelo-career-education') as role_name
  ),
  latest_recruiter_application as (
    select ra.status
    from public.recruiter_applications ra
    where ra.user_id = auth.uid()
      and ra.program_key = 'student_recruitment'
    order by ra.created_at desc nulls last
    limit 1
  )
  select jsonb_build_object(
    'staff_role', public.get_user_staff_role(auth.uid()),
    'admin_departments', to_jsonb(coalesce(public.get_my_admin_departments(), array[]::text[])),
    'is_recruiter', exists (
      select 1
      from public.referral_agents r
      where r.user_id = auth.uid()
        and r.program_key = 'student_recruitment'
        and r.status = 'approved'
    ),
    'is_pending_recruiter', coalesce((select status = 'pending' from latest_recruiter_application), false),
    'tumelo_partner_role', (select role_name from partnership),
    'is_tumelo_partner', (select role_name is not null from partnership),
    'is_student',
      (select role_name is null from partnership)
      and exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and nullif(trim(p.student_number), '') is not null
      )
  )
  where auth.uid() is not null;
$$;

revoke all on function public.get_my_access_context() from public;
grant execute on function public.get_my_access_context() to authenticated;

-- Push subscriptions are account data. Anonymous browser sessions never need table access.
revoke all privileges on table public.push_subscriptions from anon;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;
