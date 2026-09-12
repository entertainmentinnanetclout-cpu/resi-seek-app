-- AgentOS RG9 — Student Opportunities Automation
-- Unifies WIL and application-support cases, keeps opportunity catalogs fresh,
-- and creates "potential match" suggestions without claiming eligibility.

create table if not exists public.adminos_student_opportunity_cases (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('wil_application','application_support')),
  source_id uuid not null,
  user_id uuid,
  contact_id uuid references public.adminos_contacts(id) on delete set null,
  case_type text not null check (case_type in ('wil','application_support','tvet','bursary_support','general')),
  institution text,
  campus text,
  programme text,
  source_status text not null,
  readiness_score integer not null default 0 check (readiness_score between 0 and 100),
  readiness_band text not null default 'incomplete' check (readiness_band in ('incomplete','attention','ready','placed','closed')),
  missing_items jsonb not null default '[]'::jsonb,
  next_best_action text,
  next_action_url text,
  priority integer not null default 50 check (priority between 0 and 100),
  automation_state text not null default 'customer_action' check (automation_state in ('customer_action','ready_for_review','staff_attention','closed')),
  last_activity_at timestamptz,
  stale_days integer not null default 0,
  last_reminder_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  unique(source_type,source_id)
);

create index if not exists idx_student_opportunity_cases_state
  on public.adminos_student_opportunity_cases(automation_state,priority desc,calculated_at desc);
create index if not exists idx_student_opportunity_cases_user
  on public.adminos_student_opportunity_cases(user_id,calculated_at desc);

alter table public.adminos_student_opportunity_cases enable row level security;
drop policy if exists student_opportunity_cases_department_read on public.adminos_student_opportunity_cases;
create policy student_opportunity_cases_department_read
on public.adminos_student_opportunity_cases for select to authenticated
using (
  public.has_admin_department_access('student_opportunities')
  or public.has_admin_department_access('operations')
  or public.has_admin_department_access('executive')
  or public.has_admin_department_access('intelligence_analytics')
);
revoke insert,update,delete on public.adminos_student_opportunity_cases from authenticated,anon;
grant select on public.adminos_student_opportunity_cases to authenticated;

create table if not exists public.adminos_opportunity_catalog_health (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('bursary','public_opportunity')),
  source_id uuid not null,
  title text not null,
  provider text,
  public_state text not null,
  health_state text not null check (health_state in ('ready','closing_soon','expired','needs_verification','incomplete','draft')),
  quality_score integer not null default 0 check (quality_score between 0 and 100),
  deadline timestamptz,
  last_verified_at timestamptz,
  issues jsonb not null default '[]'::jsonb,
  recommended_action text,
  auto_hygiene_applied boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  refreshed_at timestamptz not null default now(),
  unique(source_type,source_id)
);

create index if not exists idx_opportunity_catalog_health_state
  on public.adminos_opportunity_catalog_health(health_state,quality_score,deadline);

alter table public.adminos_opportunity_catalog_health enable row level security;
drop policy if exists opportunity_catalog_department_read on public.adminos_opportunity_catalog_health;
create policy opportunity_catalog_department_read
on public.adminos_opportunity_catalog_health for select to authenticated
using (
  public.has_admin_department_access('student_opportunities')
  or public.has_admin_department_access('executive')
  or public.has_admin_department_access('intelligence_analytics')
);
revoke insert,update,delete on public.adminos_opportunity_catalog_health from authenticated,anon;
grant select on public.adminos_opportunity_catalog_health to authenticated;

create table if not exists public.adminos_student_opportunity_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  case_id uuid references public.adminos_student_opportunity_cases(id) on delete cascade,
  opportunity_source_type text not null check (opportunity_source_type in ('bursary','public_opportunity')),
  opportunity_source_id uuid not null,
  match_score integer not null check (match_score between 0 and 100),
  match_band text not null check (match_band in ('possible','strong')),
  rationale text not null,
  requires_official_confirmation boolean not null default true,
  status text not null default 'suggested' check (status in ('suggested','dismissed','interested','applied','expired')),
  expires_at timestamptz,
  generated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique(user_id,opportunity_source_type,opportunity_source_id)
);

