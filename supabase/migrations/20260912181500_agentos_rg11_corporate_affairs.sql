-- AgentOS RG11 — Corporate Affairs & Reputation Automation
-- Builds a first-party reputation radar, internal briefs and approval-gated PR drafts.
-- It never infers external social sentiment from counts and never auto-publishes.

create table if not exists public.adminos_reputation_signals (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('service_recovery','agent_feedback','complaint','review')),
  source_id uuid not null,
  category text not null,
  sentiment text not null check (sentiment in ('negative','positive','neutral','operational_risk')),
  severity integer not null default 50 check (severity between 0 and 100),
  status text not null default 'open' check (status in ('open','monitoring','resolved','dismissed')),
  summary text not null,
  public_risk boolean not null default false,
  requires_executive_approval boolean not null default false,
  evidence jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique(source_type,source_id)
);

create index if not exists idx_reputation_signals_open
  on public.adminos_reputation_signals(status,severity desc,category,last_seen_at desc);

alter table public.adminos_reputation_signals enable row level security;
drop policy if exists reputation_signals_department_read on public.adminos_reputation_signals;
create policy reputation_signals_department_read
on public.adminos_reputation_signals for select to authenticated
using (
  public.has_admin_department_access('marketing_corporate_affairs')
  or public.has_admin_department_access('communications_service')
  or public.has_admin_department_access('executive')
  or public.has_admin_department_access('intelligence_analytics')
);
revoke insert,update,delete on public.adminos_reputation_signals from authenticated,anon;
grant select on public.adminos_reputation_signals to authenticated;

