-- AgentOS RG6-RG8
-- RG6: Dimpho conversion automation
-- RG7: Application operations automation
-- RG8: Academic-year occupancy intelligence
--
-- Safety invariants:
-- * protected approval/rejection/allocation/payment decisions remain human-only.
-- * WhatsApp follow-ups reuse existing consent/DNC/customer-window enforcement.
-- * occupancy is always keyed by academic year; cycles are cohort analytics only.

-- ============================================================================
-- Shared task routing
-- ============================================================================
alter table public.staff_tasks
  add column if not exists department_key text;

alter table public.staff_tasks
  drop constraint if exists staff_tasks_department_key_check;
alter table public.staff_tasks
  add constraint staff_tasks_department_key_check check (
    department_key is null or department_key in (
      'executive','accommodation','student_opportunities','marketing_corporate_affairs',
      'partnerships_engagements','communications_service','operations',
      'finance_admin','intelligence_analytics','technology_systems'
    )
  );

create index if not exists idx_staff_tasks_department_status
  on public.staff_tasks(department_key,status,due_at)
  where status in ('open','in_progress','waiting');

-- ============================================================================
-- RG6 — Dimpho Conversion Automation
-- ============================================================================
alter table public.adminos_whatsapp_conversion_leads
  add column if not exists normalized_intent text,
  add column if not exists lead_score integer not null default 0,
  add column if not exists qualification_band text not null default 'cold',
  add column if not exists next_best_action text,
  add column if not exists next_action_url text,
  add column if not exists academic_cycle text,
  add column if not exists academic_period smallint,
  add column if not exists study_level text,
  add column if not exists student_stage text,
  add column if not exists last_scored_at timestamptz;

alter table public.adminos_whatsapp_conversion_leads
  drop constraint if exists adminos_conversion_lead_score_check;
alter table public.adminos_whatsapp_conversion_leads
  add constraint adminos_conversion_lead_score_check check (lead_score between 0 and 100);

alter table public.adminos_whatsapp_conversion_leads
  drop constraint if exists adminos_conversion_qualification_band_check;
alter table public.adminos_whatsapp_conversion_leads
  add constraint adminos_conversion_qualification_band_check check (
    qualification_band in ('cold','nurture','warm','hot','converted','human_review')
  );

alter table public.adminos_whatsapp_conversion_leads
  drop constraint if exists adminos_conversion_cycle_check;
alter table public.adminos_whatsapp_conversion_leads
  add constraint adminos_conversion_cycle_check check (
    academic_cycle is null or academic_cycle in ('annual','semester','trimester','unspecified')
  );

alter table public.adminos_whatsapp_conversion_leads
  drop constraint if exists adminos_conversion_period_check;
alter table public.adminos_whatsapp_conversion_leads
  add constraint adminos_conversion_period_check check (
    academic_period is null or academic_period between 0 and 3
  );

create index if not exists idx_adminos_conversion_score
  on public.adminos_whatsapp_conversion_leads(qualification_band,lead_score desc,updated_at desc)
  where converted_at is null and closed_at is null;

create or replace function public.adminos_rg6_normalize_intent(p_intent text)
returns text
language sql immutable
set search_path=''
as $$
  select case
    when lower(coalesce(p_intent,'')) ~ '(accommodation|housing|residence|res\b|room|stay)' then 'accommodation'
    when lower(coalesce(p_intent,'')) ~ '(wil|work.?integrated|internship|placement)' then 'wil'
    when lower(coalesce(p_intent,'')) ~ '(bursary|nsfas|funding|sponsor)' then 'bursary'
    when lower(coalesce(p_intent,'')) ~ '(tvet|college)' then 'tvet'
    when lower(coalesce(p_intent,'')) ~ '(application|apply|admission|enrol|enroll)' then 'applications'
    when lower(coalesce(p_intent,'')) ~ '(partner|landlord|property owner|institution)' then 'partnership'
    when lower(coalesce(p_intent,'')) ~ '(complaint|problem|fraud|scam|wrong|unhappy)' then 'complaint'
    else 'general'
  end;
$$;

create or replace function public.adminos_rg6_score_lead_trigger()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  s integer := 0;
  intent_key text;
  action_text text;
  action_url text;
begin
  intent_key := public.adminos_rg6_normalize_intent(coalesce(new.intent,''));
  s := case lower(coalesce(new.stage,'new'))
    when 'new' then 10
    when 'qualified' then 25
    when 'matched' then 45
    when 'enrollment_guidance' then 35
    when 'nsfas_guidance' then 35
    when 'application_started' then 60
    when 'reservation_started' then 70
    when 'lead_created' then 75
    when 'human_handoff' then 55
    when 'converted' then 100
    else 20
  end;

  if intent_key <> 'general' then s := s + 8; end if;
  if nullif(trim(coalesce(new.campus,'')),'') is not null then s := s + 8; end if;
  if new.academic_year between 2020 and 2100 then s := s + 8; end if;
  if nullif(trim(coalesce(new.funding,'')),'') is not null then s := s + 7; end if;
  if new.selected_residence_id is not null then s := s + 15; end if;
  if new.budget_min is not null or new.budget_max is not null then s := s + 5; end if;
  if nullif(trim(coalesce(new.room_preference,'')),'') is not null then s := s + 4; end if;
  if new.user_id is not null then s := s + 5; end if;
  if new.last_inbound_at >= now()-interval '72 hours' then s := s + 5; end if;

  s := least(100,greatest(0,s));

  if lower(coalesce(new.stage,''))='converted' or new.converted_at is not null then
    s := 100;
    action_text := 'Conversion completed';
    action_url := null;
    new.qualification_band := 'converted';
  elsif lower(coalesce(new.stage,''))='human_handoff' then
    action_text := 'Human review required';
    action_url := 'https://www.reskonnect.org';
    new.qualification_band := 'human_review';
  else
    if intent_key='accommodation' and nullif(trim(coalesce(new.campus,'')),'') is null then
      action_text := 'Confirm campus or location';
      action_url := 'https://www.reskonnect.org/findmyres';
    elsif new.academic_year is null then
      action_text := 'Confirm academic year';
      action_url := 'https://www.reskonnect.org/findmyres';
    elsif intent_key='accommodation' and nullif(trim(coalesce(new.funding,'')),'') is null then
      action_text := 'Confirm funding type';
      action_url := 'https://www.reskonnect.org/findmyres';
    elsif intent_key='accommodation' and new.selected_residence_id is null then
      action_text := 'Match verified accommodation options';
      action_url := 'https://www.reskonnect.org/findmyres';
    elsif intent_key='accommodation' and lower(coalesce(new.stage,'')) not in ('application_started','reservation_started','lead_created') then
      action_text := 'Continue to application or reservation';
      action_url := 'https://www.reskonnect.org/my-applications';
    elsif intent_key in ('applications','tvet') then
      action_text := 'Continue application support';
      action_url := 'https://www.reskonnect.org/applications';
    elsif intent_key='wil' then
      action_text := 'Continue WIL journey';
      action_url := 'https://www.reskonnect.org/opportunities';
    elsif intent_key='bursary' then
      action_text := 'Continue funding guidance';
      action_url := 'https://www.reskonnect.org/opportunities';
    elsif intent_key='partnership' then
      action_text := 'Route to Partnerships & Engagements';
      action_url := 'https://www.reskonnect.org';
    elsif intent_key='complaint' then
      action_text := 'Resolve or escalate service issue';
      action_url := 'https://www.reskonnect.org';
    else
      action_text := 'Confirm the customer goal';
      action_url := 'https://www.reskonnect.org';
    end if;

    new.qualification_band := case
      when s >= 75 then 'hot'
      when s >= 50 then 'warm'
      when s >= 25 then 'nurture'
      else 'cold'
    end;
  end if;

  new.normalized_intent := intent_key;
  new.lead_score := s;
  new.next_best_action := action_text;
  new.next_action_url := action_url;
  new.last_scored_at := now();
  return new;
end;
$$;

revoke all on function public.adminos_rg6_score_lead_trigger() from public,anon,authenticated;

drop trigger if exists trg_adminos_rg6_score_lead on public.adminos_whatsapp_conversion_leads;
create trigger trg_adminos_rg6_score_lead
before insert or update on public.adminos_whatsapp_conversion_leads
for each row execute function public.adminos_rg6_score_lead_trigger();

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
  v_cycle text;
  v_period smallint;
