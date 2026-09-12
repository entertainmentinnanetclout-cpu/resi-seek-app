-- AgentOS RG12 — Continuous SEO/AEO Growth Automation
-- Safe automation: indexing, metadata hygiene, measurement, prioritisation.
-- Public factual copy/superlative claims are not rewritten autonomously.

create table if not exists public.adminos_search_console_query_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null,
  query text not null default '',
  page_path text not null,
  device text not null default 'unknown',
  country text not null default 'unknown',
  clicks bigint not null default 0,
  impressions bigint not null default 0,
  ctr numeric not null default 0,
  avg_position numeric,
  source text not null default 'google_search_console',
  metadata jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  unique(metric_date,query,page_path,device,country)
);
create index if not exists idx_gsc_metrics_page_date on public.adminos_search_console_query_metrics(page_path,metric_date desc);
create index if not exists idx_gsc_metrics_query_date on public.adminos_search_console_query_metrics(query,metric_date desc);

alter table public.adminos_search_console_query_metrics enable row level security;
drop policy if exists gsc_metrics_department_read on public.adminos_search_console_query_metrics;
create policy gsc_metrics_department_read on public.adminos_search_console_query_metrics
for select to authenticated using (
  public.has_admin_department_access('intelligence_analytics')
  or public.has_admin_department_access('marketing_corporate_affairs')
  or public.has_admin_department_access('executive')
  or public.has_admin_department_access('technology_systems')
);
revoke insert,update,delete on public.adminos_search_console_query_metrics from authenticated,anon;
grant select on public.adminos_search_console_query_metrics to authenticated;

create table if not exists public.adminos_seo_growth_signals (
  id uuid primary key default gen_random_uuid(),
  signal_key text not null unique,
  path text,
  signal_type text not null,
  priority integer not null default 50 check(priority between 0 and 100),
  opportunity_score integer not null default 0 check(opportunity_score between 0 and 100),
  status text not null default 'open' check(status in ('open','monitoring','resolved','dismissed')),
  automation_state text not null default 'recommend' check(automation_state in ('auto_fixed','recommend','technology_attention','content_attention','resolved')),
  evidence jsonb not null default '{}'::jsonb,
  recommended_action text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists idx_seo_growth_signals_open on public.adminos_seo_growth_signals(status,priority desc,opportunity_score desc,last_seen_at desc);

alter table public.adminos_seo_growth_signals enable row level security;
drop policy if exists seo_growth_signals_department_read on public.adminos_seo_growth_signals;
create policy seo_growth_signals_department_read on public.adminos_seo_growth_signals
for select to authenticated using (
  public.has_admin_department_access('intelligence_analytics')
  or public.has_admin_department_access('marketing_corporate_affairs')
  or public.has_admin_department_access('executive')
  or public.has_admin_department_access('technology_systems')
);
revoke insert,update,delete on public.adminos_seo_growth_signals from authenticated,anon;
grant select on public.adminos_seo_growth_signals to authenticated;

create table if not exists public.adminos_seo_growth_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null unique,
  indexable_pages integer not null default 0,
  citation_ready_pages integer not null default 0,
  avg_quality_score numeric not null default 0,
  impressions_28d bigint not null default 0,
  clicks_28d bigint not null default 0,
  ctr_28d numeric not null default 0,
  avg_position_28d numeric,
  pending_index_urls integer not null default 0,
  stale_index_urls integer not null default 0,
  open_growth_signals integer not null default 0,
  high_priority_signals integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now()
);

alter table public.adminos_seo_growth_snapshots enable row level security;
drop policy if exists seo_growth_snapshots_department_read on public.adminos_seo_growth_snapshots;
create policy seo_growth_snapshots_department_read on public.adminos_seo_growth_snapshots
for select to authenticated using (
  public.has_admin_department_access('intelligence_analytics')
  or public.has_admin_department_access('marketing_corporate_affairs')
  or public.has_admin_department_access('executive')
);
revoke insert,update,delete on public.adminos_seo_growth_snapshots from authenticated,anon;
grant select on public.adminos_seo_growth_snapshots to authenticated;

