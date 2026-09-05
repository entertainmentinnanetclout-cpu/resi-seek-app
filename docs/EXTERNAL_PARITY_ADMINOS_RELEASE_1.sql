-- ResKonnect AdminOS Release 1 — Phases 0, 1 and 2
-- Production source of truth: External Supabase project mefjzkhobkltlbmhusdh
-- Safe/idempotent migration: governance foundation, unified CRM identity, workflow engine.

create extension if not exists pgcrypto;

-- ============================================================
-- PHASE 0 — GOVERNANCE, AUDIT, APPROVALS, INTEGRATION CONTROL
-- ============================================================

create or replace function public.adminos_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and public.get_user_staff_role(auth.uid()) is not null;
$$;

create or replace function public.adminos_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role::text in ('admin','super_admin','owner','developer','system_operator')
  );
$$;

create or replace function public.adminos_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.adminos_agent_config (
  id uuid primary key default gen_random_uuid(),
  agent_key text not null unique,
  display_name text not null,
  enabled boolean not null default false,
  authority_level text not null default 'green' check (authority_level in ('green','amber','red')),
  confidence_threshold numeric(4,3) not null default 0.920,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.adminos_agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_key text not null,
  trigger_type text not null,
  trigger_id uuid,
  status text not null default 'running' check (status in ('running','succeeded','failed','cancelled','awaiting_approval')),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.adminos_agent_actions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.adminos_agent_runs(id) on delete cascade,
  agent_key text not null,
  action_type text not null,
  entity_type text,
  entity_id uuid,
  authority_level text not null default 'green' check (authority_level in ('green','amber','red')),
  confidence numeric(4,3),
  reason text,
  tool_name text,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  status text not null default 'planned' check (status in ('planned','executed','blocked','failed','awaiting_approval')),
  executed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.adminos_agent_errors (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.adminos_agent_runs(id) on delete set null,
  action_id uuid references public.adminos_agent_actions(id) on delete set null,
  error_code text,
  error_message text not null,
  context jsonb not null default '{}'::jsonb,
  retryable boolean not null default false,
  resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.adminos_approval_requests (
  id uuid primary key default gen_random_uuid(),
  request_type text not null,
  title text not null,
  summary text,
  entity_type text,
  entity_id uuid,
  requested_action jsonb not null default '{}'::jsonb,
  risk_level text not null default 'amber' check (risk_level in ('amber','red')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired','cancelled')),
  requested_by_type text not null default 'system',
  requested_by_id uuid,
  expires_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.adminos_approval_actions (
  id uuid primary key default gen_random_uuid(),
  approval_id uuid not null references public.adminos_approval_requests(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('created','approved','rejected','edited','expired','cancelled')),
  note text,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.adminos_integration_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique,
  display_name text not null,
  status text not null default 'not_connected' check (status in ('not_connected','connected','needs_action','error','disabled')),
  enabled boolean not null default false,
  setup_step integer not null default 1 check (setup_step between 1 and 3),
  external_account_label text,
  config jsonb not null default '{}'::jsonb,
  secret_refs jsonb not null default '{}'::jsonb,
  setup_url text,
  docs_url text,
  last_tested_at timestamptz,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.adminos_integration_health (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.adminos_integration_connections(id) on delete cascade,
  check_type text not null,
  status text not null check (status in ('healthy','warning','error')),
  latency_ms integer,
  detail jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);

create table if not exists public.adminos_knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  title text not null,
  source_type text not null default 'internal',
  visibility text not null default 'internal' check (visibility in ('public','internal','restricted')),
  status text not null default 'active' check (status in ('draft','active','expired','archived')),
  valid_from timestamptz,
  valid_until timestamptz,
  source_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.adminos_knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.adminos_knowledge_sources(id) on delete cascade,
  knowledge_key text not null,
  title text not null,
  content text not null,
  structured_data jsonb not null default '{}'::jsonb,
  confidence numeric(4,3) not null default 1.000,
  requires_human_confirmation boolean not null default false,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_id, knowledge_key)
);

create table if not exists public.adminos_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null default 'system',
  actor_id uuid,
  action text not null,
  entity_type text,
  entity_id uuid,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  request_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.adminos_consents (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid,
  purpose text not null,
  channel text,
  status text not null check (status in ('granted','withdrawn','not_required','unknown')),
  source text,
  evidence jsonb not null default '{}'::jsonb,
  granted_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.adminos_communication_preferences (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid,
  email_allowed boolean not null default true,
  whatsapp_allowed boolean not null default true,
  sms_allowed boolean not null default true,
  voice_allowed boolean not null default true,
  marketing_allowed boolean not null default false,
  do_not_contact boolean not null default false,
  preferred_channel text,
  quiet_hours jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- PHASE 1 — UNIFIED CRM / IDENTITY
-- ============================================================

create table if not exists public.adminos_contacts (
  id uuid primary key default gen_random_uuid(),
  profile_user_id uuid unique references public.profiles(id) on delete set null,
  identity_key text unique,
  contact_type text not null default 'person' check (contact_type in ('person','student','partner','staff','prospect','other')),
  full_name text,
  email text,
  phone text,
  student_number text,
  campus text,
  status text not null default 'active' check (status in ('active','inactive','blocked','merged')),
  primary_source text,
  merged_into_id uuid references public.adminos_contacts(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.adminos_contact_channels (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.adminos_contacts(id) on delete cascade,
  channel text not null check (channel in ('email','phone','whatsapp','sms','app','other')),
  address text not null,
  normalized_address text not null,
  is_primary boolean not null default false,
  verified boolean not null default false,
  can_contact boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(contact_id, channel, normalized_address)
);
create index if not exists idx_adminos_contact_channels_lookup on public.adminos_contact_channels(channel, normalized_address);

create table if not exists public.adminos_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization_type text not null default 'partner',
  status text not null default 'active',
  email text,
  phone text,
  website text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_adminos_org_name on public.adminos_organizations(lower(name));

create table if not exists public.adminos_organization_contacts (
  organization_id uuid not null references public.adminos_organizations(id) on delete cascade,
  contact_id uuid not null references public.adminos_contacts(id) on delete cascade,
  role_title text,
  is_primary boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (organization_id, contact_id)
);

create table if not exists public.adminos_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text,
  created_at timestamptz not null default now()
);

create table if not exists public.adminos_contact_tags (
  contact_id uuid not null references public.adminos_contacts(id) on delete cascade,
  tag_id uuid not null references public.adminos_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(contact_id, tag_id)
);

create table if not exists public.adminos_prospects (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.adminos_contacts(id) on delete cascade,
  organization_id uuid references public.adminos_organizations(id) on delete set null,
  source_type text,
  source_id uuid,
  pipeline text not null default 'general',
  stage text not null default 'new',
  score numeric(6,2) not null default 0,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  owner_id uuid references auth.users(id) on delete set null,
  next_action text,
  next_action_at timestamptz,
  last_contacted_at timestamptz,
  closed_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_adminos_prospect_source on public.adminos_prospects(source_type, source_id) where source_id is not null;
create index if not exists idx_adminos_prospects_stage on public.adminos_prospects(pipeline, stage, next_action_at);

create table if not exists public.adminos_lead_scores (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.adminos_prospects(id) on delete cascade,
  score_delta numeric(6,2) not null,
  reason text not null,
  rule_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.adminos_consents
  add constraint adminos_consents_contact_fk foreign key (contact_id) references public.adminos_contacts(id) on delete cascade not valid;
alter table public.adminos_consents validate constraint adminos_consents_contact_fk;
alter table public.adminos_communication_preferences
  add constraint adminos_comm_prefs_contact_fk foreign key (contact_id) references public.adminos_contacts(id) on delete cascade not valid;
alter table public.adminos_communication_preferences validate constraint adminos_comm_prefs_contact_fk;
create unique index if not exists uq_adminos_comm_prefs_contact on public.adminos_communication_preferences(contact_id);

create or replace function public.adminos_resolve_contact(
  p_full_name text default null,
  p_email text default null,
  p_phone text default null,
  p_profile_user_id uuid default null,
  p_source_type text default null,
  p_source_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_email text := nullif(lower(trim(p_email)), '');
  v_phone text := nullif(regexp_replace(coalesce(p_phone,''), '\D', '', 'g'), '');
  v_identity text;
begin
  if p_profile_user_id is not null then
    select id into v_id from public.adminos_contacts where profile_user_id = p_profile_user_id limit 1;
  end if;

  if v_id is null and v_email is not null then
    select contact_id into v_id from public.adminos_contact_channels
    where channel='email' and normalized_address=v_email limit 1;
  end if;

  if v_id is null and v_phone is not null then
    select contact_id into v_id from public.adminos_contact_channels
    where channel in ('phone','whatsapp','sms') and normalized_address=v_phone limit 1;
  end if;

  if p_profile_user_id is not null then
    v_identity := 'profile:' || p_profile_user_id::text;
  elsif p_source_type is not null and p_source_id is not null then
    v_identity := p_source_type || ':' || p_source_id::text;
  else
    v_identity := 'contact:' || gen_random_uuid()::text;
  end if;

  if v_id is null then
    insert into public.adminos_contacts(identity_key, profile_user_id, contact_type, full_name, email, phone, primary_source, metadata)
    values(v_identity, p_profile_user_id,
      case when p_profile_user_id is not null then 'student' when p_source_type='partner_lead' then 'partner' else 'prospect' end,
      p_full_name, p_email, p_phone, p_source_type, coalesce(p_metadata,'{}'::jsonb))
    returning id into v_id;
  else
    update public.adminos_contacts
    set full_name=coalesce(nullif(p_full_name,''), full_name),
        email=coalesce(nullif(p_email,''), email),
        phone=coalesce(nullif(p_phone,''), phone),
        profile_user_id=coalesce(p_profile_user_id, profile_user_id),
        metadata=metadata || coalesce(p_metadata,'{}'::jsonb),
        updated_at=now()
    where id=v_id;
  end if;

  if v_email is not null then
    insert into public.adminos_contact_channels(contact_id,channel,address,normalized_address,is_primary)
    values(v_id,'email',p_email,v_email,true)
    on conflict(contact_id,channel,normalized_address) do update set address=excluded.address, updated_at=now();
  end if;
  if v_phone is not null then
    insert into public.adminos_contact_channels(contact_id,channel,address,normalized_address,is_primary)
    values(v_id,'phone',p_phone,v_phone,true)
    on conflict(contact_id,channel,normalized_address) do update set address=excluded.address, updated_at=now();
  end if;

  return v_id;
end;
$$;

create or replace function public.adminos_sync_profile_contact()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.adminos_resolve_contact(
    new.full_name, new.email, coalesce(new.phone,new.phone_number), new.id,
    'profile', new.id,
    jsonb_build_object('student_number',new.student_number,'campus',new.campus)
  );
  update public.adminos_contacts
  set student_number=new.student_number, campus=new.campus, updated_at=now()
  where profile_user_id=new.id;
  return new;
end;
$$;

drop trigger if exists trg_adminos_sync_profile on public.profiles;
create trigger trg_adminos_sync_profile
after insert or update of full_name,email,phone,phone_number,student_number,campus on public.profiles
for each row execute function public.adminos_sync_profile_contact();

-- Backfill existing profile identities.
do $$ declare r record; begin
  for r in select * from public.profiles loop
    perform public.adminos_resolve_contact(r.full_name,r.email,coalesce(r.phone,r.phone_number),r.id,'profile',r.id,
      jsonb_build_object('student_number',r.student_number,'campus',r.campus));
    update public.adminos_contacts set student_number=r.student_number,campus=r.campus where profile_user_id=r.id;
  end loop;
end $$;

-- Backfill existing partner leads into the same identity graph and organization CRM.
do $$ declare r record; v_contact uuid; v_org uuid; begin
  for r in select * from public.partner_leads loop
    v_contact := public.adminos_resolve_contact(r.contact_name,r.contact_email,coalesce(r.whatsapp_number,r.contact_phone),r.user_id,'partner_lead',r.id,
      jsonb_build_object('legacy_partner_lead_id',r.id,'lead_type',r.lead_type));
    if nullif(trim(r.organisation_name),'') is not null then
      insert into public.adminos_organizations(name,organization_type,metadata)
      values(trim(r.organisation_name),coalesce(r.lead_type,'partner'),jsonb_build_object('source','partner_leads'))
      on conflict(lower(name)) do update set updated_at=now()
      returning id into v_org;
      insert into public.adminos_organization_contacts(organization_id,contact_id,is_primary)
      values(v_org,v_contact,true) on conflict do nothing;
    else v_org := null; end if;
    insert into public.adminos_prospects(contact_id,organization_id,source_type,source_id,pipeline,stage,priority,owner_id,metadata)
    values(v_contact,v_org,'partner_lead',r.id,'partnerships',coalesce(r.status,'new'),coalesce(r.priority,'normal'),r.assigned_staff_id,
      jsonb_build_object('consent_to_be_contacted',r.consent_to_be_contacted,'popia_consent',r.popia_consent))
    on conflict(source_type,source_id) where source_id is not null do update
      set stage=excluded.stage, priority=excluded.priority, owner_id=excluded.owner_id, updated_at=now();
  end loop;
end $$;

-- Backfill accommodation leads.
do $$ declare r record; v_contact uuid; begin
  for r in select * from public.residence_leads loop
    v_contact := public.adminos_resolve_contact(r.contact_name,r.contact_email,r.contact_phone,r.user_id,'residence_lead',r.id,
      jsonb_build_object('legacy_residence_lead_id',r.id,'residence_id',r.residence_id));
    insert into public.adminos_prospects(contact_id,source_type,source_id,pipeline,stage,next_action_at,last_contacted_at,metadata)
    values(v_contact,'residence_lead',r.id,'accommodation',coalesce(r.stage,'new'),r.next_follow_up_at,r.last_contacted_at,
      jsonb_build_object('residence_id',r.residence_id,'funding_type',r.funding_type,'academic_year',r.academic_year))
    on conflict(source_type,source_id) where source_id is not null do update
      set stage=excluded.stage,next_action_at=excluded.next_action_at,last_contacted_at=excluded.last_contacted_at,updated_at=now();
  end loop;
end $$;

create or replace view public.adminos_contact_360 as
select c.*,
  (select count(*) from public.applications a where a.user_id=c.profile_user_id) as application_count,
  (select max(a.updated_at) from public.applications a where a.user_id=c.profile_user_id) as last_application_activity,
  (select count(*) from public.adminos_prospects p where p.contact_id=c.id) as prospect_count
from public.adminos_contacts c;

-- ============================================================
-- PHASE 2 — WORKFLOW / EVENT ENGINE
-- ============================================================

create table if not exists public.adminos_automation_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  name text not null,
  description text,
  trigger_type text not null,
  conditions jsonb not null default '{}'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  priority integer not null default 100,
  requires_approval boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.adminos_automation_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  entity_type text,
  entity_id uuid,
  contact_id uuid references public.adminos_contacts(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new','queued','processed','failed','ignored')),
  correlation_id text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists idx_adminos_events_status on public.adminos_automation_events(status,created_at);

create table if not exists public.adminos_automation_jobs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.adminos_automation_events(id) on delete cascade,
  rule_id uuid references public.adminos_automation_rules(id) on delete set null,
  action_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','running','succeeded','failed','blocked','awaiting_approval','cancelled')),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  due_at timestamptz not null default now(),
  locked_at timestamptz,
  completed_at timestamptz,
  idempotency_key text not null unique,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_adminos_jobs_due on public.adminos_automation_jobs(status,due_at);

create table if not exists public.adminos_automation_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.adminos_automation_jobs(id) on delete cascade,
  attempt integer not null,
  status text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.adminos_automation_failures (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.adminos_automation_jobs(id) on delete cascade,
  run_id uuid references public.adminos_automation_runs(id) on delete set null,
  error_code text,
  error_message text not null,
  retryable boolean not null default true,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.adminos_followup_sequences (
  id uuid primary key default gen_random_uuid(),
  sequence_key text not null unique,
  name text not null,
  description text,
  enabled boolean not null default false,
  target_type text not null default 'prospect',
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.adminos_followup_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.adminos_followup_sequences(id) on delete cascade,
  step_order integer not null,
  delay_minutes integer not null default 0,
  channel text,
  action_type text not null,
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  unique(sequence_id,step_order)
);

create table if not exists public.adminos_followup_enrollments (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.adminos_followup_sequences(id) on delete cascade,
  contact_id uuid not null references public.adminos_contacts(id) on delete cascade,
  prospect_id uuid references public.adminos_prospects(id) on delete cascade,
  status text not null default 'active' check (status in ('active','paused','completed','cancelled')),
  current_step integer not null default 0,
  next_run_at timestamptz,
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create or replace function public.adminos_dispatch_event(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  e public.adminos_automation_events%rowtype;
  r record;
  a record;
  v_count integer := 0;
  v_delay integer;
begin
  select * into e from public.adminos_automation_events where id=p_event_id for update;
  if not found or e.status not in ('new','failed') then return 0; end if;

  for r in
    select * from public.adminos_automation_rules
    where enabled=true and trigger_type=e.event_type
      and (conditions='{}'::jsonb or e.payload @> conditions)
    order by priority asc, created_at asc
  loop
    for a in select value, ordinality from jsonb_array_elements(r.actions) with ordinality loop
      v_delay := coalesce((a.value->>'delay_minutes')::integer,0);
      insert into public.adminos_automation_jobs(event_id,rule_id,action_type,payload,status,due_at,idempotency_key)
      values(e.id,r.id,coalesce(a.value->>'type','noop'),coalesce(a.value->'payload','{}'::jsonb),
        case when r.requires_approval or coalesce((a.value->>'requires_approval')::boolean,false) then 'awaiting_approval' else 'pending' end,
        now() + make_interval(mins=>v_delay),
        md5(e.id::text || ':' || r.id::text || ':' || a.ordinality::text || ':v' || r.version::text))
      on conflict(idempotency_key) do nothing;
      v_count := v_count + 1;
    end loop;
  end loop;

  update public.adminos_automation_events set status='queued',processed_at=now() where id=e.id;
  return v_count;
end;
$$;

create or replace function public.adminos_event_dispatch_trigger()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.adminos_dispatch_event(new.id);
  return new;
end;
$$;
drop trigger if exists trg_adminos_dispatch_event on public.adminos_automation_events;
create trigger trg_adminos_dispatch_event after insert on public.adminos_automation_events
for each row execute function public.adminos_event_dispatch_trigger();

-- Executes only explicitly safe internal actions. External/email/WhatsApp/AI actions remain pending for later releases.
create or replace function public.adminos_execute_safe_job()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare
  e public.adminos_automation_events%rowtype;
  c public.adminos_contacts%rowtype;
begin
  if new.status <> 'pending' or new.due_at > now() then return new; end if;
  select * into e from public.adminos_automation_events where id=new.event_id;
  select * into c from public.adminos_contacts where id=e.contact_id;

  if new.action_type='create_task' then
    insert into public.conversion_automation_tasks(task_type,source_type,source_id,user_id,owner_scope,status,priority,due_at,summary,payload)
    values(
      coalesce(new.payload->>'task_type','adminos_task'),
      coalesce(e.entity_type,'adminos'), e.entity_id, c.profile_user_id,
      coalesce(new.payload->>'owner_scope','admin'), 'pending', coalesce(new.payload->>'priority','normal'),
      now() + make_interval(mins=>coalesce((new.payload->>'due_minutes')::integer,0)),
      coalesce(new.payload->>'summary','AdminOS workflow task'),
      new.payload || jsonb_build_object('adminos_job_id',new.id,'event_id',e.id)
    );
    update public.adminos_automation_jobs set status='succeeded',attempts=attempts+1,completed_at=now(),updated_at=now() where id=new.id;
    insert into public.adminos_automation_runs(job_id,attempt,status,input,output,completed_at)
    values(new.id,new.attempts+1,'succeeded',new.payload,jsonb_build_object('executor','database_safe_executor'),now());
  elsif new.action_type='create_approval' then
    insert into public.adminos_approval_requests(request_type,title,summary,entity_type,entity_id,requested_action,risk_level)
    values(coalesce(new.payload->>'request_type','workflow'),coalesce(new.payload->>'title','Workflow approval'),new.payload->>'summary',e.entity_type,e.entity_id,new.payload,
      coalesce(new.payload->>'risk_level','amber'));
    update public.adminos_automation_jobs set status='succeeded',attempts=attempts+1,completed_at=now(),updated_at=now() where id=new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_adminos_execute_safe_job on public.adminos_automation_jobs;
create trigger trg_adminos_execute_safe_job after insert on public.adminos_automation_jobs
for each row execute function public.adminos_execute_safe_job();

create or replace function public.adminos_application_event()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_contact uuid; v_profile record; begin
  select * into v_profile from public.profiles where id=new.user_id;
  if found then
    v_contact := public.adminos_resolve_contact(v_profile.full_name,v_profile.email,coalesce(v_profile.phone,v_profile.phone_number),v_profile.id,'profile',v_profile.id,'{}'::jsonb);
  end if;
  insert into public.adminos_automation_events(event_type,entity_type,entity_id,contact_id,payload,correlation_id)
  values(
    case when tg_op='INSERT' then 'application.created' else 'application.updated' end,
    'application',new.id,v_contact,
    jsonb_build_object('status',new.status,'residence_id',new.residence_id,'funding_type',new.funding_type,'previous_status',case when tg_op='UPDATE' then old.status else null end),
    'application:'||new.id::text
  );
  return new;
end;
$$;
drop trigger if exists trg_adminos_application_event on public.applications;
create trigger trg_adminos_application_event
after insert or update of status,residence_id,funding_type on public.applications
for each row execute function public.adminos_application_event();

create or replace function public.adminos_prospect_event()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into public.adminos_automation_events(event_type,entity_type,entity_id,contact_id,payload,correlation_id)
  values(case when tg_op='INSERT' then 'prospect.created' else 'prospect.updated' end,'prospect',new.id,new.contact_id,
    jsonb_build_object('pipeline',new.pipeline,'stage',new.stage,'score',new.score,'priority',new.priority),
    'prospect:'||new.id::text);
  return new;
end;
$$;
drop trigger if exists trg_adminos_prospect_event on public.adminos_prospects;
create trigger trg_adminos_prospect_event after insert or update of stage,score,priority on public.adminos_prospects
for each row execute function public.adminos_prospect_event();

insert into public.adminos_automation_rules(rule_key,name,description,trigger_type,actions,priority)
values
('application_intake_v1','Application intake','Creates an internal exception/intake task whenever a new application enters AdminOS.','application.created',
 '[{"type":"create_task","payload":{"task_type":"application_intake","summary":"New application entered AdminOS","owner_scope":"admin","priority":"normal","due_minutes":0}}]'::jsonb,10),
('new_prospect_triage_v1','New prospect triage','Creates a CRM triage task for new prospects while external communication remains disabled in Release 1.','prospect.created',
 '[{"type":"create_task","payload":{"task_type":"prospect_triage","summary":"New CRM prospect requires initial triage","owner_scope":"admin","priority":"normal","due_minutes":0}}]'::jsonb,20)
on conflict(rule_key) do update set name=excluded.name,description=excluded.description,trigger_type=excluded.trigger_type,actions=excluded.actions,priority=excluded.priority,updated_at=now();

-- Integration scaffolding: secrets are referenced only; no credentials are stored in these rows.
insert into public.adminos_integration_connections(provider,display_name,status,enabled,setup_step,setup_url,docs_url,config)
values
('openai','OpenAI','not_connected',false,1,'https://platform.openai.com/api-keys','https://platform.openai.com/docs',jsonb_build_object('release','2','phase',3)),
('gmail','Gmail / Google Workspace','not_connected',false,1,'https://console.cloud.google.com/apis/library/gmail.googleapis.com','https://developers.google.com/workspace/gmail/api/guides',jsonb_build_object('release','3','phase',5)),
('twilio_whatsapp','WhatsApp Business via Twilio','not_connected',false,1,'https://console.twilio.com/','https://www.twilio.com/docs/whatsapp',jsonb_build_object('release','3','phase',6)),
('twilio_voice','Twilio Voice','not_connected',false,1,'https://console.twilio.com/','https://www.twilio.com/docs/voice',jsonb_build_object('release','5','phase',10))
on conflict(provider) do update set display_name=excluded.display_name,setup_url=excluded.setup_url,docs_url=excluded.docs_url,config=excluded.config,updated_at=now();

-- Updated-at triggers.
do $$ declare t text; begin
  foreach t in array array[
    'adminos_agent_config','adminos_approval_requests','adminos_integration_connections','adminos_knowledge_sources','adminos_knowledge_entries',
    'adminos_consents','adminos_communication_preferences','adminos_contacts','adminos_contact_channels','adminos_organizations','adminos_prospects',
    'adminos_automation_rules','adminos_automation_jobs','adminos_followup_sequences'
  ] loop
    execute format('drop trigger if exists trg_%I_touch on public.%I',t,t);
    execute format('create trigger trg_%I_touch before update on public.%I for each row execute function public.adminos_touch_updated_at()',t,t);
  end loop;
end $$;

-- RLS: Release 1 AdminOS is an internal staff-only operating surface.
do $$ declare t text; begin
  foreach t in array array[
    'adminos_agent_config','adminos_agent_runs','adminos_agent_actions','adminos_agent_errors','adminos_approval_requests','adminos_approval_actions',
    'adminos_integration_connections','adminos_integration_health','adminos_knowledge_sources','adminos_knowledge_entries','adminos_audit_events',
    'adminos_consents','adminos_communication_preferences','adminos_contacts','adminos_contact_channels','adminos_organizations','adminos_organization_contacts',
    'adminos_tags','adminos_contact_tags','adminos_prospects','adminos_lead_scores','adminos_automation_rules','adminos_automation_events',
    'adminos_automation_jobs','adminos_automation_runs','adminos_automation_failures','adminos_followup_sequences','adminos_followup_steps','adminos_followup_enrollments'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists "AdminOS staff access" on public.%I',t);
    execute format('create policy "AdminOS staff access" on public.%I for all to authenticated using (public.adminos_is_staff()) with check (public.adminos_is_staff())',t);
  end loop;
end $$;

revoke all on function public.adminos_resolve_contact(text,text,text,uuid,text,uuid,jsonb) from public;
grant execute on function public.adminos_resolve_contact(text,text,text,uuid,text,uuid,jsonb) to authenticated, service_role;
revoke all on function public.adminos_dispatch_event(uuid) from public;
grant execute on function public.adminos_dispatch_event(uuid) to authenticated, service_role;

-- Seed phase markers.
insert into public.platform_settings(key,value,description,updated_at)
values('adminos_release_progress',jsonb_build_object(
  'release',1,
  'total_phases',11,
  'completed_phases',jsonb_build_array(0,1,2),
  'current_phase',2,
  'release_status','implemented',
  'phase_0','complete',
  'phase_1','complete',
  'phase_2','complete',
  'phase_3','not_started'
),'ResKonnect AdminOS implementation progress. Updated only after release gates pass.',now())
on conflict(key) do update set value=excluded.value,description=excluded.description,updated_at=now();
