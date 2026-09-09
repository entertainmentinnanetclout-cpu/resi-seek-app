-- Dimpho Intelligence R5-R6 source-control parity.
-- R5: governed tool registry, permission/approval/audit execution model.
-- R6: Customer 360 memory, conversation state and resumable workflow state.

create table if not exists public.dimpho_tools (
  id uuid primary key default gen_random_uuid(),
  tool_key text not null unique,
  name text not null,
  description text not null,
  category text not null default 'general',
  operation text not null check(operation in ('read','write','action')),
  risk_level text not null default 'green' check(risk_level in ('green','amber','red')),
  requires_auth boolean not null default true,
  requires_confirmation boolean not null default false,
  requires_aal2 boolean not null default false,
  user_scoped boolean not null default true,
  input_schema jsonb not null default '{}',
  output_schema jsonb not null default '{}',
  enabled boolean not null default true,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dimpho_tool_permissions (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid not null references public.dimpho_tools(id) on delete cascade,
  principal_type text not null check(principal_type in ('user','staff','god_mode','agent')),
  principal_value text not null default '*',
  can_invoke boolean not null default true,
  max_calls_per_hour integer,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique(tool_id,principal_type,principal_value)
);

create table if not exists public.dimpho_tool_invocations (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid not null references public.dimpho_tools(id),
  tool_key text not null,
  actor_user_id uuid,
  context_user_id uuid,
  contact_id uuid references public.adminos_contacts(id) on delete set null,
  thread_ref text,
  agent_run_id uuid references public.adminos_agent_runs(id) on delete set null,
  channel text,
  request_payload jsonb not null default '{}',
  response_payload jsonb,
  risk_level text not null default 'green',
  status text not null default 'started' check(status in ('started','awaiting_confirmation','awaiting_approval','executed','failed','denied','cancelled')),
  error_code text,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms integer,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.dimpho_tool_approvals (
  id uuid primary key default gen_random_uuid(),
  invocation_id uuid not null references public.dimpho_tool_invocations(id) on delete cascade,
  status text not null default 'pending',
  requested_by uuid,
  decided_by uuid,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  expires_at timestamptz,
  decision_reason text,
  metadata jsonb not null default '{}'
);

create index if not exists idx_dimpho_tool_invocations_context on public.dimpho_tool_invocations(context_user_id,created_at desc);
create index if not exists idx_dimpho_tool_invocations_run on public.dimpho_tool_invocations(agent_run_id,created_at desc);

insert into public.dimpho_tools(tool_key,name,description,category,operation,risk_level,requires_auth,requires_confirmation,requires_aal2,user_scoped,input_schema,output_schema,enabled,metadata) values
('get_customer_profile','Customer Profile','Read the signed-in customer profile without exposing identity numbers or secrets.','customer','read','green',true,false,false,true,'{"type":"object","properties":{}}','{}',true,'{"source":"supabase","release":5}'),
('get_application_status','Application Status','Read the customer accommodation applications and current statuses from production.','applications','read','green',true,false,false,true,'{"type":"object","properties":{"application_id":{"type":"string"}}}','{}',true,'{"source":"supabase","release":5}'),
('get_application_requirements','Application Requirements','Read verified document requirements and the customer submission state.','applications','read','green',true,false,false,true,'{"type":"object","properties":{"flow_key":{"type":"string"},"application_id":{"type":"string"}}}','{}',true,'{"source":"supabase","release":5}'),
('find_residences','Find Residences','Search visible production residences with verified filters and live availability fields.','accommodation','read','green',false,false,false,false,'{"type":"object","properties":{"limit":{"type":"integer"},"nsfas":{"type":"boolean"},"campus":{"type":"string"},"max_price":{"type":"number"},"room_type":{"type":"string"}}}','{}',true,'{"source":"supabase","release":5}'),
('get_residence_details','Residence Details','Read a visible residence by id or slug using production data.','accommodation','read','green',false,false,false,false,'{"type":"object","properties":{"slug":{"type":"string"},"residence_id":{"type":"string"}}}','{}',true,'{"source":"supabase","release":5}'),
('get_opportunities','Opportunities','Read current published ResKonnect opportunities.','opportunities','read','green',false,false,false,false,'{"type":"object","properties":{"type":{"type":"string"},"limit":{"type":"integer"},"province":{"type":"string"}}}','{}',true,'{"source":"supabase","release":5}'),
('get_referral_status','Referral Status','Read the signed-in customer referral code, counts and earnings.','referrals','read','green',true,false,false,true,'{"type":"object","properties":{}}','{}',true,'{"source":"supabase","release":5}'),
('request_human_support','Request Human Support','Escalate the active conversation to a ResKonnect human support agent.','support','action','amber',true,true,false,true,'{"type":"object","properties":{"reason":{"type":"string"},"thread_id":{"type":"string"}}}','{}',true,'{"source":"supabase","release":5,"customer_visible":true}')
on conflict(tool_key) do update set name=excluded.name,description=excluded.description,category=excluded.category,operation=excluded.operation,risk_level=excluded.risk_level,requires_auth=excluded.requires_auth,requires_confirmation=excluded.requires_confirmation,requires_aal2=excluded.requires_aal2,user_scoped=excluded.user_scoped,input_schema=excluded.input_schema,output_schema=excluded.output_schema,enabled=excluded.enabled,metadata=excluded.metadata,updated_at=now();

insert into public.dimpho_tool_permissions(tool_id,principal_type,principal_value,can_invoke,max_calls_per_hour,metadata)
select id,'user','*',true,120,'{"release":5}' from public.dimpho_tools where requires_auth
on conflict(tool_id,principal_type,principal_value) do update set can_invoke=true;
insert into public.dimpho_tool_permissions(tool_id,principal_type,principal_value,can_invoke,max_calls_per_hour,metadata)
select id,'staff','*',true,600,'{"release":5}' from public.dimpho_tools
on conflict(tool_id,principal_type,principal_value) do update set can_invoke=true;
insert into public.dimpho_tool_permissions(tool_id,principal_type,principal_value,can_invoke,max_calls_per_hour,metadata)
select id,'agent','konnect_agent',true,600,'{"release":5}' from public.dimpho_tools
on conflict(tool_id,principal_type,principal_value) do update set can_invoke=true;

create table if not exists public.dimpho_customer_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  contact_id uuid references public.adminos_contacts(id) on delete cascade,
  memory_key text not null,
  value jsonb not null,
  category text not null default 'preference',
  sensitivity text not null default 'low' check(sensitivity in ('low','moderate')),
  source text not null default 'conversation',
  source_ref text,
  confidence numeric not null default .80 check(confidence between 0 and 1),
  consent_basis text not null default 'service_context',
  status text not null default 'active' check(status in ('active','superseded','expired','deleted')),
  expires_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dimpho_customer_memory_identity check(user_id is not null or contact_id is not null),
  constraint dimpho_customer_memory_safe_key check(memory_key in ('campus','institution','budget_min','budget_max','room_preference','language_preference','communication_preference','funding_type','accommodation_preferences','transport_preference'))
);
create unique index if not exists uq_dimpho_customer_memory_user_key on public.dimpho_customer_memory(user_id,memory_key) where user_id is not null and status='active';
create unique index if not exists uq_dimpho_customer_memory_contact_key on public.dimpho_customer_memory(contact_id,memory_key) where contact_id is not null and user_id is null and status='active';
create index if not exists idx_dimpho_customer_memory_context on public.dimpho_customer_memory(coalesce(user_id,contact_id),updated_at desc);

create table if not exists public.dimpho_conversation_state (
 id uuid primary key default gen_random_uuid(), channel text not null, thread_ref text not null, user_id uuid, contact_id uuid references public.adminos_contacts(id) on delete set null,
 current_intent text,current_goal text,state jsonb not null default '{}',entities jsonb not null default '{}',selected_items jsonb not null default '{}',completed_actions text[] not null default '{}',pending_action text,active_workflow_key text,current_step_key text,turn_count integer not null default 0,last_user_message_at timestamptz,last_agent_message_at timestamptz,expires_at timestamptz,metadata jsonb not null default '{}',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(channel,thread_ref)
);

create table if not exists public.dimpho_workflow_runs (
 id uuid primary key default gen_random_uuid(),workflow_id uuid not null references public.dimpho_app_workflows(id),workflow_key text not null,user_id uuid,contact_id uuid references public.adminos_contacts(id) on delete set null,channel text,thread_ref text,status text not null default 'active' check(status in ('active','paused','completed','failed','cancelled','escalated')),current_step_key text,current_step_order integer,input_context jsonb not null default '{}',working_state jsonb not null default '{}',result jsonb,started_at timestamptz not null default now(),last_progress_at timestamptz not null default now(),completed_at timestamptz,metadata jsonb not null default '{}'
);

create table if not exists public.dimpho_workflow_events (
 id uuid primary key default gen_random_uuid(),workflow_run_id uuid not null references public.dimpho_workflow_runs(id) on delete cascade,event_type text not null,step_key text,actor_type text not null default 'dimpho',actor_user_id uuid,payload jsonb not null default '{}',created_at timestamptz not null default now()
);
create index if not exists idx_dimpho_conversation_state_user on public.dimpho_conversation_state(user_id,updated_at desc);
create index if not exists idx_dimpho_conversation_state_contact on public.dimpho_conversation_state(contact_id,updated_at desc);
create index if not exists idx_dimpho_workflow_runs_active_user on public.dimpho_workflow_runs(user_id,status,last_progress_at desc);
create index if not exists idx_dimpho_workflow_runs_thread on public.dimpho_workflow_runs(channel,thread_ref,status,last_progress_at desc);

create or replace function public.dimpho_customer_context_snapshot(p_user_id uuid default null,p_contact_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=coalesce(p_user_id,auth.uid()); v_contact uuid:=p_contact_id; v_allowed boolean:=false; v_result jsonb;
begin
 v_allowed := (auth.role()='service_role') or (auth.uid() is not null and v_user=auth.uid()) or (auth.uid() is not null and public.adminos_is_staff());
 if not v_allowed then raise exception 'Context access denied' using errcode='42501'; end if;
 if v_contact is null and v_user is not null then select id into v_contact from public.adminos_contacts where profile_user_id=v_user order by updated_at desc limit 1; end if;
 select jsonb_build_object(
 'profile',(select to_jsonb(x) from (select id,full_name,email,campus,course,year_of_study,phone,applicant_stage from public.profiles where id=v_user) x),
 'memory',coalesce((select jsonb_object_agg(memory_key,value) from public.dimpho_customer_memory where status='active' and (expires_at is null or expires_at>now()) and ((v_user is not null and user_id=v_user) or (user_id is null and v_contact is not null and contact_id=v_contact))),'{}'::jsonb),
 'applications',coalesce((select jsonb_agg(to_jsonb(a) order by a.updated_at desc) from (select ap.id,ap.status,ap.funding_type,ap.residence_id,ap.created_at,ap.updated_at,r.name as residence_name,r.campus,r.available_spots from public.applications ap left join public.residences r on r.id=ap.residence_id where ap.user_id=v_user limit 8) a),'[]'::jsonb),
 'active_workflows',coalesce((select jsonb_agg(to_jsonb(w) order by w.last_progress_at desc) from (select id,workflow_key,status,current_step_key,current_step_order,working_state,last_progress_at from public.dimpho_workflow_runs where user_id=v_user and status in ('active','paused') limit 5) w),'[]'::jsonb),
 'conversation_state',(select to_jsonb(s) from (select channel,thread_ref,current_intent,current_goal,state,entities,selected_items,completed_actions,pending_action,active_workflow_key,current_step_key,turn_count,updated_at from public.dimpho_conversation_state where (user_id=v_user or (v_contact is not null and contact_id=v_contact)) order by updated_at desc limit 1) s)
 ) into v_result;
 return coalesce(v_result,'{}'::jsonb);
end $$;
grant execute on function public.dimpho_customer_context_snapshot(uuid,uuid) to authenticated,service_role;

alter table public.dimpho_tools enable row level security;
alter table public.dimpho_tool_permissions enable row level security;
alter table public.dimpho_tool_invocations enable row level security;
alter table public.dimpho_tool_approvals enable row level security;
alter table public.dimpho_customer_memory enable row level security;
alter table public.dimpho_conversation_state enable row level security;
alter table public.dimpho_workflow_runs enable row level security;
alter table public.dimpho_workflow_events enable row level security;

do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='dimpho_customer_memory' and policyname='dimpho_memory_self') then create policy dimpho_memory_self on public.dimpho_customer_memory for all to authenticated using(user_id=auth.uid() or public.adminos_is_staff()) with check(user_id=auth.uid() or public.adminos_is_staff()); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='dimpho_conversation_state' and policyname='dimpho_state_self_read') then create policy dimpho_state_self_read on public.dimpho_conversation_state for select to authenticated using(user_id=auth.uid() or public.adminos_is_staff()); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='dimpho_workflow_runs' and policyname='dimpho_workflow_self_read') then create policy dimpho_workflow_self_read on public.dimpho_workflow_runs for select to authenticated using(user_id=auth.uid() or public.adminos_is_staff()); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='dimpho_tools' and policyname='dimpho_tools_staff_read') then create policy dimpho_tools_staff_read on public.dimpho_tools for select to authenticated using(public.adminos_is_staff()); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='dimpho_tool_invocations' and policyname='dimpho_invocations_staff_read') then create policy dimpho_invocations_staff_read on public.dimpho_tool_invocations for select to authenticated using(public.adminos_is_staff()); end if;
end $$;

update public.dimpho_intelligence_settings set release_state=coalesce(release_state,'{}')||'{"release_5":"active","release_6":"active"}'::jsonb,updated_at=now() where id=1;
