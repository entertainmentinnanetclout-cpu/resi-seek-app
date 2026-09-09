-- ResKonnect 360 Studio V2 prerequisite repair.
-- Production migration history contained the RG1/RG2 release-registry migration version,
-- while the live release-registry table and helper functions were absent. Keep this
-- migration idempotent so fresh environments and drifted production both converge.

create table if not exists public.virtual_tour_release_registry (
  release_key text primary key,
  release_name text not null,
  status text not null default 'active',
  phases integer[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.virtual_tour_release_registry(release_key,release_name,status,phases,metadata) values
('rg1','360 Studio V2 · Internal Capture Prototype','active',array[0,1,2,3],'{"version":"v2"}'::jsonb),
('rg2','360 Studio V2 · End-to-End Virtual Tour','active',array[4,5,6],'{"version":"v2"}'::jsonb)
on conflict (release_key) do update set
  release_name=excluded.release_name,
  status=excluded.status,
  phases=excluded.phases,
  metadata=excluded.metadata,
  updated_at=now();

create or replace function public.virtual_tour_is_admin()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.user_roles
    where user_id=auth.uid() and role::text='admin'
  );
$$;

create or replace function public.virtual_tour_can_manage_residence(p_residence_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.virtual_tour_is_admin() or exists(
    select 1
    from public.residence_portal_accounts a
    where a.residence_id=p_residence_id
      and a.is_active=true
      and (
        a.user_id=auth.uid()
        or (
          a.user_id is null
          and lower(a.email)=lower(coalesce(auth.jwt()->>'email',''))
        )
      )
  );
$$;

revoke all on function public.virtual_tour_is_admin() from public, anon;
revoke all on function public.virtual_tour_can_manage_residence(uuid) from public, anon;
grant execute on function public.virtual_tour_is_admin(), public.virtual_tour_can_manage_residence(uuid) to authenticated;