create index if not exists idx_student_opportunity_matches_user
  on public.adminos_student_opportunity_matches(user_id,status,match_score desc);

alter table public.adminos_student_opportunity_matches enable row level security;
drop policy if exists opportunity_matches_staff_read on public.adminos_student_opportunity_matches;
create policy opportunity_matches_staff_read
on public.adminos_student_opportunity_matches for select to authenticated
using (
  public.has_admin_department_access('student_opportunities')
  or public.has_admin_department_access('operations')
  or public.has_admin_department_access('executive')
);
drop policy if exists opportunity_matches_owner_read on public.adminos_student_opportunity_matches;
create policy opportunity_matches_owner_read
on public.adminos_student_opportunity_matches for select to authenticated
using (user_id=auth.uid());
revoke insert,update,delete on public.adminos_student_opportunity_matches from authenticated,anon;
grant select on public.adminos_student_opportunity_matches to authenticated;

create or replace function public.adminos_rg9_refresh_wil_case(p_id uuid)
returns public.adminos_student_opportunity_cases
language plpgsql security definer set search_path=public as $$
declare
  w public.wil_applications%rowtype;
  existing public.adminos_student_opportunity_cases%rowtype;
  score integer:=0;
  docs integer:=0;
  stale integer:=0;
  missing jsonb:='[]'::jsonb;
  state text;
  band text;
  next_action text;
  priority_value integer:=50;
  result public.adminos_student_opportunity_cases%rowtype;
begin
  select * into w from public.wil_applications where id=p_id;
  if w.id is null then return null; end if;
  select * into existing from public.adminos_student_opportunity_cases where source_type='wil_application' and source_id=w.id;
  select count(*)::integer into docs from public.wil_documents where application_id=w.id;
  stale:=greatest(0,floor(extract(epoch from (now()-coalesce(w.updated_at,w.created_at)))/86400)::integer);

  if nullif(trim(w.full_name),'') is not null then score:=score+10; else missing:=missing||jsonb_build_array(jsonb_build_object('key','full_name','label','Confirm full name')); end if;
  if nullif(trim(w.student_number),'') is not null then score:=score+10; else missing:=missing||jsonb_build_array(jsonb_build_object('key','student_number','label','Confirm student number')); end if;
  if nullif(trim(w.course),'') is not null then score:=score+15; else missing:=missing||jsonb_build_array(jsonb_build_object('key','course','label','Confirm programme/course')); end if;
  if w.year_level>0 then score:=score+10; else missing:=missing||jsonb_build_array(jsonb_build_object('key','year_level','label','Confirm year level')); end if;
  if nullif(trim(w.wil_duration),'') is not null then score:=score+10; else missing:=missing||jsonb_build_array(jsonb_build_object('key','wil_duration','label','Confirm WIL duration')); end if;
  if nullif(trim(w.funding_status),'') is not null then score:=score+10; else missing:=missing||jsonb_build_array(jsonb_build_object('key','funding_status','label','Confirm funding/stipend context')); end if;
  if nullif(trim(w.campus),'') is not null then score:=score+10; else missing:=missing||jsonb_build_array(jsonb_build_object('key','campus','label','Confirm campus')); end if;
  if nullif(trim(coalesce(w.preferred_area,'')),'') is not null then score:=score+5; end if;
  if docs>0 then score:=score+10; end if;
  score:=score+case when stale<=2 then 10 when stale<=7 then 6 when stale<=14 then 3 else 0 end;

  if lower(w.status)='placed' then
    score:=100;band:='placed';state:='closed';next_action:='Placement recorded';priority_value:=20;
  elsif lower(w.status)='not_suitable' then
    band:='closed';state:='closed';next_action:='Case closed — not suitable';priority_value:=30;
  elsif lower(w.status) in ('needs_documents','documents_required') then
    band:=case when score>=60 then 'attention' else 'incomplete' end;
    state:='customer_action';next_action:='Complete requested WIL documents';priority_value:=85;
  elsif stale>=7 then
    band:=case when score>=75 then 'ready' when score>=55 then 'attention' else 'incomplete' end;
    state:='staff_attention';next_action:='Review stale WIL application and confirm the next placement step';priority_value:=case when stale>=14 then 95 else 80 end;
  elsif lower(w.status)='processing' then
    band:=case when score>=75 then 'ready' else 'attention' end;
    state:='ready_for_review';next_action:='Continue placement review';priority_value:=65;
  else
    band:=case when score>=75 then 'ready' when score>=55 then 'attention' else 'incomplete' end;
    state:=case when score>=75 then 'ready_for_review' else 'customer_action' end;
    next_action:=case when score>=75 then 'Review for WIL placement support' else 'Complete WIL readiness information' end;
    priority_value:=case when score<55 then 75 else 60 end;
  end if;

  insert into public.adminos_student_opportunity_cases(
    source_type,source_id,user_id,contact_id,case_type,institution,campus,programme,source_status,
    readiness_score,readiness_band,missing_items,next_best_action,next_action_url,priority,
    automation_state,last_activity_at,stale_days,last_reminder_at,metadata,calculated_at
  ) values(
    'wil_application',w.id,w.student_id,public.adminos_contact_id_for_user(w.student_id),'wil',
    null,w.campus,w.course,w.status,least(100,score),band,missing,next_action,'https://www.reskonnect.org/wil',
    priority_value,state,coalesce(w.updated_at,w.created_at),stale,existing.last_reminder_at,
    jsonb_build_object('documents_uploaded',docs,'year_level',w.year_level,'wil_duration',w.wil_duration,'funding_status',w.funding_status,'preferred_area',w.preferred_area),now()
  )
  on conflict(source_type,source_id) do update set
    user_id=excluded.user_id,contact_id=excluded.contact_id,case_type=excluded.case_type,campus=excluded.campus,
    programme=excluded.programme,source_status=excluded.source_status,readiness_score=excluded.readiness_score,
    readiness_band=excluded.readiness_band,missing_items=excluded.missing_items,next_best_action=excluded.next_best_action,
    next_action_url=excluded.next_action_url,priority=excluded.priority,automation_state=excluded.automation_state,
    last_activity_at=excluded.last_activity_at,stale_days=excluded.stale_days,
    last_reminder_at=coalesce(adminos_student_opportunity_cases.last_reminder_at,excluded.last_reminder_at),
    metadata=excluded.metadata,calculated_at=now()
  returning * into result;
  return result;
