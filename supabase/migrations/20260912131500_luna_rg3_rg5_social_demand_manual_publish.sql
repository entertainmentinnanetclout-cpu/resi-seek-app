-- Luna RG3-RG5: content intelligence, Metricool social-demand intelligence,
-- and founder-controlled manual publishing.
--
-- Critical authority boundary:
--   * Metricool analysis is allowed.
--   * Automated/scheduled Metricool publishing is NOT enabled by this release.
--   * Every generated social post requires manual publication unless a future
--     explicit founder-authorized release changes this policy.

alter table public.adminos_demand_snapshots
  add column if not exists academic_year integer;

update public.adminos_demand_snapshots
set academic_year=coalesce(academic_year,extract(year from generated_at)::integer)
where academic_year is null;

alter table public.adminos_demand_snapshots
  alter column academic_year set default (extract(year from current_date)::integer),
  alter column academic_year set not null;

alter table public.adminos_demand_snapshots
  drop constraint if exists adminos_demand_snapshots_academic_year_check;
alter table public.adminos_demand_snapshots
  add constraint adminos_demand_snapshots_academic_year_check check (academic_year between 2020 and 2100);

create index if not exists idx_demand_snapshots_academic_year
  on public.adminos_demand_snapshots(academic_year,generated_at desc);

create or replace function public.luna_academic_supply_live(p_academic_year integer default extract(year from current_date)::integer)
returns table(
  campus_name text,
  residence_count bigint,
  reported_residence_count bigint,
  total_capacity bigint,
  available_spots bigint,
  blocked_beds bigint,
  availability_rate numeric,
  average_price numeric
)
language sql stable security definer set search_path=public
as $
  select
    coalesce(nullif(trim(r.campus),''),'Unspecified') as campus_name,
    count(distinct r.id)::bigint as residence_count,
    count(*) filter(where i.reported_available_beds is not null)::bigint as reported_residence_count,
    coalesce(sum(i.capacity),0)::bigint as total_capacity,
    coalesce(sum(i.reported_available_beds) filter(where i.reported_available_beds is not null),0)::bigint as available_spots,
    coalesce(sum(i.blocked_beds),0)::bigint as blocked_beds,
    case
      when coalesce(sum(i.capacity) filter(where i.reported_available_beds is not null),0)>0
      then round(
        100.0*coalesce(sum(i.reported_available_beds) filter(where i.reported_available_beds is not null),0)
        / nullif(sum(i.capacity) filter(where i.reported_available_beds is not null),0),2
      )
      else 0
    end as availability_rate,
    round(avg(r.price)::numeric,2) as average_price
  from public.residence_academic_inventory i
  join public.residences r on r.id=i.residence_id
  where i.academic_year=p_academic_year
  group by 1
  order by available_spots desc,campus_name;
$;

revoke all on function public.luna_academic_supply_live(integer) from public,anon;
grant execute on function public.luna_academic_supply_live(integer) to authenticated,service_role;

create table if not exists public.adminos_social_demand_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_key text not null unique,
  provider text not null default 'metricool',
  brand_id text not null,
  network text not null check (network in ('instagram','tiktok','facebook','youtube','linkedin','threads','x','pinterest','google_business')),
  period_start date not null,
  period_end date not null,
  metrics jsonb not null default '{}'::jsonb,
  top_content jsonb not null default '[]'::jsonb,
  best_times jsonb not null default '[]'::jsonb,
  demand_score numeric(6,2) not null default 0 check (demand_score between 0 and 100),
  demand_signal text not null default 'monitor' check (demand_signal in ('low','monitor','rising','strong')),
  source text not null default 'metricool_connector' check (source in ('metricool_connector','metricool_api','manual_verified_import')),
  imported_by uuid references auth.users(id) on delete set null,
  imported_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  check (period_end >= period_start)
);

create index if not exists idx_social_demand_network_period
  on public.adminos_social_demand_snapshots(network,period_end desc,imported_at desc);
create index if not exists idx_social_demand_score
  on public.adminos_social_demand_snapshots(demand_score desc,imported_at desc);

alter table public.adminos_social_demand_snapshots enable row level security;

drop policy if exists "Staff read social demand intelligence" on public.adminos_social_demand_snapshots;
create policy "Staff read social demand intelligence"
on public.adminos_social_demand_snapshots for select to authenticated
using (public.get_user_staff_role((select auth.uid())) is not null);

