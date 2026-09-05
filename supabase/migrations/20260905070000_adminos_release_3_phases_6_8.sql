-- ResKonnect AdminOS Release 3 — Phases 6, 7 and 8
-- Phase 6: WhatsApp Business
-- Phase 7: Follow-up Autopilot
-- Phase 8: Company Paperwork
-- Release status remains gate_running until Release Gate 3 production validation passes.

create extension if not exists pgcrypto;

-- PHASE 6 — WHATSAPP BUSINESS
create table if not exists public.adminos_whatsapp_threads (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.adminos_contacts(id) on delete set null,
  channel_address text not null,
  normalized_address text not null,
  status text not null default 'open' check(status in ('open','waiting','escalated','resolved','blocked','archived')),
  last_message_at timestamptz,
  customer_window_expires_at timestamptz,
  unread_count integer not null default 0 check(unread_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(normalized_address)
);
create index if not exists idx_adminos_whatsapp_threads_queue on public.adminos_whatsapp_threads(status,last_message_at desc);
create index if not exists idx_adminos_whatsapp_threads_contact on public.adminos_whatsapp_threads(contact_id,last_message_at desc);

create table if not exists public.adminos_whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.adminos_whatsapp_threads(id) on delete cascade,
  contact_id uuid references public.adminos_contacts(id) on delete set null,
  twilio_message_sid text unique,
  direction text not null check(direction in ('inbound','outbound')),
  from_address text,
  to_address text,
  body_text text,
  media jsonb not null default '[]'::jsonb,
  message_kind text not null default 'transactional' check(message_kind in ('transactional','service','marketing')),
  status text not null default 'received' check(status in ('queued','received','sending','sent','delivered','read','failed','undelivered','blocked')),
  risk_level text check(risk_level is null or risk_level in ('green','amber','red')),
  confidence numeric(4,3),
  agent_run_id uuid references public.adminos_agent_runs(id) on delete set null,
  received_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_adminos_whatsapp_messages_thread on public.adminos_whatsapp_messages(thread_id,created_at);
create index if not exists idx_adminos_whatsapp_messages_contact on public.adminos_whatsapp_messages(contact_id,created_at desc);

create table if not exists public.adminos_whatsapp_outbox (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.adminos_contacts(id) on delete set null,
  thread_id uuid references public.adminos_whatsapp_threads(id) on delete set null,
  source_type text,
  source_id uuid,
  to_address text not null,
  body_text text,
  message_kind text not null default 'transactional' check(message_kind in ('transactional','service','marketing')),
  template_sid text,
  template_vars jsonb not null default '{}'::jsonb,
  risk_level text not null default 'green' check(risk_level in ('green','amber','red')),
  confidence numeric(4,3),
  status text not null default 'draft' check(status in ('draft','queued','awaiting_approval','sending','sent','failed','blocked','cancelled')),
  approval_id uuid references public.adminos_approval_requests(id) on delete set null,
  agent_run_id uuid references public.adminos_agent_runs(id) on delete set null,
  idempotency_key text not null unique,
  send_after timestamptz not null default now(),
  twilio_message_sid text,
  attempts integer not null default 0,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (body_text is not null or template_sid is not null)
);
create index if not exists idx_adminos_whatsapp_outbox_due on public.adminos_whatsapp_outbox(status,send_after);
create index if not exists idx_adminos_whatsapp_outbox_contact on public.adminos_whatsapp_outbox(contact_id,created_at desc);
create index if not exists idx_adminos_whatsapp_outbox_approval_id on public.adminos_whatsapp_outbox(approval_id);
create index if not exists idx_adminos_whatsapp_outbox_agent_run_id on public.adminos_whatsapp_outbox(agent_run_id);
create index if not exists idx_adminos_whatsapp_outbox_thread_id on public.adminos_whatsapp_outbox(thread_id);

insert into public.adminos_agent_config(agent_key,display_name,enabled,authority_level,confidence_threshold,config)
values('whatsapp_agent','WhatsApp Agent',true,'green',0.900,jsonb_build_object('release',3,'phase',6,'channel','whatsapp','auto_reply_green',true,'approval_for_amber',true,'approval_for_red',true,'customer_service_window_hours',24,'marketing_requires_consent',true,'outside_window_requires_template',true))
on conflict(agent_key) do update set display_name=excluded.display_name,enabled=excluded.enabled,authority_level=excluded.authority_level,confidence_threshold=excluded.confidence_threshold,config=excluded.config,updated_at=now();

insert into public.adminos_integration_connections(provider,display_name,status,enabled,setup_step,setup_url,docs_url,config,secret_refs)
values('twilio_whatsapp','WhatsApp Business via Twilio','not_connected',false,1,'https://console.twilio.com/','https://www.twilio.com/docs/whatsapp',jsonb_build_object('release',3,'phase',6,'provider','twilio','customer_service_window_hours',24,'template_required_outside_window',true,'popia_consent_gate',true),jsonb_build_object('account_sid_env','TWILIO_ACCOUNT_SID','auth_token_env','TWILIO_AUTH_TOKEN','from_env','TWILIO_WHATSAPP_FROM'))
on conflict(provider) do update set display_name=excluded.display_name,setup_url=excluded.setup_url,docs_url=excluded.docs_url,config=excluded.config,secret_refs=excluded.secret_refs,updated_at=now();

insert into public.adminos_automation_rules(rule_key,name,description,trigger_type,actions,priority,enabled)
values('whatsapp_escalation_v1','WhatsApp escalation','Creates a high-priority staff task when WhatsApp cannot be answered safely or consent/routing blocks automation.','whatsapp.escalated','[{"type":"create_task","payload":{"task_type":"whatsapp_escalation","summary":"WhatsApp conversation requires staff review","owner_scope":"admin","priority":"high","due_minutes":0}}]'::jsonb,7,true)
on conflict(rule_key) do update set name=excluded.name,description=excluded.description,trigger_type=excluded.trigger_type,actions=excluded.actions,priority=excluded.priority,enabled=excluded.enabled,updated_at=now();

-- PHASE 7 — FOLLOW-UP AUTOPILOT
create table if not exists public.adminos_followup_attempts (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.adminos_followup_enrollments(id) on delete cascade,
  step_id uuid references public.adminos_followup_steps(id) on delete set null,
  contact_id uuid not null references public.adminos_contacts(id) on delete cascade,
  channel text,
  action_type text not null,
  status text not null default 'planned' check(status in ('planned','queued','sent','completed','skipped','blocked','failed')),
  scheduled_for timestamptz,
  executed_at timestamptz,
  output jsonb not null default '{}'::jsonb,
  error_message text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists idx_adminos_followup_attempts_enrollment on public.adminos_followup_attempts(enrollment_id,created_at desc);
create index if not exists idx_adminos_followup_attempts_contact on public.adminos_followup_attempts(contact_id,created_at desc);
create index if not exists idx_adminos_followup_attempts_step_id on public.adminos_followup_attempts(step_id);
create index if not exists idx_adminos_followup_enrollments_due on public.adminos_followup_enrollments(status,next_run_at);
create unique index if not exists uq_adminos_followup_active_contact_sequence on public.adminos_followup_enrollments(sequence_id,contact_id) where status='active';

insert into public.adminos_agent_config(agent_key,display_name,enabled,authority_level,confidence_threshold,config)
values('followup_autopilot','Follow-up Autopilot',true,'green',0.950,jsonb_build_object('release',3,'phase',7,'respect_do_not_contact',true,'respect_channel_preferences',true,'respect_marketing_consent',true,'quiet_hours_default',jsonb_build_object('timezone','Africa/Johannesburg','start','20:00','end','08:00'),'max_attempts_per_day',2,'stop_on_reply',true))
on conflict(agent_key) do update set display_name=excluded.display_name,enabled=excluded.enabled,authority_level=excluded.authority_level,confidence_threshold=excluded.confidence_threshold,config=excluded.config,updated_at=now();

insert into public.adminos_followup_sequences(sequence_key,name,description,enabled,target_type,config)
values
('accommodation_application_nurture_v1','Accommodation application nurture','Moves an accommodation prospect from initial interest to an application without excessive messaging.',true,'prospect',jsonb_build_object('release',3,'phase',7,'pipeline','accommodation','stop_stages',jsonb_build_array('approved','converted','onboarded','lost','not_interested'))),
('missing_documents_v1','Missing application documents','Reminds applicants about outstanding documents using transactional channels and escalates unresolved cases to staff.',true,'contact',jsonb_build_object('release',3,'phase',7,'purpose','application_support','transactional',true)),
('wil_candidate_nurture_v1','WIL candidate nurture','Keeps WIL candidates informed and prompts them to complete required actions without promising placement.',true,'prospect',jsonb_build_object('release',3,'phase',7,'pipeline','wil','no_placement_promises',true)),
('partner_followup_v1','Partner follow-up','Structured follow-up for property, employer, SETA and institutional partner conversations.',true,'contact',jsonb_build_object('release',3,'phase',7,'purpose','business_followup','approval_for_commitments',true))
on conflict(sequence_key) do update set name=excluded.name,description=excluded.description,enabled=excluded.enabled,target_type=excluded.target_type,config=excluded.config,updated_at=now();

with s as (select id from public.adminos_followup_sequences where sequence_key='accommodation_application_nurture_v1')
insert into public.adminos_followup_steps(sequence_id,step_order,delay_minutes,channel,action_type,config,enabled)
select s.id,v.step_order,v.delay_minutes,v.channel,v.action_type,v.config,true from s cross join (values
(1,1440,'whatsapp','send_message',jsonb_build_object('message_kind','service','template_key','accommodation_application_reminder','risk_level','green')),
(2,1440,'email','send_message',jsonb_build_object('message_kind','service','template_key','accommodation_application_help','risk_level','green')),
(3,2880,null,'create_task',jsonb_build_object('task_type','prospect_followup','summary','Accommodation prospect still has not completed the next action','priority','normal'))
) as v(step_order,delay_minutes,channel,action_type,config)
on conflict(sequence_id,step_order) do update set delay_minutes=excluded.delay_minutes,channel=excluded.channel,action_type=excluded.action_type,config=excluded.config,enabled=true;

with s as (select id from public.adminos_followup_sequences where sequence_key='missing_documents_v1')
insert into public.adminos_followup_steps(sequence_id,step_order,delay_minutes,channel,action_type,config,enabled)
select s.id,v.step_order,v.delay_minutes,v.channel,v.action_type,v.config,true from s cross join (values
(1,60,'whatsapp','send_message',jsonb_build_object('message_kind','transactional','template_key','missing_documents_notice','risk_level','green')),
(2,1440,'email','send_message',jsonb_build_object('message_kind','transactional','template_key','missing_documents_email','risk_level','green')),
(3,2880,null,'create_task',jsonb_build_object('task_type','documents_outstanding','summary','Applicant documents remain outstanding','priority','high'))
) as v(step_order,delay_minutes,channel,action_type,config)
on conflict(sequence_id,step_order) do update set delay_minutes=excluded.delay_minutes,channel=excluded.channel,action_type=excluded.action_type,config=excluded.config,enabled=true;

with s as (select id from public.adminos_followup_sequences where sequence_key='wil_candidate_nurture_v1')
insert into public.adminos_followup_steps(sequence_id,step_order,delay_minutes,channel,action_type,config,enabled)
select s.id,v.step_order,v.delay_minutes,v.channel,v.action_type,v.config,true from s cross join (values
(1,1440,'whatsapp','send_message',jsonb_build_object('message_kind','service','template_key','wil_next_steps','risk_level','green')),
(2,2880,'email','send_message',jsonb_build_object('message_kind','service','template_key','wil_readiness_check','risk_level','green')),
(3,4320,null,'create_task',jsonb_build_object('task_type','wil_followup','summary','WIL candidate requires human follow-up','priority','normal'))
) as v(step_order,delay_minutes,channel,action_type,config)
on conflict(sequence_id,step_order) do update set delay_minutes=excluded.delay_minutes,channel=excluded.channel,action_type=excluded.action_type,config=excluded.config,enabled=true;

with s as (select id from public.adminos_followup_sequences where sequence_key='partner_followup_v1')
insert into public.adminos_followup_steps(sequence_id,step_order,delay_minutes,channel,action_type,config,enabled)
select s.id,v.step_order,v.delay_minutes,v.channel,v.action_type,v.config,true from s cross join (values
(1,1440,'email','send_message',jsonb_build_object('message_kind','service','template_key','partner_followup','risk_level','green')),
(2,4320,null,'create_task',jsonb_build_object('task_type','partner_followup','summary','Partner conversation requires follow-up','priority','normal'))
) as v(step_order,delay_minutes,channel,action_type,config)
on conflict(sequence_id,step_order) do update set delay_minutes=excluded.delay_minutes,channel=excluded.channel,action_type=excluded.action_type,config=excluded.config,enabled=true;

-- PHASE 8 — COMPANY PAPERWORK
create table if not exists public.adminos_document_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  name text not null,
  category text not null default 'general',
  format text not null default 'html' check(format in ('text','markdown','html')),
  content_template text not null,
  variables jsonb not null default '[]'::jsonb,
  risk_level text not null default 'green' check(risk_level in ('green','amber','red')),
  requires_approval boolean not null default false,
  active boolean not null default true,
  version integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.adminos_company_documents (
  id uuid primary key default gen_random_uuid(),
  document_number text not null unique,
  template_id uuid references public.adminos_document_templates(id) on delete set null,
  document_type text not null,
  category text not null default 'general',
  title text not null,
  status text not null default 'draft' check(status in ('draft','awaiting_approval','approved','finalized','rejected','archived')),
  risk_level text not null default 'green' check(risk_level in ('green','amber','red')),
  contact_id uuid references public.adminos_contacts(id) on delete set null,
  organization_id uuid references public.adminos_organizations(id) on delete set null,
  application_id uuid references public.applications(id) on delete set null,
  approval_id uuid references public.adminos_approval_requests(id) on delete set null,
  current_version integer not null default 1,
  storage_bucket text not null default 'adminos-company-documents',
  storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  finalized_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_adminos_company_documents_status on public.adminos_company_documents(status,updated_at desc);
create index if not exists idx_adminos_company_documents_contact on public.adminos_company_documents(contact_id,updated_at desc);
create index if not exists idx_adminos_company_documents_organization on public.adminos_company_documents(organization_id,updated_at desc);
create index if not exists idx_adminos_company_documents_application on public.adminos_company_documents(application_id,updated_at desc);
create index if not exists idx_adminos_company_documents_approval on public.adminos_company_documents(approval_id);
create index if not exists idx_adminos_company_documents_template on public.adminos_company_documents(template_id);
create index if not exists idx_adminos_company_documents_created_by on public.adminos_company_documents(created_by);
create index if not exists idx_adminos_company_documents_approved_by on public.adminos_company_documents(approved_by);

create table if not exists public.adminos_company_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.adminos_company_documents(id) on delete cascade,
  version integer not null,
  content_text text not null,
  merge_data jsonb not null default '{}'::jsonb,
  change_note text,
  storage_path text,
  checksum text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(document_id,version)
);
create index if not exists idx_adminos_company_document_versions_document on public.adminos_company_document_versions(document_id,version desc);
create index if not exists idx_adminos_company_document_versions_created_by on public.adminos_company_document_versions(created_by);

create table if not exists public.adminos_company_document_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.adminos_company_documents(id) on delete cascade,
  event_type text not null,
  actor_type text not null default 'system',
  actor_id uuid references auth.users(id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_adminos_company_document_events_document on public.adminos_company_document_events(document_id,created_at desc);
create index if not exists idx_adminos_company_document_events_actor on public.adminos_company_document_events(actor_id,created_at desc);

insert into public.adminos_agent_config(agent_key,display_name,enabled,authority_level,confidence_threshold,config)
values('paperwork_agent','Company Paperwork Agent',true,'amber',0.950,jsonb_build_object('release',3,'phase',8,'preserve_versions',true,'approval_required_for_legal',true,'approval_required_for_financial',true,'may_finalize_green',true,'may_sign_contracts',false,'may_change_banking',false))
on conflict(agent_key) do update set display_name=excluded.display_name,enabled=excluded.enabled,authority_level=excluded.authority_level,confidence_threshold=excluded.confidence_threshold,config=excluded.config,updated_at=now();

insert into public.adminos_document_templates(template_key,name,category,format,content_template,variables,risk_level,requires_approval,active,metadata)
values
('general_correspondence_v1','General ResKonnect correspondence','corporate','html','<h1>ResKonnect</h1><p><strong>{{title}}</strong></p><p>{{body}}</p><p>Regards,<br>{{sender_name}}<br>ResKonnect</p>','["title","body","sender_name"]'::jsonb,'green',false,true,jsonb_build_object('release',3,'phase',8,'brand','ResKonnect')),
('application_confirmation_v1','Application confirmation','students','html','<h1>Application Confirmation</h1><p>Dear {{full_name}},</p><p>We confirm receipt of your ResKonnect application reference <strong>{{application_reference}}</strong>.</p><p>{{next_steps}}</p><p>This confirmation is not an approval, placement guarantee or funding confirmation.</p>','["full_name","application_reference","next_steps"]'::jsonb,'green',false,true,jsonb_build_object('release',3,'phase',8,'no_approval_implication',true)),
('placement_confirmation_v1','Accommodation placement confirmation','students','html','<h1>Accommodation Placement Confirmation</h1><p>Dear {{full_name}},</p><p>This letter records the approved placement details currently held by ResKonnect.</p><p><strong>Residence:</strong> {{residence_name}}<br><strong>Room / Placement:</strong> {{placement_detail}}<br><strong>Effective date:</strong> {{effective_date}}</p><p>{{conditions}}</p>','["full_name","residence_name","placement_detail","effective_date","conditions"]'::jsonb,'amber',true,true,jsonb_build_object('release',3,'phase',8,'human_approval',true)),
('wil_candidate_confirmation_v1','WIL candidate confirmation','wil','html','<h1>WIL Candidate Confirmation</h1><p>Dear {{full_name}},</p><p>ResKonnect confirms that your candidate record is active for {{programme_name}}.</p><p>{{next_steps}}</p><p>This document does not guarantee workplace placement, employment or a stipend.</p>','["full_name","programme_name","next_steps"]'::jsonb,'green',false,true,jsonb_build_object('release',3,'phase',8,'no_placement_guarantee',true)),
('partner_followup_letter_v1','Partner follow-up letter','partnerships','html','<h1>Partnership Follow-up</h1><p>Dear {{contact_name}},</p><p>Thank you for engaging with ResKonnect regarding {{subject}}.</p><p>{{summary}}</p><p><strong>Proposed next step:</strong> {{next_step}}</p>','["contact_name","subject","summary","next_step"]'::jsonb,'green',false,true,jsonb_build_object('release',3,'phase',8)),
('commercial_commitment_v1','Commercial commitment draft','corporate','html','<h1>Commercial Draft — Human Approval Required</h1><p>{{body}}</p><p>This draft is not binding until reviewed and approved by an authorised ResKonnect representative.</p>','["body"]'::jsonb,'red',true,true,jsonb_build_object('release',3,'phase',8,'legal_financial_gate',true,'not_binding',true))
on conflict(template_key) do update set name=excluded.name,category=excluded.category,format=excluded.format,content_template=excluded.content_template,variables=excluded.variables,risk_level=excluded.risk_level,requires_approval=excluded.requires_approval,active=excluded.active,metadata=excluded.metadata,updated_at=now();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('adminos-company-documents','adminos-company-documents',false,20971520,array['text/plain','text/html','text/markdown','application/json','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- Extend the existing human approval executor.
create or replace function public.adminos_decide_approval(p_approval_id uuid, p_decision text, p_note text default null)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v public.adminos_approval_requests%rowtype;
  v_action text;
begin
  if not public.adminos_is_staff() then raise exception 'staff access required'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'decision must be approved or rejected'; end if;
  select * into v from public.adminos_approval_requests where id=p_approval_id for update;
  if not found then raise exception 'approval not found'; end if;
  if v.status <> 'pending' then raise exception 'approval is already %', v.status; end if;
  update public.adminos_approval_requests set status=p_decision,decided_by=auth.uid(),decided_at=now(),decision_note=p_note,updated_at=now() where id=p_approval_id;
  v_action := case when p_decision='approved' then 'approved' else 'rejected' end;
  insert into public.adminos_approval_actions(approval_id,actor_id,action,note,snapshot) values(p_approval_id,auth.uid(),v_action,p_note,jsonb_build_object('request_type',v.request_type,'requested_action',v.requested_action));
  if v.request_type='email_reply' then
    if p_decision='approved' then update public.adminos_email_outbox set status='draft',updated_at=now() where approval_id=p_approval_id and status='awaiting_approval';
    else update public.adminos_email_outbox set status='blocked',updated_at=now(),last_error='Human approval rejected' where approval_id=p_approval_id and status='awaiting_approval'; end if;
  elsif v.request_type='whatsapp_reply' then
    if p_decision='approved' then update public.adminos_whatsapp_outbox set status='queued',updated_at=now() where approval_id=p_approval_id and status='awaiting_approval';
    else update public.adminos_whatsapp_outbox set status='blocked',updated_at=now(),last_error='Human approval rejected' where approval_id=p_approval_id and status='awaiting_approval'; end if;
  elsif v.request_type='company_document_finalize' then
    if p_decision='approved' then update public.adminos_company_documents set status='approved',approved_by=auth.uid(),updated_at=now() where approval_id=p_approval_id and status='awaiting_approval';
    else update public.adminos_company_documents set status='rejected',updated_at=now() where approval_id=p_approval_id and status='awaiting_approval'; end if;
  end if;
  insert into public.adminos_audit_events(actor_type,actor_id,action,entity_type,entity_id,after_state,metadata) values('staff',auth.uid(),'approval.'||p_decision,'approval',p_approval_id,jsonb_build_object('status',p_decision),jsonb_build_object('note',p_note,'request_type',v.request_type));
  return jsonb_build_object('id',p_approval_id,'status',p_decision,'request_type',v.request_type);
end;
$$;
revoke all on function public.adminos_decide_approval(uuid,text,text) from public;
revoke all on function public.adminos_decide_approval(uuid,text,text) from anon;
grant execute on function public.adminos_decide_approval(uuid,text,text) to authenticated;

-- Touch triggers, RLS and storage access.
do $$ declare t text; begin
  foreach t in array array['adminos_whatsapp_threads','adminos_whatsapp_outbox','adminos_document_templates','adminos_company_documents'] loop
    execute format('drop trigger if exists trg_%I_touch on public.%I',t,t);
    execute format('create trigger trg_%I_touch before update on public.%I for each row execute function public.adminos_touch_updated_at()',t,t);
  end loop;
end $$;

do $$ declare t text; begin
  foreach t in array array['adminos_whatsapp_threads','adminos_whatsapp_messages','adminos_whatsapp_outbox','adminos_followup_attempts','adminos_document_templates','adminos_company_documents','adminos_company_document_versions','adminos_company_document_events'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists "AdminOS staff access" on public.%I',t);
    execute format('create policy "AdminOS staff access" on public.%I for all to authenticated using ((select public.adminos_is_staff())) with check ((select public.adminos_is_staff()))',t);
  end loop;
end $$;

grant select,insert,update,delete on public.adminos_whatsapp_threads,public.adminos_whatsapp_messages,public.adminos_whatsapp_outbox,public.adminos_followup_attempts,public.adminos_document_templates,public.adminos_company_documents,public.adminos_company_document_versions,public.adminos_company_document_events to authenticated;

drop policy if exists "AdminOS company documents staff read" on storage.objects;
create policy "AdminOS company documents staff read" on storage.objects for select to authenticated using (bucket_id='adminos-company-documents' and (select public.adminos_is_staff()));
drop policy if exists "AdminOS company documents staff insert" on storage.objects;
create policy "AdminOS company documents staff insert" on storage.objects for insert to authenticated with check (bucket_id='adminos-company-documents' and (select public.adminos_is_staff()));
drop policy if exists "AdminOS company documents staff update" on storage.objects;
create policy "AdminOS company documents staff update" on storage.objects for update to authenticated using (bucket_id='adminos-company-documents' and (select public.adminos_is_staff())) with check (bucket_id='adminos-company-documents' and (select public.adminos_is_staff()));
drop policy if exists "AdminOS company documents staff delete" on storage.objects;
create policy "AdminOS company documents staff delete" on storage.objects for delete to authenticated using (bucket_id='adminos-company-documents' and (select public.adminos_is_staff()));

update public.adminos_integration_connections set status=case when status='connected' then status else 'needs_action' end,setup_step=case when status='connected' then 3 else greatest(setup_step,2) end,updated_at=now() where provider='twilio_whatsapp';

insert into public.platform_settings(key,value,description,updated_at)
values('adminos_release_progress',jsonb_build_object('release',3,'total_phases',11,'completed_phases',jsonb_build_array(0,1,2,3,4,5),'current_phase',8,'release_status','gate_running','release_gate_3','running','phase_0','complete','phase_1','complete','phase_2','complete','phase_3','complete','phase_4','complete','phase_5','complete','phase_6','implemented_pending_gate','phase_7','implemented_pending_gate','phase_8','implemented_pending_gate','phase_9','not_started','phase_10','not_started'),'ResKonnect AdminOS implementation progress. Release Gate 3 covers phases 6-8.',now())
on conflict(key) do update set value=excluded.value,description=excluded.description,updated_at=now();

insert into public.adminos_audit_events(actor_type,action,entity_type,after_state,metadata)
values('system','release_gate_3.implementation_started','adminos_release',jsonb_build_object('release',3,'phases',jsonb_build_array(6,7,8),'status','gate_running'),jsonb_build_object('source','production_migration'));