end;
$$;

create or replace function public.adminos_rg9_refresh_support_case(p_id uuid)
returns public.adminos_student_opportunity_cases
language plpgsql security definer set search_path=public as $$
declare
  q public.application_support_queries%rowtype;
  existing public.adminos_student_opportunity_cases%rowtype;
  score integer:=0;
  stale integer:=0;
  missing jsonb:='[]'::jsonb;
  state text;
  band text;
  next_action text;
  priority_value integer:=50;
  case_kind text;
  result public.adminos_student_opportunity_cases%rowtype;
begin
  select * into q from public.application_support_queries where id=p_id;
  if q.id is null then return null; end if;
  select * into existing from public.adminos_student_opportunity_cases where source_type='application_support' and source_id=q.id;
  stale:=greatest(0,floor(extract(epoch from (now()-coalesce(q.updated_at,q.created_at)))/86400)::integer);

  if nullif(trim(q.full_name),'') is not null then score:=score+10; else missing:=missing||jsonb_build_array(jsonb_build_object('key','full_name','label','Confirm full name')); end if;
  if nullif(trim(coalesce(q.whatsapp_number,q.phone,q.email,'')),'') is not null then score:=score+15; else missing:=missing||jsonb_build_array(jsonb_build_object('key','contact','label','Add contact details')); end if;
  if q.institution_type::text<>'unsure' then score:=score+10; else missing:=missing||jsonb_build_array(jsonb_build_object('key','institution_type','label','Choose institution type')); end if;
  if nullif(trim(coalesce(q.preferred_institution,'')),'') is not null then score:=score+10; else missing:=missing||jsonb_build_array(jsonb_build_object('key','institution','label','Choose preferred institution')); end if;
  if nullif(trim(coalesce(q.preferred_programme,'')),'') is not null then score:=score+15; else missing:=missing||jsonb_build_array(jsonb_build_object('key','programme','label','Choose programme/course')); end if;
  if coalesce(q.documents_ready,false) then score:=score+20; else missing:=missing||jsonb_build_array(jsonb_build_object('key','documents','label','Prepare application documents')); end if;
  if nullif(trim(coalesce(q.highest_grade,'')),'') is not null or q.subject_marks<>'{}'::jsonb then score:=score+10; end if;
  if q.consent_to_be_contacted and q.popia_consent then score:=score+10; end if;

  case_kind:=case
    when q.institution_type::text='tvet' then 'tvet'
    when lower(coalesce(q.source_page,'')) like '%burs%' then 'bursary_support'
    else 'application_support'
  end;

  if q.status::text in ('completed','closed','cancelled','rejected') then
    band:='closed';state:='closed';next_action:='Case closed';priority_value:=20;
  elsif stale>=7 then
    band:=case when score>=75 then 'ready' when score>=55 then 'attention' else 'incomplete' end;
    state:='staff_attention';next_action:='Review stale student-service case';priority_value:=case when stale>=14 then 95 else 80 end;
  elsif score>=80 then
    band:='ready';state:='ready_for_review';next_action:='Continue application support';priority_value:=60;
  elsif score>=55 then
    band:='attention';state:='customer_action';next_action:=coalesce(missing->0->>'label','Complete application readiness');priority_value:=70;
  else
    band:='incomplete';state:='customer_action';next_action:=coalesce(missing->0->>'label','Complete application readiness');priority_value:=80;
  end if;

  insert into public.adminos_student_opportunity_cases(
    source_type,source_id,user_id,contact_id,case_type,institution,campus,programme,source_status,
    readiness_score,readiness_band,missing_items,next_best_action,next_action_url,priority,
    automation_state,last_activity_at,stale_days,last_reminder_at,metadata,calculated_at
  ) values(
    'application_support',q.id,q.user_id,public.adminos_contact_id_for_user(q.user_id),case_kind,
    q.preferred_institution,q.preferred_campus,q.preferred_programme,q.status::text,least(100,score),band,missing,
    next_action,'https://www.reskonnect.org/applications',priority_value,state,coalesce(q.updated_at,q.created_at),stale,
    existing.last_reminder_at,jsonb_build_object('institution_type',q.institution_type::text,'documents_ready',q.documents_ready,'needs_accommodation',q.needs_accommodation,'consent_to_be_contacted',q.consent_to_be_contacted,'popia_consent',q.popia_consent),now()
  )
  on conflict(source_type,source_id) do update set
    user_id=excluded.user_id,contact_id=excluded.contact_id,case_type=excluded.case_type,institution=excluded.institution,
    campus=excluded.campus,programme=excluded.programme,source_status=excluded.source_status,
    readiness_score=excluded.readiness_score,readiness_band=excluded.readiness_band,missing_items=excluded.missing_items,
    next_best_action=excluded.next_best_action,next_action_url=excluded.next_action_url,priority=excluded.priority,
    automation_state=excluded.automation_state,last_activity_at=excluded.last_activity_at,stale_days=excluded.stale_days,
    last_reminder_at=coalesce(adminos_student_opportunity_cases.last_reminder_at,excluded.last_reminder_at),
    metadata=excluded.metadata,calculated_at=now()
  returning * into result;
  return result;
