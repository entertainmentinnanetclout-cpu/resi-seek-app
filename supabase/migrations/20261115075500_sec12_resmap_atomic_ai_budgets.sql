-- SEC-12 / SEC-36 — atomic rate and spend guard for two paid ResMap AI entry points.
-- Uses the existing private, RLS-enabled, 48h-pruned counter ledger. No personal data stored.
-- Called only by trusted service-role Edge functions immediately before invoking OpenAI.
create or replace function public.rk_consume_ai_budget(
  p_surface text,
  p_subject text,
  p_verified_user boolean default false
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_minute timestamptz;
  v_hour timestamptz;
  v_day timestamptz;
  v_identity text;
  v_minute_limit integer;
  v_hour_limit integer;
  v_day_limit integer;
  v_global_minute integer;
  v_global_hour integer;
  v_rule record;
  v_count integer;
begin
  -- Only a trusted service-role backend may choose budgets or verified identity.
  if auth.role() is distinct from 'service_role' then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if p_surface not in ('map_intent','visual_search')
     or p_subject is null or octet_length(p_subject) not between 1 and 180
     or p_verified_user is null then
    raise exception 'Invalid AI budget request' using errcode='22023';
  end if;
  v_minute := date_trunc('minute', v_now);
  v_hour := date_trunc('hour', v_now);
  v_day := date_trunc('day', v_now);
  v_identity := md5(p_subject);

  if p_surface = 'visual_search' then
    v_minute_limit := 2; v_hour_limit := 8;
    v_day_limit := case when p_verified_user then 10 else 3 end;
    v_global_minute := 10; v_global_hour := 60;
  else
    v_minute_limit := 8; v_hour_limit := 40; v_day_limit := 20;
    v_global_minute := 60; v_global_hour := 360;
  end if;

  -- Each quota is an atomic INSERT/ON CONFLICT update with a hard ceiling.
  -- Subject values are hashed. Anonymous subjects remain spoofable, so the
  -- global minute/hour breakers are essential, independent of subject rotation.
  for v_rule in
    select x.bucket_start, x.identity_hash, x.quota
    from (values
      (v_minute, 'm:' || v_identity, v_minute_limit),
      (v_hour, 'h:' || v_identity, v_hour_limit),
      (v_day, 'd:' || v_identity, v_day_limit),
      (v_minute, 'global-m', v_global_minute),
      (v_hour, 'global-h', v_global_hour)
    ) as x(bucket_start, identity_hash, quota)
  loop
    insert into reskonnect_internal.rk_public_rpc_budgets
      (surface, bucket_start, identity_hash, used)
    values ('resmap_' || p_surface, v_rule.bucket_start, v_rule.identity_hash, 1)
    on conflict(surface,bucket_start,identity_hash) do update
      set used = reskonnect_internal.rk_public_rpc_budgets.used + 1
      where reskonnect_internal.rk_public_rpc_budgets.used < v_rule.quota
    returning used into v_count;

    if not found then
      raise exception 'AI search rate limit reached' using errcode='PT429';
    end if;
  end loop;
end;
$function$;

revoke all on function public.rk_consume_ai_budget(text,text,boolean) from public,anon,authenticated;
grant execute on function public.rk_consume_ai_budget(text,text,boolean) to service_role;
