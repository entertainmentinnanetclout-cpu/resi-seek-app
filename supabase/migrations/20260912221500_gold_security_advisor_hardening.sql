-- Gold Security advisor hardening.
-- Remove direct API execution from trigger-only/internal SECURITY DEFINER functions,
-- lock mutable search paths, and expose only an aggregate AAL2 security summary.

alter function public.adminos_detect_language(text) set search_path='';
alter function public.touch_conversion_automation_task() set search_path='public','pg_temp';
alter function public.touch_partnership_resource() set search_path='public','pg_temp';

do $$
declare r record;
begin
  -- Trigger functions execute through the database trigger mechanism; browser/API
  -- callers never need direct EXECUTE on them.
  for r in
    select distinct n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    join pg_trigger t on t.tgfoid=p.oid and not t.tgisinternal
    where n.nspname='public'
  loop
    execute format('revoke all on function %I.%I(%s) from public,anon,authenticated',r.nspname,r.proname,r.args);
    execute format('grant execute on function %I.%I(%s) to service_role',r.nspname,r.proname,r.args);
  end loop;

  -- Internal RG engines are invoked by pg_cron/service-role or through their
  -- explicitly authenticated "adminos_run_*" wrappers. Hide the helpers.
  for r in
    select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef
      and p.proname ~ '^adminos_rg(6|7|8|9|10|11|12|13|14|15)_'
      and p.proname not like 'adminos_run_%'
      and p.proname not like 'adminos_approve_%'
  loop
    execute format('revoke all on function %I.%I(%s) from public,anon,authenticated',r.nspname,r.proname,r.args);
    execute format('grant execute on function %I.%I(%s) to service_role',r.nspname,r.proname,r.args);
  end loop;
end $$;

-- Explicitly preserve the small self-service security RPC after the blanket
-- trigger/function hardening above.
revoke all on function public.rk_my_security_status() from public,anon;
grant execute on function public.rk_my_security_status() to authenticated;

create or replace function public.adminos_gold_security_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
set row_security='off'
as $$
declare
  v_uid uuid:=auth.uid();
  v_profiles integer:=0;
  v_google integer:=0;
  v_email_verified integer:=0;
  v_phone_verified integer:=0;
  v_privileged integer:=0;
  v_events24 integer:=0;
  v_blocked24 integer:=0;
  v_high24 integer:=0;
  v_otp24 integer:=0;
  v_otp_approved24 integer:=0;
  v_twilio_status text:='not_connected';
  v_twilio_enabled boolean:=false;
  v_twilio_success timestamptz;
  v_gsc_status text:='not_connected';
  v_gsc_success timestamptz;
  v_policy jsonb:='{}'::jsonb;
  v_trigger_exposure integer:=0;
  v_privileged_aal2_policies integer:=0;
begin
  if v_uid is null
     or not (
       public.has_admin_department_access('technology_systems')
       or public.has_admin_department_access('executive')
     ) then
    raise exception 'AAL2 Technology or Executive access required' using errcode='42501';
  end if;

  select count(*)::integer,
         count(*) filter(where auth_provider='google')::integer,
         count(*) filter(where email_verified_at is not null)::integer,
         count(*) filter(where phone_verified_at is not null)::integer,
         count(*) filter(where security_level='privileged')::integer
  into v_profiles,v_google,v_email_verified,v_phone_verified,v_privileged
  from public.profiles;

  select count(*)::integer,
         count(*) filter(where outcome='blocked')::integer,
         count(*) filter(where risk_level in ('high','critical'))::integer
  into v_events24,v_blocked24,v_high24
  from public.user_security_events
  where created_at>=now()-interval '24 hours';

  select count(*)::integer,
         count(*) filter(where status='approved')::integer
  into v_otp24,v_otp_approved24
  from public.user_phone_verification_attempts
  where requested_at>=now()-interval '24 hours';

  select coalesce(status,'not_connected'),coalesce(enabled,false),last_success_at
  into v_twilio_status,v_twilio_enabled,v_twilio_success
  from public.adminos_integration_connections
  where provider='twilio_verify'
  limit 1;

  select coalesce(status,'not_connected'),last_success_at
  into v_gsc_status,v_gsc_success
  from public.adminos_integration_connections
  where provider='google_search_console'
  limit 1;

  select coalesce(config,'{}'::jsonb) into v_policy
  from public.platform_security_policy
  where policy_key='gold_security_mode';

  select count(*)::integer into v_trigger_exposure
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  join pg_trigger t on t.tgfoid=p.oid and not t.tgisinternal
  where n.nspname='public'
    and p.prosecdef
    and (
      has_function_privilege('anon',p.oid,'EXECUTE')
      or has_function_privilege('authenticated',p.oid,'EXECUTE')
    );

  select count(*)::integer into v_privileged_aal2_policies
  from pg_policies
  where schemaname='public'
    and (
      coalesce(qual,'') ilike '%aal2%'
      or coalesce(with_check,'') ilike '%aal2%'
    );

  return jsonb_build_object(
    'mode','gold',
    'policy_enabled',true,
    'policy',v_policy,
    'identity',jsonb_build_object(
      'profiles',v_profiles,
      'google_accounts',v_google,
      'email_verified',v_email_verified,
      'phone_verified',v_phone_verified,
      'privileged_profiles',v_privileged
    ),
    'security_24h',jsonb_build_object(
      'events',v_events24,
      'blocked',v_blocked24,
      'high_or_critical',v_high24,
      'verification_requests',v_otp24,
      'verification_approved',v_otp_approved24
    ),
    'integrations',jsonb_build_object(
      'twilio_verify',jsonb_build_object('status',v_twilio_status,'enabled',v_twilio_enabled,'last_success_at',v_twilio_success),
      'google_search_console',jsonb_build_object('status',v_gsc_status,'last_success_at',v_gsc_success)
    ),
    'controls',jsonb_build_object(
      'trigger_rpc_exposure_count',v_trigger_exposure,
      'aal2_policy_count',v_privileged_aal2_policies,
      'legacy_auto_admin_email',false,
      'authenticated_supabase_cache',false,
      'attack_challenge_default',false
    ),
    'generated_at',now()
  );
end;
$$;

revoke all on function public.adminos_gold_security_summary() from public,anon;
grant execute on function public.adminos_gold_security_summary() to authenticated;