create or replace function public.adminos_rg12_normalize_path(p_url text)
returns text language plpgsql immutable set search_path='' as $$
declare v text:=coalesce(nullif(trim(p_url),''),'/');
begin
  if v ~ '^https?://' then
    v:=regexp_replace(v,'^https?://[^/]+','');
  end if;
  v:=split_part(v,'?',1);
  v:=split_part(v,'#',1);
  if v='' then v:='/'; end if;
  if left(v,1)<>'/' then v:='/'||v; end if;
  if length(v)>1 then v:=regexp_replace(v,'/+$',''); end if;
  return v;
end;
$$;

create or replace function public.adminos_rg12_safe_metadata_hygiene()
returns integer language plpgsql security definer set search_path=public as $$
declare n integer:=0;
begin
  update public.seo_pages
  set
    canonical_path=coalesce(nullif(trim(canonical_path),''),path),
    og_title=coalesce(nullif(trim(og_title),''),title),
    og_description=coalesce(nullif(trim(og_description),''),description),
    h1=coalesce(nullif(trim(h1),''),title),
    updated_at=now()
  where
    canonical_path is null or trim(canonical_path)=''
    or og_title is null or trim(og_title)=''
    or og_description is null or trim(og_description)=''
    or h1 is null or trim(h1)='';
  get diagnostics n=row_count;
  return n;
end;
$$;

create or replace function public.adminos_rg12_refresh_page_metrics()
returns integer language plpgsql security definer set search_path=public as $$
declare n integer:=0;
begin
  insert into public.seo_page_metrics(page_id,metric_date,impressions,clicks,conversions,avg_position,source,metadata)
  select
    p.id,m.metric_date,
    sum(m.impressions)::bigint,
    sum(m.clicks)::bigint,
    0,
    case when sum(m.impressions)>0
      then sum(coalesce(m.avg_position,0)*m.impressions)/sum(m.impressions)
      else null end,
    'google_search_console',
    jsonb_build_object('query_rows',count(*),'synced_at',now())
  from public.adminos_search_console_query_metrics m
  join public.seo_pages p on p.path=public.adminos_rg12_normalize_path(m.page_path)
  group by p.id,m.metric_date
  on conflict(page_id,metric_date,source) do update set
    impressions=excluded.impressions,clicks=excluded.clicks,avg_position=excluded.avg_position,
    metadata=excluded.metadata,created_at=now();
  get diagnostics n=row_count;
  return n;
end;
$$;

-- Older environments may not yet have the desired natural key.
create unique index if not exists uq_seo_page_metrics_source_day
  on public.seo_page_metrics(page_id,metric_date,source);

create or replace function public.adminos_rg12_upsert_signal(
  p_key text,p_path text,p_type text,p_priority integer,p_score integer,p_state text,p_evidence jsonb,p_action text
) returns void language plpgsql security definer set search_path=public as $$
begin
  insert into public.adminos_seo_growth_signals(
    signal_key,path,signal_type,priority,opportunity_score,status,automation_state,evidence,recommended_action,first_seen_at,last_seen_at,resolved_at
  ) values(
    p_key,p_path,p_type,least(100,greatest(0,p_priority)),least(100,greatest(0,p_score)),'open',p_state,
    coalesce(p_evidence,'{}'::jsonb),p_action,now(),now(),null
  )
  on conflict(signal_key) do update set
    path=excluded.path,signal_type=excluded.signal_type,priority=excluded.priority,opportunity_score=excluded.opportunity_score,
    status='open',automation_state=excluded.automation_state,evidence=excluded.evidence,recommended_action=excluded.recommended_action,
    last_seen_at=now(),resolved_at=null;
end;
$$;

