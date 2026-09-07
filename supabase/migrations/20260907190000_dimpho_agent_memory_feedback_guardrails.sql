-- Dimpho human-agent memory, learning and satisfaction guardrails.
-- Routine memory/feedback is deterministic and does not consume AI credits.

create table if not exists public.adminos_agent_feedback (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.adminos_whatsapp_threads(id) on delete set null,
  contact_id uuid references public.adminos_contacts(id) on delete set null,
  source_message_id uuid references public.adminos_whatsapp_messages(id) on delete set null,
  context_key text,
  satisfied boolean,
  score smallint check (score between 1 and 5),
  feedback_text text,
  language_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_adminos_agent_feedback_thread on public.adminos_agent_feedback(thread_id,created_at desc);
create index if not exists idx_adminos_agent_feedback_satisfied on public.adminos_agent_feedback(satisfied,created_at desc);
alter table public.adminos_agent_feedback enable row level security;
drop policy if exists "AdminOS staff read agent feedback" on public.adminos_agent_feedback;
create policy "AdminOS staff read agent feedback" on public.adminos_agent_feedback for select to authenticated using ((select public.adminos_is_staff()));
revoke all on public.adminos_agent_feedback from anon;
grant select on public.adminos_agent_feedback to authenticated;

create table if not exists public.adminos_agent_learning_queue (
  id uuid primary key default gen_random_uuid(),
  normalized_question text not null unique,
  example_question text not null,
  category text not null default 'knowledge_gap',
  status text not null default 'new' check (status in ('new','reviewing','resolved','dismissed')),
  occurrence_count integer not null default 1,
  first_thread_id uuid references public.adminos_whatsapp_threads(id) on delete set null,
  last_thread_id uuid references public.adminos_whatsapp_threads(id) on delete set null,
  contact_id uuid references public.adminos_contacts(id) on delete set null,
  latest_reason text,
  resolution_note text,
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid
);
create index if not exists idx_adminos_agent_learning_status on public.adminos_agent_learning_queue(status,last_seen_at desc);
alter table public.adminos_agent_learning_queue enable row level security;
drop policy if exists "AdminOS staff manage agent learning queue" on public.adminos_agent_learning_queue;
create policy "AdminOS staff manage agent learning queue" on public.adminos_agent_learning_queue for all to authenticated using ((select public.adminos_is_staff())) with check ((select public.adminos_is_staff()));
revoke all on public.adminos_agent_learning_queue from anon;
grant select,update on public.adminos_agent_learning_queue to authenticated;

create or replace function public.adminos_record_learning_gap(
  p_question text,
  p_thread_id uuid default null,
  p_contact_id uuid default null,
  p_reason text default null,
  p_category text default 'knowledge_gap',
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path=public as $$
declare
  v_norm text;
  v_id uuid;
begin
  v_norm := lower(regexp_replace(trim(coalesce(p_question,'')),'\\s+',' ','g'));
  if length(v_norm) < 3 then return null; end if;
  insert into public.adminos_agent_learning_queue(
    normalized_question,example_question,category,first_thread_id,last_thread_id,contact_id,latest_reason,metadata
  ) values (
    left(v_norm,1000),left(trim(p_question),4000),coalesce(nullif(p_category,''),'knowledge_gap'),p_thread_id,p_thread_id,p_contact_id,p_reason,coalesce(p_metadata,'{}'::jsonb)
  )
  on conflict (normalized_question) do update set
    occurrence_count=adminos_agent_learning_queue.occurrence_count+1,
    last_thread_id=excluded.last_thread_id,
    contact_id=coalesce(excluded.contact_id,adminos_agent_learning_queue.contact_id),
    latest_reason=coalesce(excluded.latest_reason,adminos_agent_learning_queue.latest_reason),
    metadata=adminos_agent_learning_queue.metadata||excluded.metadata,
    last_seen_at=now(),
    status=case when adminos_agent_learning_queue.status='dismissed' then 'new' else adminos_agent_learning_queue.status end
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.adminos_record_learning_gap(text,uuid,uuid,text,text,jsonb) from public,anon;
grant execute on function public.adminos_record_learning_gap(text,uuid,uuid,text,text,jsonb) to authenticated;

create or replace function public.adminos_record_agent_feedback(
  p_thread_id uuid,
  p_contact_id uuid default null,
  p_source_message_id uuid default null,
  p_context_key text default null,
  p_satisfied boolean default null,
  p_score integer default null,
  p_feedback_text text default null,
  p_language_code text default 'en',
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  insert into public.adminos_agent_feedback(thread_id,contact_id,source_message_id,context_key,satisfied,score,feedback_text,language_code,metadata)
  values(p_thread_id,p_contact_id,p_source_message_id,p_context_key,p_satisfied,case when p_score between 1 and 5 then p_score else null end,nullif(trim(coalesce(p_feedback_text,'')),''),p_language_code,coalesce(p_metadata,'{}'::jsonb))
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.adminos_record_agent_feedback(uuid,uuid,uuid,text,boolean,integer,text,text,jsonb) from public,anon;
grant execute on function public.adminos_record_agent_feedback(uuid,uuid,uuid,text,boolean,integer,text,text,jsonb) to authenticated;

-- Do not chase users merely because options were shown or a conversation was qualified.
-- Follow-ups are reserved for explicit customer actions that were started but not completed.
create or replace function public.adminos_touch_whatsapp_conversion(
  p_thread_id uuid,
  p_contact_id uuid default null,
  p_user_id uuid default null,
  p_intent text default null,
  p_stage text default null,
  p_patch jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path=public as $$
declare
  v_id uuid;
  v_stage text := coalesce(nullif(p_stage,''),'new');
  v_follow timestamptz;
begin
  v_follow := case v_stage
    when 'lead_created' then now() + interval '4 hours'
    when 'application_started' then now() + interval '4 hours'
    when 'reservation_started' then now() + interval '4 hours'
    else null
  end;

  insert into public.adminos_whatsapp_conversion_leads(
    thread_id,contact_id,user_id,intent,stage,campus,institution,funding,academic_year,tenant_type,room_preference,budget_min,budget_max,selected_residence_id,last_inbound_at,last_conversion_action_at,next_follow_up_at,converted_at,metadata
  ) values (
    p_thread_id,p_contact_id,p_user_id,p_intent,v_stage,
    nullif(p_patch->>'campus',''),nullif(p_patch->>'institution',''),nullif(p_patch->>'funding',''),
    case when (p_patch->>'academic_year') ~ '^\\d{4}$' then (p_patch->>'academic_year')::integer when (p_patch->>'year') ~ '^\\d{4}$' then (p_patch->>'year')::integer else null end,
    nullif(coalesce(p_patch->>'tenant_type',p_patch->>'tenant'),''),nullif(p_patch->>'room_preference',''),
    case when (p_patch->>'budget_min') ~ '^\\d+(\\.\\d+)?$' then (p_patch->>'budget_min')::numeric else null end,
    case when (p_patch->>'budget_max') ~ '^\\d+(\\.\\d+)?$' then (p_patch->>'budget_max')::numeric else null end,
    case when coalesce(p_patch->>'selected_residence_id','') ~ '^[0-9a-fA-F-]{36}$' then (p_patch->>'selected_residence_id')::uuid else null end,
    now(),now(),v_follow,case when v_stage='converted' then now() else null end,coalesce(p_patch,'{}'::jsonb)
  )
  on conflict (thread_id) do update set
    contact_id=coalesce(excluded.contact_id,adminos_whatsapp_conversion_leads.contact_id),
    user_id=coalesce(excluded.user_id,adminos_whatsapp_conversion_leads.user_id),
    intent=coalesce(nullif(excluded.intent,''),adminos_whatsapp_conversion_leads.intent),
    stage=case when excluded.stage='new' and adminos_whatsapp_conversion_leads.stage<>'new' then adminos_whatsapp_conversion_leads.stage else excluded.stage end,
    campus=coalesce(excluded.campus,adminos_whatsapp_conversion_leads.campus),
    institution=coalesce(excluded.institution,adminos_whatsapp_conversion_leads.institution),
    funding=coalesce(excluded.funding,adminos_whatsapp_conversion_leads.funding),
    academic_year=coalesce(excluded.academic_year,adminos_whatsapp_conversion_leads.academic_year),
    tenant_type=coalesce(excluded.tenant_type,adminos_whatsapp_conversion_leads.tenant_type),
    room_preference=coalesce(excluded.room_preference,adminos_whatsapp_conversion_leads.room_preference),
    budget_min=coalesce(excluded.budget_min,adminos_whatsapp_conversion_leads.budget_min),
    budget_max=coalesce(excluded.budget_max,adminos_whatsapp_conversion_leads.budget_max),
    selected_residence_id=coalesce(excluded.selected_residence_id,adminos_whatsapp_conversion_leads.selected_residence_id),
    last_inbound_at=now(),last_conversion_action_at=now(),
    next_follow_up_at=case when excluded.stage in ('lead_created','application_started','reservation_started') then excluded.next_follow_up_at else null end,
    converted_at=coalesce(adminos_whatsapp_conversion_leads.converted_at,excluded.converted_at),
    metadata=adminos_whatsapp_conversion_leads.metadata||excluded.metadata,
    updated_at=now()
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.adminos_touch_whatsapp_conversion(uuid,uuid,uuid,text,text,jsonb) from public,anon;
grant execute on function public.adminos_touch_whatsapp_conversion(uuid,uuid,uuid,text,text,jsonb) to authenticated;

update public.adminos_whatsapp_conversion_leads
set next_follow_up_at=null,updated_at=now()
where stage not in ('lead_created','application_started','reservation_started') and converted_at is null;

-- Human-like service behaviour belongs in the central prompt as well as the deterministic WhatsApp router.
update public.adminos_agent_prompt_versions set active=false where agent_key='konnect_agent' and active=true;
insert into public.adminos_agent_prompt_versions(agent_key,version,name,system_prompt,policy,tool_allowlist,active)
values(
  'konnect_agent',5,'Dimpho Conversion Service Agent',
  'You are Dimpho, ResKonnect''s customer service and conversion agent. Behave like a capable human service professional with continuity: use the supplied conversation history and state, remember what has already been asked, answered, shown or completed, and never repeat a menu, residence set, question or action unless the customer explicitly asks to see or do it again. Resolve the actual request, then move to one clear next action. Ask at most one necessary clarification at a time. Do not bluff: when verified information is missing or you do not know, say so plainly, set escalate=true when a human or protected decision is required, and provide a concise reason. Once a human escalation is required, do not continue troubleshooting or selling. Do not claim to learn facts autonomously; unresolved knowledge gaps are saved for staff review and future verified knowledge updates. Residence options without images are valid when their published data matches. Never substitute accommodation from the wrong campus. After residence options have been provided, do not generate more options or follow-up messaging unless the customer asks for other options, changes their preferences, or selects a residence to continue. ResKonnect may guide tertiary application readiness and official NSFAS processes but does not guarantee admission, funding, allocation or submit protected decisions on behalf of institutions. Never request passwords, OTPs, banking credentials, identity numbers or sensitive documents in open WhatsApp. Use only verified context for prices, availability, status and policy. All ResKonnect links must use https://www.reskonnect.org. Protected legal, financial, safety, scam, admission, placement, binding partnership and unresolved exception decisions require human escalation. Return JSON only with keys answer, confidence, risk, escalate, reason. risk must be green, amber or red.',
  jsonb_build_object('release',6,'persona','Dimpho','conversion_first',true,'deterministic_first',true,'memory_from_chat_state',true,'no_duplicate_actions',true,'stop_after_human_escalation',true,'stop_after_residence_options',true,'uncertainty_honesty',true,'learning_queue',true,'satisfaction_feedback',true,'minimise_ai_calls',true,'verified_data_only',true,'popia_minimisation',true),
  jsonb_build_array('read_contact','read_application','read_residence','read_knowledge','draft_reply','request_human_review'),true
)
on conflict (agent_key,version) do update set name=excluded.name,system_prompt=excluded.system_prompt,policy=excluded.policy,tool_allowlist=excluded.tool_allowlist,active=true;
