-- Luna AgentOS RG0/RG1 hardening
-- 1) Never let Luna website conversations enter Dimpho's learning queue.
-- 2) Accept only real ResKonnect growth campaign codes for conversion attribution.
-- 3) Bound public demand-event arrays and keep direct table writes closed.

create or replace function public.dimpho_capture_enquiry_learning_event()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  -- RG0 identity boundary: Luna owns website/in-app enquiry intelligence.
  -- Dimpho must not learn from Luna-routed conversations.
  if lower(coalesce(new.metadata->>'agent_route',new.metadata->>'agent',''))='luna' then
    return new;
  end if;
  if coalesce((select learning_enabled from public.dimpho_intelligence_settings where id=1),true) then
    insert into public.dimpho_conversation_events(channel,thread_id,message_id,direction,occurred_at,metadata)
    values('in_app',new.thread_id,new.id,coalesce(new.direction,new.sender_type),coalesce(new.created_at,now()),jsonb_build_object('sender_type',new.sender_type))
    on conflict(channel,message_id) do nothing;
  end if;
  return new;
end; $$;

create or replace function public.luna_capture_attribution(
  p_visitor_hash text,
  p_session_id text,
  p_landing_path text default null,
  p_campaign_code text default null,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null,
  p_utm_content text default null,
  p_utm_term text default null,
  p_referrer_host text default null
)
returns uuid
language plpgsql security definer set search_path=public as $$
declare
  v_id uuid;
  v_uid uuid:=auth.uid();
  v_campaign text:=null;
begin
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
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.luna_capture_attribution(text,text,text,text,text,text,text,text,text,text) from public;
grant execute on function public.luna_capture_attribution(text,text,text,text,text,text,text,text,text,text) to anon,authenticated,service_role;

create or replace function public.luna_log_demand_event(
  p_event_type text,
  p_visitor_hash text default null,
  p_session_id text default null,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql security definer set search_path=public as $$
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
    update public.adminos_attribution_sessions set user_id=coalesce(user_id,v_uid),last_seen_at=now() where session_id=left(p_session_id,128);
  end if;
  return v_id;
end $$;
revoke all on function public.luna_log_demand_event(text,text,text,jsonb) from public;
grant execute on function public.luna_log_demand_event(text,text,text,jsonb) to anon,authenticated,service_role;

-- Explicit grants; RLS remains authoritative for authenticated direct access.
grant select,insert,update,delete on public.adminos_growth_campaigns,public.adminos_content_plans,public.adminos_campaign_assets,public.adminos_social_posts,public.adminos_social_post_metrics,public.adminos_campaign_attributions,public.adminos_demand_snapshots to authenticated;
grant select on public.adminos_attribution_sessions,public.adminos_demand_events to authenticated;
revoke insert,update,delete on public.adminos_attribution_sessions,public.adminos_demand_events from anon,authenticated;