create or replace function public.adminos_rg12_refresh_signals()
returns integer language plpgsql security definer set search_path=public as $$
declare rec record; active_keys text[]:='{}'::text[];k text; n integer:=0;gsc_rows integer:=0;
begin
  select count(*)::integer into gsc_rows from public.adminos_search_console_query_metrics where metric_date>=current_date-35;

  for rec in
    select p.path,p.quality_score,p.unique_data_score,p.content_completeness,p.ai_citation_ready,p.last_verified_at
    from public.seo_pages p
    where p.indexable and p.content_status='published'
      and (p.quality_score<80 or p.unique_data_score<50 or p.content_completeness<80 or not p.ai_citation_ready
           or p.last_verified_at is null or p.last_verified_at<now()-interval '30 days')
  loop
    k:=concat('rg12:page-quality:',rec.path);
    active_keys:=array_append(active_keys,k);
    perform public.adminos_rg12_upsert_signal(
      k,rec.path,'page_quality',
      case when not rec.ai_citation_ready then 85 when rec.quality_score<70 then 80 else 65 end,
      greatest(0,100-least(rec.quality_score,rec.unique_data_score,rec.content_completeness)),
      'content_attention',
      jsonb_build_object('quality_score',rec.quality_score,'unique_data_score',rec.unique_data_score,'content_completeness',rec.content_completeness,'ai_citation_ready',rec.ai_citation_ready,'last_verified_at',rec.last_verified_at),
      'Verify factual content, strengthen original evidence and answer-engine structure before expanding public copy.'
    );
  end loop;

  for rec in
    select path,count(*)::integer pending,min(queued_at) oldest
    from public.seo_index_queue
    where status in ('pending','processing','failed')
    group by path
    having min(queued_at)<now()-interval '30 minutes'
  loop
    k:=concat('rg12:index-queue:',rec.path);
    active_keys:=array_append(active_keys,k);
    perform public.adminos_rg12_upsert_signal(
      k,rec.path,'index_queue_stale',
      case when rec.oldest<now()-interval '24 hours' then 95 else 80 end,
      case when rec.oldest<now()-interval '24 hours' then 95 else 75 end,
      'technology_attention',
      jsonb_build_object('pending_entries',rec.pending,'oldest_queued_at',rec.oldest),
      'Process the IndexNow queue and investigate repeated submission failures.'
    );
  end loop;

  if gsc_rows=0 then
    k:='rg12:gsc:no-metrics';
    active_keys:=array_append(active_keys,k);
    perform public.adminos_rg12_upsert_signal(
      k,null,'search_console_not_synced',90,90,'technology_attention',
      jsonb_build_object('metric_rows_35d',0),
      'Connect Google Search Console read-only credentials so Luna can optimize from real query and page performance.'
    );
  else
    for rec in
      with agg as (
        select page_path,
          sum(impressions)::bigint impressions,
          sum(clicks)::bigint clicks,
          case when sum(impressions)>0 then sum(clicks)::numeric/sum(impressions) else 0 end ctr,
          case when sum(impressions)>0 then sum(coalesce(avg_position,0)*impressions)/sum(impressions) else null end avg_position
        from public.adminos_search_console_query_metrics
        where metric_date>=current_date-28
        group by page_path
      )
      select * from agg where impressions>=100 and ctr<0.025
    loop
      k:=concat('rg12:low-ctr:',public.adminos_rg12_normalize_path(rec.page_path));
      active_keys:=array_append(active_keys,k);
      perform public.adminos_rg12_upsert_signal(
        k,public.adminos_rg12_normalize_path(rec.page_path),'low_ctr',
        case when rec.impressions>=1000 then 90 else 75 end,
        least(100,round(least(10000,rec.impressions)::numeric/100)::integer+50),
        'content_attention',
        jsonb_build_object('impressions_28d',rec.impressions,'clicks_28d',rec.clicks,'ctr_28d',rec.ctr,'avg_position_28d',rec.avg_position),
        'Review title/meta alignment with verified search intent; preserve factual claims and canonical positioning.'
      );
    end loop;

    for rec in
      with agg as (
        select query,page_path,
          sum(impressions)::bigint impressions,sum(clicks)::bigint clicks,
          case when sum(impressions)>0 then sum(coalesce(avg_position,0)*impressions)/sum(impressions) else null end avg_position
        from public.adminos_search_console_query_metrics
        where metric_date>=current_date-28 and query<>''
        group by query,page_path
      )
      select * from agg where impressions>=50 and avg_position between 4 and 20
      order by impressions desc limit 100
    loop
      k:=concat('rg12:ranking-opportunity:',md5(rec.query||'|'||rec.page_path));
      active_keys:=array_append(active_keys,k);
      perform public.adminos_rg12_upsert_signal(
        k,public.adminos_rg12_normalize_path(rec.page_path),'ranking_opportunity',
        case when rec.impressions>=500 then 85 else 70 end,
        least(100,50+least(50,(rec.impressions/10)::integer)),
        'content_attention',
        jsonb_build_object('query',rec.query,'impressions_28d',rec.impressions,'clicks_28d',rec.clicks,'avg_position_28d',rec.avg_position),
        'Strengthen the page for this demonstrated query using verified entity facts, FAQs, internal links and original ResKonnect data.'
      );
    end loop;
  end if;

  update public.adminos_seo_growth_signals
  set status='resolved',automation_state='resolved',resolved_at=now(),last_seen_at=now()
  where status in ('open','monitoring')
    and signal_key like 'rg12:%'
    and not(signal_key=any(active_keys));

  select count(*)::integer into n from public.adminos_seo_growth_signals where status='open' and signal_key like 'rg12:%';
  return n;
