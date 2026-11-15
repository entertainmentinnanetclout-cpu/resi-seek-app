-- SEC-04 follow-up: recruiter redirect guessing is limited before lookup.
CREATE OR REPLACE FUNCTION reskonnect_internal.rk_guard_public_rpc_budget(p_surface text, p_subject text, p_per_minute integer, p_per_hour integer, p_global_hour integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_now timestamptz:=now();v_minute timestamptz;v_hour timestamptz;
 v_subject text;v_count integer;
begin
 if auth.role()='service_role' then return; end if;
 if p_surface not in('referral_click','recruiter_redirect','growth_attribution','growth_demand','virtual_tour_event','mobile_runtime')
    or p_per_minute<1 or p_per_hour<p_per_minute or p_global_hour<p_per_hour
    or length(coalesce(p_subject,''))>257 then
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
end $function$;

CREATE OR REPLACE FUNCTION public.capture_residence_referral_click(_link_key text, _visitor_id text DEFAULT NULL::text, _landing_url text DEFAULT NULL::text, _user_agent text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  v_link public.recruiter_residence_links%rowtype;
  v_res public.residences%rowtype;
  v_session uuid;
  v_agent_name text;
begin

  if _link_key is null or length(trim(_link_key)) not between 2 and 100
    or octet_length(coalesce(_visitor_id,''))>128
    or octet_length(coalesce(_landing_url,''))>900
    or octet_length(coalesce(_user_agent,''))>600 then
    raise exception 'Invalid recruiter link' using errcode='22023';
  end if;

  -- Rate-limit even invalid or guessed links before any database lookup.
  perform reskonnect_internal.rk_guard_public_rpc_budget(
   'recruiter_redirect',coalesce(nullif(_visitor_id,''),nullif(_link_key,''),'guest'),30,300,10000
  );
  select * into v_link from public.recruiter_residence_links where link_key=lower(trim(_link_key)) and is_active=true;
  if not found or not exists(select 1 from public.residence_recruitment_programs where residence_id=v_link.residence_id and enabled=true) then return null; end if;
  select * into v_res from public.residences where id=v_link.residence_id and is_visible is distinct from false;
  if not found then return null; end if;
  select public.capture_referral_click(v_link.referral_code,_visitor_id,_landing_url,_user_agent) into v_session;
  if v_session is null then return null; end if;
  select coalesce(p.full_name,'ResKonnect Recruiter') into v_agent_name from public.profiles p where p.id=v_link.recruiter_user_id;
  insert into public.referral_events(program_key,event_type,referral_code,referral_agent_user_id,residence_id,session_id,url,metadata)
  values('student_recruitment','residence_link_click',v_link.referral_code,v_link.recruiter_user_id,v_link.residence_id,v_session,_landing_url,jsonb_build_object('link_key',v_link.link_key,'visitor_id',_visitor_id)) ;
  return jsonb_build_object('sessionId',v_session,'code',v_link.referral_code,'agentName',coalesce(v_agent_name,'ResKonnect Recruiter'),'residenceId',v_res.id,'residenceName',v_res.name,'slug',coalesce(v_res.slug,v_res.id::text));
end $function$;

notify pgrst,'reload schema';