end;
$$;

create or replace function public.adminos_rg9_refresh_catalog()
returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  bursaries_disabled integer:=0;
  opportunities_unpublished integer:=0;
begin
  update public.bursaries
  set is_active=false,updated_at=now()
  where is_active=true and deadline is not null and deadline<current_date;
  get diagnostics bursaries_disabled=row_count;

  update public.public_opportunities
  set is_published=false,updated_at=now(),
      metadata=metadata||jsonb_build_object('auto_unpublished_reason','closing_date_passed','auto_unpublished_at',now())
  where is_published=true and closing_date is not null and closing_date<now();
  get diagnostics opportunities_unpublished=row_count;

  insert into public.adminos_opportunity_catalog_health(
    source_type,source_id,title,provider,public_state,health_state,quality_score,deadline,last_verified_at,
    issues,recommended_action,auto_hygiene_applied,metadata,refreshed_at
  )
  select
    'bursary',b.id,b.name,b.provider,case when b.is_active then 'active' else 'inactive' end,
    case
      when b.deadline is not null and b.deadline<current_date then 'expired'
      when b.is_active and (nullif(trim(coalesce(b.link,'')),'') is null or nullif(trim(coalesce(b.description,'')),'') is null) then 'incomplete'
      when b.is_active and b.deadline is not null and b.deadline<=current_date+7 then 'closing_soon'
      when b.is_active then 'ready'
      else 'draft'
    end,
    least(100,
      (case when nullif(trim(b.name),'') is not null then 20 else 0 end)+
      (case when nullif(trim(b.provider),'') is not null then 15 else 0 end)+
      (case when nullif(trim(coalesce(b.description,'')),'') is not null then 15 else 0 end)+
      (case when nullif(trim(coalesce(b.link,'')),'') is not null then 20 else 0 end)+
      (case when b.deadline is not null then 15 else 0 end)+
      (case when coalesce(array_length(b.fields_of_study,1),0)>0 then 15 else 0 end)
    ),
    case when b.deadline is null then null else b.deadline::timestamptz end,null,
    (case when b.deadline is not null and b.deadline<current_date then jsonb_build_array('deadline_passed') else '[]'::jsonb end)
      || (case when nullif(trim(coalesce(b.link,'')),'') is null then jsonb_build_array('application_link_missing') else '[]'::jsonb end)
      || (case when nullif(trim(coalesce(b.description,'')),'') is null then jsonb_build_array('description_missing') else '[]'::jsonb end),
    case
      when b.deadline is not null and b.deadline<current_date then 'Keep inactive until a new verified funding cycle is added.'
      when nullif(trim(coalesce(b.link,'')),'') is null then 'Add and verify the official application link before promoting this bursary.'
      when b.is_active and b.deadline<=current_date+7 then 'Closing soon — verify the deadline and official application route.'
      else 'Continue monitoring.'
    end,
    (b.deadline is not null and b.deadline<current_date and b.is_active=false),
    jsonb_build_object('type',b.type,'fields_of_study',coalesce(to_jsonb(b.fields_of_study),'[]'::jsonb)),now()
  from public.bursaries b
  on conflict(source_type,source_id) do update set
    title=excluded.title,provider=excluded.provider,public_state=excluded.public_state,health_state=excluded.health_state,
    quality_score=excluded.quality_score,deadline=excluded.deadline,last_verified_at=excluded.last_verified_at,
    issues=excluded.issues,recommended_action=excluded.recommended_action,
    auto_hygiene_applied=excluded.auto_hygiene_applied,metadata=excluded.metadata,refreshed_at=now();

  insert into public.adminos_opportunity_catalog_health(
    source_type,source_id,title,provider,public_state,health_state,quality_score,deadline,last_verified_at,
    issues,recommended_action,auto_hygiene_applied,metadata,refreshed_at
  )
  select
    'public_opportunity',o.id,o.title,o.organisation,case when o.is_published then 'published' else 'draft' end,
    case
      when o.closing_date is not null and o.closing_date<now() then 'expired'
      when o.is_published and (o.last_verified_at is null or o.last_verified_at<now()-interval '14 days') then 'needs_verification'
      when o.is_published and (nullif(trim(coalesce(o.application_url,'')),'') is null or nullif(trim(coalesce(o.description,'')),'') is null) then 'incomplete'
      when o.is_published and o.closing_date is not null and o.closing_date<=now()+interval '7 days' then 'closing_soon'
      when o.is_published then 'ready'
      else 'draft'
    end,
    least(100,
      (case when nullif(trim(o.title),'') is not null then 20 else 0 end)+
      (case when nullif(trim(coalesce(o.organisation,'')),'') is not null then 15 else 0 end)+
      (case when nullif(trim(coalesce(o.description,'')),'') is not null then 15 else 0 end)+
      (case when nullif(trim(coalesce(o.requirements,'')),'') is not null then 15 else 0 end)+
      (case when nullif(trim(coalesce(o.application_url,'')),'') is not null then 20 else 0 end)+
      (case when o.last_verified_at is not null and o.last_verified_at>=now()-interval '14 days' then 15 else 0 end)
    ),
    o.closing_date,o.last_verified_at,
    (case when o.closing_date is not null and o.closing_date<now() then jsonb_build_array('closing_date_passed') else '[]'::jsonb end)
      || (case when o.is_published and (o.last_verified_at is null or o.last_verified_at<now()-interval '14 days') then jsonb_build_array('verification_stale') else '[]'::jsonb end)
      || (case when nullif(trim(coalesce(o.application_url,'')),'') is null then jsonb_build_array('application_url_missing') else '[]'::jsonb end),
    case
      when o.closing_date is not null and o.closing_date<now() then 'Keep unpublished unless a new verified closing date is confirmed.'
      when o.last_verified_at is null or o.last_verified_at<now()-interval '14 days' then 'Verify this opportunity against an official source before promotion.'
      when nullif(trim(coalesce(o.application_url,'')),'') is null then 'Add the official application route before promotion.'
      else 'Continue monitoring.'
    end,
    (o.closing_date is not null and o.closing_date<now() and o.is_published=false),
    jsonb_build_object('opportunity_type',o.opportunity_type,'location',o.location,'province',o.province,'employment_type',o.employment_type),now()
  from public.public_opportunities o
  on conflict(source_type,source_id) do update set
    title=excluded.title,provider=excluded.provider,public_state=excluded.public_state,health_state=excluded.health_state,
    quality_score=excluded.quality_score,deadline=excluded.deadline,last_verified_at=excluded.last_verified_at,
    issues=excluded.issues,recommended_action=excluded.recommended_action,
    auto_hygiene_applied=excluded.auto_hygiene_applied,metadata=excluded.metadata,refreshed_at=now();

  return jsonb_build_object('expired_bursaries_deactivated',bursaries_disabled,'expired_public_opportunities_unpublished',opportunities_unpublished);
