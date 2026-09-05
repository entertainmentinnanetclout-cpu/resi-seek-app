-- ResKonnect AdminOS Release 2 — Phases 3, 4 and 5
-- Phase 3: Konnect Agent Core
-- Phase 4: Internal Enquiries
-- Phase 5: Email Agent
-- Phase 6+ deliberately excluded from this release gate.

create extension if not exists pgcrypto;

-- ============================================================
-- PHASE 3 — KONNECT AGENT CORE
-- ============================================================

create table if not exists public.adminos_agent_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  agent_key text not null,
  version integer not null,
  name text not null,
  system_prompt text not null,
  policy jsonb not null default '{}'::jsonb,
  tool_allowlist jsonb not null default '[]'::jsonb,
  active boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(agent_key, version)
);

create unique index if not exists uq_adminos_agent_prompt_active on public.adminos_agent_prompt_versions(agent_key) where active;

create table if not exists public.adminos_agent_usage (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.adminos_agent_runs(id) on delete set null,
  agent_key text not null,
  provider text not null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  estimated_cost_usd numeric(12,6),
  latency_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_adminos_agent_runs_recent on public.adminos_agent_runs(agent_key, started_at desc);
create index if not exists idx_adminos_agent_actions_run on public.adminos_agent_actions(run_id, created_at);
create index if not exists idx_adminos_agent_usage_recent on public.adminos_agent_usage(agent_key, created_at desc);
create index if not exists idx_adminos_knowledge_active on public.adminos_knowledge_sources(status, visibility, valid_until);

insert into public.adminos_agent_config(agent_key,display_name,enabled,authority_level,confidence_threshold,config)
values
('konnect_agent','Konnect Agent Core',true,'green',0.860,jsonb_build_object(
  'release',2,'phase',3,
  'primary_provider','openai','primary_model','gpt-5.6-luna','complex_model','gpt-5.6-terra',
  'fallback_provider','lovable_gateway','fallback_model','google/gemini-2.5-flash',
  'max_output_tokens',700,
  'cost_guard',jsonb_build_object('default_model','gpt-5.6-luna','complex_only_model','gpt-5.6-terra','max_context_chars',18000),
  'blocked_actions',jsonb_build_array('approve_application','reject_application','sign_lease','move_money','change_banking','send_whatsapp','place_voice_call')
)),
('internal_enquiries','Internal Enquiries Agent',true,'green',0.860,jsonb_build_object(
  'release',2,'phase',4,'auto_reply_green',true,'escalate_amber',true,'escalate_red',true,'channel','in_app'
)),
('email_agent','Email Agent',true,'green',0.900,jsonb_build_object(
  'release',2,'phase',5,'auto_draft',true,'auto_send_green',true,'approval_for_amber',true,'approval_for_red',true,'channel','email'
))
on conflict(agent_key) do update set
  display_name=excluded.display_name,
  enabled=excluded.enabled,
  authority_level=excluded.authority_level,
  confidence_threshold=excluded.confidence_threshold,
  config=excluded.config,
  updated_at=now();

insert into public.adminos_agent_prompt_versions(agent_key,version,name,system_prompt,policy,tool_allowlist,active)
values(
  'konnect_agent',1,'Release 2 production policy',
  'You are Konnect Agent, the internal reasoning layer for ResKonnect. Use only supplied database and knowledge context for account-specific facts. Never invent application statuses, residence availability, prices, deadlines, approvals, partner commitments, payment outcomes or legal terms. You may answer routine factual questions and draft routine communications. You must not approve or reject applications, execute financial actions, sign or alter legal agreements, expose private data belonging to another person, send WhatsApp messages, or place calls. When information is missing, conflicting, legally sensitive, financially sensitive, or outside your authority, mark the result for human escalation. Keep replies concise, professional and easy to understand. Return JSON only with keys answer, confidence, risk, escalate, reason. risk must be green, amber or red.',
  jsonb_build_object('release',2,'authority','green','popia_minimisation',true,'no_cross_user_data',true,'human_escalation',true),
  jsonb_build_array('read_contact','read_application','read_residence','read_knowledge','draft_reply','request_human_review'),
  true
)
on conflict(agent_key,version) do update set name=excluded.name,system_prompt=excluded.system_prompt,policy=excluded.policy,tool_allowlist=excluded.tool_allowlist,active=true;

update public.adminos_agent_prompt_versions set active=false where agent_key='konnect_agent' and version<>1 and active=true;

insert into public.adminos_knowledge_sources(source_key,title,source_type,visibility,status,metadata)
values('adminos_release2_operating_policy','AdminOS Release 2 operating policy','internal','internal','active',jsonb_build_object('release',2,'phases',jsonb_build_array(3,4,5)))
on conflict(source_key) do update set title=excluded.title,status='active',metadata=excluded.metadata,updated_at=now();

insert into public.adminos_knowledge_entries(source_id,knowledge_key,title,content,structured_data,confidence,requires_human_confirmation)
select s.id,v.knowledge_key,v.title,v.content,v.structured_data,1.000,false
from public.adminos_knowledge_sources s
cross join (values
  ('application_status_policy','Application status policy','Application status answers must use the live applications table. The agent must never infer approval, rejection, funding confirmation or placement from incomplete information.',jsonb_build_object('authority','read_only')),
  ('enquiry_escalation_policy','Enquiry escalation policy','Routine account and application questions may be answered automatically when supported by live data. Legal disputes, payment disputes, threats, complaints alleging misconduct, requests to alter records, and low-confidence answers must be escalated to staff.',jsonb_build_object('green','routine factual support','amber','uncertain or sensitive','red','legal/financial/security/high impact')),
  ('email_authority_policy','Email authority policy','The Email Agent may classify, draft and send routine green-risk applicant or partner replies. Amber and red communications require human approval. The agent may not create contractual commitments, change banking details, promise payments, or make admissions of liability.',jsonb_build_object('auto_send','green','approval_required',jsonb_build_array('amber','red')))
) as v(knowledge_key,title,content,structured_data)
where s.source_key='adminos_release2_operating_policy'
on conflict(source_id,knowledge_key) do update set title=excluded.title,content=excluded.content,structured_data=excluded.structured_data,confidence=excluded.confidence,requires_human_confirmation=excluded.requires_human_confirmation,updated_at=now();

-- ============================================================
-- PHASE 4 — INTERNAL ENQUIRIES
-- ============================================================

create table if not exists public.adminos_enquiry_threads (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.adminos_contacts(id) on delete cascade,
  profile_user_id uuid references public.profiles(id) on delete set null,
  application_id uuid references public.applications(id) on delete set null,
  subject text,
  channel text not null default 'in_app' check(channel in ('in_app','web')),
  status text not null default 'open' check(status in ('open','waiting_staff','escalated','resolved','closed')),
  priority text not null default 'normal' check(priority in ('low','normal','high','urgent')),
  assigned_to uuid references auth.users(id) on delete set null,
  last_message_at timestamptz not null default now(),
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_adminos_enquiry_owner on public.adminos_enquiry_threads(profile_user_id,status,last_message_at desc);
create index if not exists idx_adminos_enquiry_staff_queue on public.adminos_enquiry_threads(status,priority,last_message_at desc);

create table if not exists public.adminos_enquiry_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.adminos_enquiry_threads(id) on delete cascade,
  sender_type text not null check(sender_type in ('user','agent','staff','system')),
  sender_user_id uuid references auth.users(id) on delete set null,
  content text not null,
  direction text not null check(direction in ('inbound','outbound','internal')),
  status text not null default 'delivered' check(status in ('queued','delivered','failed','blocked')),
  confidence numeric(4,3),
  risk_level text check(risk_level is null or risk_level in ('green','amber','red')),
  agent_run_id uuid references public.adminos_agent_runs(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_adminos_enquiry_messages_thread on public.adminos_enquiry_messages(thread_id,created_at);

-- ============================================================
-- PHASE 5 — EMAIL AGENT
-- ============================================================

create table if not exists public.adminos_email_threads (
  id uuid primary key default gen_random_uuid(),
  gmail_thread_id text unique,
  contact_id uuid references public.adminos_contacts(id) on delete set null,
  subject text,
  participants jsonb not null default '[]'::jsonb,
  status text not null default 'open' check(status in ('open','waiting','resolved','archived')),
  last_message_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_adminos_email_threads_recent on public.adminos_email_threads(status,last_message_at desc);
create index if not exists idx_adminos_email_threads_contact on public.adminos_email_threads(contact_id,last_message_at desc);

create table if not exists public.adminos_email_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.adminos_email_threads(id) on delete cascade,
  gmail_message_id text unique,
  contact_id uuid references public.adminos_contacts(id) on delete set null,
  direction text not null check(direction in ('inbound','outbound')),
  from_email text,
  to_emails jsonb not null default '[]'::jsonb,
  cc_emails jsonb not null default '[]'::jsonb,
  subject text,
  body_text text,
  snippet text,
  received_at timestamptz,
  sent_at timestamptz,
  classification jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_adminos_email_messages_thread on public.adminos_email_messages(thread_id,coalesce(received_at,sent_at,created_at));
create index if not exists idx_adminos_email_messages_contact on public.adminos_email_messages(contact_id,created_at desc);

create table if not exists public.adminos_email_outbox (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.adminos_contacts(id) on delete set null,
  thread_id uuid references public.adminos_email_threads(id) on delete set null,
  source_type text,
  source_id uuid,
  to_email text not null,
  cc_emails jsonb not null default '[]'::jsonb,
  subject text not null,
  body_text text not null,
  risk_level text not null default 'green' check(risk_level in ('green','amber','red')),
  confidence numeric(4,3),
  status text not null default 'draft' check(status in ('draft','queued','awaiting_approval','sending','sent','failed','blocked','cancelled')),
  approval_id uuid references public.adminos_approval_requests(id) on delete set null,
  agent_run_id uuid references public.adminos_agent_runs(id) on delete set null,
  idempotency_key text not null unique,
  send_after timestamptz not null default now(),
  gmail_message_id text,
  attempts integer not null default 0,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_adminos_email_outbox_due on public.adminos_email_outbox(status,send_after);

insert into public.adminos_integration_connections(provider,display_name,status,enabled,setup_step,setup_url,docs_url,config,secret_refs)
values
('openai','OpenAI','needs_action',false,2,'https://platform.openai.com/api-keys','https://platform.openai.com/docs/api-reference/responses',jsonb_build_object('release',2,'phase',3,'models',jsonb_build_array('gpt-5.6-luna','gpt-5.6-terra'),'managed_fallback','lovable_ai_gateway'),jsonb_build_object('api_key_env','OPENAI_API_KEY')),
('lovable_ai_gateway','Managed AI fallback','connected',true,3,'https://lovable.dev/','https://docs.lovable.dev/',jsonb_build_object('release',2,'phase',3,'fallback',true,'model','google/gemini-2.5-flash'),jsonb_build_object('api_key_env','LOVABLE_API_KEY')),
('gmail','Gmail / Google Workspace','needs_action',false,2,'https://console.cloud.google.com/apis/library/gmail.googleapis.com','https://developers.google.com/workspace/gmail/api/guides',jsonb_build_object('release',2,'phase',5,'scopes',jsonb_build_array('gmail.readonly','gmail.send'),'oauth','refresh_token'),jsonb_build_object('client_id_env','GMAIL_CLIENT_ID','client_secret_env','GMAIL_CLIENT_SECRET','refresh_token_env','GMAIL_REFRESH_TOKEN','sender_env','GMAIL_SENDER_EMAIL'))
on conflict(provider) do update set display_name=excluded.display_name,setup_url=excluded.setup_url,docs_url=excluded.docs_url,config=excluded.config,secret_refs=excluded.secret_refs,updated_at=now();

insert into public.adminos_automation_rules(rule_key,name,description,trigger_type,actions,priority,enabled)
values
('enquiry_escalation_v1','Enquiry escalation','Creates a staff task when the internal enquiry agent cannot safely resolve a question.','enquiry.escalated','[{"type":"create_task","payload":{"task_type":"enquiry_escalation","summary":"Internal enquiry requires staff review","owner_scope":"admin","priority":"high","due_minutes":0}}]'::jsonb,5,true),
('email_escalation_v1','Email escalation','Creates a staff task when an inbound email is amber/red risk or below confidence threshold.','email.escalated','[{"type":"create_task","payload":{"task_type":"email_escalation","summary":"Email requires human review","owner_scope":"admin","priority":"high","due_minutes":0}}]'::jsonb,6,true)
on conflict(rule_key) do update set name=excluded.name,description=excluded.description,trigger_type=excluded.trigger_type,actions=excluded.actions,priority=excluded.priority,enabled=excluded.enabled,updated_at=now();

do $$ declare t text; begin
  foreach t in array array['adminos_enquiry_threads','adminos_email_threads','adminos_email_outbox'] loop
    execute format('drop trigger if exists trg_%I_touch on public.%I',t,t);
    execute format('create trigger trg_%I_touch before update on public.%I for each row execute function public.adminos_touch_updated_at()',t,t);
  end loop;
end $$;

alter table public.adminos_agent_prompt_versions enable row level security;
alter table public.adminos_agent_usage enable row level security;
alter table public.adminos_enquiry_threads enable row level security;
alter table public.adminos_enquiry_messages enable row level security;
alter table public.adminos_email_threads enable row level security;
alter table public.adminos_email_messages enable row level security;
alter table public.adminos_email_outbox enable row level security;

do $$ declare t text; begin
  foreach t in array array['adminos_agent_prompt_versions','adminos_agent_usage','adminos_enquiry_threads','adminos_enquiry_messages','adminos_email_threads','adminos_email_messages','adminos_email_outbox'] loop
    execute format('drop policy if exists "AdminOS staff access" on public.%I',t);
    execute format('create policy "AdminOS staff access" on public.%I for all to authenticated using (public.adminos_is_staff()) with check (public.adminos_is_staff())',t);
  end loop;
end $$;

drop policy if exists "Enquiry owner read" on public.adminos_enquiry_threads;
create policy "Enquiry owner read" on public.adminos_enquiry_threads for select to authenticated using(profile_user_id=auth.uid());

drop policy if exists "Enquiry owner messages read" on public.adminos_enquiry_messages;
create policy "Enquiry owner messages read" on public.adminos_enquiry_messages for select to authenticated using(exists(select 1 from public.adminos_enquiry_threads t where t.id=thread_id and t.profile_user_id=auth.uid()));

revoke all on table public.adminos_agent_prompt_versions from anon;
revoke all on table public.adminos_agent_usage from anon;
revoke all on table public.adminos_enquiry_threads from anon;
revoke all on table public.adminos_enquiry_messages from anon;
revoke all on table public.adminos_email_threads from anon;
revoke all on table public.adminos_email_messages from anon;
revoke all on table public.adminos_email_outbox from anon;

grant select on public.adminos_enquiry_threads to authenticated;
grant select on public.adminos_enquiry_messages to authenticated;
grant select,insert,update,delete on public.adminos_agent_prompt_versions,public.adminos_agent_usage,public.adminos_email_threads,public.adminos_email_messages,public.adminos_email_outbox to authenticated;

insert into public.platform_settings(key,value,description,updated_at)
values('adminos_release_progress',jsonb_build_object(
  'release',2,'total_phases',11,'completed_phases',jsonb_build_array(0,1,2),'current_phase',5,'release_status','gate_running',
  'phase_0','complete','phase_1','complete','phase_2','complete','phase_3','implemented_pending_gate','phase_4','implemented_pending_gate','phase_5','implemented_pending_gate','phase_6','not_started'
),'ResKonnect AdminOS implementation progress. Updated to complete only after Release Gate 2 passes.',now())
on conflict(key) do update set value=excluded.value,description=excluded.description,updated_at=now();