end;
$$;

create or replace function public.adminos_rg12_reconcile_tasks()
returns integer language plpgsql security definer set search_path=public as $$
declare rec record;k text;current_count integer:=0;dept text;
begin
  update public.staff_tasks
  set status='completed',updated_at=now(),metadata=metadata||jsonb_build_object('automation_resolved_at',now())
  where status in ('open','in_progress','waiting')
    and coalesce(metadata->>'automation_family','')='rg12'
    and (
      metadata->>'automation_key' is null
      or not exists(
        select 1 from public.adminos_seo_growth_signals s
        where s.status='open'
          and concat('rg12:task:',s.signal_key)=staff_tasks.metadata->>'automation_key'
      )
    );

  for rec in
    select * from public.adminos_seo_growth_signals
    where status='open' and priority>=65
    order by priority desc,opportunity_score desc limit 100
  loop
    k:=concat('rg12:task:',rec.signal_key);
    dept:=case when rec.automation_state='technology_attention' then 'technology_systems'
               when rec.automation_state='content_attention' then 'marketing_corporate_affairs'
               else 'intelligence_analytics' end;
    if not exists(select 1 from public.staff_tasks where metadata->>'automation_key'=k and status in ('open','in_progress','waiting')) then
      insert into public.staff_tasks(title,description,source_table,source_id,priority,status,due_at,next_action,tags,metadata,department_key)
      values(
        concat('SEO/AEO: ',replace(rec.signal_type,'_',' ')),
        coalesce(rec.path,'Site-wide search growth signal'),
        'adminos_seo_growth_signals',rec.id,
        case when rec.priority>=90 then 'urgent' when rec.priority>=75 then 'high' else 'normal' end,
        'open',now()+case when rec.priority>=90 then interval '8 hours' else interval '48 hours' end,
        rec.recommended_action,array['rg12','seo-aeo',rec.signal_type],
        jsonb_build_object('automation_family','rg12','automation_key',k,'signal_key',rec.signal_key,'opportunity_score',rec.opportunity_score,'evidence',rec.evidence),
        dept
      );
    else
      update public.staff_tasks set
        description=coalesce(rec.path,'Site-wide search growth signal'),next_action=rec.recommended_action,
        priority=case when rec.priority>=90 then 'urgent' when rec.priority>=75 then 'high' else 'normal' end,
        department_key=dept,metadata=metadata||jsonb_build_object('opportunity_score',rec.opportunity_score,'evidence',rec.evidence,'last_refresh_at',now()),updated_at=now()
      where metadata->>'automation_key'=k and status in ('open','in_progress','waiting');
    end if;
  end loop;

  select count(*)::integer into current_count from public.staff_tasks
  where status in ('open','in_progress','waiting') and metadata->>'automation_family'='rg12';
  return current_count;
