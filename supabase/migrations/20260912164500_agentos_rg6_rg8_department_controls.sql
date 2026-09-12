-- Department-authorized manual controls for AgentOS RG6-RG8.
-- Internal cycle functions remain service-role-only; these wrappers enforce office access.

create or replace function public.adminos_run_rg6_now()
returns jsonb
language plpgsql
security definer
set search_path=public
set row_security=off
as $$
begin
  if auth.uid() is null or not (
    public.has_admin_department_access('communications_service')
    or public.has_admin_department_access('executive')
  ) then
    raise exception 'Communications or Executive access required' using errcode='42501';
  end if;
  return public.adminos_rg6_conversion_cycle();
end;
$$;
revoke all on function public.adminos_run_rg6_now() from public,anon;
grant execute on function public.adminos_run_rg6_now() to authenticated;

create or replace function public.adminos_run_rg7_now()
returns jsonb
language plpgsql
security definer
set search_path=public
set row_security=off
as $$
begin
  if auth.uid() is null or not (
    public.has_admin_department_access('accommodation')
    or public.has_admin_department_access('operations')
    or public.has_admin_department_access('executive')
  ) then
    raise exception 'Accommodation, Operations or Executive access required' using errcode='42501';
  end if;
  return public.adminos_rg7_application_operations_cycle();
end;
$$;
revoke all on function public.adminos_run_rg7_now() from public,anon;
grant execute on function public.adminos_run_rg7_now() to authenticated;

create or replace function public.adminos_run_rg8_now()
returns jsonb
language plpgsql
security definer
set search_path=public
set row_security=off
as $$
begin
  if auth.uid() is null or not (
    public.has_admin_department_access('accommodation')
    or public.has_admin_department_access('intelligence_analytics')
    or public.has_admin_department_access('executive')
  ) then
    raise exception 'Accommodation, Intelligence or Executive access required' using errcode='42501';
  end if;
  return public.adminos_rg8_occupancy_cycle();
end;
$$;
revoke all on function public.adminos_run_rg8_now() from public,anon;
grant execute on function public.adminos_run_rg8_now() to authenticated;