drop policy if exists "Staff manage social demand intelligence" on public.adminos_social_demand_snapshots;
create policy "Staff manage social demand intelligence"
on public.adminos_social_demand_snapshots for all to authenticated
using (public.get_user_staff_role((select auth.uid())) is not null)
with check (public.get_user_staff_role((select auth.uid())) is not null);

grant select,insert,update,delete on public.adminos_social_demand_snapshots to authenticated;

alter table public.adminos_social_posts
  add column if not exists manual_publish_required boolean not null default true,
  add column if not exists recommended_publish_at timestamptz,
  add column if not exists manual_published_at timestamptz,
  add column if not exists manual_published_by uuid references auth.users(id) on delete set null,
  add column if not exists demand_snapshot_id uuid references public.adminos_social_demand_snapshots(id) on delete set null,
  add column if not exists posting_notes text;

comment on column public.adminos_social_posts.manual_publish_required is
'Hard founder-control boundary. True means Luna/Metricool may prepare/analyze but must not publish the post automatically.';

create index if not exists idx_social_posts_manual_queue
  on public.adminos_social_posts(status,manual_publish_required,recommended_publish_at)
  where manual_publish_required=true;

create or replace function public.luna_social_demand_score(p_metrics jsonb)
returns numeric
language plpgsql immutable
set search_path=public
as $$
declare
  v_views numeric:=greatest(0,coalesce((p_metrics->>'views')::numeric,0));
  v_reach numeric:=greatest(0,coalesce((p_metrics->>'reach')::numeric,0));
  v_interactions numeric:=greatest(0,coalesce((p_metrics->>'interactions')::numeric,0));
  v_comments numeric:=greatest(0,coalesce((p_metrics->>'comments')::numeric,0));
  v_shares numeric:=greatest(0,coalesce((p_metrics->>'shares')::numeric,0));
  v_saves numeric:=greatest(0,coalesce((p_metrics->>'saves')::numeric,0));
  v_profile numeric:=greatest(0,coalesce((p_metrics->>'profile_views')::numeric,0));
  v_gain numeric:=greatest(0,coalesce((p_metrics->>'followers_gained')::numeric,0));
  v_loss numeric:=greatest(0,coalesce((p_metrics->>'followers_lost')::numeric,0));
  v_base numeric;
  v_intent numeric;
  v_growth numeric;
begin
  v_base:=least(100,18*ln(1+greatest(v_views,v_reach)));
  v_intent:=least(100,16*ln(1+v_comments*2+v_shares*4+v_saves*3+v_profile));
  v_growth:=least(100,20*ln(1+greatest(v_gain-v_loss,0)));
  return round((v_base*.45+v_intent*.40+v_growth*.15)::numeric,2);
exception when others then
  return 0;
end $$;

revoke all on function public.luna_social_demand_score(jsonb) from public,anon,authenticated;
grant execute on function public.luna_social_demand_score(jsonb) to service_role;