begin
  v_follow := case v_stage
    when 'new' then now() + interval '1 hour'
    when 'qualified' then now() + interval '1 hour'
    when 'matched' then now() + interval '2 hours'
    when 'enrollment_guidance' then now() + interval '3 hours'
    when 'nsfas_guidance' then now() + interval '3 hours'
    when 'application_started' then now() + interval '4 hours'
    when 'reservation_started' then now() + interval '4 hours'
    when 'lead_created' then now() + interval '4 hours'
    when 'human_handoff' then null
    when 'converted' then null
    else now() + interval '2 hours'
  end;

  v_cycle := case
    when lower(coalesce(p_patch->>'academic_cycle','')) in ('annual','semester','trimester') then lower(p_patch->>'academic_cycle')
    else null
  end;
  v_period := case
    when v_cycle='annual' then 1
    when v_cycle='semester' and coalesce(p_patch->>'academic_period','') ~ '^\\d+

  insert into public.adminos_whatsapp_conversion_leads(
    thread_id,contact_id,user_id,intent,stage,campus,institution,funding,academic_year,
    academic_cycle,academic_period,study_level,student_stage,
    tenant_type,room_preference,budget_min,budget_max,selected_residence_id,
    last_inbound_at,last_conversion_action_at,next_follow_up_at,converted_at,metadata
  ) values (
    p_thread_id,p_contact_id,p_user_id,p_intent,v_stage,
    nullif(p_patch->>'campus',''),nullif(p_patch->>'institution',''),nullif(p_patch->>'funding',''),
    case when (p_patch->>'academic_year') ~ '^\d{4}$' then (p_patch->>'academic_year')::integer else null end,
    v_cycle,v_period,
    case when lower(coalesce(p_patch->>'study_level','')) in ('undergraduate','postgraduate','advanced','other') then lower(p_patch->>'study_level') else null end,
    case when lower(coalesce(p_patch->>'student_stage','')) in ('first_time','continuing','returning','advanced','graduating','other') then lower(p_patch->>'student_stage') else null end,
    nullif(p_patch->>'tenant_type',''),nullif(p_patch->>'room_preference',''),
    case when (p_patch->>'budget_min') ~ '^\d+(\.\d+)?$' then (p_patch->>'budget_min')::numeric else null end,
    case when (p_patch->>'budget_max') ~ '^\d+(\.\d+)?$' then (p_patch->>'budget_max')::numeric else null end,
    case when coalesce(p_patch->>'selected_residence_id','') ~ '^[0-9a-fA-F-]{36}$' then (p_patch->>'selected_residence_id')::uuid else null end,
    now(),now(),v_follow,case when v_stage='converted' then now() else null end,p_patch
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
    academic_cycle=coalesce(excluded.academic_cycle,adminos_whatsapp_conversion_leads.academic_cycle),
    academic_period=coalesce(excluded.academic_period,adminos_whatsapp_conversion_leads.academic_period),
    study_level=coalesce(excluded.study_level,adminos_whatsapp_conversion_leads.study_level),
    student_stage=coalesce(excluded.student_stage,adminos_whatsapp_conversion_leads.student_stage),
    tenant_type=coalesce(excluded.tenant_type,adminos_whatsapp_conversion_leads.tenant_type),
    room_preference=coalesce(excluded.room_preference,adminos_whatsapp_conversion_leads.room_preference),
    budget_min=coalesce(excluded.budget_min,adminos_whatsapp_conversion_leads.budget_min),
    budget_max=coalesce(excluded.budget_max,adminos_whatsapp_conversion_leads.budget_max),
    selected_residence_id=coalesce(excluded.selected_residence_id,adminos_whatsapp_conversion_leads.selected_residence_id),
    last_inbound_at=now(),last_conversion_action_at=now(),
    next_follow_up_at=case when excluded.stage in ('converted','human_handoff') then null else excluded.next_follow_up_at end,
    converted_at=coalesce(adminos_whatsapp_conversion_leads.converted_at,excluded.converted_at),
    metadata=adminos_whatsapp_conversion_leads.metadata || excluded.metadata,
    updated_at=now()
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.adminos_touch_whatsapp_conversion(uuid,uuid,uuid,text,text,jsonb) from public,anon;
grant execute on function public.adminos_touch_whatsapp_conversion(uuid,uuid,uuid,text,text,jsonb) to authenticated,service_role;

create or replace function public.adminos_rg6_conversion_cycle()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  scored integer := 0;
  followups integer := 0;
begin
  update public.adminos_whatsapp_conversion_leads
  set updated_at=updated_at
  where converted_at is null and closed_at is null;
  get diagnostics scored=row_count;

  followups := public.adminos_generate_conversion_followups();

  return jsonb_build_object(
    'scored',scored,
    'followups_generated',followups,
    'run_at',now()
  );
end;
$$;
revoke all on function public.adminos_rg6_conversion_cycle() from public,anon,authenticated;
grant execute on function public.adminos_rg6_conversion_cycle() to service_role;

drop policy if exists department_comms_conversion_leads_read on public.adminos_whatsapp_conversion_leads;
create policy department_comms_conversion_leads_read
on public.adminos_whatsapp_conversion_leads for select to authenticated
using (public.has_admin_department_access('communications_service'));

drop policy if exists department_comms_conversion_leads_update on public.adminos_whatsapp_conversion_leads;
create policy department_comms_conversion_leads_update
on public.adminos_whatsapp_conversion_leads for update to authenticated
using (public.has_admin_department_access('communications_service'))
with check (public.has_admin_department_access('communications_service'));

-- ============================================================================
-- RG7 — Application Operations Automation
-- ============================================================================
alter table public.adminos_application_health_scores
  add column if not exists stale_days integer not null default 0,
  add column if not exists last_activity_at timestamptz,
  add column if not exists next_action_type text,
  add column if not exists next_action_url text,
  add column if not exists automation_state text not null default 'customer_action',
  add column if not exists last_reminder_at timestamptz;

alter table public.adminos_application_health_scores
  drop constraint if exists adminos_application_automation_state_check;
alter table public.adminos_application_health_scores
  add constraint adminos_application_automation_state_check check (
    automation_state in ('customer_action','ready_for_review','staff_attention','closed')
  );

create index if not exists idx_application_health_automation
  on public.adminos_application_health_scores(automation_state,health_band,score,calculated_at desc);

create or replace function public.adminos_recalculate_application_health(p_application_id uuid)
returns public.adminos_application_health_scores
language plpgsql
security definer
set search_path=public
as $$
declare
  a public.applications%rowtype;
  p public.profiles%rowtype;
  existing public.adminos_application_health_scores%rowtype;
  s integer:=0;
  profile_score integer:=0;
  application_score integer:=0;
  document_score integer:=0;
  freshness_score integer:=0;
  stale integer:=0;
  last_activity timestamptz;
  missing jsonb:='[]'::jsonb;
  docs text[]:='{}';
  blocked boolean:=false;
  closed boolean:=false;
  next_type text;
  next_url text := 'https://www.reskonnect.org/my-applications';
  state text;
  result public.adminos_application_health_scores%rowtype;
begin
  select * into a from public.applications where id=p_application_id;
  if a.id is null then return null; end if;
  select * into p from public.profiles where id=a.user_id;
  select * into existing from public.adminos_application_health_scores where application_id=a.id;

  select coalesce(array_agg(lower(regexp_replace(coalesce(doc_type,''),'[^a-z0-9]+','','g'))),'{}'::text[])
  into docs
  from public.application_documents
  where application_id=a.id and lower(coalesce(status,'')) not in ('rejected','invalid','missing','needs_action');

  select greatest(
    coalesce(a.updated_at,a.created_at,now()),
    coalesce((select max(uploaded_at) from public.application_documents where application_id=a.id),'1970-01-01'::timestamptz)
  ) into last_activity;

  stale := greatest(0,floor(extract(epoch from (now()-last_activity))/86400)::integer);

  if nullif(trim(coalesce(p.full_name,'')),'') is not null then profile_score:=profile_score+5;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','full_name','label','Add full name','area','profile','url','https://www.reskonnect.org/profile')); end if;

  if nullif(trim(coalesce(p.email,'')),'') is not null then profile_score:=profile_score+5;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','email','label','Add email address','area','profile','url','https://www.reskonnect.org/profile')); end if;

  if nullif(trim(coalesce(p.phone,p.phone_number,'')),'') is not null then profile_score:=profile_score+5;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','phone','label','Add WhatsApp/contact number','area','profile','url','https://www.reskonnect.org/profile')); end if;

  if nullif(trim(coalesce(p.campus,'')),'') is not null then profile_score:=profile_score+5;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','campus','label','Confirm campus','area','profile','url','https://www.reskonnect.org/profile')); end if;

  if nullif(trim(coalesce(p.student_number,p.identity_number,'')),'') is not null then profile_score:=profile_score+5;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','student_identifier','label','Add student number or identity reference','area','profile','url','https://www.reskonnect.org/profile')); end if;

  if a.residence_id is not null then application_score:=application_score+10;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','residence','label','Choose accommodation','area','application','url','https://www.reskonnect.org/findmyres')); end if;

  if nullif(trim(coalesce(a.funding_type,'')),'') is not null and lower(a.funding_type) not in ('unknown','undecided','unsure') then application_score:=application_score+5;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','funding','label','Confirm funding type','area','application','url',next_url)); end if;

  if a.move_in_date is not null then application_score:=application_score+5;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','move_in_date','label','Confirm intended move-in date','area','application','url',next_url)); end if;

  if nullif(trim(coalesce(a.institution_type,'')),'') is not null then application_score:=application_score+5;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','institution_type','label','Confirm institution type','area','application','url',next_url)); end if;

  if a.academic_year between 2020 and 2100
     and a.academic_cycle in ('annual','semester','trimester')
     and a.academic_period between 1 and 3 then
    application_score:=application_score+5;
  else
    missing:=missing||jsonb_build_array(jsonb_build_object('key','academic_period','label','Confirm academic year and intake period','area','application','url','https://www.reskonnect.org/profile'));
  end if;

  if a.study_level in ('undergraduate','postgraduate','advanced','other') then application_score:=application_score+5;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','study_level','label','Confirm study level','area','profile','url','https://www.reskonnect.org/profile')); end if;

  if exists(select 1 from unnest(docs) d where d ~ '(id|identity|passport)') then document_score:=document_score+10;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','identity_document','label','Upload identity document','area','documents','url',next_url)); end if;

  if exists(select 1 from unnest(docs) d where d ~ '(registration|proofofregistration|enrolment|enrollment)') then document_score:=document_score+10;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','registration_document','label','Upload proof of registration','area','documents','url',next_url)); end if;

  if lower(coalesce(a.funding_type,'')) in ('private','self','self_funded','self-funded') then
    document_score:=document_score+10;
  elsif exists(select 1 from unnest(docs) d where d ~ '(funding|nsfas|bursary|sponsor)') then
    document_score:=document_score+10;
  else
    missing:=missing||jsonb_build_array(jsonb_build_object('key','funding_document','label','Upload proof of funding','area','documents','url',next_url));
  end if;

  freshness_score := case when stale<=2 then 10 when stale<=5 then 7 when stale<=10 then 4 else 0 end;

  closed := lower(coalesce(a.status,'')) in ('approved','rejected','withdrawn','cancelled','declined');
  blocked := lower(coalesce(a.status,'')) in ('rejected','withdrawn','cancelled','declined');

  s:=least(100,profile_score+application_score+document_score+freshness_score);

  if blocked then
    next_type:='human_review';
    state:='closed';
  elsif closed then
    next_type:='none';
    state:='closed';
  elsif stale>=7 then
    next_type:='staff_review';
    state:='staff_attention';
  elsif s>=85 then
    next_type:='review_application';
    state:='ready_for_review';
  else
    next_type:='complete_application';
    state:='customer_action';
  end if;

  insert into public.adminos_application_health_scores(
    application_id,user_id,contact_id,score,health_band,missing_items,components,calculated_at,
    stale_days,last_activity_at,next_action_type,next_action_url,automation_state,last_reminder_at
  ) values(
    a.id,a.user_id,public.adminos_contact_id_for_user(a.user_id),s,
    case when blocked then 'blocked' when s>=85 then 'ready' when s>=60 then 'attention' else 'incomplete' end,
    missing,
    jsonb_build_object(
      'profile',jsonb_build_object('score',profile_score,'max',25),
      'application',jsonb_build_object('score',application_score,'max',35),
      'documents',jsonb_build_object('score',document_score,'max',30),
      'freshness',jsonb_build_object('score',freshness_score,'max',10,'stale_days',stale)
    ),
    now(),stale,last_activity,next_type,next_url,state,existing.last_reminder_at
  )
  on conflict (application_id) do update set
    user_id=excluded.user_id,
    contact_id=excluded.contact_id,
    score=excluded.score,
    health_band=excluded.health_band,
    missing_items=excluded.missing_items,
    components=excluded.components,
    calculated_at=excluded.calculated_at,
    stale_days=excluded.stale_days,
    last_activity_at=excluded.last_activity_at,
    next_action_type=excluded.next_action_type,
    next_action_url=excluded.next_action_url,
    automation_state=excluded.automation_state,
    last_reminder_at=coalesce(adminos_application_health_scores.last_reminder_at,excluded.last_reminder_at)
  returning * into result;

  return result;
end;
$$;

create or replace function public.adminos_rg7_application_operations_cycle()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  rec record;
  health public.adminos_application_health_scores%rowtype;
  recalculated integer:=0;
  reminders integer:=0;
  staff_tasks_created integer:=0;
  v_event_id uuid;
  first_missing jsonb;
  task_kind text;
begin
  for rec in
    select id from public.applications
    where lower(coalesce(status,'')) not in ('rejected','withdrawn','cancelled','declined')
  loop
    perform public.adminos_recalculate_application_health(rec.id);
    recalculated:=recalculated+1;
  end loop;

  perform public.adminos_refresh_next_best_actions();

  for health in
    select h.*
    from public.adminos_application_health_scores h
    join public.applications a on a.id=h.application_id
    where lower(coalesce(a.status,'')) not in ('approved','rejected','withdrawn','cancelled','declined')
  loop
    first_missing := coalesce(health.missing_items->0,'{}'::jsonb);

    if health.automation_state='customer_action'
       and health.user_id is not null
       and (health.last_reminder_at is null or health.last_reminder_at < now()-interval '48 hours') then
      insert into public.adminos_whatsapp_site_events(
        event_type,source_table,source_id,user_id,contact_id,payload,status,available_at,idempotency_key
      ) values(
        'document_attention','applications',health.application_id,health.user_id,health.contact_id,
        jsonb_build_object(
          'user_name',coalesce((select full_name from public.profiles where id=health.user_id),'there'),
          'next_step',coalesce(first_missing->>'label','Complete your application'),
          'action_url',coalesce(first_missing->>'url',health.next_action_url,'https://www.reskonnect.org/my-applications'),
          'health_score',health.score,
          'health_band',health.health_band,
          'missing_items',health.missing_items
        ),
        'pending',now(),
        concat('rg7-health:',health.application_id,':',to_char(current_date,'YYYYMMDD'))
      )
      on conflict (idempotency_key) do nothing
      returning id into v_event_id;

      if v_event_id is not null then
        update public.adminos_application_health_scores
        set last_reminder_at=now()
        where application_id=health.application_id;
        reminders:=reminders+1;
      end if;
      v_event_id:=null;
    end if;

    if health.automation_state='staff_attention' or health.health_band='blocked' then
      task_kind := case when health.health_band='blocked' then 'application_human_review' else 'application_stale_review' end;
      insert into public.conversion_automation_tasks(
        task_type,source_type,source_id,user_id,owner_scope,status,priority,due_at,summary,payload
      ) values(
        task_kind,'application',health.application_id,health.user_id,'accommodation','pending',
        case when health.health_band='blocked' or health.stale_days>=14 then 'urgent' else 'high' end,
        now()+case when health.health_band='blocked' then interval '4 hours' else interval '24 hours' end,
        case when health.health_band='blocked' then 'Application requires protected staff review'
             else concat('Application stale for ',health.stale_days,' days') end,
        jsonb_build_object(
          'health_score',health.score,'health_band',health.health_band,'stale_days',health.stale_days,
          'missing_items',health.missing_items,'next_action_url',health.next_action_url,
          'department_key','accommodation','release_gate',7
        )
      )
      on conflict (source_type,source_id,task_type) do update set
        status=case when conversion_automation_tasks.status='completed' then 'pending' else conversion_automation_tasks.status end,
        priority=excluded.priority,due_at=excluded.due_at,summary=excluded.summary,payload=excluded.payload,updated_at=now();
      staff_tasks_created:=staff_tasks_created+1;
    end if;
  end loop;

  update public.conversion_automation_tasks t
  set status='completed',completed_at=coalesce(completed_at,now()),updated_at=now()
  where t.source_type='application'
    and t.task_type in ('application_human_review','application_stale_review')
    and t.status='pending'
    and exists(
      select 1 from public.adminos_application_health_scores h
      where h.application_id=t.source_id
        and h.automation_state not in ('staff_attention')
        and h.health_band<>'blocked'
    );

  return jsonb_build_object(
    'applications_recalculated',recalculated,
    'customer_reminders_queued',reminders,
    'staff_exception_tasks_refreshed',staff_tasks_created,
    'run_at',now()
  );
end;
$$;

revoke all on function public.adminos_rg7_application_operations_cycle() from public,anon,authenticated;
grant execute on function public.adminos_rg7_application_operations_cycle() to service_role;

drop policy if exists department_accommodation_health_read on public.adminos_application_health_scores;
create policy department_accommodation_health_read
on public.adminos_application_health_scores for select to authenticated
using (public.has_admin_department_access('accommodation'));

drop policy if exists department_accommodation_conversion_tasks_manage on public.conversion_automation_tasks;
create policy department_accommodation_conversion_tasks_manage
on public.conversion_automation_tasks for all to authenticated
using (public.has_admin_department_access('accommodation') or public.has_admin_department_access('operations'))
with check (public.has_admin_department_access('accommodation') or public.has_admin_department_access('operations'));

-- ============================================================================
-- RG8 — Academic-Year Occupancy Intelligence
-- ============================================================================
create table if not exists public.adminos_occupancy_intelligence(
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences(id) on delete cascade,
  academic_year integer not null check (academic_year between 2020 and 2100),
  capacity integer not null default 0,
  reported_available_beds integer,
  blocked_beds integer not null default 0,
  derived_occupied_beds integer,
  fill_rate numeric,
  active_applications integer not null default 0,
  active_reservations integer not null default 0,
  confirmed_reservations integer not null default 0,
  moved_in_students integer not null default 0,
  demand_people integer not null default 0,
  excess_demand integer not null default 0,
  cohort_breakdown jsonb not null default '{}'::jsonb,
  intelligence_status text not null default 'inventory_unreported',
  action_priority integer not null default 50 check (action_priority between 0 and 100),
  recommended_action text,
  department_key text,
  refreshed_at timestamptz not null default now(),
  unique(residence_id,academic_year)
);

alter table public.adminos_occupancy_intelligence enable row level security;

drop policy if exists occupancy_intelligence_department_read on public.adminos_occupancy_intelligence;
create policy occupancy_intelligence_department_read
on public.adminos_occupancy_intelligence for select to authenticated
using (
  public.has_admin_department_access('accommodation')
  or public.has_admin_department_access('intelligence_analytics')
  or public.has_admin_department_access('executive')
  or public.has_admin_department_access('marketing_corporate_affairs')
);

grant select on public.adminos_occupancy_intelligence to authenticated;
revoke insert,update,delete on public.adminos_occupancy_intelligence from authenticated,anon;

create index if not exists idx_occupancy_intelligence_year_priority
  on public.adminos_occupancy_intelligence(academic_year,action_priority desc,intelligence_status);

create or replace function public.adminos_rg8_refresh_occupancy_year(p_academic_year integer)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  affected integer:=0;
  rec public.adminos_occupancy_intelligence%rowtype;
  action_key text;
  target_department text;
  task_title text;
begin
  if p_academic_year < 2020 or p_academic_year > 2100 then
    raise exception 'Invalid academic year';
  end if;

  with apps as (
    select residence_id,
      count(*) filter (where lower(coalesce(status,'')) not in ('approved','rejected','withdrawn','cancelled','declined'))::integer active_applications,
      count(distinct user_id) filter (where coalesce(moved_in,false)=true)::integer moved_in_students,
      jsonb_build_object(
        'annual',count(*) filter (where academic_cycle='annual'),
        'semester_1',count(*) filter (where academic_cycle='semester' and academic_period=1),
        'semester_2',count(*) filter (where academic_cycle='semester' and academic_period=2),
        'trimester_1',count(*) filter (where academic_cycle='trimester' and academic_period=1),
        'trimester_2',count(*) filter (where academic_cycle='trimester' and academic_period=2),
        'trimester_3',count(*) filter (where academic_cycle='trimester' and academic_period=3),
        'undergraduate',count(*) filter (where study_level='undergraduate'),
        'postgraduate',count(*) filter (where study_level='postgraduate'),
        'advanced',count(*) filter (where study_level='advanced')
      ) cohort_breakdown
    from public.applications
    where academic_year=p_academic_year and residence_id is not null
    group by residence_id
  ),
  reservations as (
    select residence_id,
      count(*) filter (where lower(coalesce(status,''))<>'cancelled')::integer active_reservations,
      count(*) filter (where lower(coalesce(status,''))='confirmed')::integer confirmed_reservations
    from public.accommodation_reservations
    where academic_year=p_academic_year
    group by residence_id
  ),
  demand as (
    select residence_id,count(distinct user_id)::integer demand_people
    from (
      select residence_id,user_id from public.applications
      where academic_year=p_academic_year and residence_id is not null and user_id is not null
        and lower(coalesce(status,'')) not in ('rejected','withdrawn','cancelled','declined')
      union
      select residence_id,user_id from public.accommodation_reservations
      where academic_year=p_academic_year and user_id is not null
        and lower(coalesce(status,''))<>'cancelled'
    ) d
    group by residence_id
  ),
  calc as (
    select
      i.residence_id,i.academic_year,i.capacity,i.reported_available_beds,i.blocked_beds,
      case when i.reported_available_beds is null then null
           else greatest(i.capacity-i.reported_available_beds-i.blocked_beds,0) end derived_occupied_beds,
      case when i.reported_available_beds is null or i.capacity<=0 then null
           else round((greatest(i.capacity-i.reported_available_beds-i.blocked_beds,0)::numeric/nullif(i.capacity,0))*100,2) end fill_rate,
      coalesce(a.active_applications,0) active_applications,
      coalesce(r.active_reservations,0) active_reservations,
      coalesce(r.confirmed_reservations,0) confirmed_reservations,
      coalesce(a.moved_in_students,0) moved_in_students,
      coalesce(d.demand_people,0) demand_people,
      case when i.reported_available_beds is null then 0
           else greatest(coalesce(d.demand_people,0)-i.reported_available_beds,0) end excess_demand,
      coalesce(a.cohort_breakdown,'{}'::jsonb) cohort_breakdown
    from public.residence_academic_inventory i
    left join apps a on a.residence_id=i.residence_id
    left join reservations r on r.residence_id=i.residence_id
    left join demand d on d.residence_id=i.residence_id
    where i.academic_year=p_academic_year
  )
  insert into public.adminos_occupancy_intelligence(
    residence_id,academic_year,capacity,reported_available_beds,blocked_beds,derived_occupied_beds,fill_rate,
    active_applications,active_reservations,confirmed_reservations,moved_in_students,demand_people,excess_demand,
    cohort_breakdown,intelligence_status,action_priority,recommended_action,department_key,refreshed_at
  )
  select
    c.residence_id,c.academic_year,c.capacity,c.reported_available_beds,c.blocked_beds,c.derived_occupied_beds,c.fill_rate,
    c.active_applications,c.active_reservations,c.confirmed_reservations,c.moved_in_students,c.demand_people,c.excess_demand,
    c.cohort_breakdown,
    case
      when c.reported_available_beds is null then 'inventory_unreported'
      when c.reported_available_beds=0 then 'full'
      when c.excess_demand>0 then 'demand_pressure'
      when c.fill_rate>=85 then 'near_full'
      when c.capacity>0 and c.reported_available_beds::numeric/c.capacity>=0.30 and c.demand_people<=greatest(2,round(c.capacity*0.10)) then 'vacancy_opportunity'
      when c.fill_rate<50 then 'low_fill'
      else 'healthy'
    end,
    case
      when c.reported_available_beds is null and c.demand_people>0 then 95
      when c.excess_demand>0 then 92
      when c.reported_available_beds=0 and c.demand_people>0 then 88
      when c.capacity>0 and c.reported_available_beds::numeric/c.capacity>=0.30 and c.demand_people<=greatest(2,round(c.capacity*0.10)) then 78
      when c.fill_rate<50 then 72
      when c.fill_rate>=85 then 65
      else 35
    end,
    case
      when c.reported_available_beds is null then 'Verify and report this academic year''s inventory before using occupancy for decisions.'
      when c.excess_demand>0 then 'Review demand pressure and route overflow students to verified alternatives before making allocation promises.'
      when c.reported_available_beds=0 then 'Mark demand as constrained and guide new enquiries to verified alternatives.'
      when c.capacity>0 and c.reported_available_beds::numeric/c.capacity>=0.30 and c.demand_people<=greatest(2,round(c.capacity*0.10)) then 'Prepare a vacancy-demand campaign brief for Corporate Affairs; do not auto-publish.'
      when c.fill_rate<50 then 'Investigate low fill, listing quality, price and demand signals.'
      when c.fill_rate>=85 then 'Monitor remaining beds and avoid over-promising availability.'
      else 'No intervention required; continue monitoring.'
    end,
    case
      when c.capacity>0 and c.reported_available_beds is not null
           and c.reported_available_beds::numeric/c.capacity>=0.30
           and c.demand_people<=greatest(2,round(c.capacity*0.10)) then 'marketing_corporate_affairs'
      else 'accommodation'
    end,
    now()
  from calc c
  on conflict(residence_id,academic_year) do update set
    capacity=excluded.capacity,
    reported_available_beds=excluded.reported_available_beds,
    blocked_beds=excluded.blocked_beds,
    derived_occupied_beds=excluded.derived_occupied_beds,
    fill_rate=excluded.fill_rate,
    active_applications=excluded.active_applications,
    active_reservations=excluded.active_reservations,
    confirmed_reservations=excluded.confirmed_reservations,
    moved_in_students=excluded.moved_in_students,
    demand_people=excluded.demand_people,
    excess_demand=excluded.excess_demand,
    cohort_breakdown=excluded.cohort_breakdown,
    intelligence_status=excluded.intelligence_status,
    action_priority=excluded.action_priority,
    recommended_action=excluded.recommended_action,
    department_key=excluded.department_key,
    refreshed_at=now();

  get diagnostics affected=row_count;

  for rec in
    select * from public.adminos_occupancy_intelligence
    where academic_year=p_academic_year
  loop
    update public.staff_tasks
    set status='completed',updated_at=now(),
        metadata=metadata||jsonb_build_object('resolved_by_rg8_at',now())
    where source_table='adminos_occupancy_intelligence'
      and source_id=rec.id
      and status in ('open','in_progress','waiting')
      and coalesce(metadata->>'automation_key','') <>
          concat('rg8:',rec.academic_year,':',rec.intelligence_status);

    if rec.intelligence_status in ('inventory_unreported','demand_pressure','full','vacancy_opportunity','low_fill') then
      action_key:=concat('rg8:',rec.academic_year,':',rec.intelligence_status);
      target_department:=coalesce(rec.department_key,'accommodation');
      task_title:=case rec.intelligence_status
        when 'inventory_unreported' then concat(rec.academic_year,' inventory verification required')
        when 'demand_pressure' then concat(rec.academic_year,' demand exceeds reported open beds')
        when 'full' then concat(rec.academic_year,' residence full — manage overflow demand')
        when 'vacancy_opportunity' then concat(rec.academic_year,' vacancy-demand opportunity')
        when 'low_fill' then concat(rec.academic_year,' low-fill residence review')
        else 'Occupancy action required'
      end;

      if not exists(
        select 1 from public.staff_tasks
        where source_table='adminos_occupancy_intelligence'
          and source_id=rec.id
          and status in ('open','in_progress','waiting')
          and metadata->>'automation_key'=action_key
      ) then
        insert into public.staff_tasks(
          title,description,source_table,source_id,priority,status,due_at,next_action,tags,metadata,department_key
        ) values(
          task_title,rec.recommended_action,'adminos_occupancy_intelligence',rec.id,
          case when rec.action_priority>=90 then 'urgent' when rec.action_priority>=75 then 'high' else 'normal' end,
          'open',
          now()+case when rec.action_priority>=90 then interval '4 hours' else interval '24 hours' end,
          rec.recommended_action,
          array['rg8','occupancy',rec.intelligence_status,rec.academic_year::text],
          jsonb_build_object(
            'automation_key',action_key,
            'residence_id',rec.residence_id,
            'academic_year',rec.academic_year,
            'fill_rate',rec.fill_rate,
            'reported_available_beds',rec.reported_available_beds,
            'demand_people',rec.demand_people,
            'excess_demand',rec.excess_demand,
            'release_gate',8
          ),
          target_department
        );
      end if;
    end if;
  end loop;

  return affected;
end;
$$;

revoke all on function public.adminos_rg8_refresh_occupancy_year(integer) from public,anon,authenticated;
grant execute on function public.adminos_rg8_refresh_occupancy_year(integer) to service_role;

create or replace function public.adminos_rg8_occupancy_cycle()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  y integer;
  refreshed integer:=0;
  years integer:=0;
begin
  for y in
    select distinct academic_year
    from public.residence_academic_inventory
    where academic_year between extract(year from current_date)::integer-1
                            and extract(year from current_date)::integer+2
    order by academic_year
  loop
    refreshed:=refreshed+public.adminos_rg8_refresh_occupancy_year(y);
    years:=years+1;
  end loop;

  return jsonb_build_object('academic_years_refreshed',years,'residence_year_rows',refreshed,'run_at',now());
end;
$$;

revoke all on function public.adminos_rg8_occupancy_cycle() from public,anon,authenticated;
grant execute on function public.adminos_rg8_occupancy_cycle() to service_role;

-- ============================================================================
-- Agent configuration / authority
-- ============================================================================
insert into public.adminos_agent_config(agent_key,display_name,enabled,authority_level,confidence_threshold,config)
values
('dimpho_conversion','Dimpho · Conversion Automation',true,'green',0.95,
  jsonb_build_object(
    'release_gate',6,'deterministic_scoring',true,'followups',true,'respect_consent',true,
    'respect_do_not_contact',true,'human_handoff_for_protected_decisions',true,
    'blocked_actions',jsonb_build_array('approve_application','reject_application','allocate_room','guarantee_placement','move_money','change_banking')
  )),
('application_operations','Application Operations Agent',true,'green',0.95,
  jsonb_build_object(
    'release_gate',7,'health_score',true,'missing_document_reminders',true,'stale_case_detection',true,
    'protected_status_decisions','human_only','approval_and_rejection','human_only'
  )),
('occupancy_intelligence','Accommodation & Occupancy Intelligence',true,'green',0.97,
  jsonb_build_object(
    'release_gate',8,'academic_year_isolation',true,'cycle_cohorts_not_capacity_pools',true,
    'inventory_verification_required',true,'marketing_handoff_only',true,'auto_publish',false,'room_allocation','human_only'
  ))
on conflict(agent_key) do update set
  display_name=excluded.display_name,
  enabled=excluded.enabled,
  authority_level=excluded.authority_level,
  confidence_threshold=excluded.confidence_threshold,
  config=excluded.config,
  updated_at=now();

-- ============================================================================
-- Schedulers
-- ============================================================================
do $$
declare j record;
begin
  for j in select jobid from cron.job where jobname in (
    'adminos-conversion-followups',
    'adminos-rg6-conversion-intelligence',
    'adminos-rg7-application-operations',
    'adminos-rg8-occupancy-intelligence'
  ) loop
    perform cron.unschedule(j.jobid);
  end loop;

  perform cron.schedule(
    'adminos-rg6-conversion-intelligence',
    '*/10 * * * *',
    $job$select public.adminos_rg6_conversion_cycle();$job$
  );
  perform cron.schedule(
    'adminos-rg7-application-operations',
    '*/15 * * * *',
    $job$select public.adminos_rg7_application_operations_cycle();$job$
  );
  perform cron.schedule(
    'adminos-rg8-occupancy-intelligence',
    '*/30 * * * *',
    $job$select public.adminos_rg8_occupancy_cycle();$job$
  );
end $$;

-- Prime all three engines once on migration.
update public.adminos_whatsapp_conversion_leads set updated_at=updated_at;
select public.adminos_rg7_application_operations_cycle();
select public.adminos_rg8_occupancy_cycle();

      then least(2,greatest(1,(p_patch->>'academic_period')::smallint))
    when v_cycle='semester' then 1
    when v_cycle='trimester' and coalesce(p_patch->>'academic_period','') ~ '^\\d+

  insert into public.adminos_whatsapp_conversion_leads(
    thread_id,contact_id,user_id,intent,stage,campus,institution,funding,academic_year,
    academic_cycle,academic_period,study_level,student_stage,
    tenant_type,room_preference,budget_min,budget_max,selected_residence_id,
    last_inbound_at,last_conversion_action_at,next_follow_up_at,converted_at,metadata
  ) values (
    p_thread_id,p_contact_id,p_user_id,p_intent,v_stage,
    nullif(p_patch->>'campus',''),nullif(p_patch->>'institution',''),nullif(p_patch->>'funding',''),
    case when (p_patch->>'academic_year') ~ '^\d{4}$' then (p_patch->>'academic_year')::integer else null end,
    v_cycle,v_period,
    case when lower(coalesce(p_patch->>'study_level','')) in ('undergraduate','postgraduate','advanced','other') then lower(p_patch->>'study_level') else null end,
    case when lower(coalesce(p_patch->>'student_stage','')) in ('first_time','continuing','returning','advanced','graduating','other') then lower(p_patch->>'student_stage') else null end,
    nullif(p_patch->>'tenant_type',''),nullif(p_patch->>'room_preference',''),
    case when (p_patch->>'budget_min') ~ '^\d+(\.\d+)?$' then (p_patch->>'budget_min')::numeric else null end,
    case when (p_patch->>'budget_max') ~ '^\d+(\.\d+)?$' then (p_patch->>'budget_max')::numeric else null end,
    case when coalesce(p_patch->>'selected_residence_id','') ~ '^[0-9a-fA-F-]{36}$' then (p_patch->>'selected_residence_id')::uuid else null end,
    now(),now(),v_follow,case when v_stage='converted' then now() else null end,p_patch
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
    academic_cycle=coalesce(excluded.academic_cycle,adminos_whatsapp_conversion_leads.academic_cycle),
    academic_period=coalesce(excluded.academic_period,adminos_whatsapp_conversion_leads.academic_period),
    study_level=coalesce(excluded.study_level,adminos_whatsapp_conversion_leads.study_level),
    student_stage=coalesce(excluded.student_stage,adminos_whatsapp_conversion_leads.student_stage),
    tenant_type=coalesce(excluded.tenant_type,adminos_whatsapp_conversion_leads.tenant_type),
    room_preference=coalesce(excluded.room_preference,adminos_whatsapp_conversion_leads.room_preference),
    budget_min=coalesce(excluded.budget_min,adminos_whatsapp_conversion_leads.budget_min),
    budget_max=coalesce(excluded.budget_max,adminos_whatsapp_conversion_leads.budget_max),
    selected_residence_id=coalesce(excluded.selected_residence_id,adminos_whatsapp_conversion_leads.selected_residence_id),
    last_inbound_at=now(),last_conversion_action_at=now(),
    next_follow_up_at=case when excluded.stage in ('converted','human_handoff') then null else excluded.next_follow_up_at end,
    converted_at=coalesce(adminos_whatsapp_conversion_leads.converted_at,excluded.converted_at),
    metadata=adminos_whatsapp_conversion_leads.metadata || excluded.metadata,
    updated_at=now()
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.adminos_touch_whatsapp_conversion(uuid,uuid,uuid,text,text,jsonb) from public,anon;
grant execute on function public.adminos_touch_whatsapp_conversion(uuid,uuid,uuid,text,text,jsonb) to authenticated,service_role;

create or replace function public.adminos_rg6_conversion_cycle()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  scored integer := 0;
  followups integer := 0;
begin
  update public.adminos_whatsapp_conversion_leads
  set updated_at=updated_at
  where converted_at is null and closed_at is null;
  get diagnostics scored=row_count;

  followups := public.adminos_generate_conversion_followups();

  return jsonb_build_object(
    'scored',scored,
    'followups_generated',followups,
    'run_at',now()
  );
end;
$$;
revoke all on function public.adminos_rg6_conversion_cycle() from public,anon,authenticated;
grant execute on function public.adminos_rg6_conversion_cycle() to service_role;

drop policy if exists department_comms_conversion_leads_read on public.adminos_whatsapp_conversion_leads;
create policy department_comms_conversion_leads_read
on public.adminos_whatsapp_conversion_leads for select to authenticated
using (public.has_admin_department_access('communications_service'));

drop policy if exists department_comms_conversion_leads_update on public.adminos_whatsapp_conversion_leads;
create policy department_comms_conversion_leads_update
on public.adminos_whatsapp_conversion_leads for update to authenticated
using (public.has_admin_department_access('communications_service'))
with check (public.has_admin_department_access('communications_service'));

-- ============================================================================
-- RG7 — Application Operations Automation
-- ============================================================================
alter table public.adminos_application_health_scores
  add column if not exists stale_days integer not null default 0,
  add column if not exists last_activity_at timestamptz,
  add column if not exists next_action_type text,
  add column if not exists next_action_url text,
  add column if not exists automation_state text not null default 'customer_action',
  add column if not exists last_reminder_at timestamptz;

alter table public.adminos_application_health_scores
  drop constraint if exists adminos_application_automation_state_check;
alter table public.adminos_application_health_scores
  add constraint adminos_application_automation_state_check check (
    automation_state in ('customer_action','ready_for_review','staff_attention','closed')
  );

create index if not exists idx_application_health_automation
  on public.adminos_application_health_scores(automation_state,health_band,score,calculated_at desc);

create or replace function public.adminos_recalculate_application_health(p_application_id uuid)
returns public.adminos_application_health_scores
language plpgsql
security definer
set search_path=public
as $$
declare
  a public.applications%rowtype;
  p public.profiles%rowtype;
  existing public.adminos_application_health_scores%rowtype;
  s integer:=0;
  profile_score integer:=0;
  application_score integer:=0;
  document_score integer:=0;
  freshness_score integer:=0;
  stale integer:=0;
  last_activity timestamptz;
  missing jsonb:='[]'::jsonb;
  docs text[]:='{}';
  blocked boolean:=false;
  closed boolean:=false;
  next_type text;
  next_url text := 'https://www.reskonnect.org/my-applications';
  state text;
  result public.adminos_application_health_scores%rowtype;
begin
  select * into a from public.applications where id=p_application_id;
  if a.id is null then return null; end if;
  select * into p from public.profiles where id=a.user_id;
  select * into existing from public.adminos_application_health_scores where application_id=a.id;

  select coalesce(array_agg(lower(regexp_replace(coalesce(doc_type,''),'[^a-z0-9]+','','g'))),'{}'::text[])
  into docs
  from public.application_documents
  where application_id=a.id and lower(coalesce(status,'')) not in ('rejected','invalid','missing','needs_action');

  select greatest(
    coalesce(a.updated_at,a.created_at,now()),
    coalesce((select max(uploaded_at) from public.application_documents where application_id=a.id),'1970-01-01'::timestamptz)
  ) into last_activity;

  stale := greatest(0,floor(extract(epoch from (now()-last_activity))/86400)::integer);

  if nullif(trim(coalesce(p.full_name,'')),'') is not null then profile_score:=profile_score+5;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','full_name','label','Add full name','area','profile','url','https://www.reskonnect.org/profile')); end if;

  if nullif(trim(coalesce(p.email,'')),'') is not null then profile_score:=profile_score+5;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','email','label','Add email address','area','profile','url','https://www.reskonnect.org/profile')); end if;

  if nullif(trim(coalesce(p.phone,p.phone_number,'')),'') is not null then profile_score:=profile_score+5;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','phone','label','Add WhatsApp/contact number','area','profile','url','https://www.reskonnect.org/profile')); end if;

  if nullif(trim(coalesce(p.campus,'')),'') is not null then profile_score:=profile_score+5;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','campus','label','Confirm campus','area','profile','url','https://www.reskonnect.org/profile')); end if;

  if nullif(trim(coalesce(p.student_number,p.identity_number,'')),'') is not null then profile_score:=profile_score+5;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','student_identifier','label','Add student number or identity reference','area','profile','url','https://www.reskonnect.org/profile')); end if;

  if a.residence_id is not null then application_score:=application_score+10;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','residence','label','Choose accommodation','area','application','url','https://www.reskonnect.org/findmyres')); end if;

  if nullif(trim(coalesce(a.funding_type,'')),'') is not null and lower(a.funding_type) not in ('unknown','undecided','unsure') then application_score:=application_score+5;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','funding','label','Confirm funding type','area','application','url',next_url)); end if;

  if a.move_in_date is not null then application_score:=application_score+5;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','move_in_date','label','Confirm intended move-in date','area','application','url',next_url)); end if;

  if nullif(trim(coalesce(a.institution_type,'')),'') is not null then application_score:=application_score+5;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','institution_type','label','Confirm institution type','area','application','url',next_url)); end if;

  if a.academic_year between 2020 and 2100
     and a.academic_cycle in ('annual','semester','trimester')
     and a.academic_period between 1 and 3 then
    application_score:=application_score+5;
  else
    missing:=missing||jsonb_build_array(jsonb_build_object('key','academic_period','label','Confirm academic year and intake period','area','application','url','https://www.reskonnect.org/profile'));
  end if;

  if a.study_level in ('undergraduate','postgraduate','advanced','other') then application_score:=application_score+5;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','study_level','label','Confirm study level','area','profile','url','https://www.reskonnect.org/profile')); end if;

  if exists(select 1 from unnest(docs) d where d ~ '(id|identity|passport)') then document_score:=document_score+10;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','identity_document','label','Upload identity document','area','documents','url',next_url)); end if;

  if exists(select 1 from unnest(docs) d where d ~ '(registration|proofofregistration|enrolment|enrollment)') then document_score:=document_score+10;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','registration_document','label','Upload proof of registration','area','documents','url',next_url)); end if;

  if lower(coalesce(a.funding_type,'')) in ('private','self','self_funded','self-funded') then
    document_score:=document_score+10;
  elsif exists(select 1 from unnest(docs) d where d ~ '(funding|nsfas|bursary|sponsor)') then
    document_score:=document_score+10;
  else
    missing:=missing||jsonb_build_array(jsonb_build_object('key','funding_document','label','Upload proof of funding','area','documents','url',next_url));
  end if;

  freshness_score := case when stale<=2 then 10 when stale<=5 then 7 when stale<=10 then 4 else 0 end;

  closed := lower(coalesce(a.status,'')) in ('approved','rejected','withdrawn','cancelled','declined');
  blocked := lower(coalesce(a.status,'')) in ('rejected','withdrawn','cancelled','declined');

  s:=least(100,profile_score+application_score+document_score+freshness_score);

  if blocked then
    next_type:='human_review';
    state:='closed';
  elsif closed then
    next_type:='none';
    state:='closed';
  elsif stale>=7 then
    next_type:='staff_review';
    state:='staff_attention';
  elsif s>=85 then
    next_type:='review_application';
    state:='ready_for_review';
  else
    next_type:='complete_application';
    state:='customer_action';
  end if;

  insert into public.adminos_application_health_scores(
    application_id,user_id,contact_id,score,health_band,missing_items,components,calculated_at,
    stale_days,last_activity_at,next_action_type,next_action_url,automation_state,last_reminder_at
  ) values(
    a.id,a.user_id,public.adminos_contact_id_for_user(a.user_id),s,
    case when blocked then 'blocked' when s>=85 then 'ready' when s>=60 then 'attention' else 'incomplete' end,
    missing,
    jsonb_build_object(
      'profile',jsonb_build_object('score',profile_score,'max',25),
      'application',jsonb_build_object('score',application_score,'max',35),
      'documents',jsonb_build_object('score',document_score,'max',30),
      'freshness',jsonb_build_object('score',freshness_score,'max',10,'stale_days',stale)
    ),
    now(),stale,last_activity,next_type,next_url,state,existing.last_reminder_at
  )
  on conflict (application_id) do update set
    user_id=excluded.user_id,
    contact_id=excluded.contact_id,
    score=excluded.score,
    health_band=excluded.health_band,
    missing_items=excluded.missing_items,
    components=excluded.components,
    calculated_at=excluded.calculated_at,
    stale_days=excluded.stale_days,
    last_activity_at=excluded.last_activity_at,
    next_action_type=excluded.next_action_type,
    next_action_url=excluded.next_action_url,
    automation_state=excluded.automation_state,
    last_reminder_at=coalesce(adminos_application_health_scores.last_reminder_at,excluded.last_reminder_at)
  returning * into result;

  return result;
end;
$$;

create or replace function public.adminos_rg7_application_operations_cycle()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  rec record;
  health public.adminos_application_health_scores%rowtype;
  recalculated integer:=0;
  reminders integer:=0;
  staff_tasks_created integer:=0;
  v_event_id uuid;
  first_missing jsonb;
  task_kind text;
begin
  for rec in
    select id from public.applications
    where lower(coalesce(status,'')) not in ('rejected','withdrawn','cancelled','declined')
  loop
    perform public.adminos_recalculate_application_health(rec.id);
    recalculated:=recalculated+1;
  end loop;

  perform public.adminos_refresh_next_best_actions();

  for health in
    select h.*
    from public.adminos_application_health_scores h
    join public.applications a on a.id=h.application_id
    where lower(coalesce(a.status,'')) not in ('approved','rejected','withdrawn','cancelled','declined')
  loop
    first_missing := coalesce(health.missing_items->0,'{}'::jsonb);

    if health.automation_state='customer_action'
       and health.user_id is not null
       and (health.last_reminder_at is null or health.last_reminder_at < now()-interval '48 hours') then
      insert into public.adminos_whatsapp_site_events(
        event_type,source_table,source_id,user_id,contact_id,payload,status,available_at,idempotency_key
      ) values(
        'document_attention','applications',health.application_id,health.user_id,health.contact_id,
        jsonb_build_object(
          'user_name',coalesce((select full_name from public.profiles where id=health.user_id),'there'),
          'next_step',coalesce(first_missing->>'label','Complete your application'),
          'action_url',coalesce(first_missing->>'url',health.next_action_url,'https://www.reskonnect.org/my-applications'),
          'health_score',health.score,
          'health_band',health.health_band,
          'missing_items',health.missing_items
        ),
        'pending',now(),
        concat('rg7-health:',health.application_id,':',to_char(current_date,'YYYYMMDD'))
      )
      on conflict (idempotency_key) do nothing
      returning id into v_event_id;

      if v_event_id is not null then
        update public.adminos_application_health_scores
        set last_reminder_at=now()
        where application_id=health.application_id;
        reminders:=reminders+1;
      end if;
      v_event_id:=null;
    end if;

    if health.automation_state='staff_attention' or health.health_band='blocked' then
      task_kind := case when health.health_band='blocked' then 'application_human_review' else 'application_stale_review' end;
      insert into public.conversion_automation_tasks(
        task_type,source_type,source_id,user_id,owner_scope,status,priority,due_at,summary,payload
      ) values(
        task_kind,'application',health.application_id,health.user_id,'accommodation','pending',
        case when health.health_band='blocked' or health.stale_days>=14 then 'urgent' else 'high' end,
        now()+case when health.health_band='blocked' then interval '4 hours' else interval '24 hours' end,
        case when health.health_band='blocked' then 'Application requires protected staff review'
             else concat('Application stale for ',health.stale_days,' days') end,
        jsonb_build_object(
          'health_score',health.score,'health_band',health.health_band,'stale_days',health.stale_days,
          'missing_items',health.missing_items,'next_action_url',health.next_action_url,
          'department_key','accommodation','release_gate',7
        )
      )
      on conflict (source_type,source_id,task_type) do update set
        status=case when conversion_automation_tasks.status='completed' then 'pending' else conversion_automation_tasks.status end,
        priority=excluded.priority,due_at=excluded.due_at,summary=excluded.summary,payload=excluded.payload,updated_at=now();
      staff_tasks_created:=staff_tasks_created+1;
    end if;
  end loop;

  update public.conversion_automation_tasks t
  set status='completed',completed_at=coalesce(completed_at,now()),updated_at=now()
  where t.source_type='application'
    and t.task_type in ('application_human_review','application_stale_review')
    and t.status='pending'
    and exists(
      select 1 from public.adminos_application_health_scores h
      where h.application_id=t.source_id
        and h.automation_state not in ('staff_attention')
        and h.health_band<>'blocked'
    );

  return jsonb_build_object(
    'applications_recalculated',recalculated,
    'customer_reminders_queued',reminders,
    'staff_exception_tasks_refreshed',staff_tasks_created,
    'run_at',now()
  );
end;
$$;

revoke all on function public.adminos_rg7_application_operations_cycle() from public,anon,authenticated;
grant execute on function public.adminos_rg7_application_operations_cycle() to service_role;

drop policy if exists department_accommodation_health_read on public.adminos_application_health_scores;
create policy department_accommodation_health_read
on public.adminos_application_health_scores for select to authenticated
using (public.has_admin_department_access('accommodation'));

drop policy if exists department_accommodation_conversion_tasks_manage on public.conversion_automation_tasks;
create policy department_accommodation_conversion_tasks_manage
on public.conversion_automation_tasks for all to authenticated
using (public.has_admin_department_access('accommodation') or public.has_admin_department_access('operations'))
with check (public.has_admin_department_access('accommodation') or public.has_admin_department_access('operations'));

-- ============================================================================
-- RG8 — Academic-Year Occupancy Intelligence
-- ============================================================================
create table if not exists public.adminos_occupancy_intelligence(
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences(id) on delete cascade,
  academic_year integer not null check (academic_year between 2020 and 2100),
  capacity integer not null default 0,
  reported_available_beds integer,
  blocked_beds integer not null default 0,
  derived_occupied_beds integer,
  fill_rate numeric,
  active_applications integer not null default 0,
  active_reservations integer not null default 0,
  confirmed_reservations integer not null default 0,
  moved_in_students integer not null default 0,
  demand_people integer not null default 0,
  excess_demand integer not null default 0,
  cohort_breakdown jsonb not null default '{}'::jsonb,
  intelligence_status text not null default 'inventory_unreported',
  action_priority integer not null default 50 check (action_priority between 0 and 100),
  recommended_action text,
  department_key text,
  refreshed_at timestamptz not null default now(),
  unique(residence_id,academic_year)
);

alter table public.adminos_occupancy_intelligence enable row level security;

drop policy if exists occupancy_intelligence_department_read on public.adminos_occupancy_intelligence;
create policy occupancy_intelligence_department_read
on public.adminos_occupancy_intelligence for select to authenticated
using (
  public.has_admin_department_access('accommodation')
  or public.has_admin_department_access('intelligence_analytics')
  or public.has_admin_department_access('executive')
  or public.has_admin_department_access('marketing_corporate_affairs')
);

grant select on public.adminos_occupancy_intelligence to authenticated;
revoke insert,update,delete on public.adminos_occupancy_intelligence from authenticated,anon;

create index if not exists idx_occupancy_intelligence_year_priority
  on public.adminos_occupancy_intelligence(academic_year,action_priority desc,intelligence_status);

create or replace function public.adminos_rg8_refresh_occupancy_year(p_academic_year integer)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  affected integer:=0;
  rec public.adminos_occupancy_intelligence%rowtype;
  action_key text;
  target_department text;
  task_title text;
begin
  if p_academic_year < 2020 or p_academic_year > 2100 then
    raise exception 'Invalid academic year';
  end if;

  with apps as (
    select residence_id,
      count(*) filter (where lower(coalesce(status,'')) not in ('approved','rejected','withdrawn','cancelled','declined'))::integer active_applications,
      count(distinct user_id) filter (where coalesce(moved_in,false)=true)::integer moved_in_students,
      jsonb_build_object(
        'annual',count(*) filter (where academic_cycle='annual'),
        'semester_1',count(*) filter (where academic_cycle='semester' and academic_period=1),
        'semester_2',count(*) filter (where academic_cycle='semester' and academic_period=2),
        'trimester_1',count(*) filter (where academic_cycle='trimester' and academic_period=1),
        'trimester_2',count(*) filter (where academic_cycle='trimester' and academic_period=2),
        'trimester_3',count(*) filter (where academic_cycle='trimester' and academic_period=3),
        'undergraduate',count(*) filter (where study_level='undergraduate'),
        'postgraduate',count(*) filter (where study_level='postgraduate'),
        'advanced',count(*) filter (where study_level='advanced')
      ) cohort_breakdown
    from public.applications
    where academic_year=p_academic_year and residence_id is not null
    group by residence_id
  ),
  reservations as (
    select residence_id,
      count(*) filter (where lower(coalesce(status,''))<>'cancelled')::integer active_reservations,
      count(*) filter (where lower(coalesce(status,''))='confirmed')::integer confirmed_reservations
    from public.accommodation_reservations
    where academic_year=p_academic_year
    group by residence_id
  ),
  demand as (
    select residence_id,count(distinct user_id)::integer demand_people
    from (
      select residence_id,user_id from public.applications
      where academic_year=p_academic_year and residence_id is not null and user_id is not null
        and lower(coalesce(status,'')) not in ('rejected','withdrawn','cancelled','declined')
      union
      select residence_id,user_id from public.accommodation_reservations
      where academic_year=p_academic_year and user_id is not null
        and lower(coalesce(status,''))<>'cancelled'
    ) d
    group by residence_id
  ),
  calc as (
    select
      i.residence_id,i.academic_year,i.capacity,i.reported_available_beds,i.blocked_beds,
      case when i.reported_available_beds is null then null
           else greatest(i.capacity-i.reported_available_beds-i.blocked_beds,0) end derived_occupied_beds,
      case when i.reported_available_beds is null or i.capacity<=0 then null
           else round((greatest(i.capacity-i.reported_available_beds-i.blocked_beds,0)::numeric/nullif(i.capacity,0))*100,2) end fill_rate,
      coalesce(a.active_applications,0) active_applications,
      coalesce(r.active_reservations,0) active_reservations,
      coalesce(r.confirmed_reservations,0) confirmed_reservations,
      coalesce(a.moved_in_students,0) moved_in_students,
      coalesce(d.demand_people,0) demand_people,
      case when i.reported_available_beds is null then 0
           else greatest(coalesce(d.demand_people,0)-i.reported_available_beds,0) end excess_demand,
      coalesce(a.cohort_breakdown,'{}'::jsonb) cohort_breakdown
    from public.residence_academic_inventory i
    left join apps a on a.residence_id=i.residence_id
    left join reservations r on r.residence_id=i.residence_id
    left join demand d on d.residence_id=i.residence_id
    where i.academic_year=p_academic_year
  )
  insert into public.adminos_occupancy_intelligence(
    residence_id,academic_year,capacity,reported_available_beds,blocked_beds,derived_occupied_beds,fill_rate,
    active_applications,active_reservations,confirmed_reservations,moved_in_students,demand_people,excess_demand,
    cohort_breakdown,intelligence_status,action_priority,recommended_action,department_key,refreshed_at
  )
  select
    c.residence_id,c.academic_year,c.capacity,c.reported_available_beds,c.blocked_beds,c.derived_occupied_beds,c.fill_rate,
    c.active_applications,c.active_reservations,c.confirmed_reservations,c.moved_in_students,c.demand_people,c.excess_demand,
    c.cohort_breakdown,
    case
      when c.reported_available_beds is null then 'inventory_unreported'
      when c.reported_available_beds=0 then 'full'
      when c.excess_demand>0 then 'demand_pressure'
      when c.fill_rate>=85 then 'near_full'
      when c.capacity>0 and c.reported_available_beds::numeric/c.capacity>=0.30 and c.demand_people<=greatest(2,round(c.capacity*0.10)) then 'vacancy_opportunity'
      when c.fill_rate<50 then 'low_fill'
      else 'healthy'
    end,
    case
      when c.reported_available_beds is null and c.demand_people>0 then 95
      when c.excess_demand>0 then 92
      when c.reported_available_beds=0 and c.demand_people>0 then 88
      when c.capacity>0 and c.reported_available_beds::numeric/c.capacity>=0.30 and c.demand_people<=greatest(2,round(c.capacity*0.10)) then 78
      when c.fill_rate<50 then 72
      when c.fill_rate>=85 then 65
      else 35
    end,
    case
      when c.reported_available_beds is null then 'Verify and report this academic year''s inventory before using occupancy for decisions.'
      when c.excess_demand>0 then 'Review demand pressure and route overflow students to verified alternatives before making allocation promises.'
      when c.reported_available_beds=0 then 'Mark demand as constrained and guide new enquiries to verified alternatives.'
      when c.capacity>0 and c.reported_available_beds::numeric/c.capacity>=0.30 and c.demand_people<=greatest(2,round(c.capacity*0.10)) then 'Prepare a vacancy-demand campaign brief for Corporate Affairs; do not auto-publish.'
      when c.fill_rate<50 then 'Investigate low fill, listing quality, price and demand signals.'
      when c.fill_rate>=85 then 'Monitor remaining beds and avoid over-promising availability.'
      else 'No intervention required; continue monitoring.'
    end,
    case
      when c.capacity>0 and c.reported_available_beds is not null
           and c.reported_available_beds::numeric/c.capacity>=0.30
           and c.demand_people<=greatest(2,round(c.capacity*0.10)) then 'marketing_corporate_affairs'
      else 'accommodation'
    end,
    now()
  from calc c
  on conflict(residence_id,academic_year) do update set
    capacity=excluded.capacity,
    reported_available_beds=excluded.reported_available_beds,
    blocked_beds=excluded.blocked_beds,
    derived_occupied_beds=excluded.derived_occupied_beds,
    fill_rate=excluded.fill_rate,
    active_applications=excluded.active_applications,
    active_reservations=excluded.active_reservations,
    confirmed_reservations=excluded.confirmed_reservations,
    moved_in_students=excluded.moved_in_students,
    demand_people=excluded.demand_people,
    excess_demand=excluded.excess_demand,
    cohort_breakdown=excluded.cohort_breakdown,
    intelligence_status=excluded.intelligence_status,
    action_priority=excluded.action_priority,
    recommended_action=excluded.recommended_action,
    department_key=excluded.department_key,
    refreshed_at=now();

  get diagnostics affected=row_count;

  for rec in
    select * from public.adminos_occupancy_intelligence
    where academic_year=p_academic_year
  loop
    update public.staff_tasks
    set status='completed',updated_at=now(),
        metadata=metadata||jsonb_build_object('resolved_by_rg8_at',now())
    where source_table='adminos_occupancy_intelligence'
      and source_id=rec.id
      and status in ('open','in_progress','waiting')
      and coalesce(metadata->>'automation_key','') <>
          concat('rg8:',rec.academic_year,':',rec.intelligence_status);

    if rec.intelligence_status in ('inventory_unreported','demand_pressure','full','vacancy_opportunity','low_fill') then
      action_key:=concat('rg8:',rec.academic_year,':',rec.intelligence_status);
      target_department:=coalesce(rec.department_key,'accommodation');
      task_title:=case rec.intelligence_status
        when 'inventory_unreported' then concat(rec.academic_year,' inventory verification required')
        when 'demand_pressure' then concat(rec.academic_year,' demand exceeds reported open beds')
        when 'full' then concat(rec.academic_year,' residence full — manage overflow demand')
        when 'vacancy_opportunity' then concat(rec.academic_year,' vacancy-demand opportunity')
        when 'low_fill' then concat(rec.academic_year,' low-fill residence review')
        else 'Occupancy action required'
      end;

      if not exists(
        select 1 from public.staff_tasks
        where source_table='adminos_occupancy_intelligence'
          and source_id=rec.id
          and status in ('open','in_progress','waiting')
          and metadata->>'automation_key'=action_key
      ) then
        insert into public.staff_tasks(
          title,description,source_table,source_id,priority,status,due_at,next_action,tags,metadata,department_key
        ) values(
          task_title,rec.recommended_action,'adminos_occupancy_intelligence',rec.id,
          case when rec.action_priority>=90 then 'urgent' when rec.action_priority>=75 then 'high' else 'normal' end,
          'open',
          now()+case when rec.action_priority>=90 then interval '4 hours' else interval '24 hours' end,
          rec.recommended_action,
          array['rg8','occupancy',rec.intelligence_status,rec.academic_year::text],
          jsonb_build_object(
            'automation_key',action_key,
            'residence_id',rec.residence_id,
            'academic_year',rec.academic_year,
            'fill_rate',rec.fill_rate,
            'reported_available_beds',rec.reported_available_beds,
            'demand_people',rec.demand_people,
            'excess_demand',rec.excess_demand,
            'release_gate',8
          ),
          target_department
        );
      end if;
    end if;
  end loop;

  return affected;
end;
$$;

revoke all on function public.adminos_rg8_refresh_occupancy_year(integer) from public,anon,authenticated;
grant execute on function public.adminos_rg8_refresh_occupancy_year(integer) to service_role;

create or replace function public.adminos_rg8_occupancy_cycle()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  y integer;
  refreshed integer:=0;
  years integer:=0;
begin
  for y in
    select distinct academic_year
    from public.residence_academic_inventory
    where academic_year between extract(year from current_date)::integer-1
                            and extract(year from current_date)::integer+2
    order by academic_year
  loop
    refreshed:=refreshed+public.adminos_rg8_refresh_occupancy_year(y);
    years:=years+1;
  end loop;

  return jsonb_build_object('academic_years_refreshed',years,'residence_year_rows',refreshed,'run_at',now());
end;
$$;

revoke all on function public.adminos_rg8_occupancy_cycle() from public,anon,authenticated;
grant execute on function public.adminos_rg8_occupancy_cycle() to service_role;

-- ============================================================================
-- Agent configuration / authority
-- ============================================================================
insert into public.adminos_agent_config(agent_key,display_name,enabled,authority_level,confidence_threshold,config)
values
('dimpho_conversion','Dimpho · Conversion Automation',true,'green',0.95,
  jsonb_build_object(
    'release_gate',6,'deterministic_scoring',true,'followups',true,'respect_consent',true,
    'respect_do_not_contact',true,'human_handoff_for_protected_decisions',true,
    'blocked_actions',jsonb_build_array('approve_application','reject_application','allocate_room','guarantee_placement','move_money','change_banking')
  )),
('application_operations','Application Operations Agent',true,'green',0.95,
  jsonb_build_object(
    'release_gate',7,'health_score',true,'missing_document_reminders',true,'stale_case_detection',true,
    'protected_status_decisions','human_only','approval_and_rejection','human_only'
  )),
('occupancy_intelligence','Accommodation & Occupancy Intelligence',true,'green',0.97,
  jsonb_build_object(
    'release_gate',8,'academic_year_isolation',true,'cycle_cohorts_not_capacity_pools',true,
    'inventory_verification_required',true,'marketing_handoff_only',true,'auto_publish',false,'room_allocation','human_only'
  ))
on conflict(agent_key) do update set
  display_name=excluded.display_name,
  enabled=excluded.enabled,
  authority_level=excluded.authority_level,
  confidence_threshold=excluded.confidence_threshold,
  config=excluded.config,
  updated_at=now();

-- ============================================================================
-- Schedulers
-- ============================================================================
do $$
declare j record;
begin
  for j in select jobid from cron.job where jobname in (
    'adminos-conversion-followups',
    'adminos-rg6-conversion-intelligence',
    'adminos-rg7-application-operations',
    'adminos-rg8-occupancy-intelligence'
  ) loop
    perform cron.unschedule(j.jobid);
  end loop;

  perform cron.schedule(
    'adminos-rg6-conversion-intelligence',
    '*/10 * * * *',
    $job$select public.adminos_rg6_conversion_cycle();$job$
  );
  perform cron.schedule(
    'adminos-rg7-application-operations',
    '*/15 * * * *',
    $job$select public.adminos_rg7_application_operations_cycle();$job$
  );
  perform cron.schedule(
    'adminos-rg8-occupancy-intelligence',
    '*/30 * * * *',
    $job$select public.adminos_rg8_occupancy_cycle();$job$
  );
end $$;

-- Prime all three engines once on migration.
update public.adminos_whatsapp_conversion_leads set updated_at=updated_at;
select public.adminos_rg7_application_operations_cycle();
select public.adminos_rg8_occupancy_cycle();

      then least(3,greatest(1,(p_patch->>'academic_period')::smallint))
    when v_cycle='trimester' then 1
    else null
  end;

  insert into public.adminos_whatsapp_conversion_leads(
    thread_id,contact_id,user_id,intent,stage,campus,institution,funding,academic_year,
    academic_cycle,academic_period,study_level,student_stage,
    tenant_type,room_preference,budget_min,budget_max,selected_residence_id,
    last_inbound_at,last_conversion_action_at,next_follow_up_at,converted_at,metadata
  ) values (
    p_thread_id,p_contact_id,p_user_id,p_intent,v_stage,
    nullif(p_patch->>'campus',''),nullif(p_patch->>'institution',''),nullif(p_patch->>'funding',''),
    case when (p_patch->>'academic_year') ~ '^\d{4}$' then (p_patch->>'academic_year')::integer else null end,
    v_cycle,v_period,
    case when lower(coalesce(p_patch->>'study_level','')) in ('undergraduate','postgraduate','advanced','other') then lower(p_patch->>'study_level') else null end,
    case when lower(coalesce(p_patch->>'student_stage','')) in ('first_time','continuing','returning','advanced','graduating','other') then lower(p_patch->>'student_stage') else null end,
    nullif(p_patch->>'tenant_type',''),nullif(p_patch->>'room_preference',''),
    case when (p_patch->>'budget_min') ~ '^\d+(\.\d+)?$' then (p_patch->>'budget_min')::numeric else null end,
    case when (p_patch->>'budget_max') ~ '^\d+(\.\d+)?$' then (p_patch->>'budget_max')::numeric else null end,
    case when coalesce(p_patch->>'selected_residence_id','') ~ '^[0-9a-fA-F-]{36}$' then (p_patch->>'selected_residence_id')::uuid else null end,
    now(),now(),v_follow,case when v_stage='converted' then now() else null end,p_patch
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
    academic_cycle=coalesce(excluded.academic_cycle,adminos_whatsapp_conversion_leads.academic_cycle),
    academic_period=coalesce(excluded.academic_period,adminos_whatsapp_conversion_leads.academic_period),
    study_level=coalesce(excluded.study_level,adminos_whatsapp_conversion_leads.study_level),
    student_stage=coalesce(excluded.student_stage,adminos_whatsapp_conversion_leads.student_stage),
    tenant_type=coalesce(excluded.tenant_type,adminos_whatsapp_conversion_leads.tenant_type),
    room_preference=coalesce(excluded.room_preference,adminos_whatsapp_conversion_leads.room_preference),
    budget_min=coalesce(excluded.budget_min,adminos_whatsapp_conversion_leads.budget_min),
    budget_max=coalesce(excluded.budget_max,adminos_whatsapp_conversion_leads.budget_max),
    selected_residence_id=coalesce(excluded.selected_residence_id,adminos_whatsapp_conversion_leads.selected_residence_id),
    last_inbound_at=now(),last_conversion_action_at=now(),
    next_follow_up_at=case when excluded.stage in ('converted','human_handoff') then null else excluded.next_follow_up_at end,
    converted_at=coalesce(adminos_whatsapp_conversion_leads.converted_at,excluded.converted_at),
    metadata=adminos_whatsapp_conversion_leads.metadata || excluded.metadata,
    updated_at=now()
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.adminos_touch_whatsapp_conversion(uuid,uuid,uuid,text,text,jsonb) from public,anon;
grant execute on function public.adminos_touch_whatsapp_conversion(uuid,uuid,uuid,text,text,jsonb) to authenticated,service_role;

create or replace function public.adminos_rg6_conversion_cycle()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  scored integer := 0;
  followups integer := 0;
begin
  update public.adminos_whatsapp_conversion_leads
  set updated_at=updated_at
  where converted_at is null and closed_at is null;
  get diagnostics scored=row_count;

  followups := public.adminos_generate_conversion_followups();

  return jsonb_build_object(
    'scored',scored,
    'followups_generated',followups,
    'run_at',now()
  );
end;
$$;
revoke all on function public.adminos_rg6_conversion_cycle() from public,anon,authenticated;
grant execute on function public.adminos_rg6_conversion_cycle() to service_role;

drop policy if exists department_comms_conversion_leads_read on public.adminos_whatsapp_conversion_leads;
create policy department_comms_conversion_leads_read
on public.adminos_whatsapp_conversion_leads for select to authenticated
using (public.has_admin_department_access('communications_service'));

drop policy if exists department_comms_conversion_leads_update on public.adminos_whatsapp_conversion_leads;
create policy department_comms_conversion_leads_update
on public.adminos_whatsapp_conversion_leads for update to authenticated
using (public.has_admin_department_access('communications_service'))
with check (public.has_admin_department_access('communications_service'));

-- ============================================================================
-- RG7 — Application Operations Automation
-- ============================================================================
alter table public.adminos_application_health_scores
  add column if not exists stale_days integer not null default 0,
  add column if not exists last_activity_at timestamptz,
  add column if not exists next_action_type text,
  add column if not exists next_action_url text,
  add column if not exists automation_state text not null default 'customer_action',
  add column if not exists last_reminder_at timestamptz;

alter table public.adminos_application_health_scores
  drop constraint if exists adminos_application_automation_state_check;
alter table public.adminos_application_health_scores
  add constraint adminos_application_automation_state_check check (
    automation_state in ('customer_action','ready_for_review','staff_attention','closed')
  );

create index if not exists idx_application_health_automation
  on public.adminos_application_health_scores(automation_state,health_band,score,calculated_at desc);

create or replace function public.adminos_recalculate_application_health(p_application_id uuid)
returns public.adminos_application_health_scores
language plpgsql
security definer
set search_path=public
as $$
declare
  a public.applications%rowtype;
  p public.profiles%rowtype;
  existing public.adminos_application_health_scores%rowtype;
  s integer:=0;
  profile_score integer:=0;
  application_score integer:=0;
  document_score integer:=0;
  freshness_score integer:=0;
  stale integer:=0;
  last_activity timestamptz;
  missing jsonb:='[]'::jsonb;
  docs text[]:='{}';
  blocked boolean:=false;
  closed boolean:=false;
  next_type text;
  next_url text := 'https://www.reskonnect.org/my-applications';
  state text;
  result public.adminos_application_health_scores%rowtype;
begin
  select * into a from public.applications where id=p_application_id;
  if a.id is null then return null; end if;
  select * into p from public.profiles where id=a.user_id;
  select * into existing from public.adminos_application_health_scores where application_id=a.id;

  select coalesce(array_agg(lower(regexp_replace(coalesce(doc_type,''),'[^a-z0-9]+','','g'))),'{}'::text[])
  into docs
  from public.application_documents
  where application_id=a.id and lower(coalesce(status,'')) not in ('rejected','invalid','missing','needs_action');

  select greatest(
    coalesce(a.updated_at,a.created_at,now()),
    coalesce((select max(uploaded_at) from public.application_documents where application_id=a.id),'1970-01-01'::timestamptz)
  ) into last_activity;

  stale := greatest(0,floor(extract(epoch from (now()-last_activity))/86400)::integer);

  if nullif(trim(coalesce(p.full_name,'')),'') is not null then profile_score:=profile_score+5;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','full_name','label','Add full name','area','profile','url','https://www.reskonnect.org/profile')); end if;

  if nullif(trim(coalesce(p.email,'')),'') is not null then profile_score:=profile_score+5;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','email','label','Add email address','area','profile','url','https://www.reskonnect.org/profile')); end if;

  if nullif(trim(coalesce(p.phone,p.phone_number,'')),'') is not null then profile_score:=profile_score+5;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','phone','label','Add WhatsApp/contact number','area','profile','url','https://www.reskonnect.org/profile')); end if;

  if nullif(trim(coalesce(p.campus,'')),'') is not null then profile_score:=profile_score+5;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','campus','label','Confirm campus','area','profile','url','https://www.reskonnect.org/profile')); end if;

  if nullif(trim(coalesce(p.student_number,p.identity_number,'')),'') is not null then profile_score:=profile_score+5;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','student_identifier','label','Add student number or identity reference','area','profile','url','https://www.reskonnect.org/profile')); end if;

  if a.residence_id is not null then application_score:=application_score+10;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','residence','label','Choose accommodation','area','application','url','https://www.reskonnect.org/findmyres')); end if;

  if nullif(trim(coalesce(a.funding_type,'')),'') is not null and lower(a.funding_type) not in ('unknown','undecided','unsure') then application_score:=application_score+5;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','funding','label','Confirm funding type','area','application','url',next_url)); end if;

  if a.move_in_date is not null then application_score:=application_score+5;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','move_in_date','label','Confirm intended move-in date','area','application','url',next_url)); end if;

  if nullif(trim(coalesce(a.institution_type,'')),'') is not null then application_score:=application_score+5;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','institution_type','label','Confirm institution type','area','application','url',next_url)); end if;

  if a.academic_year between 2020 and 2100
     and a.academic_cycle in ('annual','semester','trimester')
     and a.academic_period between 1 and 3 then
    application_score:=application_score+5;
  else
    missing:=missing||jsonb_build_array(jsonb_build_object('key','academic_period','label','Confirm academic year and intake period','area','application','url','https://www.reskonnect.org/profile'));
  end if;

  if a.study_level in ('undergraduate','postgraduate','advanced','other') then application_score:=application_score+5;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','study_level','label','Confirm study level','area','profile','url','https://www.reskonnect.org/profile')); end if;

  if exists(select 1 from unnest(docs) d where d ~ '(id|identity|passport)') then document_score:=document_score+10;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','identity_document','label','Upload identity document','area','documents','url',next_url)); end if;

  if exists(select 1 from unnest(docs) d where d ~ '(registration|proofofregistration|enrolment|enrollment)') then document_score:=document_score+10;
  else missing:=missing||jsonb_build_array(jsonb_build_object('key','registration_document','label','Upload proof of registration','area','documents','url',next_url)); end if;

  if lower(coalesce(a.funding_type,'')) in ('private','self','self_funded','self-funded') then
    document_score:=document_score+10;
  elsif exists(select 1 from unnest(docs) d where d ~ '(funding|nsfas|bursary|sponsor)') then
    document_score:=document_score+10;
  else
    missing:=missing||jsonb_build_array(jsonb_build_object('key','funding_document','label','Upload proof of funding','area','documents','url',next_url));
  end if;

  freshness_score := case when stale<=2 then 10 when stale<=5 then 7 when stale<=10 then 4 else 0 end;

  closed := lower(coalesce(a.status,'')) in ('approved','rejected','withdrawn','cancelled','declined');
  blocked := lower(coalesce(a.status,'')) in ('rejected','withdrawn','cancelled','declined');

  s:=least(100,profile_score+application_score+document_score+freshness_score);

  if blocked then
    next_type:='human_review';
    state:='closed';
  elsif closed then
    next_type:='none';
    state:='closed';
  elsif stale>=7 then
    next_type:='staff_review';
    state:='staff_attention';
  elsif s>=85 then
    next_type:='review_application';
    state:='ready_for_review';
  else
    next_type:='complete_application';
    state:='customer_action';
  end if;

  insert into public.adminos_application_health_scores(
    application_id,user_id,contact_id,score,health_band,missing_items,components,calculated_at,
    stale_days,last_activity_at,next_action_type,next_action_url,automation_state,last_reminder_at
  ) values(
    a.id,a.user_id,public.adminos_contact_id_for_user(a.user_id),s,
    case when blocked then 'blocked' when s>=85 then 'ready' when s>=60 then 'attention' else 'incomplete' end,
    missing,
    jsonb_build_object(
      'profile',jsonb_build_object('score',profile_score,'max',25),
      'application',jsonb_build_object('score',application_score,'max',35),
      'documents',jsonb_build_object('score',document_score,'max',30),
      'freshness',jsonb_build_object('score',freshness_score,'max',10,'stale_days',stale)
    ),
    now(),stale,last_activity,next_type,next_url,state,existing.last_reminder_at
  )
  on conflict (application_id) do update set
    user_id=excluded.user_id,
    contact_id=excluded.contact_id,
    score=excluded.score,
    health_band=excluded.health_band,
    missing_items=excluded.missing_items,
    components=excluded.components,
    calculated_at=excluded.calculated_at,
    stale_days=excluded.stale_days,
    last_activity_at=excluded.last_activity_at,
    next_action_type=excluded.next_action_type,
    next_action_url=excluded.next_action_url,
    automation_state=excluded.automation_state,
    last_reminder_at=coalesce(adminos_application_health_scores.last_reminder_at,excluded.last_reminder_at)
  returning * into result;

  return result;
end;
$$;

create or replace function public.adminos_rg7_application_operations_cycle()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  rec record;
  health public.adminos_application_health_scores%rowtype;
  recalculated integer:=0;
  reminders integer:=0;
  staff_tasks_created integer:=0;
  v_event_id uuid;
  first_missing jsonb;
  task_kind text;
begin
  for rec in
    select id from public.applications
    where lower(coalesce(status,'')) not in ('rejected','withdrawn','cancelled','declined')
  loop
    perform public.adminos_recalculate_application_health(rec.id);
    recalculated:=recalculated+1;
  end loop;

  perform public.adminos_refresh_next_best_actions();

  for health in
    select h.*
    from public.adminos_application_health_scores h
    join public.applications a on a.id=h.application_id
    where lower(coalesce(a.status,'')) not in ('approved','rejected','withdrawn','cancelled','declined')
  loop
    first_missing := coalesce(health.missing_items->0,'{}'::jsonb);

    if health.automation_state='customer_action'
       and health.user_id is not null
       and (health.last_reminder_at is null or health.last_reminder_at < now()-interval '48 hours') then
      insert into public.adminos_whatsapp_site_events(
        event_type,source_table,source_id,user_id,contact_id,payload,status,available_at,idempotency_key
      ) values(
        'document_attention','applications',health.application_id,health.user_id,health.contact_id,
        jsonb_build_object(
          'user_name',coalesce((select full_name from public.profiles where id=health.user_id),'there'),
          'next_step',coalesce(first_missing->>'label','Complete your application'),
          'action_url',coalesce(first_missing->>'url',health.next_action_url,'https://www.reskonnect.org/my-applications'),
          'health_score',health.score,
          'health_band',health.health_band,
          'missing_items',health.missing_items
        ),
        'pending',now(),
        concat('rg7-health:',health.application_id,':',to_char(current_date,'YYYYMMDD'))
      )
      on conflict (idempotency_key) do nothing
      returning id into v_event_id;

      if v_event_id is not null then
        update public.adminos_application_health_scores
        set last_reminder_at=now()
        where application_id=health.application_id;
        reminders:=reminders+1;
      end if;
      v_event_id:=null;
    end if;

    if health.automation_state='staff_attention' or health.health_band='blocked' then
      task_kind := case when health.health_band='blocked' then 'application_human_review' else 'application_stale_review' end;
      insert into public.conversion_automation_tasks(
        task_type,source_type,source_id,user_id,owner_scope,status,priority,due_at,summary,payload
      ) values(
        task_kind,'application',health.application_id,health.user_id,'accommodation','pending',
        case when health.health_band='blocked' or health.stale_days>=14 then 'urgent' else 'high' end,
        now()+case when health.health_band='blocked' then interval '4 hours' else interval '24 hours' end,
        case when health.health_band='blocked' then 'Application requires protected staff review'
             else concat('Application stale for ',health.stale_days,' days') end,
        jsonb_build_object(
          'health_score',health.score,'health_band',health.health_band,'stale_days',health.stale_days,
          'missing_items',health.missing_items,'next_action_url',health.next_action_url,
          'department_key','accommodation','release_gate',7
        )
      )
      on conflict (source_type,source_id,task_type) do update set
        status=case when conversion_automation_tasks.status='completed' then 'pending' else conversion_automation_tasks.status end,
        priority=excluded.priority,due_at=excluded.due_at,summary=excluded.summary,payload=excluded.payload,updated_at=now();
      staff_tasks_created:=staff_tasks_created+1;
    end if;
  end loop;

  update public.conversion_automation_tasks t
  set status='completed',completed_at=coalesce(completed_at,now()),updated_at=now()
  where t.source_type='application'
    and t.task_type in ('application_human_review','application_stale_review')
    and t.status='pending'
    and exists(
      select 1 from public.adminos_application_health_scores h
      where h.application_id=t.source_id
        and h.automation_state not in ('staff_attention')
        and h.health_band<>'blocked'
    );

  return jsonb_build_object(
    'applications_recalculated',recalculated,
    'customer_reminders_queued',reminders,
    'staff_exception_tasks_refreshed',staff_tasks_created,
    'run_at',now()
  );
end;
$$;

revoke all on function public.adminos_rg7_application_operations_cycle() from public,anon,authenticated;
grant execute on function public.adminos_rg7_application_operations_cycle() to service_role;

drop policy if exists department_accommodation_health_read on public.adminos_application_health_scores;
create policy department_accommodation_health_read
on public.adminos_application_health_scores for select to authenticated
using (public.has_admin_department_access('accommodation'));

drop policy if exists department_accommodation_conversion_tasks_manage on public.conversion_automation_tasks;
create policy department_accommodation_conversion_tasks_manage
on public.conversion_automation_tasks for all to authenticated
using (public.has_admin_department_access('accommodation') or public.has_admin_department_access('operations'))
with check (public.has_admin_department_access('accommodation') or public.has_admin_department_access('operations'));

-- ============================================================================
-- RG8 — Academic-Year Occupancy Intelligence
-- ============================================================================
create table if not exists public.adminos_occupancy_intelligence(
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences(id) on delete cascade,
  academic_year integer not null check (academic_year between 2020 and 2100),
  capacity integer not null default 0,
  reported_available_beds integer,
  blocked_beds integer not null default 0,
  derived_occupied_beds integer,
  fill_rate numeric,
  active_applications integer not null default 0,
  active_reservations integer not null default 0,
  confirmed_reservations integer not null default 0,
  moved_in_students integer not null default 0,
  demand_people integer not null default 0,
  excess_demand integer not null default 0,
  cohort_breakdown jsonb not null default '{}'::jsonb,
  intelligence_status text not null default 'inventory_unreported',
  action_priority integer not null default 50 check (action_priority between 0 and 100),
  recommended_action text,
  department_key text,
  refreshed_at timestamptz not null default now(),
  unique(residence_id,academic_year)
);

alter table public.adminos_occupancy_intelligence enable row level security;

drop policy if exists occupancy_intelligence_department_read on public.adminos_occupancy_intelligence;
create policy occupancy_intelligence_department_read
on public.adminos_occupancy_intelligence for select to authenticated
using (
  public.has_admin_department_access('accommodation')
  or public.has_admin_department_access('intelligence_analytics')
  or public.has_admin_department_access('executive')
  or public.has_admin_department_access('marketing_corporate_affairs')
);

grant select on public.adminos_occupancy_intelligence to authenticated;
revoke insert,update,delete on public.adminos_occupancy_intelligence from authenticated,anon;

create index if not exists idx_occupancy_intelligence_year_priority
  on public.adminos_occupancy_intelligence(academic_year,action_priority desc,intelligence_status);

create or replace function public.adminos_rg8_refresh_occupancy_year(p_academic_year integer)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  affected integer:=0;
  rec public.adminos_occupancy_intelligence%rowtype;
  action_key text;
  target_department text;
  task_title text;
begin
  if p_academic_year < 2020 or p_academic_year > 2100 then
    raise exception 'Invalid academic year';
  end if;

  with apps as (
    select residence_id,
      count(*) filter (where lower(coalesce(status,'')) not in ('approved','rejected','withdrawn','cancelled','declined'))::integer active_applications,
      count(distinct user_id) filter (where coalesce(moved_in,false)=true)::integer moved_in_students,
      jsonb_build_object(
        'annual',count(*) filter (where academic_cycle='annual'),
        'semester_1',count(*) filter (where academic_cycle='semester' and academic_period=1),
        'semester_2',count(*) filter (where academic_cycle='semester' and academic_period=2),
        'trimester_1',count(*) filter (where academic_cycle='trimester' and academic_period=1),
        'trimester_2',count(*) filter (where academic_cycle='trimester' and academic_period=2),
        'trimester_3',count(*) filter (where academic_cycle='trimester' and academic_period=3),
        'undergraduate',count(*) filter (where study_level='undergraduate'),
        'postgraduate',count(*) filter (where study_level='postgraduate'),
        'advanced',count(*) filter (where study_level='advanced')
      ) cohort_breakdown
    from public.applications
    where academic_year=p_academic_year and residence_id is not null
    group by residence_id
  ),
  reservations as (
    select residence_id,
      count(*) filter (where lower(coalesce(status,''))<>'cancelled')::integer active_reservations,
      count(*) filter (where lower(coalesce(status,''))='confirmed')::integer confirmed_reservations
    from public.accommodation_reservations
    where academic_year=p_academic_year
    group by residence_id
  ),
  demand as (
    select residence_id,count(distinct user_id)::integer demand_people
    from (
      select residence_id,user_id from public.applications
      where academic_year=p_academic_year and residence_id is not null and user_id is not null
        and lower(coalesce(status,'')) not in ('rejected','withdrawn','cancelled','declined')
      union
      select residence_id,user_id from public.accommodation_reservations
      where academic_year=p_academic_year and user_id is not null
        and lower(coalesce(status,''))<>'cancelled'
    ) d
    group by residence_id
  ),
  calc as (
    select
      i.residence_id,i.academic_year,i.capacity,i.reported_available_beds,i.blocked_beds,
      case when i.reported_available_beds is null then null
           else greatest(i.capacity-i.reported_available_beds-i.blocked_beds,0) end derived_occupied_beds,
      case when i.reported_available_beds is null or i.capacity<=0 then null
           else round((greatest(i.capacity-i.reported_available_beds-i.blocked_beds,0)::numeric/nullif(i.capacity,0))*100,2) end fill_rate,
      coalesce(a.active_applications,0) active_applications,
      coalesce(r.active_reservations,0) active_reservations,
      coalesce(r.confirmed_reservations,0) confirmed_reservations,
      coalesce(a.moved_in_students,0) moved_in_students,
      coalesce(d.demand_people,0) demand_people,
      case when i.reported_available_beds is null then 0
           else greatest(coalesce(d.demand_people,0)-i.reported_available_beds,0) end excess_demand,
      coalesce(a.cohort_breakdown,'{}'::jsonb) cohort_breakdown
    from public.residence_academic_inventory i
    left join apps a on a.residence_id=i.residence_id
    left join reservations r on r.residence_id=i.residence_id
    left join demand d on d.residence_id=i.residence_id
    where i.academic_year=p_academic_year
  )
  insert into public.adminos_occupancy_intelligence(
    residence_id,academic_year,capacity,reported_available_beds,blocked_beds,derived_occupied_beds,fill_rate,
    active_applications,active_reservations,confirmed_reservations,moved_in_students,demand_people,excess_demand,
    cohort_breakdown,intelligence_status,action_priority,recommended_action,department_key,refreshed_at
  )
  select
    c.residence_id,c.academic_year,c.capacity,c.reported_available_beds,c.blocked_beds,c.derived_occupied_beds,c.fill_rate,
    c.active_applications,c.active_reservations,c.confirmed_reservations,c.moved_in_students,c.demand_people,c.excess_demand,
    c.cohort_breakdown,
    case
      when c.reported_available_beds is null then 'inventory_unreported'
      when c.reported_available_beds=0 then 'full'
      when c.excess_demand>0 then 'demand_pressure'
      when c.fill_rate>=85 then 'near_full'
      when c.capacity>0 and c.reported_available_beds::numeric/c.capacity>=0.30 and c.demand_people<=greatest(2,round(c.capacity*0.10)) then 'vacancy_opportunity'
      when c.fill_rate<50 then 'low_fill'
      else 'healthy'
    end,
    case
      when c.reported_available_beds is null and c.demand_people>0 then 95
      when c.excess_demand>0 then 92
      when c.reported_available_beds=0 and c.demand_people>0 then 88
      when c.capacity>0 and c.reported_available_beds::numeric/c.capacity>=0.30 and c.demand_people<=greatest(2,round(c.capacity*0.10)) then 78
      when c.fill_rate<50 then 72
      when c.fill_rate>=85 then 65
      else 35
    end,
    case
      when c.reported_available_beds is null then 'Verify and report this academic year''s inventory before using occupancy for decisions.'
      when c.excess_demand>0 then 'Review demand pressure and route overflow students to verified alternatives before making allocation promises.'
      when c.reported_available_beds=0 then 'Mark demand as constrained and guide new enquiries to verified alternatives.'
      when c.capacity>0 and c.reported_available_beds::numeric/c.capacity>=0.30 and c.demand_people<=greatest(2,round(c.capacity*0.10)) then 'Prepare a vacancy-demand campaign brief for Corporate Affairs; do not auto-publish.'
      when c.fill_rate<50 then 'Investigate low fill, listing quality, price and demand signals.'
      when c.fill_rate>=85 then 'Monitor remaining beds and avoid over-promising availability.'
      else 'No intervention required; continue monitoring.'
    end,
    case
      when c.capacity>0 and c.reported_available_beds is not null
           and c.reported_available_beds::numeric/c.capacity>=0.30
           and c.demand_people<=greatest(2,round(c.capacity*0.10)) then 'marketing_corporate_affairs'
      else 'accommodation'
    end,
    now()
  from calc c
  on conflict(residence_id,academic_year) do update set
    capacity=excluded.capacity,
    reported_available_beds=excluded.reported_available_beds,
    blocked_beds=excluded.blocked_beds,
    derived_occupied_beds=excluded.derived_occupied_beds,
    fill_rate=excluded.fill_rate,
    active_applications=excluded.active_applications,
    active_reservations=excluded.active_reservations,
    confirmed_reservations=excluded.confirmed_reservations,
    moved_in_students=excluded.moved_in_students,
    demand_people=excluded.demand_people,
    excess_demand=excluded.excess_demand,
    cohort_breakdown=excluded.cohort_breakdown,
    intelligence_status=excluded.intelligence_status,
    action_priority=excluded.action_priority,
    recommended_action=excluded.recommended_action,
    department_key=excluded.department_key,
    refreshed_at=now();

  get diagnostics affected=row_count;

  for rec in
    select * from public.adminos_occupancy_intelligence
    where academic_year=p_academic_year
  loop
    update public.staff_tasks
    set status='completed',updated_at=now(),
        metadata=metadata||jsonb_build_object('resolved_by_rg8_at',now())
    where source_table='adminos_occupancy_intelligence'
      and source_id=rec.id
      and status in ('open','in_progress','waiting')
      and coalesce(metadata->>'automation_key','') <>
          concat('rg8:',rec.academic_year,':',rec.intelligence_status);

    if rec.intelligence_status in ('inventory_unreported','demand_pressure','full','vacancy_opportunity','low_fill') then
      action_key:=concat('rg8:',rec.academic_year,':',rec.intelligence_status);
      target_department:=coalesce(rec.department_key,'accommodation');
      task_title:=case rec.intelligence_status
        when 'inventory_unreported' then concat(rec.academic_year,' inventory verification required')
        when 'demand_pressure' then concat(rec.academic_year,' demand exceeds reported open beds')
        when 'full' then concat(rec.academic_year,' residence full — manage overflow demand')
        when 'vacancy_opportunity' then concat(rec.academic_year,' vacancy-demand opportunity')
        when 'low_fill' then concat(rec.academic_year,' low-fill residence review')
        else 'Occupancy action required'
      end;

      if not exists(
        select 1 from public.staff_tasks
        where source_table='adminos_occupancy_intelligence'
          and source_id=rec.id
          and status in ('open','in_progress','waiting')
          and metadata->>'automation_key'=action_key
      ) then
        insert into public.staff_tasks(
          title,description,source_table,source_id,priority,status,due_at,next_action,tags,metadata,department_key
        ) values(
          task_title,rec.recommended_action,'adminos_occupancy_intelligence',rec.id,
          case when rec.action_priority>=90 then 'urgent' when rec.action_priority>=75 then 'high' else 'normal' end,
          'open',
          now()+case when rec.action_priority>=90 then interval '4 hours' else interval '24 hours' end,
          rec.recommended_action,
          array['rg8','occupancy',rec.intelligence_status,rec.academic_year::text],
          jsonb_build_object(
            'automation_key',action_key,
            'residence_id',rec.residence_id,
            'academic_year',rec.academic_year,
            'fill_rate',rec.fill_rate,
            'reported_available_beds',rec.reported_available_beds,
            'demand_people',rec.demand_people,
            'excess_demand',rec.excess_demand,
            'release_gate',8
          ),
          target_department
        );
      end if;
    end if;
  end loop;

  return affected;
end;
$$;

revoke all on function public.adminos_rg8_refresh_occupancy_year(integer) from public,anon,authenticated;
grant execute on function public.adminos_rg8_refresh_occupancy_year(integer) to service_role;

create or replace function public.adminos_rg8_occupancy_cycle()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  y integer;
  refreshed integer:=0;
  years integer:=0;
begin
  for y in
    select distinct academic_year
    from public.residence_academic_inventory
    where academic_year between extract(year from current_date)::integer-1
                            and extract(year from current_date)::integer+2
    order by academic_year
  loop
    refreshed:=refreshed+public.adminos_rg8_refresh_occupancy_year(y);
    years:=years+1;
  end loop;

  return jsonb_build_object('academic_years_refreshed',years,'residence_year_rows',refreshed,'run_at',now());
end;
$$;

revoke all on function public.adminos_rg8_occupancy_cycle() from public,anon,authenticated;
grant execute on function public.adminos_rg8_occupancy_cycle() to service_role;

-- ============================================================================
-- Agent configuration / authority
-- ============================================================================
insert into public.adminos_agent_config(agent_key,display_name,enabled,authority_level,confidence_threshold,config)
values
('dimpho_conversion','Dimpho · Conversion Automation',true,'green',0.95,
  jsonb_build_object(
    'release_gate',6,'deterministic_scoring',true,'followups',true,'respect_consent',true,
    'respect_do_not_contact',true,'human_handoff_for_protected_decisions',true,
    'blocked_actions',jsonb_build_array('approve_application','reject_application','allocate_room','guarantee_placement','move_money','change_banking')
  )),
('application_operations','Application Operations Agent',true,'green',0.95,
  jsonb_build_object(
    'release_gate',7,'health_score',true,'missing_document_reminders',true,'stale_case_detection',true,
    'protected_status_decisions','human_only','approval_and_rejection','human_only'
  )),
('occupancy_intelligence','Accommodation & Occupancy Intelligence',true,'green',0.97,
  jsonb_build_object(
    'release_gate',8,'academic_year_isolation',true,'cycle_cohorts_not_capacity_pools',true,
    'inventory_verification_required',true,'marketing_handoff_only',true,'auto_publish',false,'room_allocation','human_only'
  ))
on conflict(agent_key) do update set
  display_name=excluded.display_name,
  enabled=excluded.enabled,
  authority_level=excluded.authority_level,
  confidence_threshold=excluded.confidence_threshold,
  config=excluded.config,
  updated_at=now();

-- ============================================================================
-- Schedulers
-- ============================================================================
do $$
declare j record;
begin
  for j in select jobid from cron.job where jobname in (
    'adminos-conversion-followups',
    'adminos-rg6-conversion-intelligence',
    'adminos-rg7-application-operations',
    'adminos-rg8-occupancy-intelligence'
  ) loop
    perform cron.unschedule(j.jobid);
  end loop;

  perform cron.schedule(
    'adminos-rg6-conversion-intelligence',
    '*/10 * * * *',
    $job$select public.adminos_rg6_conversion_cycle();$job$
  );
  perform cron.schedule(
    'adminos-rg7-application-operations',
    '*/15 * * * *',
    $job$select public.adminos_rg7_application_operations_cycle();$job$
  );
  perform cron.schedule(
    'adminos-rg8-occupancy-intelligence',
    '*/30 * * * *',
    $job$select public.adminos_rg8_occupancy_cycle();$job$
  );
end $$;

-- Prime all three engines once on migration.
update public.adminos_whatsapp_conversion_leads set updated_at=updated_at;
select public.adminos_rg7_application_operations_cycle();
select public.adminos_rg8_occupancy_cycle();