end;
$$;

create or replace function public.adminos_rg12_seo_cycle()
returns jsonb language plpgsql security definer set search_path=public as $$
declare hygiene integer:=0;metric_rows integer:=0;signals integer:=0;tasks integer:=0;
declare indexable integer:=0;citation integer:=0;avg_quality numeric:=0;impressions bigint:=0;clicks bigint:=0;avg_pos numeric:=null;pending integer:=0;stale integer:=0;high_signals integer:=0;
begin
  hygiene:=public.adminos_rg12_safe_metadata_hygiene();
  metric_rows:=public.adminos_rg12_refresh_page_metrics();
  signals:=public.adminos_rg12_refresh_signals();
  tasks:=public.adminos_rg12_reconcile_tasks();

  select count(*) filter(where indexable and content_status='published')::integer,
         count(*) filter(where indexable and content_status='published' and ai_citation_ready)::integer,
         coalesce(avg(quality_score) filter(where indexable and content_status='published'),0)
  into indexable,citation,avg_quality from public.seo_pages;

  select coalesce(sum(impressions),0)::bigint,coalesce(sum(clicks),0)::bigint,
         case when sum(impressions)>0 then sum(coalesce(avg_position,0)*impressions)/sum(impressions) else null end
  into impressions,clicks,avg_pos
  from public.adminos_search_console_query_metrics where metric_date>=current_date-28;

  select count(*) filter(where status='pending')::integer,
         count(*) filter(where status in ('pending','processing','failed') and queued_at<now()-interval '30 minutes')::integer
  into pending,stale from public.seo_index_queue;

  select count(*)::integer into high_signals from public.adminos_seo_growth_signals where status='open' and priority>=80;

  insert into public.adminos_seo_growth_snapshots(
    snapshot_date,indexable_pages,citation_ready_pages,avg_quality_score,impressions_28d,clicks_28d,ctr_28d,avg_position_28d,
    pending_index_urls,stale_index_urls,open_growth_signals,high_priority_signals,metadata,generated_at
  ) values(
    current_date,indexable,citation,avg_quality,impressions,clicks,
    case when impressions>0 then clicks::numeric/impressions else 0 end,avg_pos,pending,stale,signals,high_signals,
    jsonb_build_object('safe_metadata_updates',hygiene,'page_metric_rows_refreshed',metric_rows,'department_tasks',tasks),now()
  )
  on conflict(snapshot_date) do update set
    indexable_pages=excluded.indexable_pages,citation_ready_pages=excluded.citation_ready_pages,avg_quality_score=excluded.avg_quality_score,
    impressions_28d=excluded.impressions_28d,clicks_28d=excluded.clicks_28d,ctr_28d=excluded.ctr_28d,avg_position_28d=excluded.avg_position_28d,
    pending_index_urls=excluded.pending_index_urls,stale_index_urls=excluded.stale_index_urls,open_growth_signals=excluded.open_growth_signals,
    high_priority_signals=excluded.high_priority_signals,metadata=excluded.metadata,generated_at=now();

  return jsonb_build_object('safe_metadata_updates',hygiene,'page_metric_rows_refreshed',metric_rows,'open_signals',signals,'department_tasks',tasks,
    'indexable_pages',indexable,'citation_ready_pages',citation,'pending_index_urls',pending,'stale_index_urls',stale,'gsc_impressions_28d',impressions,'gsc_clicks_28d',clicks,'run_at',now());
end;
$$;

revoke all on function public.adminos_rg12_seo_cycle() from public,anon,authenticated;
grant execute on function public.adminos_rg12_seo_cycle() to service_role;

create or replace function public.adminos_run_rg12_now()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
begin
  if auth.uid() is null or not (
    public.has_admin_department_access('intelligence_analytics')
    or public.has_admin_department_access('technology_systems')
    or public.has_admin_department_access('executive')
  ) then raise exception 'Intelligence, Technology or Executive access required' using errcode='42501'; end if;
  return public.adminos_rg12_seo_cycle();