create or replace function public.luna_import_social_demand(
  p_brand_id text,
  p_network text,
  p_period_start date,
  p_period_end date,
  p_metrics jsonb,
  p_top_content jsonb default '[]'::jsonb,
  p_best_times jsonb default '[]'::jsonb,
  p_source text default 'metricool_connector',
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  v_role text;
  v_score numeric;
  v_signal text;
  v_key text;
  v_id uuid;
begin
  if auth.role()<>'service_role' then
    if v_uid is null then raise exception 'Authentication required'; end if;
    select public.get_user_staff_role(v_uid)::text into v_role;
    if v_role is null then raise exception 'Staff access required'; end if;
  end if;
  if p_network not in ('instagram','tiktok','facebook','youtube','linkedin','threads','x','pinterest','google_business') then
    raise exception 'Unsupported social network';
  end if;
  if p_source not in ('metricool_connector','metricool_api','manual_verified_import') then
    raise exception 'Unsupported social-demand source';
  end if;
  if p_period_start is null or p_period_end is null or p_period_end<p_period_start then
    raise exception 'Invalid social-demand date range';
  end if;

  v_score:=public.luna_social_demand_score(coalesce(p_metrics,'{}'::jsonb));
  v_signal:=case when v_score>=70 then 'strong' when v_score>=50 then 'rising' when v_score>=25 then 'monitor' else 'low' end;
  v_key:=lower(p_network)||':'||coalesce(nullif(trim(p_brand_id),''),'unknown')||':'||p_period_start::text||':'||p_period_end::text;

  insert into public.adminos_social_demand_snapshots(
    snapshot_key,provider,brand_id,network,period_start,period_end,metrics,top_content,best_times,
    demand_score,demand_signal,source,imported_by,metadata
  ) values (
    v_key,'metricool',left(coalesce(p_brand_id,'unknown'),80),p_network,p_period_start,p_period_end,
    coalesce(p_metrics,'{}'::jsonb),coalesce(p_top_content,'[]'::jsonb),coalesce(p_best_times,'[]'::jsonb),
    v_score,v_signal,p_source,v_uid,coalesce(p_metadata,'{}'::jsonb)
  )
  on conflict(snapshot_key) do update set
    metrics=excluded.metrics,
    top_content=excluded.top_content,
    best_times=excluded.best_times,
    demand_score=excluded.demand_score,
    demand_signal=excluded.demand_signal,
    source=excluded.source,
    imported_by=excluded.imported_by,
    imported_at=now(),
    metadata=excluded.metadata
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.luna_import_social_demand(text,text,date,date,jsonb,jsonb,jsonb,text,jsonb) from public,anon;
grant execute on function public.luna_import_social_demand(text,text,date,date,jsonb,jsonb,jsonb,text,jsonb) to authenticated,service_role;

create or replace function public.luna_social_demand_overview()
returns jsonb
language plpgsql stable security definer set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
begin
  if v_uid is null or public.get_user_staff_role(v_uid) is null then raise exception 'Staff access required'; end if;
  return jsonb_build_object(
    'policy',jsonb_build_object(
      'analysis_provider','metricool',
      'analysis_enabled',true,
      'manual_posting',true,
      'publishing_enabled',false,
      'publishing_authority','founder_explicit_instruction_only'
    ),
    'networks',(
      select coalesce(jsonb_agg(to_jsonb(x) order by x.demand_score desc),'[]'::jsonb)
      from (
        select distinct on (network)
          id,network,brand_id,period_start,period_end,metrics,top_content,best_times,
          demand_score,demand_signal,source,imported_at
        from public.adminos_social_demand_snapshots
        order by network,imported_at desc
      ) x
    ),
    'manual_queue',jsonb_build_object(
      'ready',(select count(*) from public.adminos_social_posts where manual_publish_required=true and status='validated'),
      'draft',(select count(*) from public.adminos_social_posts where manual_publish_required=true and status='draft'),
      'published_manual',(select count(*) from public.adminos_social_posts where manual_publish_required=true and status='published' and manual_published_at is not null)
    )
  );
end $$;

revoke all on function public.luna_social_demand_overview() from public,anon;
grant execute on function public.luna_social_demand_overview() to authenticated;

create or replace function public.luna_mark_social_post_published(
  p_social_post_id uuid,
  p_external_url text,
  p_external_post_id text default null,
  p_published_at timestamptz default now()
) returns public.adminos_social_posts
language plpgsql security definer set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  v_row public.adminos_social_posts;
begin
  if v_uid is null or public.get_user_staff_role(v_uid) is null then raise exception 'Staff access required'; end if;
  if nullif(trim(coalesce(p_external_url,'')),'') is null then raise exception 'Published post URL is required'; end if;

  update public.adminos_social_posts set
    status='published',
    published_at=coalesce(p_published_at,now()),
    manual_published_at=coalesce(p_published_at,now()),
    manual_published_by=v_uid,
    external_url=left(trim(p_external_url),1000),
    external_post_id=left(nullif(trim(coalesce(p_external_post_id,'')),''),300),
    provider='manual',
    updated_at=now()
  where id=p_social_post_id and manual_publish_required=true
  returning * into v_row;

  if v_row.id is null then raise exception 'Manual social post not found'; end if;
  return v_row;
end $$;

revoke all on function public.luna_mark_social_post_published(uuid,text,text,timestamptz) from public,anon;
grant execute on function public.luna_mark_social_post_published(uuid,text,text,timestamptz) to authenticated;

-- Explicitly define Metricool as analytics-only inside the company integration registry.
insert into public.adminos_integration_connections(
  provider,display_name,status,enabled,setup_step,external_account_label,config,secret_refs,setup_url,docs_url
) values (
  'metricool',
  'Metricool · Social Demand Intelligence',
  'connected',
  true,
  3,
  'ResKonnect · Brand 6910625',
  jsonb_build_object(
    'mode','analysis_only',
    'analysis_enabled',true,
    'publishing_enabled',false,
    'manual_posting',true,
    'publishing_authority','founder_explicit_instruction_only',
    'brand_id','6910625',
    'user_id','5324275',
    'timezone','Africa/Johannesburg',
    'networks',jsonb_build_array('facebook','instagram','tiktok','youtube'),
    'mcp_connected',true,
    'rest_api_optional',true
  ),
  '{}'::jsonb,
  'https://app.metricool.com',
  'https://help.metricool.com/analytics-028fw'
)
on conflict(provider) do update set
  display_name=excluded.display_name,
  status=excluded.status,
  enabled=excluded.enabled,
  setup_step=excluded.setup_step,
  external_account_label=excluded.external_account_label,
  config=excluded.config,
  setup_url=excluded.setup_url,
  docs_url=excluded.docs_url,
  updated_at=now();

insert into public.adminos_agent_config(agent_key,display_name,enabled,authority_level,confidence_threshold,config)
values
('luna_content','Luna · Content Intelligence',true,'green',0.900,
  jsonb_build_object(
    'release',1,'release_gate',3,'primary_provider','openai','primary_model','gpt-5.6-luna',
    'campaign_creation',true,'content_generation',true,'publishing',false,'manual_publish_required',true,
    'fact_validation',true,'metricool_role','social_demand_analysis'
  )
),
('luna_social_demand','Luna · Social Demand Intelligence',true,'green',0.950,
  jsonb_build_object(
    'release',1,'release_gate',4,'provider','metricool','analysis_enabled',true,'publishing',false,
    'manual_posting',true,'brand_id','6910625','timezone','Africa/Johannesburg',
    'networks',jsonb_build_array('facebook','instagram','tiktok','youtube')
  )
)
on conflict(agent_key) do update set
  display_name=excluded.display_name,
  enabled=excluded.enabled,
  authority_level=excluded.authority_level,
  confidence_threshold=excluded.confidence_threshold,
  config=excluded.config,
  updated_at=now();

update public.adminos_agent_config
set config=jsonb_set(
  jsonb_set(config,'{publishing}','false'::jsonb,true),
  '{metricool_role}','"social_demand_analysis"'::jsonb,true
),updated_at=now()
where agent_key='luna_demand';

update public.adminos_agent_prompt_versions set active=false where agent_key in ('luna_content','luna_social_demand');

insert into public.adminos_agent_prompt_versions(agent_key,version,name,system_prompt,policy,tool_allowlist,active)
values
('luna_content',1,'Luna Content Intelligence v1',
'You are Luna Content Intelligence for ResKonnect. Convert only verified demand, accommodation inventory, application/intake, search and social-demand evidence supplied by the runtime into high-quality campaign and post drafts. Never invent prices, bed availability, accreditation, partnerships, application deadlines, placement guarantees, funding decisions, first-in-Africa claims, or institutional endorsements. Every public claim must be traceable to supplied facts. Produce platform-specific drafts rather than copying one caption everywhere. Metricool is an analytics source only. You must never schedule or publish content. Every generated social post is founder/manual-publish required. Return valid JSON in the exact schema requested by the runtime.',
'{"fact_grounded":true,"campaign_creation":true,"publishing":false,"manual_publish_required":true,"metricool":"analysis_only"}'::jsonb,
'["verified_demand_snapshot","verified_social_demand","verified_inventory","verified_public_residence_data","campaign_draft_writer"]'::jsonb,
true),
('luna_social_demand',1,'Luna Social Demand Intelligence v1',
'You are Luna Social Demand Intelligence. Metricool is the first-party social analytics source. Analyze reach, views, comments, shares, saves, profile/search intent, follower movement, watch behavior and timing signals to identify where student attention and intent are rising. Social engagement is not a conversion; never equate views with applications or placements. Supabase attribution remains the conversion source of truth. Metricool must not publish, schedule, edit or delete social posts unless the founder explicitly instructs a future publishing action. Your normal mode is analysis only.',
'{"analysis_only":true,"publishing":false,"manual_posting":true,"conversion_truth":"supabase"}'::jsonb,
'["metricool_analytics","metricool_best_times","supabase_attribution"]'::jsonb,
true)
on conflict(agent_key,version) do update set
  name=excluded.name,
  system_prompt=excluded.system_prompt,
  policy=excluded.policy,
  tool_allowlist=excluded.tool_allowlist,
  active=excluded.active;

-- Extend the consolidated growth overview without creating another AdminOS maze.
create or replace function public.luna_growth_overview()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare uid uuid:=auth.uid(); role_name text;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select public.get_user_staff_role(uid)::text into role_name;
  if role_name is null then raise exception 'Staff access required'; end if;
  return jsonb_build_object(
    'agents',(select coalesce(jsonb_agg(jsonb_build_object('agent_key',agent_key,'display_name',display_name,'enabled',enabled,'authority_level',authority_level,'confidence_threshold',confidence_threshold,'config',config) order by agent_key),'[]'::jsonb) from public.adminos_agent_config where agent_key in ('luna_core','luna_demand','luna_content','luna_social_demand')),
    'latest_snapshot',(select jsonb_build_object('id',id,'days',days,'generated_at',generated_at,'summary',summary,'ranked_opportunities',ranked_opportunities,'source_counts',source_counts,'provider',provider,'model',model,'status',status) from public.adminos_demand_snapshots order by generated_at desc limit 1),
    'social_demand',(select coalesce(jsonb_agg(to_jsonb(x) order by x.demand_score desc),'[]'::jsonb) from (select distinct on(network) id,network,period_start,period_end,metrics,best_times,demand_score,demand_signal,source,imported_at from public.adminos_social_demand_snapshots order by network,imported_at desc)x),
    'events_24h',(select count(*) from public.adminos_demand_events where created_at>=now()-interval '24 hours'),
    'searches_24h',(select count(*) from public.adminos_demand_events where event_type in ('residence_search','filter_change') and created_at>=now()-interval '24 hours'),
    'campaign_visits_24h',(select count(*) from public.adminos_demand_events where event_type in ('landing','campaign_visit') and campaign_code is not null and created_at>=now()-interval '24 hours'),
    'attributed_applications_30d',(select count(*) from public.adminos_campaign_attributions where event_type='application_submitted' and attributed_at>=now()-interval '30 days'),
    'attributed_placements_30d',(select count(*) from public.adminos_campaign_attributions where event_type='placement' and attributed_at>=now()-interval '30 days'),
    'growth_campaigns',(select jsonb_build_object('total',count(*),'active',count(*) filter(where status='active'),'draft',count(*) filter(where status in ('draft','planned','validated'))) from public.adminos_growth_campaigns),
    'manual_social_queue',jsonb_build_object(
      'draft',(select count(*) from public.adminos_social_posts where manual_publish_required=true and status='draft'),
      'ready',(select count(*) from public.adminos_social_posts where manual_publish_required=true and status='validated'),
      'published',(select count(*) from public.adminos_social_posts where manual_publish_required=true and status='published' and manual_published_at is not null)
    ),
    'publishing_policy',jsonb_build_object(
      'metricool_analysis',true,
      'metricool_publishing',false,
      'manual_publish_required',true,
      'authority','founder_explicit_instruction_only'
    )
  );
end $$;

revoke all on function public.luna_growth_overview() from public,anon;
grant execute on function public.luna_growth_overview() to authenticated;

-- Automatic content planning is allowed, publishing is not.
insert into public.adminos_scheduler_secrets(secret_key,secret_value)
values('luna_content',replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''))
on conflict(secret_key) do nothing;

do $$
declare jid bigint;
begin
  for jid in select jobid from cron.job where jobname='luna-content-cycle' loop perform cron.unschedule(jid); end loop;
  perform cron.schedule(
    'luna-content-cycle',
    '17 */6 * * *',
    $cron$select net.http_post(
      url := 'https://mefjzkhobkltlbmhusdh.supabase.co/functions/v1/luna-orchestrator',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-luna-cron-token',(select secret_value from public.adminos_scheduler_secrets where secret_key='luna_content')
      ),
      body := '{"action":"content_cycle","source":"supabase_cron"}'::jsonb,
      timeout_milliseconds := 120000
    );$cron$
  );
end $$;
