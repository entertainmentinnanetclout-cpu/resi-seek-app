-- AgentOS RG14 — Technology & Reliability Automation
-- Reliability monitoring is autonomous. Production patches, deployments,
-- destructive data changes and external-service restarts remain human-gated.

create table if not exists public.adminos_reliability_expectations (
  expectation_key text primary key,
  expectation_type text not null check(expectation_type in ('cron','integration','agent')),
  target_key text not null,
  criticality text not null default 'high' check(criticality in ('low','medium','high','critical')),
  enabled boolean not null default true,
  max_silence_minutes integer,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.adminos_reliability_incidents (
  id uuid primary key default gen_random_uuid(),
  incident_key text not null unique,
  subsystem text not null,
  signal_type text not null,
  severity text not null default 'medium' check(severity in ('low','medium','high','critical')),
  status text not null default 'open' check(status in ('open','monitoring','resolved','dismissed')),
  current_count integer not null default 0,
  auto_fix_supported boolean not null default false,
  auto_fix_state text not null default 'not_applicable' check(auto_fix_state in ('not_applicable','available','applied','failed')),
  evidence jsonb not null default '{}'::jsonb,
  recommended_action text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists idx_reliability_incidents_open
  on public.adminos_reliability_incidents(status,severity,last_seen_at desc);

create table if not exists public.adminos_reliability_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_at timestamptz not null default now(),
  active_crons integer not null default 0,
  expected_crons integer not null default 0,
  missing_expected_crons integer not null default 0,
  agent_runs_24h integer not null default 0,
  failed_agent_runs_24h integer not null default 0,
  unresolved_agent_errors integer not null default 0,
  stuck_agent_runs integer not null default 0,
  enabled_integrations integer not null default 0,
  unhealthy_enabled_integrations integer not null default 0,
  stale_automation_events integer not null default 0,
  open_incidents integer not null default 0,
  high_incidents integer not null default 0,
  platform_health_score integer not null default 100 check(platform_health_score between 0 and 100),
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists idx_reliability_snapshots_at on public.adminos_reliability_snapshots(snapshot_at desc);

alter table public.adminos_reliability_expectations enable row level security;
alter table public.adminos_reliability_incidents enable row level security;
alter table public.adminos_reliability_snapshots enable row level security;

drop policy if exists reliability_expectations_department_read on public.adminos_reliability_expectations;
create policy reliability_expectations_department_read on public.adminos_reliability_expectations
for select to authenticated using (
  public.has_admin_department_access('technology_systems')
  or public.has_admin_department_access('executive')
  or public.has_admin_department_access('intelligence_analytics')
);
drop policy if exists reliability_incidents_department_read on public.adminos_reliability_incidents;
create policy reliability_incidents_department_read on public.adminos_reliability_incidents
for select to authenticated using (
  public.has_admin_department_access('technology_systems')
  or public.has_admin_department_access('executive')
  or public.has_admin_department_access('intelligence_analytics')
);
drop policy if exists reliability_snapshots_department_read on public.adminos_reliability_snapshots;
create policy reliability_snapshots_department_read on public.adminos_reliability_snapshots
for select to authenticated using (
  public.has_admin_department_access('technology_systems')
  or public.has_admin_department_access('executive')
  or public.has_admin_department_access('intelligence_analytics')
);
revoke insert,update,delete on public.adminos_reliability_expectations from authenticated,anon;
revoke insert,update,delete on public.adminos_reliability_incidents from authenticated,anon;
revoke insert,update,delete on public.adminos_reliability_snapshots from authenticated,anon;
grant select on public.adminos_reliability_expectations,public.adminos_reliability_incidents,public.adminos_reliability_snapshots to authenticated;

insert into public.adminos_reliability_expectations(expectation_key,expectation_type,target_key,criticality,max_silence_minutes,metadata)
values
 ('cron:dimpho-intelligence-cycle','cron','dimpho-intelligence-cycle','critical',15,'{"purpose":"WhatsApp intelligence"}'),
 ('cron:luna-demand-cycle','cron','luna-demand-cycle','critical',30,'{"purpose":"Demand intelligence"}'),
 ('cron:adminos-whatsapp-event-worker','cron','adminos-whatsapp-event-worker','critical',5,'{"purpose":"WhatsApp event processing"}'),
 ('cron:adminos-service-recovery-watch','cron','adminos-service-recovery-watch','high',5,'{"purpose":"Service recovery"}'),
 ('cron:adminos-rg6-conversion-intelligence','cron','adminos-rg6-conversion-intelligence','high',20,'{"purpose":"Conversion intelligence"}'),
 ('cron:adminos-rg7-application-operations','cron','adminos-rg7-application-operations','high',30,'{"purpose":"Application operations"}'),
 ('cron:adminos-rg8-occupancy-intelligence','cron','adminos-rg8-occupancy-intelligence','high',45,'{"purpose":"Occupancy intelligence"}'),
 ('cron:adminos-rg9-student-opportunities','cron','adminos-rg9-student-opportunities','high',40,'{"purpose":"Student opportunities"}'),
 ('cron:adminos-rg10-partnerships','cron','adminos-rg10-partnerships','medium',60,'{"purpose":"Partnerships"}'),
 ('cron:adminos-rg11-reputation','cron','adminos-rg11-reputation','high',30,'{"purpose":"Reputation"}'),
 ('cron:adminos-rg12-seo-aeo-growth','cron','adminos-rg12-seo-aeo-growth','medium',60,'{"purpose":"SEO/AEO growth"}'),
 ('cron:adminos-rg12-indexnow-worker','cron','adminos-rg12-indexnow-worker','medium',15,'{"purpose":"IndexNow freshness"}'),
 ('cron:adminos-rg13-finance-admin','cron','adminos-rg13-finance-admin','high',60,'{"purpose":"Finance controls"}'),
 ('integration:openai','integration','openai','critical',null,'{"purpose":"AI runtime"}'),
 ('integration:twilio_whatsapp','integration','twilio_whatsapp','critical',null,'{"purpose":"WhatsApp transport"}'),
 ('integration:metricool','integration','metricool','medium',null,'{"purpose":"Social analytics"}')
on conflict(expectation_key) do update set expectation_type=excluded.expectation_type,target_key=excluded.target_key,
  criticality=excluded.criticality,enabled=true,max_silence_minutes=excluded.max_silence_minutes,metadata=excluded.metadata,updated_at=now();

create or replace function public.adminos_rg14_upsert_incident(
  p_key text,p_subsystem text,p_type text,p_severity text,p_count integer,p_evidence jsonb,p_action text
) returns void language plpgsql security definer set search_path=public as $$
begin
  insert into public.adminos_reliability_incidents(
    incident_key,subsystem,signal_type,severity,status,current_count,auto_fix_supported,auto_fix_state,evidence,recommended_action,first_seen_at,last_seen_at,resolved_at
  ) values(
    p_key,p_subsystem,p_type,p_severity,'open',greatest(0,coalesce(p_count,0)),false,'not_applicable',
    coalesce(p_evidence,'{}'::jsonb),p_action,now(),now(),null
  )
  on conflict(incident_key) do update set subsystem=excluded.subsystem,signal_type=excluded.signal_type,severity=excluded.severity,
    status='open',current_count=excluded.current_count,auto_fix_supported=false,auto_fix_state='not_applicable',
    evidence=excluded.evidence,recommended_action=excluded.recommended_action,last_seen_at=now(),resolved_at=null;
end;
$$;

create or replace function public.adminos_rg14_refresh_incidents()
returns integer language plpgsql security definer set search_path=public as $$
declare rec record;k text;active_keys text[]:='{}'::text[];n integer:=0;cnt integer:=0;
begin
  for rec in
    select e.*,j.jobid,j.active,j.schedule
    from public.adminos_reliability_expectations e
    left join cron.job j on e.expectation_type='cron' and j.jobname=e.target_key
    where e.enabled and e.expectation_type='cron' and (j.jobid is null or not coalesce(j.active,false))
  loop
    k:=concat('rg14:missing-cron:',rec.target_key);active_keys:=array_append(active_keys,k);
    perform public.adminos_rg14_upsert_incident(k,'scheduler','missing_expected_cron',
      case when rec.criticality='critical' then 'critical' when rec.criticality='high' then 'high' else 'medium' end,
      1,jsonb_build_object('jobname',rec.target_key,'criticality',rec.criticality,'schedule',rec.schedule),
      'Restore the expected scheduler job only after verifying the release configuration and function target.');
  end loop;

  for rec in
    select e.target_key,e.criticality,c.status,c.enabled,c.last_success_at,c.last_error_at,c.last_error
    from public.adminos_reliability_expectations e
    left join public.adminos_integration_connections c on e.expectation_type='integration' and c.provider=e.target_key
    where e.enabled and e.expectation_type='integration'
      and (c.id is null or not coalesce(c.enabled,false) or coalesce(c.status,'not_connected')<>'connected')
  loop
    k:=concat('rg14:integration:',rec.target_key);active_keys:=array_append(active_keys,k);
    perform public.adminos_rg14_upsert_incident(k,'integrations','required_integration_unhealthy',
      case when rec.criticality='critical' then 'critical' when rec.criticality='high' then 'high' else 'medium' end,
      1,jsonb_build_object('provider',rec.target_key,'status',rec.status,'enabled',rec.enabled,'last_success_at',rec.last_success_at,'last_error_at',rec.last_error_at,'last_error',rec.last_error),
      'Verify provider credentials/connectivity and run its health check. Do not rotate credentials automatically.');
  end loop;

  for rec in
    select coalesce(r.agent_key,'unknown') agent_key,count(*)::integer total,min(r.started_at) oldest
    from public.adminos_agent_runs r
    where r.status='running' and r.started_at<now()-interval '30 minutes'
    group by coalesce(r.agent_key,'unknown')
  loop
    k:=concat('rg14:stuck-agent:',rec.agent_key);active_keys:=array_append(active_keys,k);
    perform public.adminos_rg14_upsert_incident(k,'agents','stuck_agent_run',
      case when rec.oldest<now()-interval '2 hours' then 'high' else 'medium' end,
      rec.total,jsonb_build_object('agent_key',rec.agent_key,'oldest_started_at',rec.oldest),
      'Inspect the run and dependency state. Do not retry state-changing tools until idempotency is confirmed.');
  end loop;

  for rec in
    select coalesce(e.error_code,'unknown') error_code,count(*)::integer total,max(e.created_at) latest,
           bool_or(e.retryable) retryable
    from public.adminos_agent_errors e
    where not e.resolved and e.created_at>=now()-interval '24 hours'
    group by coalesce(e.error_code,'unknown')
  loop
    k:=concat('rg14:agent-error:',rec.error_code);active_keys:=array_append(active_keys,k);
    perform public.adminos_rg14_upsert_incident(k,'agents','unresolved_agent_error',
      case when rec.total>=10 then 'critical' when rec.total>=3 then 'high' else 'medium' end,
      rec.total,jsonb_build_object('error_code',rec.error_code,'latest_at',rec.latest,'retryable',rec.retryable),
      'Trace the failing agent/run and correct the root cause before retrying. Production code changes remain release-gated.');
  end loop;

  select count(*)::integer into cnt from public.adminos_automation_events
  where status in ('new','failed','blocked') and created_at<now()-interval '30 minutes';
  if cnt>0 then
    k:='rg14:stale-automation-events';active_keys:=array_append(active_keys,k);
    perform public.adminos_rg14_upsert_incident(k,'automation','stale_automation_events',
      case when cnt>=50 then 'critical' when cnt>=10 then 'high' else 'medium' end,cnt,
      jsonb_build_object('count',cnt,'age_threshold_minutes',30),
      'Inspect event consumers and blocked dependencies; preserve event records until processing is verified.');
  end if;

  select count(*)::integer into cnt from public.seo_index_queue
  where status='failed' and attempts>=3;
  if cnt>0 then
    k:='rg14:indexing-repeated-failures';active_keys:=array_append(active_keys,k);
    perform public.adminos_rg14_upsert_incident(k,'search','indexing_repeated_failures',
      case when cnt>=25 then 'high' else 'medium' end,cnt,jsonb_build_object('failed_after_retries',cnt),
      'Inspect IndexNow transport failures and canonical URL generation before requeueing.');
  end if;

  update public.adminos_reliability_incidents
  set status='resolved',resolved_at=now(),last_seen_at=now()
  where status in ('open','monitoring') and incident_key like 'rg14:%' and not(incident_key=any(active_keys));

  select count(*)::integer into n from public.adminos_reliability_incidents where status='open' and incident_key like 'rg14:%';
  return n;
end;
$$;

create or replace function public.adminos_rg14_reconcile_tasks()
returns integer language plpgsql security definer set search_path=public as $$
declare rec record;k text;current_count integer:=0;
begin
  update public.staff_tasks set status='completed',updated_at=now(),metadata=metadata||jsonb_build_object('automation_resolved_at',now())
  where department_key='technology_systems' and status in ('open','in_progress','waiting')
    and metadata->>'automation_family'='rg14'
    and (metadata->>'automation_key' is null or not exists(
      select 1 from public.adminos_reliability_incidents i where i.status='open'
        and concat('rg14:task:',i.incident_key)=staff_tasks.metadata->>'automation_key'));

  for rec in
    select * from public.adminos_reliability_incidents where status='open'
    order by case severity when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end,last_seen_at desc
  loop
    k:=concat('rg14:task:',rec.incident_key);
    if not exists(select 1 from public.staff_tasks where metadata->>'automation_key'=k and status in ('open','in_progress','waiting')) then
      insert into public.staff_tasks(title,description,source_table,source_id,priority,status,due_at,next_action,tags,metadata,department_key)
      values(concat('Reliability: ',replace(rec.signal_type,'_',' ')),concat(rec.subsystem,' · ',rec.current_count,' active signal(s)'),
        'adminos_reliability_incidents',rec.id,
        case when rec.severity='critical' then 'urgent' when rec.severity='high' then 'high' else 'normal' end,
        'open',now()+case when rec.severity='critical' then interval '2 hours' when rec.severity='high' then interval '8 hours' else interval '24 hours' end,
        rec.recommended_action,array['rg14','reliability',rec.subsystem,rec.signal_type],
        jsonb_build_object('automation_family','rg14','automation_key',k,'incident_key',rec.incident_key,'evidence',rec.evidence,'auto_fix_supported',false),
        'technology_systems');
    else
      update public.staff_tasks set description=concat(rec.subsystem,' · ',rec.current_count,' active signal(s)'),next_action=rec.recommended_action,
        priority=case when rec.severity='critical' then 'urgent' when rec.severity='high' then 'high' else 'normal' end,
        metadata=metadata||jsonb_build_object('evidence',rec.evidence,'last_refresh_at',now()),updated_at=now()
      where metadata->>'automation_key'=k and status in ('open','in_progress','waiting');
    end if;
  end loop;
  select count(*)::integer into current_count from public.staff_tasks where department_key='technology_systems'
    and status in ('open','in_progress','waiting') and metadata->>'automation_family'='rg14';
  return current_count;
end;
$$;

create or replace function public.adminos_rg14_reliability_cycle()
returns jsonb language plpgsql security definer set search_path=public as $$
declare incidents integer:=0;tasks integer:=0;active_crons integer:=0;expected_crons integer:=0;missing_crons integer:=0;
declare runs24 integer:=0;failed24 integer:=0;errors integer:=0;stuck integer:=0;enabled_integrations integer:=0;bad_integrations integer:=0;stale_events integer:=0;high integer:=0;score integer:=100;
begin
  incidents:=public.adminos_rg14_refresh_incidents();
  tasks:=public.adminos_rg14_reconcile_tasks();

  select count(*)::integer into active_crons from cron.job where active;
  select count(*)::integer into expected_crons from public.adminos_reliability_expectations where enabled and expectation_type='cron';
  select count(*)::integer into missing_crons
  from public.adminos_reliability_expectations e left join cron.job j on j.jobname=e.target_key and j.active
  where e.enabled and e.expectation_type='cron' and j.jobid is null;
  select count(*)::integer,count(*) filter(where status not in ('completed','success','succeeded'))::integer
    into runs24,failed24 from public.adminos_agent_runs where started_at>=now()-interval '24 hours';
  select count(*)::integer into errors from public.adminos_agent_errors where not resolved;
  select count(*)::integer into stuck from public.adminos_agent_runs where status='running' and started_at<now()-interval '30 minutes';
  select count(*)::integer,count(*) filter(where status<>'connected')::integer into enabled_integrations,bad_integrations
    from public.adminos_integration_connections where enabled;
  select count(*)::integer into stale_events from public.adminos_automation_events where status in ('new','failed','blocked') and created_at<now()-interval '30 minutes';
  select count(*)::integer into high from public.adminos_reliability_incidents where status='open' and severity in ('high','critical');

  score:=greatest(0,100 - least(40,missing_crons*20) - least(25,bad_integrations*10) - least(20,stuck*5) - least(20,errors*2) - least(15,stale_events/5));
  insert into public.adminos_reliability_snapshots(
    active_crons,expected_crons,missing_expected_crons,agent_runs_24h,failed_agent_runs_24h,unresolved_agent_errors,stuck_agent_runs,
    enabled_integrations,unhealthy_enabled_integrations,stale_automation_events,open_incidents,high_incidents,platform_health_score,metadata
  ) values(active_crons,expected_crons,missing_crons,runs24,failed24,errors,stuck,enabled_integrations,bad_integrations,stale_events,incidents,high,score,
    jsonb_build_object('department_tasks',tasks,'production_patch_automation',false,'deployment_automation',false));

  return jsonb_build_object('open_incidents',incidents,'high_incidents',high,'department_tasks',tasks,'platform_health_score',score,
    'active_crons',active_crons,'expected_crons',expected_crons,'missing_expected_crons',missing_crons,'runs_24h',runs24,'failed_runs_24h',failed24,
    'unresolved_agent_errors',errors,'stuck_agent_runs',stuck,'run_at',now());
end;
$$;

revoke all on function public.adminos_rg14_reliability_cycle() from public,anon,authenticated;
grant execute on function public.adminos_rg14_reliability_cycle() to service_role;

create or replace function public.adminos_run_rg14_now()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
begin
  if auth.uid() is null or not (
    public.has_admin_department_access('technology_systems') or public.has_admin_department_access('executive')
  ) then raise exception 'Technology or Executive access required' using errcode='42501'; end if;
  return public.adminos_rg14_reliability_cycle();
end;
$$;
revoke all on function public.adminos_run_rg14_now() from public,anon;
grant execute on function public.adminos_run_rg14_now() to authenticated;

insert into public.adminos_agent_config(agent_key,display_name,enabled,authority_level,confidence_threshold,config)
values('technology_reliability_agent','Technology & Reliability Agent',true,'green',0.99,
  jsonb_build_object('release_gate',14,'health_monitoring',true,'incident_detection',true,'task_routing',true,
    'production_patch',false,'production_deploy',false,'delete_production_data',false,'credential_rotation',false,
    'restart_external_services',false,'diagnostics','autonomous','code_changes','release_gate_required'))
on conflict(agent_key) do update set display_name=excluded.display_name,enabled=true,authority_level='green',
  confidence_threshold=excluded.confidence_threshold,config=excluded.config,updated_at=now();

do $$ declare j record; begin
  for j in select jobid from cron.job where jobname='adminos-rg14-reliability' loop perform cron.unschedule(j.jobid); end loop;
  perform cron.schedule('adminos-rg14-reliability','*/10 * * * *',$job$select public.adminos_rg14_reliability_cycle();$job$);
end $$;

select public.adminos_rg14_reliability_cycle();