end;
$$;

create or replace function public.adminos_rg9_refresh_matches()
returns integer
language plpgsql security definer set search_path=public as $$
declare generated integer:=0; step_count integer:=0;
begin
  update public.adminos_student_opportunity_matches
  set status='expired'
  where status in ('suggested','interested')
    and expires_at is not null and expires_at<now();

  insert into public.adminos_student_opportunity_matches(
    user_id,case_id,opportunity_source_type,opportunity_source_id,match_score,match_band,rationale,
    requires_official_confirmation,status,expires_at,generated_at,metadata
  )
  select
    c.user_id,c.id,'bursary',b.id,
    case
      when c.programme is not null and exists(
        select 1 from unnest(coalesce(b.fields_of_study,'{}'::text[])) f
        where lower(c.programme) like '%'||lower(f)||'%' or lower(f) like '%'||lower(c.programme)||'%'
      ) then 85 else 55 end,
    case
      when c.programme is not null and exists(
        select 1 from unnest(coalesce(b.fields_of_study,'{}'::text[])) f
        where lower(c.programme) like '%'||lower(f)||'%' or lower(f) like '%'||lower(c.programme)||'%'
      ) then 'strong' else 'possible' end,
    case
      when c.programme is not null and exists(
        select 1 from unnest(coalesce(b.fields_of_study,'{}'::text[])) f
        where lower(c.programme) like '%'||lower(f)||'%' or lower(f) like '%'||lower(c.programme)||'%'
      ) then 'Programme text overlaps a listed field of study. Official provider eligibility still applies.'
      else 'Active funding opportunity surfaced for manual eligibility review. No eligibility claim is made.' end,
    true,'suggested',
    case when b.deadline is null then now()+interval '30 days' else b.deadline::timestamptz end,
    now(),jsonb_build_object('programme',c.programme,'provider',b.provider,'official_link',b.link)
  from public.adminos_student_opportunity_cases c
  join public.bursaries b on b.is_active=true and (b.deadline is null or b.deadline>=current_date)
  where c.user_id is not null and c.automation_state<>'closed'
  on conflict(user_id,opportunity_source_type,opportunity_source_id) do update set
    case_id=excluded.case_id,match_score=excluded.match_score,match_band=excluded.match_band,rationale=excluded.rationale,
    requires_official_confirmation=true,expires_at=excluded.expires_at,generated_at=now(),metadata=excluded.metadata,
    status=case when adminos_student_opportunity_matches.status='expired' then 'suggested' else adminos_student_opportunity_matches.status end;

  get diagnostics generated=row_count;

  insert into public.adminos_student_opportunity_matches(
    user_id,case_id,opportunity_source_type,opportunity_source_id,match_score,match_band,rationale,
    requires_official_confirmation,status,expires_at,generated_at,metadata
  )
  select
    c.user_id,c.id,'public_opportunity',o.id,
    case
      when c.programme is not null and lower(coalesce(o.title,'')||' '||coalesce(o.requirements,'')||' '||coalesce(o.description,'')) like '%'||lower(c.programme)||'%' then 85
      else 60 end,
    case
      when c.programme is not null and lower(coalesce(o.title,'')||' '||coalesce(o.requirements,'')||' '||coalesce(o.description,'')) like '%'||lower(c.programme)||'%' then 'strong'
      else 'possible' end,
    case
      when c.programme is not null and lower(coalesce(o.title,'')||' '||coalesce(o.requirements,'')||' '||coalesce(o.description,'')) like '%'||lower(c.programme)||'%' then 'Programme text overlaps the opportunity description. Official organisation requirements still apply.'
      else 'Verified published opportunity surfaced for manual fit review. No eligibility or placement promise is made.' end,
    true,'suggested',coalesce(o.closing_date,now()+interval '30 days'),now(),
    jsonb_build_object('programme',c.programme,'organisation',o.organisation,'application_url',o.application_url,'opportunity_type',o.opportunity_type)
  from public.adminos_student_opportunity_cases c
  join public.public_opportunities o on o.is_published=true
    and (o.closing_date is null or o.closing_date>=now())
    and o.last_verified_at is not null and o.last_verified_at>=now()-interval '14 days'
  where c.user_id is not null and c.automation_state<>'closed'
  on conflict(user_id,opportunity_source_type,opportunity_source_id) do update set
    case_id=excluded.case_id,match_score=excluded.match_score,match_band=excluded.match_band,rationale=excluded.rationale,
    requires_official_confirmation=true,expires_at=excluded.expires_at,generated_at=now(),metadata=excluded.metadata,
    status=case when adminos_student_opportunity_matches.status='expired' then 'suggested' else adminos_student_opportunity_matches.status end;

  get diagnostics step_count=row_count;
  generated:=generated+step_count;
  return generated;