end;
$$;
revoke all on function public.adminos_run_rg12_now() from public,anon;
grant execute on function public.adminos_run_rg12_now() to authenticated;

insert into public.adminos_agent_config(agent_key,display_name,enabled,authority_level,confidence_threshold,config)
values('seo_aeo_growth_agent','SEO & AEO Growth Agent',true,'green',0.98,
  jsonb_build_object('release_gate',12,'safe_metadata_hygiene',true,'indexnow_submission',true,'search_console_ingestion',true,
    'query_opportunity_scoring',true,'auto_rewrite_public_claims',false,'auto_create_superlatives',false,'auto_publish_content',false,
    'mechanical_indexing','autonomous','content_strategy','recommendation_only'))
on conflict(agent_key) do update set display_name=excluded.display_name,enabled=true,authority_level='green',confidence_threshold=excluded.confidence_threshold,config=excluded.config,updated_at=now();

insert into public.adminos_integration_connections(provider,display_name,status,enabled,setup_step,external_account_label,config,secret_refs,setup_url,docs_url)
values(
  'google_search_console','Google Search Console','not_connected',false,1,'reskonnect.org',
  jsonb_build_object('site_url','sc-domain:reskonnect.org','scope','https://www.googleapis.com/auth/webmasters.readonly','sync_days',7),
  jsonb_build_object('service_account_env','GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON'),
  'https://search.google.com/search-console','https://developers.google.com/webmaster-tools/v1/searchanalytics/query'
)
on conflict(provider) do update set display_name=excluded.display_name,config=adminos_integration_connections.config||excluded.config,
  secret_refs=adminos_integration_connections.secret_refs||excluded.secret_refs,setup_url=excluded.setup_url,docs_url=excluded.docs_url,updated_at=now();

insert into public.adminos_scheduler_secrets(secret_key,secret_value)
values('seo_indexnow_worker',encode(gen_random_bytes(32),'hex'))
on conflict(secret_key) do nothing;
insert into public.adminos_scheduler_secrets(secret_key,secret_value)
values('seo_search_console_sync',encode(gen_random_bytes(32),'hex'))
on conflict(secret_key) do nothing;

do $$
declare j record;
begin
  for j in select jobid from cron.job where jobname='adminos-rg12-seo-aeo-growth' loop perform cron.unschedule(j.jobid); end loop;
  perform cron.schedule('adminos-rg12-seo-aeo-growth','*/30 * * * *',$job$select public.adminos_rg12_seo_cycle();$job$);

  for j in select jobid from cron.job where jobname='adminos-rg12-indexnow-worker' loop perform cron.unschedule(j.jobid); end loop;
  perform cron.schedule('adminos-rg12-indexnow-worker','*/5 * * * *',$job$
    select net.http_post(
      url:='https://mefjzkhobkltlbmhusdh.supabase.co/functions/v1/seo-indexnow-worker',
      headers:=jsonb_build_object('Content-Type','application/json','x-seo-cron-token',(select secret_value from public.adminos_scheduler_secrets where secret_key='seo_indexnow_worker')),
      body:='{"action":"tick","source":"pg_cron"}'::jsonb,timeout_milliseconds:=30000
    );
  $job$);

  for j in select jobid from cron.job where jobname='adminos-rg12-search-console-sync' loop perform cron.unschedule(j.jobid); end loop;
  perform cron.schedule('adminos-rg12-search-console-sync','15 5 * * *',$job$
    select net.http_post(
      url:='https://mefjzkhobkltlbmhusdh.supabase.co/functions/v1/seo-search-console-sync',
      headers:=jsonb_build_object('Content-Type','application/json','x-seo-cron-token',(select secret_value from public.adminos_scheduler_secrets where secret_key='seo_search_console_sync')),
      body:='{"action":"sync","days":7,"source":"pg_cron"}'::jsonb,timeout_milliseconds:=120000
    );
  $job$);
end $$;

select public.adminos_rg12_seo_cycle();
