-- AgentOS RG15 — Executive Autonomous Operating Layer
-- Luna becomes the company-wide executive intelligence/orchestration layer.
-- Routine monitoring/delegation is autonomous; restricted commitments remain founder-controlled.

create table if not exists public.adminos_executive_authority_policy (
  action_key text primary key,
  action_group text not null,
  authority_level text not null check(authority_level in ('green','amber','red')),
  autonomous_allowed boolean not null default false,
  requires_executive_approval boolean not null default true,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.adminos_executive_authority_policy(action_key,action_group,authority_level,autonomous_allowed,requires_executive_approval,description,metadata)
values
 ('routine_monitoring','operations','green',true,false,'Read operational evidence and refresh intelligence/task state.','{}'),
 ('routine_task_routing','operations','green',true,false,'Create idempotent department exception tasks from verified signals.','{}'),
 ('routine_seo_indexing','growth','green',true,false,'Submit already-approved public URLs to indexing services and maintain mechanical metadata.','{}'),
 ('routine_customer_followup','service','green',true,false,'Use existing governed follow-up systems within consent and template rules.','{}'),
 ('campaign_strategy_draft','growth','green',true,false,'Prepare campaign/content strategy without publishing or spending funds.','{}'),
 ('social_publish','public_communications','amber',false,true,'Publishing remains manual unless a later explicit policy enables it.','{}'),
 ('partnership_announcement','public_communications','amber',false,true,'Public partnership announcements require Executive approval.','{}'),
 ('pricing_change','commercial','amber',false,true,'Material pricing/fee changes require Executive approval.','{}'),
 ('refund_or_payout_execution','finance','red',false,true,'Money movement and refund/payout execution remain human-controlled.','{}'),
 ('banking_change','finance','red',false,true,'Bank accounts, payment destinations and credentials remain founder-controlled.','{}'),
 ('contract_signature','legal','red',false,true,'Contracts cannot be signed autonomously.','{}'),
 ('ownership_or_shareholding','legal','red',false,true,'Ownership/shareholding decisions remain founder/legal controlled.','{}'),
 ('public_crisis_statement','public_communications','red',false,true,'Crisis, legal, security-breach or apology statements require Executive approval.','{}'),
 ('production_data_delete','technology','red',false,true,'Destructive production-data changes require human approval and release procedure.','{}'),
 ('production_deploy','technology','amber',false,true,'Production deployments remain gated by CI/release controls.','{}')
on conflict(action_key) do update set action_group=excluded.action_group,authority_level=excluded.authority_level,
 autonomous_allowed=excluded.autonomous_allowed,requires_executive_approval=excluded.requires_executive_approval,
 description=excluded.description,metadata=excluded.metadata,updated_at=now();

create table if not exists public.adminos_executive_priorities (
  id uuid primary key default gen_random_uuid(),
  priority_key text not null unique,
  area text not null,
  department_key text,
  priority integer not null default 50 check(priority between 0 and 100),
  risk_level text not null default 'green' check(risk_level in ('green','amber','red')),
  title text not null,
  rationale text not null,
  source_type text,
  source_id uuid,
  current_count integer not null default 0,
  requires_executive_approval boolean not null default false,
  action_url text,
  status text not null default 'open' check(status in ('open','monitoring','resolved','dismissed')),
  evidence jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists idx_executive_priorities_open on public.adminos_executive_priorities(status,priority desc,last_seen_at desc);

create table if not exists public.adminos_company_operating_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_at timestamptz not null default now(),
  operating_score integer not null default 100 check(operating_score between 0 and 100),
  open_department_tasks integer not null default 0,
  urgent_department_tasks integer not null default 0,
  pending_approvals integer not null default 0,
  executive_priorities integer not null default 0,
  red_priorities integer not null default 0,
  platform_health_score integer not null default 100,
  finance_high_anomalies integer not null default 0,
  reputation_red_briefs integer not null default 0,
  seo_high_signals integer not null default 0,
  student_attention_cases integer not null default 0,
  partnerships_attention integer not null default 0,
  application_attention integer not null default 0,
  occupancy_attention integer not null default 0,
  metrics jsonb not null default '{}'::jsonb,
  release_gates jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists idx_company_operating_snapshots_at on public.adminos_company_operating_snapshots(snapshot_at desc);

alter table public.adminos_executive_authority_policy enable row level security;
alter table public.adminos_executive_priorities enable row level security;
alter table public.adminos_company_operating_snapshots enable row level security;

drop policy if exists executive_authority_policy_read on public.adminos_executive_authority_policy;
create policy executive_authority_policy_read on public.adminos_executive_authority_policy
for select to authenticated using (public.has_admin_department_access('executive') or public.has_admin_department_access('intelligence_analytics'));
drop policy if exists executive_priorities_read on public.adminos_executive_priorities;
create policy executive_priorities_read on public.adminos_executive_priorities
for select to authenticated using (public.has_admin_department_access('executive') or public.has_admin_department_access('intelligence_analytics'));
drop policy if exists company_operating_snapshots_read on public.adminos_company_operating_snapshots;
create policy company_operating_snapshots_read on public.adminos_company_operating_snapshots
for select to authenticated using (public.has_admin_department_access('executive') or public.has_admin_department_access('intelligence_analytics'));
revoke insert,update,delete on public.adminos_executive_authority_policy,public.adminos_executive_priorities,public.adminos_company_operating_snapshots from authenticated,anon;
grant select on public.adminos_executive_authority_policy,public.adminos_executive_priorities,public.adminos_company_operating_snapshots to authenticated;

create or replace function public.adminos_rg15_upsert_priority(
  p_key text,p_area text,p_department text,p_priority integer,p_risk text,p_title text,p_rationale text,
  p_source_type text,p_source_id uuid,p_count integer,p_requires_approval boolean,p_url text,p_evidence jsonb
) returns void language plpgsql security definer set search_path=public as $$
begin
  insert into public.adminos_executive_priorities(
    priority_key,area,department_key,priority,risk_level,title,rationale,source_type,source_id,current_count,
    requires_executive_approval,action_url,status,evidence,first_seen_at,last_seen_at,resolved_at
  ) values(
    p_key,p_area,p_department,least(100,greatest(0,p_priority)),p_risk,p_title,p_rationale,p_source_type,p_source_id,
    greatest(0,coalesce(p_count,0)),p_requires_approval,p_url,'open',coalesce(p_evidence,'{}'::jsonb),now(),now(),null
  )
  on conflict(priority_key) do update set
    area=excluded.area,department_key=excluded.department_key,priority=excluded.priority,risk_level=excluded.risk_level,
    title=excluded.title,rationale=excluded.rationale,source_type=excluded.source_type,source_id=excluded.source_id,
    current_count=excluded.current_count,requires_executive_approval=excluded.requires_executive_approval,
    action_url=excluded.action_url,status='open',evidence=excluded.evidence,last_seen_at=now(),resolved_at=null;
end;
$$;

create or replace function public.adminos_rg15_refresh_priorities()
returns integer language plpgsql security definer set search_path=public as $$
declare active_keys text[]:='{}'::text[];k text;rec record;cnt integer:=0;n integer:=0;
begin
  select count(*)::integer into cnt from public.adminos_approval_requests where status='pending';
  if cnt>0 then
    k:='rg15:pending-approvals';active_keys:=array_append(active_keys,k);
    perform public.adminos_rg15_upsert_priority(k,'governance','executive',
      case when cnt>=10 then 100 when cnt>=3 then 95 else 85 end,'amber',
      'Executive approvals require decisions',
      concat(cnt,' approval request(s) are waiting. Review the underlying action and evidence; approval does not override downstream safety controls.'),
      'adminos_approval_requests',null,cnt,true,'/admin/executive',
      jsonb_build_object('pending_approvals',cnt));
  end if;

  select count(*)::integer into cnt from public.adminos_reliability_incidents where status='open' and severity in ('high','critical');
  if cnt>0 then
    k:='rg15:reliability-risk';active_keys:=array_append(active_keys,k);
    perform public.adminos_rg15_upsert_priority(k,'technology','technology_systems',100,'red',
      'Platform reliability requires Executive visibility',
      concat(cnt,' high/critical reliability incident(s) are open. Technology owns diagnosis and release-gated remediation.'),
      'adminos_reliability_incidents',null,cnt,false,'/admin/technology',
      jsonb_build_object('high_incidents',cnt));
  end if;

  select count(*)::integer into cnt from public.adminos_finance_anomalies where status='open' and severity in ('high','critical');
  if cnt>0 then
    k:='rg15:finance-risk';active_keys:=array_append(active_keys,k);
    perform public.adminos_rg15_upsert_priority(k,'finance','finance_admin',100,'red',
      'Financial control exceptions need review',
      concat(cnt,' high/critical finance anomaly/anomalies are open. No money movement is autonomous.'),
      'adminos_finance_anomalies',null,cnt,true,'/admin/finance',
      jsonb_build_object('high_finance_anomalies',cnt));
  end if;

  select count(*)::integer into cnt from public.adminos_corporate_affairs_briefs where status='open' and risk_level='red';
  if cnt>0 then
    k:='rg15:reputation-risk';active_keys:=array_append(active_keys,k);
    perform public.adminos_rg15_upsert_priority(k,'reputation','marketing_corporate_affairs',98,'red',
      'Reputation risk requires coordinated remediation',
      concat(cnt,' RED Corporate Affairs brief(s) are open. Resolve operational causes first; public statements remain approval-gated.'),
      'adminos_corporate_affairs_briefs',null,cnt,true,'/admin/corporate-affairs',
      jsonb_build_object('red_reputation_briefs',cnt));
  end if;

  select count(*)::integer into cnt from public.adminos_seo_growth_signals where status='open' and priority>=80;
  if cnt>0 then
    k:='rg15:search-growth-risk';active_keys:=array_append(active_keys,k);
    perform public.adminos_rg15_upsert_priority(k,'growth','intelligence_analytics',82,'amber',
      'Search growth exceptions need attention',
      concat(cnt,' high-priority SEO/AEO signal(s) are open. Mechanical indexing is autonomous; public content changes remain controlled.'),
      'adminos_seo_growth_signals',null,cnt,false,'/admin/intelligence',
      jsonb_build_object('high_seo_signals',cnt));
  end if;

  for rec in
    select department_key,count(*)::integer total,
      count(*) filter(where priority='urgent')::integer urgent,
      count(*) filter(where priority='high')::integer high_count
    from public.staff_tasks
    where status in ('open','in_progress','waiting') and department_key is not null and department_key<>'executive'
    group by department_key
    having count(*) filter(where priority in ('urgent','high'))>0
  loop
    k:=concat('rg15:department:',rec.department_key);active_keys:=array_append(active_keys,k);
    perform public.adminos_rg15_upsert_priority(
      k,'department_execution',rec.department_key,
      least(95,70+rec.urgent*10+rec.high_count*3),
      case when rec.urgent>=3 then 'red' when rec.urgent>0 or rec.high_count>=5 then 'amber' else 'green' end,
      concat(replace(rec.department_key,'_',' '),' execution pressure'),
      concat(rec.total,' open task(s), including ',rec.urgent,' urgent and ',rec.high_count,' high priority. Departments own execution; Executive intervenes only on material exceptions.'),
      'staff_tasks',null,rec.total,false,'/admin/executive',
      jsonb_build_object('department_key',rec.department_key,'open_tasks',rec.total,'urgent_tasks',rec.urgent,'high_tasks',rec.high_count)
    );
  end loop;

  update public.adminos_executive_priorities
  set status='resolved',resolved_at=now(),last_seen_at=now()
  where status in ('open','monitoring') and priority_key like 'rg15:%' and not(priority_key=any(active_keys));

  select count(*)::integer into n from public.adminos_executive_priorities where status='open' and priority_key like 'rg15:%';
  return n;
end;
$$;

create or replace function public.adminos_rg15_refresh_executive_alerts()
returns jsonb language plpgsql security definer set search_path=public as $$
declare base jsonb;rel integer:=0;fin integer:=0;rep integer:=0;seo integer:=0;
begin
  base:=public.adminos_refresh_executive_alerts();

  select count(*)::integer into rel from public.adminos_reliability_incidents where status='open' and severity in ('high','critical');
  insert into public.adminos_executive_alerts(alert_key,severity,title,description,status,current_count,metadata,updated_at,resolved_at)
  values('agentos.reliability',case when rel>0 then 'critical' else 'medium' end,'Platform reliability exceptions',
    rel||' high/critical RG14 reliability incident(s) are open.',case when rel>0 then 'open' else 'resolved' end,rel,
    jsonb_build_object('source','rg14_reliability'),now(),case when rel=0 then now() else null end)
  on conflict(alert_key) do update set severity=excluded.severity,description=excluded.description,status=excluded.status,
    current_count=excluded.current_count,metadata=excluded.metadata,updated_at=now(),resolved_at=excluded.resolved_at;

  select count(*)::integer into fin from public.adminos_finance_anomalies where status='open' and severity in ('high','critical');
  insert into public.adminos_executive_alerts(alert_key,severity,title,description,status,current_count,metadata,updated_at,resolved_at)
  values('agentos.finance',case when fin>0 then 'critical' else 'medium' end,'Financial control exceptions',
    fin||' high/critical RG13 finance anomaly/anomalies are open.',case when fin>0 then 'open' else 'resolved' end,fin,
    jsonb_build_object('source','rg13_finance'),now(),case when fin=0 then now() else null end)
  on conflict(alert_key) do update set severity=excluded.severity,description=excluded.description,status=excluded.status,
    current_count=excluded.current_count,metadata=excluded.metadata,updated_at=now(),resolved_at=excluded.resolved_at;

  select count(*)::integer into rep from public.adminos_corporate_affairs_briefs where status='open' and risk_level='red';
  insert into public.adminos_executive_alerts(alert_key,severity,title,description,status,current_count,metadata,updated_at,resolved_at)
  values('agentos.reputation',case when rep>0 then 'critical' else 'medium' end,'Reputation risk briefs',
    rep||' RED RG11 Corporate Affairs brief(s) are open.',case when rep>0 then 'open' else 'resolved' end,rep,
    jsonb_build_object('source','rg11_reputation'),now(),case when rep=0 then now() else null end)
  on conflict(alert_key) do update set severity=excluded.severity,description=excluded.description,status=excluded.status,
    current_count=excluded.current_count,metadata=excluded.metadata,updated_at=now(),resolved_at=excluded.resolved_at;

  select count(*)::integer into seo from public.adminos_seo_growth_signals where status='open' and priority>=80;
  insert into public.adminos_executive_alerts(alert_key,severity,title,description,status,current_count,metadata,updated_at,resolved_at)
  values('agentos.search_growth',case when seo>=10 then 'high' else 'medium' end,'SEO/AEO growth exceptions',
    seo||' high-priority RG12 search signal(s) are open.',case when seo>0 then 'open' else 'resolved' end,seo,
    jsonb_build_object('source','rg12_seo'),now(),case when seo=0 then now() else null end)
  on conflict(alert_key) do update set severity=excluded.severity,description=excluded.description,status=excluded.status,
    current_count=excluded.current_count,metadata=excluded.metadata,updated_at=now(),resolved_at=excluded.resolved_at;

  return base||jsonb_build_object('rg14_reliability_high',rel,'rg13_finance_high',fin,'rg11_reputation_red',rep,'rg12_seo_high',seo);
end;
$$;

create or replace function public.adminos_rg15_generate_operating_snapshot()
returns public.adminos_company_operating_snapshots
language plpgsql security definer set search_path=public as $$
declare
  open_tasks integer:=0;urgent_tasks integer:=0;approvals integer:=0;priorities integer:=0;red_priorities integer:=0;
  health integer:=100;finance_high integer:=0;rep_red integer:=0;seo_high integer:=0;student_attention integer:=0;partner_attention integer:=0;
  app_attention integer:=0;occupancy_attention integer:=0;score integer:=100;result public.adminos_company_operating_snapshots%rowtype;
  dept jsonb:='{}'::jsonb;gates jsonb:='{}'::jsonb;
begin
  select count(*)::integer,count(*) filter(where priority='urgent')::integer into open_tasks,urgent_tasks
  from public.staff_tasks where status in ('open','in_progress','waiting');
  select count(*)::integer into approvals from public.adminos_approval_requests where status='pending';
  select count(*)::integer,count(*) filter(where risk_level='red')::integer into priorities,red_priorities
  from public.adminos_executive_priorities where status='open';
  select coalesce((select platform_health_score from public.adminos_reliability_snapshots order by snapshot_at desc limit 1),100) into health;
  select count(*)::integer into finance_high from public.adminos_finance_anomalies where status='open' and severity in ('high','critical');
  select count(*)::integer into rep_red from public.adminos_corporate_affairs_briefs where status='open' and risk_level='red';
  select count(*)::integer into seo_high from public.adminos_seo_growth_signals where status='open' and priority>=80;
  select count(*)::integer into student_attention from public.adminos_student_opportunity_cases where automation_state='staff_attention';
  select count(*)::integer into partner_attention from public.adminos_partnership_relationship_health where automation_state in ('follow_up','executive_review');
  select count(*)::integer into app_attention from public.adminos_application_health_scores where automation_state in ('staff_attention','human_review') or health_band in ('attention','blocked','incomplete');
  select count(*)::integer into occupancy_attention from public.adminos_occupancy_intelligence where action_priority>=70;

  select coalesce(jsonb_object_agg(department_key,jsonb_build_object('open',total,'urgent',urgent,'high',high_count)),'{}'::jsonb) into dept
  from (
    select department_key,count(*)::integer total,count(*) filter(where priority='urgent')::integer urgent,
      count(*) filter(where priority='high')::integer high_count
    from public.staff_tasks where status in ('open','in_progress','waiting') and department_key is not null group by department_key
  ) x;

  select coalesce(jsonb_object_agg(agent_key,jsonb_build_object('enabled',enabled,'authority',authority_level)),'{}'::jsonb) into gates
  from public.adminos_agent_config where agent_key in (
    'luna_core','luna_demand','luna_content','student_opportunities','partnerships_agent','corporate_affairs_agent',
    'finance_admin_agent','technology_reliability_agent','seo_aeo_growth_agent','executive_operating_agent'
  );

  score:=greatest(0,least(100,round(
    health*0.35
    + greatest(0,100-finance_high*20)*0.15
    + greatest(0,100-rep_red*15)*0.15
    + greatest(0,100-red_priorities*10)*0.15
    + greatest(0,100-urgent_tasks*3)*0.10
    + greatest(0,100-approvals*2)*0.10
  ))::integer);

  insert into public.adminos_company_operating_snapshots(
    operating_score,open_department_tasks,urgent_department_tasks,pending_approvals,executive_priorities,red_priorities,
    platform_health_score,finance_high_anomalies,reputation_red_briefs,seo_high_signals,student_attention_cases,
    partnerships_attention,application_attention,occupancy_attention,metrics,release_gates,metadata
  ) values(
    score,open_tasks,urgent_tasks,approvals,priorities,red_priorities,health,finance_high,rep_red,seo_high,student_attention,
    partner_attention,app_attention,occupancy_attention,
    jsonb_build_object('department_queues',dept,'generated_timezone','Africa/Johannesburg'),
    gates,jsonb_build_object('autonomous_money_movement',false,'autonomous_contracts',false,'autonomous_public_crisis_statements',false)
  ) returning * into result;
  return result;
end;
$$;

create unique index if not exists uq_adminos_executive_briefs_brief_date on public.adminos_executive_briefs(brief_date);

create or replace function public.adminos_generate_executive_brief(p_date date default ((now() at time zone 'Africa/Johannesburg')::date))
returns public.adminos_executive_briefs
language plpgsql security definer set search_path=public as $$
declare
  snap public.adminos_company_operating_snapshots%rowtype;
  priorities_value jsonb:='[]'::jsonb;recommendations_value jsonb:='[]'::jsonb;
  v_period_start timestamptz;v_period_end timestamptz;v_headline text;result public.adminos_executive_briefs%rowtype;
begin
  snap:=public.adminos_rg15_generate_operating_snapshot();
  v_period_start:=(p_date::timestamp at time zone 'Africa/Johannesburg');
  v_period_end:=v_period_start+interval '1 day';

  select coalesce(jsonb_agg(jsonb_build_object(
    'priority',p.priority,'area',p.area,'department_key',p.department_key,'title',p.title,'rationale',p.rationale,
    'risk_level',p.risk_level,'requires_approval',p.requires_executive_approval,'url',p.action_url
  ) order by p.priority desc),'[]'::jsonb)
  into priorities_value
  from (select * from public.adminos_executive_priorities where status='open' order by priority desc limit 12) p;

  select coalesce(jsonb_agg(jsonb_build_object(
    'priority',case when t.priority='urgent' then 95 when t.priority='high' then 80 else 60 end,
    'title',t.title,'rationale',coalesce(t.next_action,t.description),'department_key',t.department_key
  ) order by case when t.priority='urgent' then 1 when t.priority='high' then 2 else 3 end,t.due_at nulls last),'[]'::jsonb)
  into recommendations_value
  from (select * from public.staff_tasks where status in ('open','in_progress','waiting') order by
    case when priority='urgent' then 1 when priority='high' then 2 else 3 end,due_at nulls last limit 10) t;

  v_headline:=concat('Luna operating brief: company score ',snap.operating_score,'/100 · ',snap.red_priorities,
    ' red executive priorit',case when snap.red_priorities=1 then 'y' else 'ies' end,' · ',snap.pending_approvals,' approval(s) pending.');

  insert into public.adminos_executive_briefs(
    brief_date,period_start,period_end,headline,summary,metrics,attention,recommendations,generated_by_type,provider,model,metadata,persona,priorities,generated_at
  ) values(
    p_date,v_period_start,v_period_end,v_headline,
    concat('AgentOS RG0–RG15 is operating across department queues. Platform health is ',snap.platform_health_score,
      '/100; ',snap.urgent_department_tasks,' urgent department task(s), ',snap.finance_high_anomalies,' high finance anomaly/anomalies, ',
      snap.reputation_red_briefs,' RED reputation brief(s), and ',snap.seo_high_signals,' high-priority search signal(s) currently require attention.'),
    jsonb_build_object(
      'operating_score',snap.operating_score,'open_department_tasks',snap.open_department_tasks,'urgent_department_tasks',snap.urgent_department_tasks,
      'pending_approvals',snap.pending_approvals,'executive_priorities',snap.executive_priorities,'red_priorities',snap.red_priorities,
      'platform_health_score',snap.platform_health_score,'finance_high_anomalies',snap.finance_high_anomalies,
      'reputation_red_briefs',snap.reputation_red_briefs,'seo_high_signals',snap.seo_high_signals,
      'student_attention_cases',snap.student_attention_cases,'partnerships_attention',snap.partnerships_attention,
      'application_attention',snap.application_attention,'occupancy_attention',snap.occupancy_attention
    ),
    priorities_value,recommendations_value,'scheduler','rules',null,
    jsonb_build_object('ai_calls',0,'timezone','Africa/Johannesburg','release_gate',15,'source_snapshot_id',snap.id),
    'Luna',priorities_value,now()
  )
  on conflict(brief_date) do update set
    period_start=excluded.period_start,period_end=excluded.period_end,headline=excluded.headline,summary=excluded.summary,
    metrics=excluded.metrics,attention=excluded.attention,recommendations=excluded.recommendations,generated_by_type=excluded.generated_by_type,
    provider=excluded.provider,model=excluded.model,metadata=excluded.metadata,persona='Luna',priorities=excluded.priorities,generated_at=excluded.generated_at
  returning * into result;
  return result;
end;
$$;

create or replace function public.adminos_rg15_reconcile_tasks()
returns integer language plpgsql security definer set search_path=public as $$
declare rec record;k text;current_count integer:=0;
begin
  update public.staff_tasks set status='completed',updated_at=now(),metadata=metadata||jsonb_build_object('automation_resolved_at',now())
  where department_key='executive' and status in ('open','in_progress','waiting')
    and metadata->>'automation_family'='rg15'
    and (metadata->>'automation_key' is null or not exists(
      select 1 from public.adminos_executive_priorities p where p.status='open' and p.priority>=90
        and concat('rg15:task:',p.priority_key)=staff_tasks.metadata->>'automation_key'));

  for rec in select * from public.adminos_executive_priorities where status='open' and priority>=90 order by priority desc
  loop
    k:=concat('rg15:task:',rec.priority_key);
    if not exists(select 1 from public.staff_tasks where metadata->>'automation_key'=k and status in ('open','in_progress','waiting')) then
      insert into public.staff_tasks(title,description,source_table,source_id,priority,status,due_at,next_action,tags,metadata,department_key)
      values(rec.title,rec.rationale,'adminos_executive_priorities',rec.id,
        case when rec.priority>=98 then 'urgent' else 'high' end,'open',
        now()+case when rec.priority>=98 then interval '4 hours' else interval '24 hours' end,
        case when rec.requires_executive_approval then 'Review evidence and decide the approval/exception.' else 'Review the material exception and unblock the owning department.' end,
        array['rg15','executive',rec.area],
        jsonb_build_object('automation_family','rg15','automation_key',k,'priority_key',rec.priority_key,'risk_level',rec.risk_level,
          'requires_executive_approval',rec.requires_executive_approval,'evidence',rec.evidence),
        'executive');
    else
      update public.staff_tasks set description=rec.rationale,priority=case when rec.priority>=98 then 'urgent' else 'high' end,
        metadata=metadata||jsonb_build_object('evidence',rec.evidence,'last_refresh_at',now()),updated_at=now()
      where metadata->>'automation_key'=k and status in ('open','in_progress','waiting');
    end if;
  end loop;
  select count(*)::integer into current_count from public.staff_tasks where department_key='executive'
    and status in ('open','in_progress','waiting') and metadata->>'automation_family'='rg15';
  return current_count;
end;
$$;

create or replace function public.adminos_rg15_executive_cycle()
returns jsonb language plpgsql security definer set search_path=public as $$
declare priorities integer:=0;tasks integer:=0;alerts jsonb;brief public.adminos_executive_briefs%rowtype;snap public.adminos_company_operating_snapshots%rowtype;
begin
  priorities:=public.adminos_rg15_refresh_priorities();
  alerts:=public.adminos_rg15_refresh_executive_alerts();
  snap:=public.adminos_rg15_generate_operating_snapshot();
  tasks:=public.adminos_rg15_reconcile_tasks();
  brief:=public.adminos_generate_executive_brief(((now() at time zone 'Africa/Johannesburg')::date));
  return jsonb_build_object('operating_score',snap.operating_score,'open_priorities',priorities,'executive_tasks',tasks,
    'pending_approvals',snap.pending_approvals,'red_priorities',snap.red_priorities,'platform_health_score',snap.platform_health_score,
    'brief_id',brief.id,'persona',brief.persona,'alerts',alerts,'run_at',now());
end;
$$;

revoke all on function public.adminos_rg15_executive_cycle() from public,anon,authenticated;
grant execute on function public.adminos_rg15_executive_cycle() to service_role;

create or replace function public.adminos_run_rg15_now()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
begin
  if auth.uid() is null or not public.has_admin_department_access('executive') then
    raise exception 'Executive access required' using errcode='42501';
  end if;
  return public.adminos_rg15_executive_cycle();
end;
$$;
revoke all on function public.adminos_run_rg15_now() from public,anon;
grant execute on function public.adminos_run_rg15_now() to authenticated;

insert into public.adminos_agent_config(agent_key,display_name,enabled,authority_level,confidence_threshold,config)
values('executive_operating_agent','Luna Executive Operating Agent',true,'green',0.995,
  jsonb_build_object('release_gate',15,'company_operating_score',true,'cross_department_priorities',true,'exception_routing',true,
    'executive_brief_persona','Luna','routine_delegation',true,'contracts',false,'banking_changes',false,'money_movement',false,
    'ownership_legal_admissions',false,'public_crisis_statements',false,'production_deploy',false,
    'founder_role','strategy_relationships_and_material_exceptions'))
on conflict(agent_key) do update set display_name=excluded.display_name,enabled=true,authority_level='green',
  confidence_threshold=excluded.confidence_threshold,config=excluded.config,updated_at=now();

do $$ declare j record; begin
  for j in select jobid from cron.job where jobname='adminos-rg15-executive-operating-cycle' loop perform cron.unschedule(j.jobid); end loop;
  perform cron.schedule('adminos-rg15-executive-operating-cycle','*/15 * * * *',$job$select public.adminos_rg15_executive_cycle();$job$);
end $$;

select public.adminos_rg15_executive_cycle();