end;
$$;

create or replace function public.adminos_rg9_student_opportunities_cycle()
returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  rec record;
  wil_cases integer:=0;
  support_cases integer:=0;
  matches integer:=0;
  task_count integer:=0;
  catalog_result jsonb;
begin
  catalog_result:=public.adminos_rg9_refresh_catalog();

  for rec in select id from public.wil_applications loop
    perform public.adminos_rg9_refresh_wil_case(rec.id);
    wil_cases:=wil_cases+1;
  end loop;

  for rec in select id from public.application_support_queries loop
    perform public.adminos_rg9_refresh_support_case(rec.id);
    support_cases:=support_cases+1;
  end loop;

  matches:=public.adminos_rg9_refresh_matches();

  update public.staff_tasks
  set status='completed',updated_at=now(),metadata=metadata||jsonb_build_object('rg9_rebuilt_at',now())
  where department_key='student_opportunities'
    and status in ('open','in_progress','waiting')
    and coalesce(metadata->>'automation_family','')='rg9';

  for rec in
    select * from public.adminos_student_opportunity_cases
    where automation_state='staff_attention'
    order by priority desc,stale_days desc
    limit 50
  loop
    insert into public.staff_tasks(
      title,description,source_table,source_id,user_id,priority,status,due_at,next_action,tags,metadata,department_key
    ) values(
      case when rec.case_type='wil' then 'WIL case needs attention' else 'Student opportunity case needs attention' end,
      concat(coalesce(rec.programme,'Student service'),' · ',rec.source_status,' · stale ',rec.stale_days,' day(s)'),
      'adminos_student_opportunity_cases',rec.id,rec.user_id,
      case when rec.priority>=90 then 'urgent' when rec.priority>=75 then 'high' else 'normal' end,
      'open',now()+case when rec.priority>=90 then interval '4 hours' else interval '24 hours' end,
      rec.next_best_action,array['rg9','student-opportunities',rec.case_type],
      jsonb_build_object('automation_family','rg9','case_type',rec.case_type,'source_type',rec.source_type,'source_id',rec.source_id,'readiness_score',rec.readiness_score,'stale_days',rec.stale_days),
      'student_opportunities'
    );
    task_count:=task_count+1;
  end loop;

  for rec in
    select * from public.adminos_opportunity_catalog_health
    where health_state in ('needs_verification','incomplete','closing_soon')
      and public_state in ('active','published')
    order by case health_state when 'needs_verification' then 1 when 'incomplete' then 2 else 3 end,deadline nulls last
    limit 25
  loop
    insert into public.staff_tasks(
      title,description,source_table,source_id,priority,status,due_at,next_action,tags,metadata,department_key
    ) values(
      concat('Opportunity catalog: ',rec.health_state),rec.title,'adminos_opportunity_catalog_health',rec.id,
      case when rec.health_state='needs_verification' then 'high' else 'normal' end,'open',
      now()+case when rec.health_state='closing_soon' then interval '8 hours' else interval '24 hours' end,
      rec.recommended_action,array['rg9','catalog',rec.source_type,rec.health_state],
      jsonb_build_object('automation_family','rg9','source_type',rec.source_type,'source_id',rec.source_id,'quality_score',rec.quality_score,'deadline',rec.deadline),
      'student_opportunities'
    );
    task_count:=task_count+1;
  end loop;

  return jsonb_build_object(
    'wil_cases',wil_cases,'application_support_cases',support_cases,'potential_matches_refreshed',matches,
    'department_tasks',task_count,'catalog',catalog_result,'run_at',now()
  );
