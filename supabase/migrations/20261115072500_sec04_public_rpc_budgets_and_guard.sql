-- SEC-04 public attribution/telemetry — bounded anonymous writes, session ownership and budgets.
-- Budget counters live in a non-exposed schema. Caller-supplied visitor/session identifiers
-- can be rotated: these controls limit accidental/repetitive abuse but DO NOT replace WAF/IP quotas.
create table if not exists reskonnect_internal.rk_public_rpc_budgets(
 surface text not null,
 bucket_start timestamptz not null,
 identity_hash text not null,
 used integer not null default 0 check(used>=0),
 primary key(surface,bucket_start,identity_hash)
);
alter table reskonnect_internal.rk_public_rpc_budgets enable row level security;
revoke all on table reskonnect_internal.rk_public_rpc_budgets from PUBLIC,anon,authenticated;

create or replace function reskonnect_internal.rk_guard_public_rpc_budget(
 p_surface text,p_subject text,p_per_minute integer,p_per_hour integer,p_global_hour integer
) returns void language plpgsql security definer set search_path='' as $body$
declare v_now timestamptz:=now();v_minute timestamptz;v_hour timestamptz;
 v_subject text;v_count integer;
begin
 if auth.role()='service_role' then return; end if;
 if p_surface not in('referral_click','growth_attribution','growth_demand','virtual_tour_event','mobile_runtime')
    or p_per_minute<1 or p_per_hour<p_per_minute or p_global_hour<p_per_hour
    or length(coalesce(p_subject,''))>256 then
  raise exception 'Invalid public API budget configuration' using errcode='22023';
 end if;
 v_minute:=date_trunc('minute',v_now);
 v_hour:=date_trunc('hour',v_now);
 -- Strong actor identity if authenticated; anonymous browser IDs are untrusted heuristics.
 v_subject:=md5(coalesce(auth.uid()::text,'anonymous:'||coalesce(nullif(p_subject,''),'unidentified')));
 insert into reskonnect_internal.rk_public_rpc_budgets(surface,bucket_start,identity_hash,used)
 values(p_surface,v_minute,'m:'||v_subject,1)
 on conflict(surface,bucket_start,identity_hash) do update
  set used=reskonnect_internal.rk_public_rpc_budgets.used+1
  where reskonnect_internal.rk_public_rpc_budgets.used<p_per_minute
 returning used into v_count;
 if not found then raise exception 'Too many requests' using errcode='PT429';end if;
 insert into reskonnect_internal.rk_public_rpc_budgets(surface,bucket_start,identity_hash,used)
 values(p_surface,v_hour,'h:'||v_subject,1)
 on conflict(surface,bucket_start,identity_hash) do update
  set used=reskonnect_internal.rk_public_rpc_budgets.used+1
  where reskonnect_internal.rk_public_rpc_budgets.used<p_per_hour
 returning used into v_count;
 if not found then raise exception 'Too many requests' using errcode='PT429';end if;
 -- High-ceiling global circuit breaker for rotating anonymous identifiers.
 insert into reskonnect_internal.rk_public_rpc_budgets(surface,bucket_start,identity_hash,used)
 values(p_surface,v_hour,'global',1)
 on conflict(surface,bucket_start,identity_hash) do update
  set used=reskonnect_internal.rk_public_rpc_budgets.used+1
  where reskonnect_internal.rk_public_rpc_budgets.used<p_global_hour
 returning used into v_count;
 if not found then raise exception 'Public telemetry temporarily limited' using errcode='PT429';end if;
end $body$;
revoke all on function reskonnect_internal.rk_guard_public_rpc_budget(text,text,integer,integer,integer)
 from PUBLIC,anon,authenticated;
grant execute on function reskonnect_internal.rk_guard_public_rpc_budget(text,text,integer,integer,integer)
 to service_role;

-- Limit budget table growth to 48 hours. No business/customer tables are cleaned.
select cron.schedule('rk-public-rpc-budget-prune','39 4 * * *',
 $job$delete from reskonnect_internal.rk_public_rpc_budgets
      where bucket_start < now()-interval '48 hours'$job$);
