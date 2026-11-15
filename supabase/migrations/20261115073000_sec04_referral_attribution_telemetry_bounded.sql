-- SEC-04: Public events retain the original signatures and output contracts.
-- Function definitions are taken from verified live PostgreSQL schema, not stale original migrations.
-- Anonymous per-session identifiers are spoofable; caps are budget protections, NOT identity verification.

-- Harden capture_referral_click
CREATE OR REPLACE FUNCTION public.capture_referral_click(_code text, _visitor_id text DEFAULT NULL::text, _landing_url text DEFAULT NULL::text, _user_agent text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _c text;
  _agent_id uuid;
  _session_id uuid;
BEGIN

  if _code is null or length(trim(_code)) not between 2 and 100
    or octet_length(coalesce(_visitor_id,''))>128
    or octet_length(coalesce(_landing_url,''))>900
    or octet_length(coalesce(_user_agent,''))>600 then
    raise exception 'Invalid referral tracking input' using errcode='22023';
  end if;
  perform reskonnect_internal.rk_guard_public_rpc_budget(
    'referral_click',coalesce(nullif(_visitor_id,''),'guest'),15,100,5000
  );

  _c := public.normalize_referral_code(_code);
  SELECT user_id INTO _agent_id FROM public.referral_codes WHERE code = _c AND is_active = true;
  IF _agent_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.referral_sessions(code, referral_agent_user_id, anonymous_visitor_id, landing_url, user_agent, attached_user_id)
  VALUES (_c, _agent_id, _visitor_id, _landing_url, _user_agent, auth.uid())
  RETURNING id INTO _session_id;

  RETURN _session_id;
END $function$;

-- Harden capture_residence_referral_click
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

-- Harden luna_capture_attribution
CREATE OR REPLACE FUNCTION public.luna_capture_attribution(p_visitor_hash text, p_session_id text, p_landing_path text DEFAULT NULL::text, p_campaign_code text DEFAULT NULL::text, p_utm_source text DEFAULT NULL::text, p_utm_medium text DEFAULT NULL::text, p_utm_campaign text DEFAULT NULL::text, p_utm_content text DEFAULT NULL::text, p_utm_term text DEFAULT NULL::text, p_referrer_host text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_uid uuid:=auth.uid();
  v_campaign text:=null;
begin

  if p_session_id is null or length(trim(p_session_id)) not between 8 and 128
    or p_visitor_hash is null or length(trim(p_visitor_hash)) not between 8 and 128
    or octet_length(coalesce(p_landing_path,''))>500
    or octet_length(coalesce(p_campaign_code,''))>160
    or octet_length(coalesce(p_utm_source,''))>120
    or octet_length(coalesce(p_utm_medium,''))>120
    or octet_length(coalesce(p_utm_campaign,''))>160
    or octet_length(coalesce(p_utm_content,''))>160
    or octet_length(coalesce(p_utm_term,''))>160
    or octet_length(coalesce(p_referrer_host,''))>255 then
    raise exception 'Invalid attribution session' using errcode='22023';
  end if;
  perform reskonnect_internal.rk_guard_public_rpc_budget(
    'growth_attribution',p_visitor_hash||':'||p_session_id,20,120,25000
  );

  if nullif(trim(coalesce(p_session_id,'')),'') is null then raise exception 'session_id is required'; end if;
  if nullif(trim(coalesce(p_campaign_code,'')),'') is not null and exists(
    select 1 from public.adminos_growth_campaigns c where c.campaign_code=left(trim(p_campaign_code),160)
  ) then
    v_campaign:=left(trim(p_campaign_code),160);
  end if;

  insert into public.adminos_attribution_sessions(visitor_hash,session_id,user_id,campaign_code,utm_source,utm_medium,utm_campaign,utm_content,utm_term,landing_path,referrer_host,last_seen_at)
  values(left(nullif(p_visitor_hash,''),128),left(p_session_id,128),v_uid,v_campaign,left(nullif(p_utm_source,''),120),left(nullif(p_utm_medium,''),120),left(nullif(p_utm_campaign,''),160),left(nullif(p_utm_content,''),160),left(nullif(p_utm_term,''),160),left(nullif(p_landing_path,''),500),left(nullif(p_referrer_host,''),255),now())
  on conflict(session_id) do update set
    visitor_hash=coalesce(excluded.visitor_hash,adminos_attribution_sessions.visitor_hash),
    user_id=coalesce(excluded.user_id,adminos_attribution_sessions.user_id),
    campaign_code=coalesce(excluded.campaign_code,adminos_attribution_sessions.campaign_code),
    utm_source=coalesce(excluded.utm_source,adminos_attribution_sessions.utm_source),
    utm_medium=coalesce(excluded.utm_medium,adminos_attribution_sessions.utm_medium),
    utm_campaign=coalesce(excluded.utm_campaign,adminos_attribution_sessions.utm_campaign),
    utm_content=coalesce(excluded.utm_content,adminos_attribution_sessions.utm_content),
    utm_term=coalesce(excluded.utm_term,adminos_attribution_sessions.utm_term),
    landing_path=coalesce(adminos_attribution_sessions.landing_path,excluded.landing_path),
    referrer_host=coalesce(adminos_attribution_sessions.referrer_host,excluded.referrer_host),
    last_seen_at=now()
  where adminos_attribution_sessions.visitor_hash=excluded.visitor_hash
    and (adminos_attribution_sessions.user_id is null
         or adminos_attribution_sessions.user_id=excluded.user_id)
  returning id into v_id;
  return v_id;
end $function$;

-- Harden luna_log_demand_event
CREATE OR REPLACE FUNCTION public.luna_log_demand_event(p_event_type text, p_visitor_hash text DEFAULT NULL::text, p_session_id text DEFAULT NULL::text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_uid uuid:=auth.uid();
  v_rooms text[]:='{}';
  v_amenities text[]:='{}';
  v_price_min numeric;
  v_price_max numeric;
  v_distance numeric;
  v_results integer;
  v_campaign text:=null;
begin

  if p_event_type is null or length(p_event_type)>80
    or octet_length(coalesce(p_session_id,''))>128
    or octet_length(coalesce(p_visitor_hash,''))>128
    or jsonb_typeof(coalesce(p_payload,'{}'::jsonb))<>'object'
    or octet_length(coalesce(p_payload,'{}'::jsonb)::text)>8192 then
    raise exception 'Invalid or oversized demand event' using errcode='22023';
  end if;
  perform reskonnect_internal.rk_guard_public_rpc_budget(
    'growth_demand',coalesce(nullif(p_visitor_hash,''),nullif(p_session_id,''),'guest'),
    60,500,25000
  );

  if p_event_type not in ('landing','campaign_visit','residence_search','filter_change','application_start','application_submitted','whatsapp_click') then raise exception 'Unsupported demand event'; end if;
  if jsonb_typeof(p_payload->'room_types')='array' then
    select coalesce(array_agg(left(t.value,80)),'{}'::text[]) into v_rooms
    from jsonb_array_elements_text(p_payload->'room_types') with ordinality as t(value,n)
    where t.n<=20;
  end if;
  if jsonb_typeof(p_payload->'amenities')='array' then
    select coalesce(array_agg(left(t.value,80)),'{}'::text[]) into v_amenities
    from jsonb_array_elements_text(p_payload->'amenities') with ordinality as t(value,n)
    where t.n<=20;
  end if;
  if coalesce(p_payload->>'price_min','') ~ '^\d+(\.\d+)?$' then v_price_min=least((p_payload->>'price_min')::numeric,1000000); end if;
  if coalesce(p_payload->>'price_max','') ~ '^\d+(\.\d+)?$' then v_price_max=least((p_payload->>'price_max')::numeric,1000000); end if;
  if coalesce(p_payload->>'distance_max','') ~ '^\d+(\.\d+)?$' then v_distance=least((p_payload->>'distance_max')::numeric,10000); end if;
  if coalesce(p_payload->>'result_count','') ~ '^\d+$' then v_results=least((p_payload->>'result_count')::integer,1000000); end if;
  if nullif(trim(coalesce(p_payload->>'campaign_code','')),'') is not null and exists(
    select 1 from public.adminos_growth_campaigns c where c.campaign_code=left(trim(p_payload->>'campaign_code'),160)
  ) then v_campaign:=left(trim(p_payload->>'campaign_code'),160); end if;

  insert into public.adminos_demand_events(user_id,visitor_hash,session_id,event_type,surface,path,campus,search_query,price_min,price_max,distance_max,room_types,amenities,funding_type,audience,institution_tag,result_count,campaign_code,metadata)
  values(v_uid,left(nullif(p_visitor_hash,''),128),left(nullif(p_session_id,''),128),p_event_type,left(nullif(p_payload->>'surface',''),80),left(nullif(p_payload->>'path',''),500),left(nullif(p_payload->>'campus',''),160),left(nullif(p_payload->>'search_query',''),240),v_price_min,v_price_max,v_distance,v_rooms,v_amenities,left(nullif(p_payload->>'funding_type',''),80),left(nullif(p_payload->>'audience',''),80),left(nullif(p_payload->>'institution_tag',''),160),v_results,v_campaign,jsonb_build_object('sort_by',left(coalesce(p_payload->>'sort_by',''),80),'category',left(coalesce(p_payload->>'category',''),80),'availability',left(coalesce(p_payload->>'availability',''),80),'nsfas_only',coalesce(p_payload->'nsfas_only','false'::jsonb),'tut_only',coalesce(p_payload->'tut_only','false'::jsonb),'furnished_only',coalesce(p_payload->'furnished_only','false'::jsonb),'wifi_only',coalesce(p_payload->'wifi_only','false'::jsonb),'parking_only',coalesce(p_payload->'parking_only','false'::jsonb)))
  returning id into v_id;

  if v_uid is not null and nullif(p_session_id,'') is not null then
    update public.adminos_attribution_sessions set user_id=coalesce(user_id,v_uid),last_seen_at=now() where session_id=left(p_session_id,128)
      and visitor_hash=left(p_visitor_hash,128)
      and (user_id is null or user_id=v_uid);
  end if;
  return v_id;
end $function$;

-- Harden record_mobile_runtime_event
CREATE OR REPLACE FUNCTION public.record_mobile_runtime_event(p_event_type text, p_platform text DEFAULT 'android'::text, p_release text DEFAULT 'unknown'::text, p_version_code integer DEFAULT NULL::integer, p_stage text DEFAULT NULL::text, p_message text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_id uuid;
  v_event text := lower(trim(coalesce(p_event_type,'')));
  v_platform text := left(lower(trim(coalesce(p_platform,'android'))),32);
  v_release text := left(trim(coalesce(p_release,'unknown')),64);
  v_stage text := nullif(left(trim(coalesce(p_stage,'')),240),'');
  v_message text := nullif(left(trim(coalesce(p_message,'')),500),'');
  v_meta jsonb := coalesce(p_metadata,'{}'::jsonb);
begin

  perform reskonnect_internal.rk_guard_public_rpc_budget(
    'mobile_runtime',
    coalesce(auth.uid()::text,
      nullif(left(coalesce(p_metadata->>'anonymous_session',''),128),''),
      'anonymous-device'),
    case when auth.uid() is null then 2000 else 30 end,
    case when auth.uid() is null then 20000 else 300 end,30000
  );

  if v_event not in (
    'post_login_stable','ui_error','renderer_recovery','boot',
    'renderer_gone','js_error','unhandled_rejection','ui_render_error',
    'webgl_context_lost','memory_pressure','request_timeout','offline','reconnected'
  ) then
    raise exception 'Unsupported runtime event';
  end if;
  if octet_length(v_meta::text) > 4096 then
    raise exception 'Runtime metadata too large';
  end if;

  insert into public.mobile_runtime_events(
    user_id,platform,release,version_code,event_type,stage,message,metadata
  )
  values(
    auth.uid(),coalesce(nullif(v_platform,''),'android'),
    coalesce(nullif(v_release,''),'unknown'),p_version_code,
    v_event,v_stage,v_message,v_meta
  )
  returning id into v_id;
  return v_id;
end;
$function$;

-- Harden record_virtual_tour_event
CREATE OR REPLACE FUNCTION public.record_virtual_tour_event(p_tour_id uuid, p_scene_id uuid, p_event_type text, p_viewer_session uuid, p_anonymous_id text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin

  if p_viewer_session is null
    or jsonb_typeof(coalesce(p_metadata,'{}'::jsonb))<>'object'
    or octet_length(coalesce(p_metadata,'{}'::jsonb)::text)>4096
    or octet_length(coalesce(p_anonymous_id,''))>120 then
    raise exception 'Invalid tour tracking payload' using errcode='22023';
  end if;
  perform reskonnect_internal.rk_guard_public_rpc_budget(
    'virtual_tour_event',p_viewer_session::text,60,600,20000
  );

  if p_event_type not in ('tour_open','scene_view','hotspot_click','guided_start','guided_complete','apply_click','contact_click','fullscreen','motion_enable','exit') then raise exception 'Unsupported analytics event'; end if;
  if not exists(select 1 from public.virtual_tours where id=p_tour_id and status='published') then return false; end if;
  if p_scene_id is not null and not exists(
    select 1 from public.virtual_tour_scenes
    where id=p_scene_id and tour_id=p_tour_id
  ) then
    return false;
  end if;
  insert into public.virtual_tour_analytics(tour_id,scene_id,event_type,viewer_session,user_id,anonymous_id,metadata)
  values(p_tour_id,p_scene_id,p_event_type,p_viewer_session,auth.uid(),left(coalesce(p_anonymous_id,''),120),coalesce(p_metadata,'{}'::jsonb));
  return true;
end; $function$;

notify pgrst,'reload schema';