end;
$$;

revoke all on function public.adminos_rg9_student_opportunities_cycle() from public,anon,authenticated;
grant execute on function public.adminos_rg9_student_opportunities_cycle() to service_role;

create or replace function public.adminos_run_rg9_now()
returns jsonb
language plpgsql security definer set search_path=public set row_security=off as $$
begin
  if auth.uid() is null or not (
    public.has_admin_department_access('student_opportunities')
    or public.has_admin_department_access('operations')
    or public.has_admin_department_access('executive')
  ) then
    raise exception 'Student Services, Operations or Executive access required' using errcode='42501';
  end if;
  return public.adminos_rg9_student_opportunities_cycle();
end;
$$;
revoke all on function public.adminos_run_rg9_now() from public,anon;
grant execute on function public.adminos_run_rg9_now() to authenticated;

insert into public.adminos_agent_config(agent_key,display_name,enabled,authority_level,confidence_threshold,config)
values(
  'student_opportunities','Student Opportunities Agent',true,'green',0.97,
  jsonb_build_object(
    'release_gate',9,'wil_readiness',true,'application_support_readiness',true,'catalog_hygiene',true,
    'potential_matching',true,'eligibility_claims',false,'official_confirmation_required',true,
    'placement_decisions','human_only','funding_approvals','human_only','institution_submission','human_only'
  )
)
on conflict(agent_key) do update set display_name=excluded.display_name,enabled=true,authority_level='green',
  confidence_threshold=excluded.confidence_threshold,config=excluded.config,updated_at=now();

do $$
declare j record;
begin
  for j in select jobid from cron.job where jobname='adminos-rg9-student-opportunities' loop
    perform cron.unschedule(j.jobid);
  end loop;
  perform cron.schedule('adminos-rg9-student-opportunities','*/20 * * * *',$job$select public.adminos_rg9_student_opportunities_cycle();$job$);
end $$;

select public.adminos_rg9_student_opportunities_cycle();
