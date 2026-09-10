-- ResKonnect Luna AgentOS — Release Gates 0, 1 and 2
-- RG0: separate Luna website/company intelligence from Dimpho WhatsApp intelligence.
-- RG1: private growth domain, campaign/session attribution and safe demand-event capture.
-- RG2: demand snapshots and scheduled Luna demand cycles built on existing Housing Intelligence.

create table if not exists public.adminos_growth_campaigns (
  id uuid primary key default gen_random_uuid(),
  campaign_code text not null unique,
  name text not null,
  objective text not null,
  status text not null default 'draft' check (status in ('draft','planned','validated','queued','publishing','active','paused','completed','cancelled','failed')),
  source_signal_type text,
  source_signal_id text,
  campus text,
  residence_id uuid references public.residences(id) on delete set null,
  target_path text,
  audience jsonb not null default '{}'::jsonb,
  strategy jsonb not null default '{}'::jsonb,
  network_plan jsonb not null default '{}'::jsonb,
  facts_snapshot jsonb not null default '{}'::jsonb,
  risk_level text not null default 'green' check (risk_level in ('green','amber','red')),
  quality_score numeric not null default 0 check (quality_score between 0 and 100),
  created_by_agent text not null default 'luna_growth',
  created_by_user uuid references auth.users(id) on delete set null,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.adminos_content_plans (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.adminos_growth_campaigns(id) on delete cascade,
  plan_key text not null unique,
  status text not null default 'draft' check (status in ('draft','validated','approved','queued','published','rejected','failed')),
  objective text,
  platform_variants jsonb not null default '{}'::jsonb,
  facts_snapshot jsonb not null default '{}'::jsonb,
  validation jsonb not null default '{}'::jsonb,
  risk_level text not null default 'green' check (risk_level in ('green','amber','red')),
  quality_score numeric not null default 0 check (quality_score between 0 and 100),
  generated_by text not null default 'luna_content',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.adminos_campaign_assets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.adminos_growth_campaigns(id) on delete cascade,
  content_plan_id uuid references public.adminos_content_plans(id) on delete set null,
  asset_type text not null,
  storage_path text,
  public_url text,
  status text not null default 'planned',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.adminos_social_posts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.adminos_growth_campaigns(id) on delete cascade,
  content_plan_id uuid references public.adminos_content_plans(id) on delete set null,
  network text not null check (network in ('tiktok','instagram','facebook','youtube','linkedin','threads','x','pinterest','google_business')),
  status text not null default 'draft' check (status in ('draft','validated','queued','scheduled','published','failed','cancelled')),
  scheduled_for timestamptz,
  published_at timestamptz,
  external_post_id text,
  external_url text,
  caption text,
  title text,
  payload jsonb not null default '{}'::jsonb,
  provider text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.adminos_social_post_metrics (
  id uuid primary key default gen_random_uuid(),
  social_post_id uuid not null references public.adminos_social_posts(id) on delete cascade,
  snapshot_at timestamptz not null default now(),
  impressions bigint not null default 0,
  reach bigint not null default 0,
  views bigint not null default 0,
  engagements bigint not null default 0,
  clicks bigint not null default 0,
  shares bigint not null default 0,
  comments bigint not null default 0,
  saves bigint not null default 0,
  metrics jsonb not null default '{}'::jsonb,
  unique (social_post_id, snapshot_at)
);

create table if not exists public.adminos_attribution_sessions (
  id uuid primary key default gen_random_uuid(),
  visitor_hash text,
  session_id text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  campaign_code text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  landing_path text,
  referrer_host text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.adminos_campaign_attributions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.adminos_growth_campaigns(id) on delete set null,
  campaign_code text,
  session_id text,
  visitor_hash text,
  user_id uuid references auth.users(id) on delete set null,
  application_id uuid references public.applications(id) on delete set null,
  residence_lead_id uuid references public.residence_leads(id) on delete set null,
  event_type text not null check (event_type in ('application_submitted','lead_created','reservation','placement','conversion')),
  source text not null default 'website',
  attribution_model text not null default 'last_touch',
  value_zar numeric,
  metadata jsonb not null default '{}'::jsonb,
  attributed_at timestamptz not null default now()
);

create table if not exists public.adminos_demand_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  visitor_hash text,
  session_id text,
  event_type text not null check (event_type in ('landing','campaign_visit','residence_search','filter_change','application_start','application_submitted','whatsapp_click')),
  surface text,
  path text,
  campus text,
  search_query text,
  price_min numeric,
  price_max numeric,
  distance_max numeric,
  room_types text[] not null default '{}'::text[],
  amenities text[] not null default '{}'::text[],
  funding_type text,
  audience text,
  institution_tag text,
  result_count integer,
  campaign_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.adminos_demand_snapshots (
  id uuid primary key default gen_random_uuid(),
  days integer not null default 30 check (days between 1 and 730),
  fingerprint text not null,
  supply jsonb not null default '[]'::jsonb,
  demand jsonb not null default '[]'::jsonb,
  institutions jsonb not null default '[]'::jsonb,
  housing_opportunities jsonb not null default '[]'::jsonb,
  ranked_opportunities jsonb not null default '[]'::jsonb,
  source_counts jsonb not null default '{}'::jsonb,
  summary text,
  provider text,
  model text,
  status text not null default 'completed' check (status in ('completed','partial','failed')),
  generated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_growth_campaigns_status on public.adminos_growth_campaigns(status, created_at desc);
create index if not exists idx_growth_campaigns_campus on public.adminos_growth_campaigns(campus, status);
create index if not exists idx_social_posts_status on public.adminos_social_posts(status, scheduled_for);
create index if not exists idx_attribution_sessions_user on public.adminos_attribution_sessions(user_id, last_seen_at desc);
create index if not exists idx_attribution_sessions_campaign on public.adminos_attribution_sessions(campaign_code, last_seen_at desc);
create index if not exists idx_campaign_attributions_campaign on public.adminos_campaign_attributions(campaign_code, attributed_at desc);
create unique index if not exists ux_campaign_attr_application on public.adminos_campaign_attributions(application_id,event_type) where application_id is not null;
create unique index if not exists ux_campaign_attr_residence_lead on public.adminos_campaign_attributions(residence_lead_id,event_type) where residence_lead_id is not null;
create index if not exists idx_demand_events_created on public.adminos_demand_events(created_at desc);
create index if not exists idx_demand_events_campus on public.adminos_demand_events(campus, event_type, created_at desc);
create index if not exists idx_demand_events_campaign on public.adminos_demand_events(campaign_code, created_at desc);
create index if not exists idx_demand_snapshots_generated on public.adminos_demand_snapshots(generated_at desc);

alter table public.adminos_growth_campaigns enable row level security;
alter table public.adminos_content_plans enable row level security;
alter table public.adminos_campaign_assets enable row level security;
alter table public.adminos_social_posts enable row level security;
alter table public.adminos_social_post_metrics enable row level security;
alter table public.adminos_attribution_sessions enable row level security;
alter table public.adminos_campaign_attributions enable row level security;
alter table public.adminos_demand_events enable row level security;
alter table public.adminos_demand_snapshots enable row level security;

-- Internal growth data is staff-visible. Direct writes are admin-only; public capture happens through constrained RPCs.
do $$
declare t text;
begin
  foreach t in array array['adminos_growth_campaigns','adminos_content_plans','adminos_campaign_assets','adminos_social_posts','adminos_social_post_metrics','adminos_campaign_attributions','adminos_demand_snapshots'] loop
    execute format('drop policy if exists %I on public.%I', t || '_staff_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.get_user_staff_role(auth.uid()) is not null)', t || '_staff_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_manage', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_reskonnect_admin(auth.uid())) with check (public.is_reskonnect_admin(auth.uid()))', t || '_admin_manage', t);
  end loop;
end $$;

drop policy if exists adminos_attribution_sessions_staff_read on public.adminos_attribution_sessions;
create policy adminos_attribution_sessions_staff_read on public.adminos_attribution_sessions for select to authenticated using (public.get_user_staff_role(auth.uid()) is not null);
drop policy if exists adminos_demand_events_staff_read on public.adminos_demand_events;
create policy adminos_demand_events_staff_read on public.adminos_demand_events for select to authenticated using (public.get_user_staff_role(auth.uid()) is not null);

create or replace function public.luna_touch_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin new.updated_at=now(); return new; end $$;

drop trigger if exists trg_luna_growth_campaigns_touch on public.adminos_growth_campaigns;
create trigger trg_luna_growth_campaigns_touch before update on public.adminos_growth_campaigns for each row execute function public.luna_touch_updated_at();
drop trigger if exists trg_luna_content_plans_touch on public.adminos_content_plans;
create trigger trg_luna_content_plans_touch before update on public.adminos_content_plans for each row execute function public.luna_touch_updated_at();
drop trigger if exists trg_luna_campaign_assets_touch on public.adminos_campaign_assets;
create trigger trg_luna_campaign_assets_touch before update on public.adminos_campaign_assets for each row execute function public.luna_touch_updated_at();
drop trigger if exists trg_luna_social_posts_touch on public.adminos_social_posts;
create trigger trg_luna_social_posts_touch before update on public.adminos_social_posts for each row execute function public.luna_touch_updated_at();

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
declare v_id uuid; v_uid uuid:=auth.uid();
begin
  if nullif(trim(coalesce(p_session_id,'')),'') is null then raise exception 'session_id is required'; end if;
  insert into public.adminos_attribution_sessions(visitor_hash,session_id,user_id,campaign_code,utm_source,utm_medium,utm_campaign,utm_content,utm_term,landing_path,referrer_host,last_seen_at)
  values(left(nullif(p_visitor_hash,''),128),left(p_session_id,128),v_uid,left(nullif(p_campaign_code,''),160),left(nullif(p_utm_source,''),120),left(nullif(p_utm_medium,''),120),left(nullif(p_utm_campaign,''),160),left(nullif(p_utm_content,''),160),left(nullif(p_utm_term,''),160),left(nullif(p_landing_path,''),500),left(nullif(p_referrer_host,''),255),now())
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
begin
  if p_event_type not in ('landing','campaign_visit','residence_search','filter_change','application_start','application_submitted','whatsapp_click') then raise exception 'Unsupported demand event'; end if;
  if jsonb_typeof(p_payload->'room_types')='array' then select coalesce(array_agg(left(x,80)),'{}') into v_rooms from jsonb_array_elements_text(p_payload->'room_types') x; end if;
  if jsonb_typeof(p_payload->'amenities')='array' then select coalesce(array_agg(left(x,80)),'{}') into v_amenities from jsonb_array_elements_text(p_payload->'amenities') x; end if;
  if coalesce(p_payload->>'price_min','') ~ '^\d+(\.\d+)?$' then v_price_min=(p_payload->>'price_min')::numeric; end if;
  if coalesce(p_payload->>'price_max','') ~ '^\d+(\.\d+)?$' then v_price_max=(p_payload->>'price_max')::numeric; end if;
  if coalesce(p_payload->>'distance_max','') ~ '^\d+(\.\d+)?$' then v_distance=(p_payload->>'distance_max')::numeric; end if;
  if coalesce(p_payload->>'result_count','') ~ '^\d+$' then v_results=least((p_payload->>'result_count')::integer,1000000); end if;
  insert into public.adminos_demand_events(user_id,visitor_hash,session_id,event_type,surface,path,campus,search_query,price_min,price_max,distance_max,room_types,amenities,funding_type,audience,institution_tag,result_count,campaign_code,metadata)
  values(v_uid,left(nullif(p_visitor_hash,''),128),left(nullif(p_session_id,''),128),p_event_type,left(nullif(p_payload->>'surface',''),80),left(nullif(p_payload->>'path',''),500),left(nullif(p_payload->>'campus',''),160),left(nullif(p_payload->>'search_query',''),240),v_price_min,v_price_max,v_distance,v_rooms,v_amenities,left(nullif(p_payload->>'funding_type',''),80),left(nullif(p_payload->>'audience',''),80),left(nullif(p_payload->>'institution_tag',''),160),v_results,left(nullif(p_payload->>'campaign_code',''),160),jsonb_build_object('sort_by',left(coalesce(p_payload->>'sort_by',''),80),'category',left(coalesce(p_payload->>'category',''),80),'availability',left(coalesce(p_payload->>'availability',''),80),'nsfas_only',coalesce(p_payload->'nsfas_only','false'::jsonb),'tut_only',coalesce(p_payload->'tut_only','false'::jsonb),'furnished_only',coalesce(p_payload->'furnished_only','false'::jsonb),'wifi_only',coalesce(p_payload->'wifi_only','false'::jsonb),'parking_only',coalesce(p_payload->'parking_only','false'::jsonb)))
  returning id into v_id;
  if v_uid is not null and nullif(p_session_id,'') is not null then update public.adminos_attribution_sessions set user_id=coalesce(user_id,v_uid),last_seen_at=now() where session_id=left(p_session_id,128); end if;
  return v_id;
end $$;
revoke all on function public.luna_log_demand_event(text,text,text,jsonb) from public;
grant execute on function public.luna_log_demand_event(text,text,text,jsonb) to anon,authenticated,service_role;

create or replace function public.luna_demand_event_summary(p_days integer default 30)
returns table(campus text,event_type text,event_count bigint,unique_visitors bigint,avg_result_count numeric,avg_price_max numeric)
language sql stable security definer set search_path=public as $$
  select coalesce(nullif(trim(e.campus),''),'unspecified'),e.event_type,count(*),count(distinct coalesce(e.user_id::text,e.visitor_hash,e.session_id)),round(avg(e.result_count)::numeric,1),round(avg(e.price_max)::numeric,0)
  from public.adminos_demand_events e
  where e.created_at>=now()-make_interval(days=>greatest(1,least(coalesce(p_days,30),730)))
  group by 1,2 order by count(*) desc;
$$;
revoke all on function public.luna_demand_event_summary(integer) from public,anon;
grant execute on function public.luna_demand_event_summary(integer) to authenticated,service_role;

create or replace function public.luna_attribute_application()
returns trigger language plpgsql security definer set search_path=public as $$
declare a public.adminos_attribution_sessions%rowtype; c_id uuid;
begin
  if new.user_id is null then return new; end if;
  select * into a from public.adminos_attribution_sessions where user_id=new.user_id and campaign_code is not null and last_seen_at>=now()-interval '30 days' order by last_seen_at desc limit 1;
  if not found then return new; end if;
  select id into c_id from public.adminos_growth_campaigns where campaign_code=a.campaign_code limit 1;
  insert into public.adminos_campaign_attributions(campaign_id,campaign_code,session_id,visitor_hash,user_id,application_id,event_type,source,metadata)
  values(c_id,a.campaign_code,a.session_id,a.visitor_hash,new.user_id,new.id,'application_submitted',coalesce(a.utm_source,'website'),jsonb_build_object('residence_id',new.residence_id,'application_status',new.status))
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists trg_luna_attribute_application on public.applications;
create trigger trg_luna_attribute_application after insert on public.applications for each row execute function public.luna_attribute_application();

create or replace function public.luna_attribute_placement()
returns trigger language plpgsql security definer set search_path=public as $$
declare a public.adminos_attribution_sessions%rowtype; c_id uuid;
begin
  if lower(coalesce(new.stage,''))<>'placed' or new.user_id is null then return new; end if;
  if tg_op='UPDATE' and lower(coalesce(old.stage,''))='placed' then return new; end if;
  select * into a from public.adminos_attribution_sessions where user_id=new.user_id and campaign_code is not null and last_seen_at>=now()-interval '90 days' order by last_seen_at desc limit 1;
  if not found then return new; end if;
  select id into c_id from public.adminos_growth_campaigns where campaign_code=a.campaign_code limit 1;
  insert into public.adminos_campaign_attributions(campaign_id,campaign_code,session_id,visitor_hash,user_id,residence_lead_id,event_type,source,metadata)
  values(c_id,a.campaign_code,a.session_id,a.visitor_hash,new.user_id,new.id,'placement',coalesce(a.utm_source,'website'),jsonb_build_object('residence_id',new.residence_id,'funding_type',new.funding_type))
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists trg_luna_attribute_placement on public.residence_leads;
create trigger trg_luna_attribute_placement after insert or update of stage on public.residence_leads for each row execute function public.luna_attribute_placement();

create or replace function public.luna_growth_overview()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare uid uuid:=auth.uid(); role_name text;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select public.get_user_staff_role(uid)::text into role_name;
  if role_name is null then raise exception 'Staff access required'; end if;
  return jsonb_build_object(
    'agents',(select coalesce(jsonb_agg(jsonb_build_object('agent_key',agent_key,'display_name',display_name,'enabled',enabled,'authority_level',authority_level,'confidence_threshold',confidence_threshold,'config',config) order by agent_key),'[]'::jsonb) from public.adminos_agent_config where agent_key in ('luna_core','luna_demand')),
    'latest_snapshot',(select jsonb_build_object('id',id,'days',days,'generated_at',generated_at,'summary',summary,'ranked_opportunities',ranked_opportunities,'source_counts',source_counts,'provider',provider,'model',model,'status',status) from public.adminos_demand_snapshots order by generated_at desc limit 1),
    'events_24h',(select count(*) from public.adminos_demand_events where created_at>=now()-interval '24 hours'),
    'searches_24h',(select count(*) from public.adminos_demand_events where event_type in ('residence_search','filter_change') and created_at>=now()-interval '24 hours'),
    'campaign_visits_24h',(select count(*) from public.adminos_demand_events where event_type in ('landing','campaign_visit') and campaign_code is not null and created_at>=now()-interval '24 hours'),
    'attributed_applications_30d',(select count(*) from public.adminos_campaign_attributions where event_type='application_submitted' and attributed_at>=now()-interval '30 days'),
    'attributed_placements_30d',(select count(*) from public.adminos_campaign_attributions where event_type='placement' and attributed_at>=now()-interval '30 days'),
    'growth_campaigns',(select jsonb_build_object('total',count(*),'active',count(*) filter(where status='active'),'draft',count(*) filter(where status in ('draft','planned','validated'))) from public.adminos_growth_campaigns)
  );
end $$;
revoke all on function public.luna_growth_overview() from public,anon;
grant execute on function public.luna_growth_overview() to authenticated;

insert into public.adminos_agent_config(agent_key,display_name,enabled,authority_level,confidence_threshold,config)
values
('luna_core','Luna · Website & Company Intelligence',true,'green',0.900,jsonb_build_object('release',1,'release_gate',0,'channels',jsonb_build_array('website','in_app'),'primary_provider','openai','primary_model','gpt-5.6-luna','identity','luna','dimpho_boundary','whatsapp_only','read_only_by_default',true,'blocked_actions',jsonb_build_array('approve_application','reject_application','sign_lease','move_money','change_banking'))),
('luna_demand','Luna · Demand Intelligence',true,'green',0.950,jsonb_build_object('release',1,'release_gate',2,'cycle_minutes',15,'primary_provider','openai','primary_model','gpt-5.6-luna','housing_intelligence',true,'campaign_creation',false,'publishing',false,'data_grounded',true))
on conflict(agent_key) do update set display_name=excluded.display_name,enabled=excluded.enabled,authority_level=excluded.authority_level,confidence_threshold=excluded.confidence_threshold,config=excluded.config,updated_at=now();

update public.adminos_agent_prompt_versions set active=false where agent_key in ('luna_core','luna_demand');
insert into public.adminos_agent_prompt_versions(agent_key,version,name,system_prompt,policy,tool_allowlist,active)
values
('luna_core',1,'Luna Website Intelligence v1',
'You are Luna, ResKonnect central website and company intelligence assistant. You are not Dimpho, ResBot, or Konnect Agent. Dimpho is the separate WhatsApp conversion specialist. Answer from verified ResKonnect database facts and approved knowledge only. Never invent residence availability, prices, accreditation, application decisions, deadlines, partnerships, guarantees, funding status, or placement status. Public users may only receive public information. Signed-in users may receive only their own account/application information supplied in verified context. If verified context is insufficient, say so and escalate rather than guess. Use canonical https://www.reskonnect.org links only. Legal disputes, payment disputes, misconduct allegations, record changes, threats, and uncertain sensitive matters must be escalated. Output the exact JSON structure requested by the runtime.',
'{"identity":"luna","data_grounded":true,"public_privacy":"strict","canonical_links_only":true,"whatsapp_identity":"dimpho"}'::jsonb,
'["read_public_residences","read_public_opportunities","read_own_applications","read_approved_knowledge"]'::jsonb,true),
('luna_demand',1,'Luna Demand Intelligence v1',
'You are Luna Demand Intelligence for ResKonnect. Interpret only the verified aggregate demand, housing supply, search-intent, WhatsApp-conversion and application signals provided by the runtime. Do not invent counts, demand, availability, prices or market conditions. Distinguish student demand from vacant-supply pressure: a strong marketing opportunity requires real available inventory plus evidence of relevant demand or strategic need. Your role in Release Gate 2 is analysis only: do not create campaigns, publish content, spend money or contact users. Produce a concise internal executive summary grounded in the supplied metrics.',
'{"analysis_only":true,"campaign_creation":false,"publishing":false,"spend":false,"data_grounded":true}'::jsonb,
'["housing_intelligence","demand_events","whatsapp_conversion_aggregates","application_aggregates"]'::jsonb,true)
on conflict(agent_key,version) do update set name=excluded.name,system_prompt=excluded.system_prompt,policy=excluded.policy,tool_allowlist=excluded.tool_allowlist,active=excluded.active;

insert into public.adminos_scheduler_secrets(secret_key,secret_value)
values('luna_demand',replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''))
on conflict(secret_key) do nothing;

-- Schedule the task-limited Luna demand orchestrator every 15 minutes.
do $$
declare jid bigint;
begin
  for jid in select jobid from cron.job where jobname='luna-demand-cycle' loop perform cron.unschedule(jid); end loop;
  perform cron.schedule(
    'luna-demand-cycle',
    '*/15 * * * *',
    $cron$select net.http_post(
      url := 'https://mefjzkhobkltlbmhusdh.supabase.co/functions/v1/luna-orchestrator',
      headers := jsonb_build_object('Content-Type','application/json','x-luna-cron-token',(select secret_value from public.adminos_scheduler_secrets where secret_key='luna_demand')),
      body := '{"action":"demand_cycle","days":30,"source":"supabase_cron"}'::jsonb,
      timeout_milliseconds := 120000
    );$cron$
  );
end $$;
