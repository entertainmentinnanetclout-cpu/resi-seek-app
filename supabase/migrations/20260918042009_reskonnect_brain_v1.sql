-- ResKonnect Brain v1
-- One provider-agnostic intelligence layer for Luna, Dimpho, email, voice,
-- AdminOS and future Meta/other customer-service agents.

create table if not exists public.rk_brain_config (
  config_key text primary key,
  enabled boolean not null default true,
  release integer not null default 1,
  master_instructions text not null,
  memory_retention_days integer not null default 365,
  interaction_retention_days integer not null default 730,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rk_brain_agents (
  agent_key text primary key,
  display_name text not null,
  persona_name text not null,
  channel text not null default 'any',
  role_title text,
  system_instructions text not null,
  default_model text not null default 'gpt-5.6-luna',
  enabled boolean not null default true,
  allow_public boolean not null default false,
  tool_allowlist text[] not null default '{}'::text[],
  memory_policy jsonb not null default '{}'::jsonb,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rk_brain_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  contact_id uuid references public.adminos_contacts(id) on delete cascade,
  memory_key text not null,
  value jsonb not null,
  category text not null default 'preference',
  sensitivity text not null default 'low' check (sensitivity in ('low','medium','restricted')),
  source text not null default 'conversation',
  source_channel text,
  source_ref text,
  source_agent_key text references public.rk_brain_agents(agent_key) on delete set null,
  confidence numeric not null default 0.80 check (confidence >= 0 and confidence <= 1),
  consent_basis text not null default 'service_context',
  status text not null default 'active' check (status in ('active','superseded','expired','deleted')),
  last_confirmed_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rk_brain_memory_identity check (user_id is not null or contact_id is not null)
);
create unique index if not exists rk_brain_memory_user_key_uidx
  on public.rk_brain_memory(user_id,memory_key) where user_id is not null and status='active';
create unique index if not exists rk_brain_memory_contact_key_uidx
  on public.rk_brain_memory(contact_id,memory_key) where user_id is null and contact_id is not null and status='active';
create index if not exists rk_brain_memory_contact_idx on public.rk_brain_memory(contact_id,updated_at desc);
create index if not exists rk_brain_memory_user_idx on public.rk_brain_memory(user_id,updated_at desc);

create table if not exists public.rk_brain_conversation_state (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  thread_ref text not null,
  user_id uuid references auth.users(id) on delete cascade,
  contact_id uuid references public.adminos_contacts(id) on delete cascade,
  last_agent_key text references public.rk_brain_agents(agent_key) on delete set null,
  current_intent text,
  current_goal text,
  entities jsonb not null default '{}'::jsonb,
  state jsonb not null default '{}'::jsonb,
  next_best_action jsonb,
  turn_count integer not null default 0,
  last_user_message_at timestamptz,
  last_agent_message_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(channel,thread_ref)
);
create index if not exists rk_brain_state_contact_idx on public.rk_brain_conversation_state(contact_id,updated_at desc);
create index if not exists rk_brain_state_user_idx on public.rk_brain_conversation_state(user_id,updated_at desc);

create table if not exists public.rk_brain_interactions (
  id uuid primary key default gen_random_uuid(),
  agent_key text not null references public.rk_brain_agents(agent_key),
  channel text not null,
  thread_ref text,
  user_id uuid references auth.users(id) on delete set null,
  contact_id uuid references public.adminos_contacts(id) on delete set null,
  source_message_id uuid,
  request_text text not null,
  response_text text,
  intent text,
  goal text,
  entities jsonb not null default '{}'::jsonb,
  next_best_action jsonb,
  outcome text not null default 'answered',
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  risk text not null default 'green' check (risk in ('green','amber','red')),
  escalated boolean not null default false,
  tool_calls jsonb not null default '[]'::jsonb,
  tool_results jsonb not null default '[]'::jsonb,
  provider text,
  model text,
  run_id uuid references public.adminos_agent_runs(id) on delete set null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost_usd numeric not null default 0,
  latency_ms integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists rk_brain_interactions_contact_idx on public.rk_brain_interactions(contact_id,created_at desc);
create index if not exists rk_brain_interactions_user_idx on public.rk_brain_interactions(user_id,created_at desc);
create index if not exists rk_brain_interactions_thread_idx on public.rk_brain_interactions(channel,thread_ref,created_at desc);
create index if not exists rk_brain_interactions_intent_idx on public.rk_brain_interactions(intent,created_at desc);

create table if not exists public.rk_brain_intent_catalog (
  intent_key text primary key,
  label text not null,
  description text,
  status text not null default 'active' check(status in ('active','review','disabled')),
  observed_count bigint not null default 0,
  resolution_count bigint not null default 0,
  escalation_count bigint not null default 0,
  conversion_count bigint not null default 0,
  last_seen_at timestamptz,
  recommended_next_actions jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rk_brain_feedback (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid references public.rk_brain_interactions(id) on delete cascade,
  contact_id uuid references public.adminos_contacts(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  source text not null default 'customer',
  score smallint check(score between 1 and 5),
  satisfied boolean,
  feedback_text text,
  outcome text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.rk_brain_config enable row level security;
alter table public.rk_brain_agents enable row level security;
alter table public.rk_brain_memory enable row level security;
alter table public.rk_brain_conversation_state enable row level security;
alter table public.rk_brain_interactions enable row level security;
alter table public.rk_brain_intent_catalog enable row level security;
alter table public.rk_brain_feedback enable row level security;

revoke all on public.rk_brain_config from anon, authenticated;
revoke all on public.rk_brain_agents from anon, authenticated;
revoke all on public.rk_brain_memory from anon, authenticated;
revoke all on public.rk_brain_conversation_state from anon, authenticated;
revoke all on public.rk_brain_interactions from anon, authenticated;
revoke all on public.rk_brain_intent_catalog from anon, authenticated;
revoke all on public.rk_brain_feedback from anon, authenticated;

insert into public.rk_brain_config(config_key,enabled,release,master_instructions,memory_retention_days,interaction_retention_days,config)
values(
  'core',
  true,
  1,
  $brain$
You are the ResKonnect Brain: the shared intelligence layer behind every ResKonnect customer-service agent.
Use the agent profile only for channel-specific identity, tone and scope. The underlying facts, customer memory, intent understanding, business rules and tool results are shared.
Use verified ResKonnect knowledge and live tool/database results as the source of truth. Never invent availability, prices, application status, funding outcomes, eligibility, policy, placements or business commitments.
Use cross-channel customer memory to avoid repeating questions already answered. Treat memory as hints unless it is verified or explicitly supplied by the customer. Never store passwords, OTPs, banking credentials, identity numbers, medical information or other unnecessary sensitive information.
Ask only for information required to complete the customer's current goal. Prefer one best next action over long menus. If a protected decision or uncertain fact requires a person, escalate cleanly and stop automation from obstructing the handoff.
ResKonnect customer-service agents may explain, search, guide, retrieve verified account information through authorized tools, create permitted service requests and request human support. They may not make funding, admission, placement, room-allocation, legal or financial approval decisions.
All public ResKonnect links must use https://www.reskonnect.org.
Return concise, useful customer-facing answers and structured machine-readable intent, entities, memory updates, next-best-action and tool requests.
$brain$,
  365,
  730,
  jsonb_build_object(
    'brand_descriptor','Living • AI • Opportunity',
    'tagline','Connecting Residents. Advancing Futures.',
    'canonical_website','https://www.reskonnect.org',
    'knowledge_store','dimpho_knowledge_documents',
    'tool_registry','dimpho_tools',
    'privacy','POPIA-minimised',
    'shared_across_agents',true
  )
)
on conflict(config_key) do update set
  enabled=excluded.enabled,
  release=excluded.release,
  master_instructions=excluded.master_instructions,
  memory_retention_days=excluded.memory_retention_days,
  interaction_retention_days=excluded.interaction_retention_days,
  config=public.rk_brain_config.config || excluded.config,
  updated_at=now();

insert into public.rk_brain_agents(agent_key,display_name,persona_name,channel,role_title,system_instructions,default_model,enabled,allow_public,tool_allowlist,memory_policy,config)
values
(
  'luna','Luna · Website','Luna','website','ResKonnect website concierge',
  'Represent ResKonnect on the website and authenticated in-app customer journeys. Be discovery-led and conversion-aware without pressure. Explain Living, AI and Opportunity services clearly, use verified data, and continue from shared customer context rather than restarting the conversation.',
  'gpt-5.6-luna',true,true,
  array['find_residences','get_residence_details','get_virtual_tour','get_virtual_tour_scene','get_opportunities','get_application_status','get_application_requirements','get_customer_profile','request_human_support'],
  jsonb_build_object('read_shared',true,'write_explicit_low_sensitivity',true),
  jsonb_build_object('identity_boundary','website')
),
(
  'dimpho','Dimpho · WhatsApp','Dimpho','whatsapp','ResKonnect service concierge',
  'Represent ResKonnect in WhatsApp customer service. Be conversational, efficient and human-like. Resolve routine enquiries, continue from shared cross-channel memory, use live tools for operational facts, and hand over once when a human is required. Do not repeatedly ask questions already answered elsewhere.',
  'gpt-5.6-luna',true,false,
  array['find_residences','get_residence_details','get_virtual_tour','get_virtual_tour_scene','get_opportunities','get_application_status','get_application_requirements','get_customer_profile','get_referral_status','request_human_support'],
  jsonb_build_object('read_shared',true,'write_explicit_low_sensitivity',true),
  jsonb_build_object('identity_boundary','whatsapp')
),
(
  'email_service','ResKonnect Email Service','ResKonnect','email','Customer-service email agent',
  'Draft and reason about customer-service email using the same verified ResKonnect knowledge and customer context as other channels. Preserve professional email tone. Do not send sensitive or binding commitments automatically.',
  'gpt-5.6-luna',true,false,
  array['find_residences','get_residence_details','get_opportunities','get_application_status','get_application_requirements','get_customer_profile'],
  jsonb_build_object('read_shared',true,'write_explicit_low_sensitivity',true),
  '{}'::jsonb
),
(
  'voice_service','ResKonnect Voice Service','ResKonnect','voice','Customer-service voice agent',
  'Answer briefly for spoken delivery. Use the shared ResKonnect Brain and verified facts. Do not make legal, financial, admission, funding, placement or room-allocation commitments. Escalate uncertainty rather than guessing.',
  'gpt-5.6-luna',true,false,
  array['find_residences','get_residence_details','get_opportunities','get_application_status','get_customer_profile','request_human_support'],
  jsonb_build_object('read_shared',true,'write_explicit_low_sensitivity',false),
  '{}'::jsonb
),
(
  'meta_business_agent','Meta Business Agent Gateway','ResKonnect','whatsapp_meta','Meta WhatsApp customer-service gateway',
  'Use this profile when Meta Business Agent or a future WhatsApp Business Platform gateway calls ResKonnect. Keep Meta as the conversational surface while ResKonnect Brain remains the source of customer context, verified business knowledge and actions.',
  'gpt-5.6-luna',true,false,
  array['find_residences','get_residence_details','get_virtual_tour','get_opportunities','get_application_status','get_application_requirements','get_customer_profile','request_human_support'],
  jsonb_build_object('read_shared',true,'write_explicit_low_sensitivity',true),
  jsonb_build_object('external_gateway',true)
),
(
  'adminos_copilot','AdminOS Customer Service Copilot','AdminOS','admin','Internal customer-service copilot',
  'Assist authorised ResKonnect staff with customer-service context, conversation continuity, intent patterns and next-best actions. Distinguish verified facts from suggestions. Never silently execute protected external actions.',
  'gpt-5.6-luna',true,false,
  array['find_residences','get_residence_details','get_virtual_tour','get_opportunities','get_application_status','get_application_requirements','get_customer_profile','get_referral_status'],
  jsonb_build_object('read_shared',true,'write_explicit_low_sensitivity',false),
  jsonb_build_object('staff_only',true)
)
on conflict(agent_key) do update set
  display_name=excluded.display_name,
  persona_name=excluded.persona_name,
  channel=excluded.channel,
  role_title=excluded.role_title,
  system_instructions=excluded.system_instructions,
  default_model=excluded.default_model,
  enabled=excluded.enabled,
  allow_public=excluded.allow_public,
  tool_allowlist=excluded.tool_allowlist,
  memory_policy=excluded.memory_policy,
  config=public.rk_brain_agents.config || excluded.config,
  updated_at=now();

-- Promote existing Dimpho memory into the shared brain without deleting legacy data.
insert into public.rk_brain_memory(
  user_id,contact_id,memory_key,value,category,sensitivity,source,source_channel,source_ref,
  source_agent_key,confidence,consent_basis,status,last_confirmed_at,expires_at,metadata,created_at,updated_at
)
select
  m.user_id,m.contact_id,m.memory_key,m.value,m.category,m.sensitivity,m.source,
  'whatsapp',m.source_ref,'dimpho',m.confidence,m.consent_basis,m.status,
  m.updated_at,m.expires_at,coalesce(m.metadata,'{}'::jsonb)||jsonb_build_object('migrated_from','dimpho_customer_memory'),
  m.created_at,m.updated_at
from public.dimpho_customer_memory m
where m.status='active'
  and not exists (
    select 1 from public.rk_brain_memory b
    where b.status='active'
      and b.memory_key=m.memory_key
      and ((m.user_id is not null and b.user_id=m.user_id)
        or (m.user_id is null and b.user_id is null and b.contact_id=m.contact_id))
  );

create or replace function public.rk_brain_sync_legacy_memory()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare v_id uuid;
begin
  if new.status <> 'active' then
    update public.rk_brain_memory
       set status='superseded',updated_at=now()
     where memory_key=new.memory_key and status='active'
       and ((new.user_id is not null and user_id=new.user_id)
         or (new.user_id is null and user_id is null and contact_id=new.contact_id));
    return new;
  end if;

  select id into v_id
  from public.rk_brain_memory
  where memory_key=new.memory_key and status='active'
    and ((new.user_id is not null and user_id=new.user_id)
      or (new.user_id is null and user_id is null and contact_id=new.contact_id))
  limit 1;

  if v_id is null then
    insert into public.rk_brain_memory(
      user_id,contact_id,memory_key,value,category,sensitivity,source,source_channel,source_ref,
      source_agent_key,confidence,consent_basis,status,last_confirmed_at,expires_at,metadata
    ) values(
      new.user_id,new.contact_id,new.memory_key,new.value,new.category,new.sensitivity,new.source,
      'whatsapp',new.source_ref,'dimpho',new.confidence,new.consent_basis,'active',now(),new.expires_at,
      coalesce(new.metadata,'{}'::jsonb)||jsonb_build_object('synced_from','dimpho_customer_memory')
    );
  else
    update public.rk_brain_memory set
      value=new.value,category=new.category,sensitivity=new.sensitivity,source=new.source,
      source_channel='whatsapp',source_ref=new.source_ref,source_agent_key='dimpho',
      confidence=new.confidence,consent_basis=new.consent_basis,status='active',
      last_confirmed_at=now(),expires_at=new.expires_at,
      metadata=coalesce(metadata,'{}'::jsonb)||coalesce(new.metadata,'{}'::jsonb)||jsonb_build_object('synced_from','dimpho_customer_memory'),
      updated_at=now()
    where id=v_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rk_brain_sync_legacy_memory on public.dimpho_customer_memory;
create trigger trg_rk_brain_sync_legacy_memory
after insert or update on public.dimpho_customer_memory
for each row execute function public.rk_brain_sync_legacy_memory();

-- Seed the intent catalog from real ResKonnect history without duplicating raw conversations.
insert into public.rk_brain_intent_catalog(intent_key,label,observed_count,last_seen_at,metadata)
select
  regexp_replace(lower(trim(intent)),'[^a-z0-9]+','_','g') as intent_key,
  initcap(replace(trim(intent),'_',' ')) as label,
  count(*)::bigint,
  max(coalesce(last_inbound_at,last_message_at,updated_at)),
  jsonb_build_object('seed_source','adminos_whatsapp_threads')
from public.adminos_whatsapp_threads
where nullif(trim(intent),'') is not null
group by trim(intent)
on conflict(intent_key) do update set
  observed_count=greatest(public.rk_brain_intent_catalog.observed_count,excluded.observed_count),
  last_seen_at=greatest(public.rk_brain_intent_catalog.last_seen_at,excluded.last_seen_at),
  metadata=public.rk_brain_intent_catalog.metadata||excluded.metadata,
  updated_at=now();

insert into public.rk_brain_intent_catalog(intent_key,label,observed_count,last_seen_at,metadata)
select
  regexp_replace(lower(trim(primary_need::text)),'[^a-z0-9]+','_','g') as intent_key,
  initcap(replace(trim(primary_need::text),'_',' ')) as label,
  count(*)::bigint,
  max(updated_at),
  jsonb_build_object('seed_source','user_intent_profiles')
from public.user_intent_profiles
where primary_need is not null and nullif(trim(primary_need::text),'') is not null
group by trim(primary_need::text)
on conflict(intent_key) do update set
  observed_count=public.rk_brain_intent_catalog.observed_count + excluded.observed_count,
  last_seen_at=greatest(public.rk_brain_intent_catalog.last_seen_at,excluded.last_seen_at),
  metadata=public.rk_brain_intent_catalog.metadata||excluded.metadata,
  updated_at=now();

create or replace function public.rk_brain_overview()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_role text;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select public.get_user_staff_role(auth.uid()) into v_role;
  if v_role is null then raise exception 'Staff access required'; end if;

  select jsonb_build_object(
    'release',(select release from public.rk_brain_config where config_key='core'),
    'enabled',(select enabled from public.rk_brain_config where config_key='core'),
    'agents',(select coalesce(jsonb_agg(jsonb_build_object(
      'agent_key',agent_key,'display_name',display_name,'persona_name',persona_name,'channel',channel,
      'enabled',enabled,'model',default_model,'tools',coalesce(array_length(tool_allowlist,1),0)
    ) order by agent_key),'[]'::jsonb) from public.rk_brain_agents),
    'memory_count',(select count(*) from public.rk_brain_memory where status='active'),
    'known_customers',(select count(distinct coalesce(user_id::text,contact_id::text)) from public.rk_brain_memory where status='active'),
    'interactions_24h',(select count(*) from public.rk_brain_interactions where created_at>=now()-interval '24 hours'),
    'escalations_24h',(select count(*) from public.rk_brain_interactions where created_at>=now()-interval '24 hours' and escalated=true),
    'knowledge_documents',(select count(*) from public.dimpho_knowledge_documents where status='published' and (valid_until is null or valid_until>now())),
    'knowledge_chunks',(select count(*) from public.dimpho_knowledge_chunks),
    'top_intents',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (
      select jsonb_build_object('intent_key',intent_key,'label',label,'observed_count',observed_count,'last_seen_at',last_seen_at) x
      from public.rk_brain_intent_catalog
      where status='active'
      order by observed_count desc,last_seen_at desc nulls last
      limit 10
    ) q),
    'channels',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (
      select jsonb_build_object('channel',channel,'interactions',count(*),'last_seen_at',max(created_at)) x
      from public.rk_brain_interactions
      group by channel
      order by count(*) desc
    ) q)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.rk_brain_overview() from public, anon;
grant execute on function public.rk_brain_overview() to authenticated;

comment on table public.rk_brain_memory is 'Canonical cross-channel ResKonnect customer memory. Do not store credentials, OTPs, banking credentials, identity numbers or unnecessary sensitive data.';
comment on table public.rk_brain_interactions is 'Provider-agnostic interaction and outcome telemetry shared by Luna, Dimpho and future customer-service agents.';
comment on table public.rk_brain_agents is 'Agent personalities and channel boundaries layered on top of the shared ResKonnect Brain.';