create table if not exists public.adminos_corporate_affairs_briefs (
  id uuid primary key default gen_random_uuid(),
  brief_key text not null unique,
  brief_type text not null check (brief_type in ('service_reliability','customer_satisfaction','complaints','reviews','reputation_summary')),
  risk_level text not null check (risk_level in ('green','amber','red')),
  headline text not null,
  summary text not null,
  signal_count integer not null default 0,
  evidence jsonb not null default '{}'::jsonb,
  recommended_action text not null,
  public_statement_recommended boolean not null default false,
  requires_executive_approval boolean not null default false,
  status text not null default 'open' check (status in ('open','approved','dismissed','resolved')),
  approved_by uuid,
  approved_at timestamptz,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.adminos_corporate_affairs_briefs enable row level security;
drop policy if exists corporate_briefs_department_read on public.adminos_corporate_affairs_briefs;
create policy corporate_briefs_department_read
on public.adminos_corporate_affairs_briefs for select to authenticated
using (
  public.has_admin_department_access('marketing_corporate_affairs')
  or public.has_admin_department_access('executive')
  or public.has_admin_department_access('intelligence_analytics')
);
revoke insert,update,delete on public.adminos_corporate_affairs_briefs from authenticated,anon;
grant select on public.adminos_corporate_affairs_briefs to authenticated;

create table if not exists public.adminos_corporate_affairs_drafts (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid references public.adminos_corporate_affairs_briefs(id) on delete cascade,
  draft_key text not null unique,
  draft_type text not null check (draft_type in ('holding_statement','announcement','talking_points','response')),
  title text not null,
  body text not null,
  risk_level text not null check (risk_level in ('green','amber','red')),
  intended_audience text not null default 'public',
  manual_publish_required boolean not null default true,
  requires_executive_approval boolean not null default true,
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected','not_required')),
  approved_by uuid,
  approved_at timestamptz,
  status text not null default 'draft' check (status in ('draft','ready','used','dismissed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.adminos_corporate_affairs_drafts enable row level security;
drop policy if exists corporate_drafts_department_read on public.adminos_corporate_affairs_drafts;
create policy corporate_drafts_department_read
on public.adminos_corporate_affairs_drafts for select to authenticated
using (
  public.has_admin_department_access('marketing_corporate_affairs')
  or public.has_admin_department_access('executive')
);
revoke insert,update,delete on public.adminos_corporate_affairs_drafts from authenticated,anon;
grant select on public.adminos_corporate_affairs_drafts to authenticated;

-- Public announcement governance.
alter table public.site_announcements
  add column if not exists risk_level text not null default 'green',
  add column if not exists requires_executive_approval boolean not null default false,
  add column if not exists approval_status text not null default 'not_required',
  add column if not exists approved_by uuid,
  add column if not exists approved_at timestamptz;

alter table public.site_announcements
  drop constraint if exists site_announcements_risk_level_check;
alter table public.site_announcements
  add constraint site_announcements_risk_level_check check (risk_level in ('green','amber','red'));

alter table public.site_announcements
  drop constraint if exists site_announcements_approval_status_check;
alter table public.site_announcements
  add constraint site_announcements_approval_status_check check (approval_status in ('not_required','pending','approved','rejected'));

create or replace function public.adminos_rg11_statement_risk(p_text text)
returns text
language sql immutable set search_path='' as $$
  select case
    when lower(coalesce(p_text,'')) ~ '(data breach|security breach|lawsuit|court action|legal action|public apology|apologise|apologize|controversy|crisis|fraud allegation|criminal investigation)'
      then 'red'
    when lower(coalesce(p_text,'')) ~ '(partnership|partnered with|government|department of|university|college|seta|nsfas|pricing|price change|fee change|refund|contract|agreement|guarantee|guaranteed|accredited|first in africa|official provider)'
      then 'amber'
    else 'green'
  end;
$$;

create or replace function public.adminos_rg11_site_announcement_guard()
returns trigger
language plpgsql security definer set search_path=public as $$
declare
  new_risk text;
  content_changed boolean:=true;
begin
  new_risk:=public.adminos_rg11_statement_risk(concat_ws(' ',new.title,new.subtitle,new.body,new.badge));

  if tg_op='UPDATE' then
    content_changed:=(new.title,new.subtitle,new.body,new.badge,new.cta_label,new.cta_url)
      is distinct from (old.title,old.subtitle,old.body,old.badge,old.cta_label,old.cta_url);
  end if;

  new.risk_level:=new_risk;
  new.requires_executive_approval:=(new_risk in ('amber','red'));

  if new_risk='green' then
    new.approval_status:='not_required';
    new.approved_by:=null;
    new.approved_at:=null;
  elsif tg_op='INSERT' or content_changed then
    new.approval_status:='pending';
    new.approved_by:=null;
    new.approved_at:=null;
    new.is_active:=false;
  elsif new.approval_status<>'approved' then
    new.is_active:=false;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_rg11_site_announcement_guard on public.site_announcements;
create trigger trg_rg11_site_announcement_guard
before insert or update on public.site_announcements
for each row execute function public.adminos_rg11_site_announcement_guard();

-- Classify existing announcements without changing green ones.
update public.site_announcements
set updated_at=updated_at;

create or replace function public.adminos_rg11_refresh_signals()
returns integer
language plpgsql security definer set search_path=public as $$
declare affected integer:=0; step_count integer:=0;
begin
  perform public.adminos_refresh_service_recovery();

  insert into public.adminos_reputation_signals(
    source_type,source_id,category,sentiment,severity,status,summary,public_risk,requires_executive_approval,evidence,first_seen_at,last_seen_at,resolved_at
  )
  select
    'service_recovery',r.id,
    case when r.issue_type in ('delivery_failure','automation_failure') then 'service_reliability' else 'customer_service' end,
    'operational_risk',least(100,greatest(0,r.priority)),
    case when r.status='resolved' then 'resolved' else 'open' end,
    r.reason,
    (r.priority>=90),
    (r.priority>=90),
    jsonb_build_object('issue_type',r.issue_type,'age_seconds',r.age_seconds,'thread_id',r.thread_id,'metadata',r.metadata),
    r.first_detected_at,r.last_detected_at,r.resolved_at
  from public.adminos_service_recovery_items r
  on conflict(source_type,source_id) do update set
    category=excluded.category,sentiment=excluded.sentiment,severity=excluded.severity,status=excluded.status,
    summary=excluded.summary,public_risk=excluded.public_risk,requires_executive_approval=excluded.requires_executive_approval,
    evidence=excluded.evidence,last_seen_at=excluded.last_seen_at,resolved_at=excluded.resolved_at;
  get diagnostics affected=row_count;

  insert into public.adminos_reputation_signals(
    source_type,source_id,category,sentiment,severity,status,summary,public_risk,requires_executive_approval,evidence,first_seen_at,last_seen_at
  )
  select
    'agent_feedback',f.id,'customer_satisfaction',
    case when f.satisfied=false or coalesce(f.score,5)<=2 then 'negative' when f.satisfied=true and coalesce(f.score,0)>=4 then 'positive' else 'neutral' end,
    case when f.satisfied=false or coalesce(f.score,5)<=2 then 80 when f.satisfied=true and coalesce(f.score,0)>=4 then 20 else 40 end,
    'monitoring',
    case when f.satisfied=false or coalesce(f.score,5)<=2 then 'Customer reported that the service interaction did not solve the issue.' else 'Customer service feedback recorded.' end,
    (f.satisfied=false or coalesce(f.score,5)<=2),
    false,
    jsonb_build_object('score',f.score,'satisfied',f.satisfied,'context_key',f.context_key,'feedback_text',f.feedback_text,'language_code',f.language_code),
    f.created_at,f.created_at
  from public.adminos_agent_feedback f
  on conflict(source_type,source_id) do update set
    sentiment=excluded.sentiment,severity=excluded.severity,summary=excluded.summary,public_risk=excluded.public_risk,
    evidence=excluded.evidence,last_seen_at=excluded.last_seen_at;
  get diagnostics step_count=row_count; affected:=affected+step_count;

  insert into public.adminos_reputation_signals(
    source_type,source_id,category,sentiment,severity,status,summary,public_risk,requires_executive_approval,evidence,first_seen_at,last_seen_at
  )
  select
    'complaint',c.id,coalesce(nullif(c.category,''),'complaint'),'negative',
    case when lower(coalesce(c.category,'')) ~ '(safety|fraud|security|legal)' then 95 else 80 end,
    case when lower(coalesce(c.status,'')) in ('resolved','closed','completed') then 'resolved' else 'open' end,
    coalesce(nullif(c.title,''),nullif(c.description,''),nullif(c.message,''),'Customer complaint'),
    true,
    lower(coalesce(c.category,'')) ~ '(safety|fraud|security|legal)',
    jsonb_build_object('status',c.status,'category',c.category,'description',coalesce(c.description,c.message),'student_email',c.student_email),
    coalesce(c.created_at::timestamptz,now()),coalesce(c.created_at::timestamptz,now())
  from public.complaints c
  on conflict(source_type,source_id) do update set
    category=excluded.category,severity=excluded.severity,status=excluded.status,summary=excluded.summary,
    public_risk=excluded.public_risk,requires_executive_approval=excluded.requires_executive_approval,evidence=excluded.evidence,last_seen_at=excluded.last_seen_at;
  get diagnostics step_count=row_count; affected:=affected+step_count;

  insert into public.adminos_reputation_signals(
    source_type,source_id,category,sentiment,severity,status,summary,public_risk,requires_executive_approval,evidence,first_seen_at,last_seen_at
  )
  select
    'review',v.id,'residence_review',
    case when v.rating<=2 then 'negative' when v.rating>=4 then 'positive' else 'neutral' end,
    case when v.rating=1 then 90 when v.rating=2 then 75 when v.rating=3 then 45 else 20 end,
    'monitoring',
    concat(v.rating,'/5 review: ',v.title),
    (v.rating<=2),
    false,
    jsonb_build_object('rating',v.rating,'content',v.content,'verified_stay',v.verified_stay,'residence_id',v.residence_id),
    v.created_at,v.updated_at
  from public.reviews v
  on conflict(source_type,source_id) do update set
    sentiment=excluded.sentiment,severity=excluded.severity,summary=excluded.summary,public_risk=excluded.public_risk,
    evidence=excluded.evidence,last_seen_at=excluded.last_seen_at;
  get diagnostics step_count=row_count; affected:=affected+step_count;

  return affected;
end;
$$;

create or replace function public.adminos_rg11_refresh_briefs()
returns integer
language plpgsql security definer set search_path=public as $$
declare
  open_recovery integer:=0;
  delivery_failures integer:=0;
  unanswered integer:=0;
  automation_failures integer:=0;
  negative_feedback integer:=0;
  open_complaints integer:=0;
  low_reviews integer:=0;
  affected integer:=0;
  step_count integer:=0;
begin
  select
    count(*) filter(where source_type='service_recovery' and status='open'),
    count(*) filter(where source_type='service_recovery' and status='open' and evidence->>'issue_type'='delivery_failure'),
    count(*) filter(where source_type='service_recovery' and status='open' and evidence->>'issue_type'='unanswered_customer'),
    count(*) filter(where source_type='service_recovery' and status='open' and evidence->>'issue_type'='automation_failure')
  into open_recovery,delivery_failures,unanswered,automation_failures
  from public.adminos_reputation_signals;

  select count(*) into negative_feedback
  from public.adminos_reputation_signals
  where source_type='agent_feedback' and sentiment='negative' and first_seen_at>=now()-interval '7 days';

  select count(*) into open_complaints
  from public.adminos_reputation_signals where source_type='complaint' and status='open';

  select count(*) into low_reviews
  from public.adminos_reputation_signals where source_type='review' and sentiment='negative' and first_seen_at>=now()-interval '30 days';

  insert into public.adminos_corporate_affairs_briefs(
    brief_key,brief_type,risk_level,headline,summary,signal_count,evidence,recommended_action,
    public_statement_recommended,requires_executive_approval,status,generated_at,updated_at
  ) values(
    'service-reliability-current','service_reliability',
    case when unanswered>=5 or delivery_failures>=20 then 'red' when open_recovery>=5 then 'amber' else 'green' end,
    'Service reliability and customer-communication risk',
    concat(open_recovery,' open service-recovery signals: ',delivery_failures,' delivery failures, ',automation_failures,' automation failures and ',unanswered,' unanswered-customer cases.'),
    open_recovery,
    jsonb_build_object('delivery_failures',delivery_failures,'automation_failures',automation_failures,'unanswered_customers',unanswered),
    case when open_recovery>=5 then 'Coordinate root-cause resolution with Communications/Technology, verify customer impact, and prepare factual talking points before any public response.' else 'Continue monitoring service reliability.' end,
    (unanswered>=5 or delivery_failures>=20),
    (open_recovery>=5),
    case when open_recovery=0 then 'resolved' else 'open' end,now(),now()
  )
  on conflict(brief_key) do update set
    risk_level=excluded.risk_level,headline=excluded.headline,summary=excluded.summary,signal_count=excluded.signal_count,
    evidence=excluded.evidence,recommended_action=excluded.recommended_action,
    public_statement_recommended=excluded.public_statement_recommended,
    requires_executive_approval=excluded.requires_executive_approval,status=excluded.status,generated_at=now(),updated_at=now();
  get diagnostics affected=row_count;

  insert into public.adminos_corporate_affairs_briefs(
    brief_key,brief_type,risk_level,headline,summary,signal_count,evidence,recommended_action,
    public_statement_recommended,requires_executive_approval,status,generated_at,updated_at
  ) values(
    'customer-satisfaction-7d','customer_satisfaction',
    case when negative_feedback>=10 then 'red' when negative_feedback>=3 then 'amber' else 'green' end,
    'Customer satisfaction watch',
    concat(negative_feedback,' negative service-feedback records were recorded in the last 7 days.'),
    negative_feedback,jsonb_build_object('negative_feedback_7d',negative_feedback),
    case when negative_feedback>=3 then 'Review repeated failure themes with Service Intelligence and prepare remediation talking points. Do not make public claims until causes are verified.' else 'Continue monitoring feedback.' end,
    false,(negative_feedback>=3),
    case when negative_feedback=0 then 'resolved' else 'open' end,now(),now()
  )
  on conflict(brief_key) do update set
    risk_level=excluded.risk_level,summary=excluded.summary,signal_count=excluded.signal_count,evidence=excluded.evidence,
    recommended_action=excluded.recommended_action,public_statement_recommended=excluded.public_statement_recommended,
    requires_executive_approval=excluded.requires_executive_approval,status=excluded.status,generated_at=now(),updated_at=now();
  get diagnostics step_count=row_count;affected:=affected+step_count;

  insert into public.adminos_corporate_affairs_briefs(
    brief_key,brief_type,risk_level,headline,summary,signal_count,evidence,recommended_action,
    public_statement_recommended,requires_executive_approval,status,generated_at,updated_at
  ) values(
    'complaints-current','complaints',
    case when open_complaints>=5 then 'red' when open_complaints>0 then 'amber' else 'green' end,
    'Open complaint watch',concat(open_complaints,' unresolved complaint records are currently in the reputation radar.'),
    open_complaints,jsonb_build_object('open_complaints',open_complaints),
    case when open_complaints>0 then 'Resolve the operational case first; prepare a response only from verified facts.' else 'No complaint escalation required.' end,
    false,(open_complaints>0),case when open_complaints=0 then 'resolved' else 'open' end,now(),now()
  )
  on conflict(brief_key) do update set risk_level=excluded.risk_level,summary=excluded.summary,signal_count=excluded.signal_count,
    evidence=excluded.evidence,recommended_action=excluded.recommended_action,requires_executive_approval=excluded.requires_executive_approval,
    status=excluded.status,generated_at=now(),updated_at=now();
  get diagnostics step_count=row_count;affected:=affected+step_count;

  insert into public.adminos_corporate_affairs_briefs(
    brief_key,brief_type,risk_level,headline,summary,signal_count,evidence,recommended_action,
    public_statement_recommended,requires_executive_approval,status,generated_at,updated_at
  ) values(
    'reviews-30d','reviews',
    case when low_reviews>=5 then 'red' when low_reviews>=2 then 'amber' else 'green' end,
    'Low-rating review watch',concat(low_reviews,' low-rating residence reviews were recorded in the last 30 days.'),
    low_reviews,jsonb_build_object('low_reviews_30d',low_reviews),
    case when low_reviews>0 then 'Review the underlying residence/service issues and respond from verified property facts.' else 'No low-rating escalation required.' end,
    false,(low_reviews>=2),case when low_reviews=0 then 'resolved' else 'open' end,now(),now()
  )
  on conflict(brief_key) do update set risk_level=excluded.risk_level,summary=excluded.summary,signal_count=excluded.signal_count,
    evidence=excluded.evidence,recommended_action=excluded.recommended_action,requires_executive_approval=excluded.requires_executive_approval,
    status=excluded.status,generated_at=now(),updated_at=now();
  get diagnostics step_count=row_count;affected:=affected+step_count;

  return affected;
end;
$$;

create or replace function public.adminos_rg11_prepare_drafts()
returns integer
language plpgsql security definer set search_path=public as $$
declare affected integer:=0;
begin
  insert into public.adminos_corporate_affairs_drafts(
    brief_id,draft_key,draft_type,title,body,risk_level,intended_audience,manual_publish_required,
    requires_executive_approval,approval_status,status,metadata,updated_at
  )
  select
    b.id,'holding-statement-service-reliability','holding_statement',
    'Prepared holding statement — service communications',
    'ResKonnect is reviewing a service-communication issue affecting some message deliveries. Students can continue using the ResKonnect portal while the issue is investigated. This draft must be checked against the latest incident facts, affected channels and recovery status before any publication.',
    b.risk_level,'public',true,true,'pending','draft',
    jsonb_build_object('automation_family','rg11','brief_key',b.brief_key,'signal_count',b.signal_count,'fact_check_required',true,'auto_publish',false),
    now()
  from public.adminos_corporate_affairs_briefs b
  where b.brief_key='service-reliability-current' and b.public_statement_recommended=true and b.status='open'
  on conflict(draft_key) do update set
    brief_id=excluded.brief_id,title=excluded.title,body=excluded.body,risk_level=excluded.risk_level,
    metadata=excluded.metadata,updated_at=now(),
    approval_status=case when adminos_corporate_affairs_drafts.body is distinct from excluded.body or adminos_corporate_affairs_drafts.risk_level is distinct from excluded.risk_level then 'pending' else adminos_corporate_affairs_drafts.approval_status end,
    status=case when adminos_corporate_affairs_drafts.body is distinct from excluded.body then 'draft' else adminos_corporate_affairs_drafts.status end;
  get diagnostics affected=row_count;
  return affected;
end;
$$;

create or replace function public.adminos_rg11_reputation_cycle()
returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  signals integer:=0;
  briefs integer:=0;
  drafts integer:=0;
  tasks integer:=0;
  rec record;
begin
  signals:=public.adminos_rg11_refresh_signals();
  briefs:=public.adminos_rg11_refresh_briefs();
  drafts:=public.adminos_rg11_prepare_drafts();

  update public.staff_tasks
  set status='completed',updated_at=now(),metadata=metadata||jsonb_build_object('rg11_rebuilt_at',now())
  where department_key='marketing_corporate_affairs'
    and status in ('open','in_progress','waiting')
    and coalesce(metadata->>'automation_family','')='rg11';

  for rec in
    select * from public.adminos_corporate_affairs_briefs
    where status='open' and risk_level in ('amber','red')
    order by case risk_level when 'red' then 1 else 2 end,signal_count desc
  loop
    insert into public.staff_tasks(
      title,description,source_table,source_id,priority,status,due_at,next_action,tags,metadata,department_key
    ) values(
      concat('Reputation brief: ',rec.headline),rec.summary,'adminos_corporate_affairs_briefs',rec.id,
      case when rec.risk_level='red' then 'urgent' else 'high' end,'open',
      now()+case when rec.risk_level='red' then interval '4 hours' else interval '24 hours' end,
      rec.recommended_action,array['rg11','corporate-affairs',rec.brief_type,rec.risk_level],
      jsonb_build_object('automation_family','rg11','brief_key',rec.brief_key,'risk_level',rec.risk_level,'signal_count',rec.signal_count,'public_statement_recommended',rec.public_statement_recommended),
      'marketing_corporate_affairs'
    );
    tasks:=tasks+1;
  end loop;

  return jsonb_build_object('signals_refreshed',signals,'briefs_refreshed',briefs,'drafts_prepared',drafts,'department_tasks',tasks,'run_at',now());
end;
$$;

revoke all on function public.adminos_rg11_reputation_cycle() from public,anon,authenticated;
grant execute on function public.adminos_rg11_reputation_cycle() to service_role;

create or replace function public.adminos_approve_corporate_affairs_draft(p_id uuid,p_approve boolean default true)
returns void
language plpgsql security definer set search_path=public set row_security=off as $$
begin
  if auth.uid() is null or not public.has_admin_department_access('executive') then
    raise exception 'Executive approval required' using errcode='42501';
  end if;
  update public.adminos_corporate_affairs_drafts
  set approval_status=case when p_approve then 'approved' else 'rejected' end,
      approved_by=auth.uid(),approved_at=now(),
      status=case when p_approve then 'ready' else 'dismissed' end,updated_at=now()
  where id=p_id;
end;
$$;
revoke all on function public.adminos_approve_corporate_affairs_draft(uuid,boolean) from public,anon;
grant execute on function public.adminos_approve_corporate_affairs_draft(uuid,boolean) to authenticated;

create or replace function public.adminos_approve_site_announcement(p_id uuid,p_approve boolean default true,p_activate boolean default false)
returns void
language plpgsql security definer set search_path=public set row_security=off as $$
begin
  if auth.uid() is null or not public.has_admin_department_access('executive') then
    raise exception 'Executive approval required' using errcode='42501';
  end if;

  if p_approve then
    update public.site_announcements
    set approval_status='approved',approved_by=auth.uid(),approved_at=now(),
        is_active=case when p_activate then true else is_active end,updated_at=now()
    where id=p_id;
  else
    update public.site_announcements
    set approval_status='rejected',approved_by=auth.uid(),approved_at=now(),is_active=false,updated_at=now()
    where id=p_id;
  end if;
end;
$$;
revoke all on function public.adminos_approve_site_announcement(uuid,boolean,boolean) from public,anon;
grant execute on function public.adminos_approve_site_announcement(uuid,boolean,boolean) to authenticated;

create or replace function public.adminos_run_rg11_now()
returns jsonb
language plpgsql security definer set search_path=public set row_security=off as $$
begin
  if auth.uid() is null or not (
    public.has_admin_department_access('marketing_corporate_affairs')
    or public.has_admin_department_access('executive')
  ) then
    raise exception 'Corporate Affairs or Executive access required' using errcode='42501';
  end if;
  return public.adminos_rg11_reputation_cycle();
end;
$$;
revoke all on function public.adminos_run_rg11_now() from public,anon;
grant execute on function public.adminos_run_rg11_now() to authenticated;

insert into public.adminos_agent_config(agent_key,display_name,enabled,authority_level,confidence_threshold,config)
values(
  'corporate_affairs_agent','Corporate Affairs & Reputation Agent',true,'green',0.98,
  jsonb_build_object(
    'release_gate',11,'reputation_radar',true,'service_recovery_signals',true,'customer_feedback_signals',true,
    'complaint_signals',true,'review_signals',true,'social_sentiment_inference',false,
    'pr_drafts',true,'manual_publish_required',true,'auto_publish',false,
    'partnership_announcements','executive_approval','government_statements','executive_approval',
    'legal_or_crisis_statements','executive_approval','pricing_announcements','executive_approval'
  )
)
on conflict(agent_key) do update set display_name=excluded.display_name,enabled=true,authority_level='green',
  confidence_threshold=excluded.confidence_threshold,config=excluded.config,updated_at=now();

do $$
declare j record;
begin
  for j in select jobid from cron.job where jobname='adminos-rg11-reputation' loop
    perform cron.unschedule(j.jobid);
  end loop;
  perform cron.schedule('adminos-rg11-reputation','*/15 * * * *',$job$select public.adminos_rg11_reputation_cycle();$job$);
end $$;

select public.adminos_rg11_reputation_cycle();
