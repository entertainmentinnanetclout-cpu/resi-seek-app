-- AgentOS RG10 — Partnerships Automation
-- Syncs partner leads into AdminOS CRM, scores lead/relationship health,
-- prepares follow-up drafts, and creates department exceptions.
-- External partnership messages are never auto-sent.

create unique index if not exists uq_adminos_prospects_source
  on public.adminos_prospects(source_type,source_id)
  where source_id is not null;

create unique index if not exists uq_adminos_organizations_lower_name
  on public.adminos_organizations(lower(name))
  where nullif(trim(name),'') is not null;

create table if not exists public.adminos_partnership_lead_intelligence (
  id uuid primary key default gen_random_uuid(),
  partner_lead_id uuid not null unique references public.partner_leads(id) on delete cascade,
  contact_id uuid references public.adminos_contacts(id) on delete set null,
  organization_id uuid references public.adminos_organizations(id) on delete set null,
  prospect_id uuid references public.adminos_prospects(id) on delete set null,
  lead_type text not null,
  source_status text not null,
  lead_score integer not null default 0 check (lead_score between 0 and 100),
  qualification_band text not null default 'cold' check (qualification_band in ('cold','warm','hot','converted','closed')),
  automation_state text not null default 'follow_up' check (automation_state in ('follow_up','qualified','executive_review','converted','closed')),
  next_best_action text,
  priority integer not null default 50 check (priority between 0 and 100),
  stale_days integer not null default 0,
  consent_ready boolean not null default false,
  last_activity_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now()
);

create index if not exists idx_partnership_lead_intelligence_state
  on public.adminos_partnership_lead_intelligence(automation_state,priority desc,lead_score desc);

alter table public.adminos_partnership_lead_intelligence enable row level security;
drop policy if exists partnership_lead_intel_department_read on public.adminos_partnership_lead_intelligence;
create policy partnership_lead_intel_department_read
on public.adminos_partnership_lead_intelligence for select to authenticated
using (
  public.has_admin_department_access('partnerships_engagements')
  or public.has_admin_department_access('executive')
  or public.has_admin_department_access('intelligence_analytics')
);
revoke insert,update,delete on public.adminos_partnership_lead_intelligence from authenticated,anon;
grant select on public.adminos_partnership_lead_intelligence to authenticated;

create table if not exists public.adminos_partnership_relationship_health (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null unique references public.partnerships(id) on delete cascade,
  relationship_score integer not null default 0 check (relationship_score between 0 and 100),
  health_band text not null default 'new' check (health_band in ('new','healthy','attention','stale','paused','closed')),
  automation_state text not null default 'monitor' check (automation_state in ('monitor','follow_up','executive_review','closed')),
  attributed_users integer not null default 0,
  conversions_30d integer not null default 0,
  value_30d numeric not null default 0,
  last_conversion_at timestamptz,
  last_attribution_at timestamptz,
  last_activity_at timestamptz,
  days_since_activity integer not null default 0,
  next_best_action text,
  priority integer not null default 50 check (priority between 0 and 100),
  metadata jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now()
);

create index if not exists idx_partnership_relationship_health
  on public.adminos_partnership_relationship_health(automation_state,priority desc,relationship_score);

alter table public.adminos_partnership_relationship_health enable row level security;
drop policy if exists partnership_health_department_read on public.adminos_partnership_relationship_health;
create policy partnership_health_department_read
on public.adminos_partnership_relationship_health for select to authenticated
using (
  public.has_admin_department_access('partnerships_engagements')
  or public.has_admin_department_access('executive')
  or public.has_admin_department_access('intelligence_analytics')
);
revoke insert,update,delete on public.adminos_partnership_relationship_health from authenticated,anon;
grant select on public.adminos_partnership_relationship_health to authenticated;

create table if not exists public.adminos_partnership_followup_drafts (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('partner_lead','partnership')),
  source_id uuid not null,
  contact_id uuid references public.adminos_contacts(id) on delete set null,
  purpose text not null,
  channel text not null default 'email' check (channel in ('email','whatsapp','internal')),
  subject text,
  body text not null,
  risk_level text not null default 'amber' check (risk_level in ('green','amber','red')),
  requires_executive_approval boolean not null default true,
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected','not_required')),
  approved_by uuid,
  approved_at timestamptz,
  status text not null default 'draft' check (status in ('draft','ready','used','dismissed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_type,source_id,purpose)
);

alter table public.adminos_partnership_followup_drafts enable row level security;
drop policy if exists partnership_drafts_department_read on public.adminos_partnership_followup_drafts;
create policy partnership_drafts_department_read
on public.adminos_partnership_followup_drafts for select to authenticated
using (
  public.has_admin_department_access('partnerships_engagements')
  or public.has_admin_department_access('executive')
);
revoke insert,update,delete on public.adminos_partnership_followup_drafts from authenticated,anon;
grant select on public.adminos_partnership_followup_drafts to authenticated;

create or replace function public.adminos_rg10_sync_partner_lead(p_id uuid)
returns public.adminos_partnership_lead_intelligence
language plpgsql security definer set search_path=public as $$
declare
  l public.partner_leads%rowtype;
  v_contact uuid;
  v_org uuid;
  v_prospect uuid;
  v_score integer:=0;
  v_stale integer:=0;
  v_band text;
  v_state text;
  v_action text;
  v_priority integer:=50;
  v_consent boolean:=false;
  result public.adminos_partnership_lead_intelligence%rowtype;
begin
  select * into l from public.partner_leads where id=p_id;
  if l.id is null then return null; end if;

  v_contact:=public.adminos_resolve_contact(
    l.contact_name,l.contact_email,coalesce(l.whatsapp_number,l.contact_phone),l.user_id,
    'partner_lead',l.id,jsonb_build_object('lead_type',l.lead_type,'organisation_name',l.organisation_name,'area',l.area)
  );

  if nullif(trim(coalesce(l.organisation_name,'')),'') is not null then
    select id into v_org from public.adminos_organizations where lower(name)=lower(trim(l.organisation_name)) limit 1;
    if v_org is null then
      insert into public.adminos_organizations(name,organization_type,status,email,phone,metadata)
      values(trim(l.organisation_name),coalesce(nullif(l.lead_type,''),'partner'),'active',l.contact_email,coalesce(l.whatsapp_number,l.contact_phone),
        jsonb_build_object('source','partner_leads','partner_lead_id',l.id))
      returning id into v_org;
    else
      update public.adminos_organizations
      set email=coalesce(nullif(l.contact_email,''),email),
          phone=coalesce(nullif(coalesce(l.whatsapp_number,l.contact_phone),''),phone),
          updated_at=now()
      where id=v_org;
    end if;
    if v_contact is not null then
      insert into public.adminos_organization_contacts(organization_id,contact_id,is_primary,metadata)
      values(v_org,v_contact,true,jsonb_build_object('source','partner_lead'))
      on conflict(organization_id,contact_id) do update set is_primary=true;
    end if;
  end if;

  insert into public.adminos_prospects(
    contact_id,organization_id,source_type,source_id,pipeline,stage,priority,owner_id,next_action,next_action_at,metadata
  ) values(
    v_contact,v_org,'partner_lead',l.id,'partnerships',l.status,l.priority,l.assigned_staff_id,
    case
      when l.status='new' then 'Qualify partnership need'
      when l.status='contacted' then 'Review response and define next step'
      when l.status='qualified' then 'Prepare partnership proposal'
      when l.status='proposal_sent' then 'Track proposal response'
      else null
    end,
    case when l.status in ('converted','closed','cancelled') then null else now()+interval '24 hours' end,
    jsonb_build_object('lead_type',l.lead_type,'organisation_name',l.organisation_name,'area',l.area,'consent_to_be_contacted',l.consent_to_be_contacted,'popia_consent',l.popia_consent)
  )
  on conflict(source_type,source_id) where source_id is not null do update set
    contact_id=excluded.contact_id,organization_id=excluded.organization_id,pipeline='partnerships',stage=excluded.stage,
    priority=excluded.priority,owner_id=excluded.owner_id,next_action=excluded.next_action,next_action_at=excluded.next_action_at,
    metadata=adminos_prospects.metadata||excluded.metadata,updated_at=now()
  returning id into v_prospect;

  v_stale:=greatest(0,floor(extract(epoch from (now()-coalesce(l.updated_at,l.created_at)))/86400)::integer);
  v_consent:=coalesce(l.consent_to_be_contacted,false) and coalesce(l.popia_consent,false);

  if nullif(trim(l.contact_name),'') is not null then v_score:=v_score+15; end if;
  if nullif(trim(coalesce(l.contact_email,l.whatsapp_number,l.contact_phone,'')),'') is not null then v_score:=v_score+15; end if;
  if nullif(trim(coalesce(l.organisation_name,'')),'') is not null then v_score:=v_score+15; end if;
  if v_consent then v_score:=v_score+15; end if;
  v_score:=v_score+case l.status
    when 'new' then 5 when 'contacted' then 15 when 'qualified' then 25 when 'proposal_sent' then 30 when 'converted' then 40 else 0 end;
  v_score:=v_score+case when v_stale<=2 then 10 when v_stale<=7 then 5 else 0 end;
  if l.priority in ('high','urgent') then v_score:=v_score+5; end if;
  v_score:=least(100,v_score);

  if l.status='converted' then
    v_band:='converted';v_state:='converted';v_action:='Partnership converted — complete onboarding and governance';v_priority:=60;
  elsif l.status in ('closed','cancelled') then
    v_band:='closed';v_state:='closed';v_action:='Lead closed';v_priority:=20;
  elsif l.status='qualified' or l.status='proposal_sent' then
    v_band:=case when v_score>=75 then 'hot' else 'warm' end;
    v_state:=case when l.status='proposal_sent' then 'executive_review' else 'qualified' end;
    v_action:=case when l.status='proposal_sent' then 'Track proposal response; contractual commitments require Executive approval' else 'Prepare a factual partnership proposal for Executive approval' end;
    v_priority:=case when v_stale>=7 then 90 else 75 end;
  elsif v_stale>=7 then
    v_band:=case when v_score>=60 then 'warm' else 'cold' end;
    v_state:='follow_up';v_action:='Partnership lead is stale — schedule a factual follow-up';v_priority:=case when v_stale>=14 then 90 else 75 end;
  else
    v_band:=case when v_score>=75 then 'hot' when v_score>=50 then 'warm' else 'cold' end;
    v_state:='follow_up';
    v_action:=case when l.status='new' then 'Qualify goals, authority, timeline and fit' else 'Continue the next partnership step' end;
    v_priority:=case when l.priority='urgent' then 90 when l.priority='high' then 80 else 60 end;
  end if;

  insert into public.adminos_partnership_lead_intelligence(
    partner_lead_id,contact_id,organization_id,prospect_id,lead_type,source_status,lead_score,
    qualification_band,automation_state,next_best_action,priority,stale_days,consent_ready,last_activity_at,metadata,calculated_at
  ) values(
    l.id,v_contact,v_org,v_prospect,l.lead_type,l.status,v_score,v_band,v_state,v_action,v_priority,v_stale,v_consent,
    coalesce(l.updated_at,l.created_at),jsonb_build_object('organisation_name',l.organisation_name,'area',l.area,'source_priority',l.priority),now()
  )
  on conflict(partner_lead_id) do update set
    contact_id=excluded.contact_id,organization_id=excluded.organization_id,prospect_id=excluded.prospect_id,
    lead_type=excluded.lead_type,source_status=excluded.source_status,lead_score=excluded.lead_score,
    qualification_band=excluded.qualification_band,automation_state=excluded.automation_state,
    next_best_action=excluded.next_best_action,priority=excluded.priority,stale_days=excluded.stale_days,
    consent_ready=excluded.consent_ready,last_activity_at=excluded.last_activity_at,metadata=excluded.metadata,calculated_at=now()
  returning * into result;

  return result;
end;
$$;

create or replace function public.adminos_rg10_partner_lead_trigger()
returns trigger
language plpgsql security definer set search_path=public as $$
begin
  perform public.adminos_rg10_sync_partner_lead(new.id);
  return new;
end;
$$;

drop trigger if exists trg_rg10_partner_lead_sync on public.partner_leads;
create trigger trg_rg10_partner_lead_sync
after insert or update on public.partner_leads
for each row execute function public.adminos_rg10_partner_lead_trigger();

-- Replace the old generic task trigger: RG10 cycle owns deduplicated department work.
create or replace function public.rk_create_partner_lead_operations()
returns trigger
language plpgsql security definer set search_path=public as $$
begin
  return new;
end;
$$;

create or replace function public.adminos_rg10_refresh_relationships()
returns integer
language plpgsql security definer set search_path=public as $$
declare affected integer:=0;
begin
  with agg as (
    select p.id partner_id,
      count(distinct a.user_id)::integer attributed_users,
      count(e.id) filter(where e.created_at>=now()-interval '30 days')::integer conversions_30d,
      coalesce(sum(e.value) filter(where e.created_at>=now()-interval '30 days'),0)::numeric value_30d,
      max(e.created_at) last_conversion_at,
      max(a.last_attributed_at) last_attribution_at
    from public.partnerships p
    left join public.partnership_attributions a on a.partner_id=p.id
    left join public.partnership_conversion_events e on e.partner_id=p.id
    group by p.id
  ),
  calc as (
    select p.*,coalesce(a.attributed_users,0) attributed_users,coalesce(a.conversions_30d,0) conversions_30d,
      coalesce(a.value_30d,0) value_30d,a.last_conversion_at,a.last_attribution_at,
      greatest(p.updated_at,coalesce(a.last_conversion_at,'1970-01-01'::timestamptz),coalesce(a.last_attribution_at,'1970-01-01'::timestamptz)) last_activity_at
    from public.partnerships p left join agg a on a.partner_id=p.id
  )
  insert into public.adminos_partnership_relationship_health(
    partner_id,relationship_score,health_band,automation_state,attributed_users,conversions_30d,value_30d,
    last_conversion_at,last_attribution_at,last_activity_at,days_since_activity,next_best_action,priority,metadata,calculated_at
  )
  select
    c.id,
    least(100,
      (case when c.status='active' then 25 when c.status='prospect' then 10 else 0 end)+
      (case when nullif(trim(coalesce(c.conversion_goal,'')),'') is not null then 15 else 0 end)+
      least(20,c.attributed_users*5)+
      least(25,c.conversions_30d*5)+
      (case when c.last_activity_at>=now()-interval '14 days' then 15 when c.last_activity_at>=now()-interval '30 days' then 8 else 0 end)
    ),
    case
      when c.status='ended' then 'closed'
      when c.status='paused' then 'paused'
      when c.status='prospect' then 'new'
      when c.last_activity_at<now()-interval '60 days' then 'stale'
      when c.last_activity_at<now()-interval '30 days' or c.conversions_30d=0 then 'attention'
      else 'healthy'
    end,
    case
      when c.status='ended' then 'closed'
      when c.status='paused' then 'executive_review'
      when c.status='prospect' then 'follow_up'
      when c.last_activity_at<now()-interval '30 days' or c.conversions_30d=0 then 'follow_up'
      else 'monitor'
    end,
    c.attributed_users,c.conversions_30d,c.value_30d,c.last_conversion_at,c.last_attribution_at,c.last_activity_at,
    greatest(0,floor(extract(epoch from (now()-c.last_activity_at))/86400)::integer),
    case
      when c.status='ended' then 'Relationship closed'
      when c.status='paused' then 'Executive review required before reactivation'
      when nullif(trim(coalesce(c.conversion_goal,'')),'') is null then 'Define a measurable partnership conversion goal'
      when c.attributed_users=0 then 'Validate partner attribution link and activation plan'
      when c.last_activity_at<now()-interval '30 days' then 'Prepare a partnership check-in for Executive approval'
      when c.conversions_30d=0 then 'Review partner activation plan and next engagement'
      else 'Maintain relationship and monitor outcomes'
    end,
    case
      when c.status='paused' then 90
      when c.last_activity_at<now()-interval '60 days' then 85
      when c.attributed_users=0 or c.conversions_30d=0 then 75
      else 40
    end,
    jsonb_build_object('partner_name',c.name,'partnership_type',c.partnership_type,'visibility',c.visibility,'public_path',c.public_path,'conversion_goal',c.conversion_goal),
    now()
  from calc c
  on conflict(partner_id) do update set
    relationship_score=excluded.relationship_score,health_band=excluded.health_band,automation_state=excluded.automation_state,
    attributed_users=excluded.attributed_users,conversions_30d=excluded.conversions_30d,value_30d=excluded.value_30d,
    last_conversion_at=excluded.last_conversion_at,last_attribution_at=excluded.last_attribution_at,last_activity_at=excluded.last_activity_at,
    days_since_activity=excluded.days_since_activity,next_best_action=excluded.next_best_action,priority=excluded.priority,
    metadata=excluded.metadata,calculated_at=now();

  get diagnostics affected=row_count;
  return affected;
end;
$$;

create or replace function public.adminos_rg10_prepare_drafts()
returns integer
language plpgsql security definer set search_path=public as $$
declare affected integer:=0; step_count integer:=0;
begin
  insert into public.adminos_partnership_followup_drafts(
    source_type,source_id,contact_id,purpose,channel,subject,body,risk_level,requires_executive_approval,approval_status,status,metadata
  )
  select
    'partner_lead',l.id,i.contact_id,
    case when l.status='new' then 'qualification_followup' when l.status='qualified' then 'proposal_preparation' else 'relationship_followup' end,
    case when nullif(trim(coalesce(l.contact_email,'')),'') is not null then 'email' else 'whatsapp' end,
    case when l.status='new' then 'ResKonnect partnership enquiry' when l.status='qualified' then 'ResKonnect partnership next steps' else 'ResKonnect partnership follow-up' end,
    case
      when l.status='new' then concat('Thank you for your interest in working with ResKonnect. We would like to understand ',coalesce(l.organisation_name,'your organisation'),'''s goals, scope and timeline so we can assess fit and prepare the correct next step.')
      when l.status='qualified' then concat('We have reviewed the initial partnership requirements for ',coalesce(l.organisation_name,'your organisation'),'. The next step is to confirm scope, responsibilities, measurable outcomes and any commercial or institutional terms before anything is committed.')
      else concat('We are following up on the ResKonnect partnership conversation with ',coalesce(l.organisation_name,'your organisation'),'. Please confirm the current status and the most useful next step.')
    end,
    'amber',true,'pending','draft',
    jsonb_build_object('automation_family','rg10','lead_status',l.status,'lead_score',i.lead_score,'no_auto_send',true)
  from public.partner_leads l
  join public.adminos_partnership_lead_intelligence i on i.partner_lead_id=l.id
  where i.automation_state in ('follow_up','qualified','executive_review') and l.status not in ('converted','closed','cancelled')
  on conflict(source_type,source_id,purpose) do update set
    contact_id=excluded.contact_id,channel=excluded.channel,subject=excluded.subject,body=excluded.body,
    risk_level='amber',requires_executive_approval=true,metadata=excluded.metadata,updated_at=now(),
    approval_status=case when adminos_partnership_followup_drafts.body is distinct from excluded.body then 'pending' else adminos_partnership_followup_drafts.approval_status end;

  get diagnostics affected=row_count;

  insert into public.adminos_partnership_followup_drafts(
    source_type,source_id,purpose,channel,subject,body,risk_level,requires_executive_approval,approval_status,status,metadata
  )
  select
    'partnership',p.id,'relationship_checkin','email',
    concat('Partnership check-in · ',p.name),
    concat('This is a prepared relationship check-in for ',p.name,'. Confirm current objectives, activity, attribution and the next measurable outcome before sending. No contract, pricing, exclusivity or institutional commitment is authorised by this draft.'),
    'amber',true,'pending','draft',
    jsonb_build_object('automation_family','rg10','relationship_score',h.relationship_score,'health_band',h.health_band,'next_best_action',h.next_best_action,'no_auto_send',true)
  from public.partnerships p
  join public.adminos_partnership_relationship_health h on h.partner_id=p.id
  where h.automation_state in ('follow_up','executive_review') and p.status<>'ended'
  on conflict(source_type,source_id,purpose) do update set
    subject=excluded.subject,body=excluded.body,risk_level='amber',requires_executive_approval=true,
    metadata=excluded.metadata,updated_at=now(),
    approval_status=case when adminos_partnership_followup_drafts.body is distinct from excluded.body then 'pending' else adminos_partnership_followup_drafts.approval_status end;

  get diagnostics step_count=row_count;
  return affected+step_count;
end;
$$;

create or replace function public.adminos_rg10_partnerships_cycle()
returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  rec record;
  leads integer:=0;
  relationships integer:=0;
  drafts integer:=0;
  tasks integer:=0;
begin
  for rec in select id from public.partner_leads loop
    perform public.adminos_rg10_sync_partner_lead(rec.id);
    leads:=leads+1;
  end loop;

  relationships:=public.adminos_rg10_refresh_relationships();
  drafts:=public.adminos_rg10_prepare_drafts();

  update public.staff_tasks
  set status='completed',updated_at=now(),metadata=metadata||jsonb_build_object('rg10_rebuilt_at',now())
  where department_key='partnerships_engagements'
    and status in ('open','in_progress','waiting')
    and coalesce(metadata->>'automation_family','')='rg10';

  for rec in
    select i.*,l.organisation_name,l.contact_name
    from public.adminos_partnership_lead_intelligence i
    join public.partner_leads l on l.id=i.partner_lead_id
    where i.automation_state in ('follow_up','qualified','executive_review')
    order by i.priority desc,i.lead_score desc
    limit 50
  loop
    insert into public.staff_tasks(
      title,description,source_table,source_id,priority,status,due_at,next_action,contact_name,tags,metadata,department_key
    ) values(
      concat('Partner lead: ',coalesce(rec.organisation_name,rec.lead_type)),
      concat(rec.source_status,' · score ',rec.lead_score,'/100 · stale ',rec.stale_days,' day(s)'),
      'adminos_partnership_lead_intelligence',rec.id,
      case when rec.priority>=90 then 'urgent' when rec.priority>=75 then 'high' else 'normal' end,
      'open',now()+case when rec.priority>=90 then interval '4 hours' else interval '24 hours' end,
      rec.next_best_action,rec.contact_name,array['rg10','partnerships','lead',rec.lead_type],
      jsonb_build_object('automation_family','rg10','partner_lead_id',rec.partner_lead_id,'lead_score',rec.lead_score,'automation_state',rec.automation_state),
      'partnerships_engagements'
    );
    tasks:=tasks+1;
  end loop;

  for rec in
    select h.*,p.name,p.partnership_type
    from public.adminos_partnership_relationship_health h join public.partnerships p on p.id=h.partner_id
    where h.automation_state in ('follow_up','executive_review')
    order by h.priority desc,h.days_since_activity desc
    limit 30
  loop
    insert into public.staff_tasks(
      title,description,source_table,source_id,priority,status,due_at,next_action,tags,metadata,department_key
    ) values(
      concat('Partnership health: ',rec.name),
      concat(rec.health_band,' · relationship score ',rec.relationship_score,'/100 · ',rec.days_since_activity,' day(s) since activity'),
      'adminos_partnership_relationship_health',rec.id,
      case when rec.priority>=90 then 'urgent' when rec.priority>=75 then 'high' else 'normal' end,
      'open',now()+case when rec.priority>=90 then interval '8 hours' else interval '48 hours' end,
      rec.next_best_action,array['rg10','partnerships','relationship',rec.health_band],
      jsonb_build_object('automation_family','rg10','partner_id',rec.partner_id,'relationship_score',rec.relationship_score,'health_band',rec.health_band,'partnership_type',rec.partnership_type),
      'partnerships_engagements'
    );
    tasks:=tasks+1;
  end loop;

  return jsonb_build_object('partner_leads_synced',leads,'relationships_refreshed',relationships,'followup_drafts',drafts,'department_tasks',tasks,'run_at',now());
end;
$$;

revoke all on function public.adminos_rg10_partnerships_cycle() from public,anon,authenticated;
grant execute on function public.adminos_rg10_partnerships_cycle() to service_role;

create or replace function public.adminos_approve_partnership_draft(p_id uuid,p_approve boolean default true)
returns void
language plpgsql security definer set search_path=public set row_security=off as $$
begin
  if auth.uid() is null or not public.has_admin_department_access('executive') then
    raise exception 'Executive approval required' using errcode='42501';
  end if;
  update public.adminos_partnership_followup_drafts
  set approval_status=case when p_approve then 'approved' else 'rejected' end,
      approved_by=auth.uid(),approved_at=now(),
      status=case when p_approve then 'ready' else 'dismissed' end,updated_at=now()
  where id=p_id;
end;
$$;
revoke all on function public.adminos_approve_partnership_draft(uuid,boolean) from public,anon;
grant execute on function public.adminos_approve_partnership_draft(uuid,boolean) to authenticated;

create or replace function public.adminos_run_rg10_now()
returns jsonb
language plpgsql security definer set search_path=public set row_security=off as $$
begin
  if auth.uid() is null or not (
    public.has_admin_department_access('partnerships_engagements')
    or public.has_admin_department_access('executive')
  ) then
    raise exception 'Partnerships or Executive access required' using errcode='42501';
  end if;
  return public.adminos_rg10_partnerships_cycle();
end;
$$;
revoke all on function public.adminos_run_rg10_now() from public,anon;
grant execute on function public.adminos_run_rg10_now() to authenticated;

insert into public.adminos_agent_config(agent_key,display_name,enabled,authority_level,confidence_threshold,config)
values(
  'partnerships_agent','Partnerships & Engagements Agent',true,'green',0.97,
  jsonb_build_object(
    'release_gate',10,'crm_sync',true,'relationship_health',true,'followup_drafts',true,
    'auto_send_external_messages',false,'contracts','human_only','commercial_terms','human_only',
    'institutional_commitments','human_only','public_announcements','human_only','executive_approval_for_external_drafts',true
  )
)
on conflict(agent_key) do update set display_name=excluded.display_name,enabled=true,authority_level='green',
  confidence_threshold=excluded.confidence_threshold,config=excluded.config,updated_at=now();

do $$
declare j record;
begin
  for j in select jobid from cron.job where jobname='adminos-rg10-partnerships' loop
    perform cron.unschedule(j.jobid);
  end loop;
  perform cron.schedule('adminos-rg10-partnerships','*/30 * * * *',$job$select public.adminos_rg10_partnerships_cycle();$job$);
end $$;

select public.adminos_rg10_partnerships_cycle();
