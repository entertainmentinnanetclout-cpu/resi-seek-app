-- RG3-RG4 — Verified Opportunity Engine + My ResKonnect Service Delivery Engine
-- RG3 closes the public opportunity-supply/matching gap.
-- RG4 turns student_requests into a tracked, department-routed customer service layer.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- RG3 · Opportunity provenance + user action state
-- ---------------------------------------------------------------------------

alter table public.bursaries add column if not exists source_url text;
alter table public.bursaries add column if not exists last_verified_at timestamptz;
alter table public.bursaries add column if not exists verification_status text not null default 'pending';
alter table public.bursaries add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.student_opportunity_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('public_opportunity','bursary')),
  source_id uuid not null,
  action text not null check (action in ('saved','interested','applied','dismissed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,source_type,source_id)
);

create index if not exists student_opportunity_actions_user_idx
  on public.student_opportunity_actions(user_id,action,updated_at desc);

alter table public.student_opportunity_actions enable row level security;
drop policy if exists student_opportunity_actions_owner_read on public.student_opportunity_actions;
create policy student_opportunity_actions_owner_read
on public.student_opportunity_actions for select to authenticated
using (user_id=auth.uid());

revoke all on public.student_opportunity_actions from anon;
revoke insert,update,delete on public.student_opportunity_actions from authenticated;
grant select on public.student_opportunity_actions to authenticated;

drop policy if exists department_opportunities_public_catalog_manage on public.public_opportunities;
create policy department_opportunities_public_catalog_manage
on public.public_opportunities for all to authenticated
using (
  public.has_admin_department_access('student_opportunities')
  or public.has_admin_department_access('executive')
)
with check (
  public.has_admin_department_access('student_opportunities')
  or public.has_admin_department_access('executive')
);

-- Current official, manually verified seed supply for RG3.
insert into public.public_opportunities(
  slug,title,opportunity_type,organisation,location,province,description,requirements,
  application_url,closing_date,date_posted,employment_type,is_published,last_verified_at,metadata
) values (
  'national-treasury-chartered-accountants-academy-2027',
  'National Treasury Chartered Accountants Academy (CAA) 2027',
  'graduate programme',
  'National Treasury',
  'South Africa',
  null,
  'National Treasury has opened the 2027 Chartered Accountants Academy application route. Confirm the current advert and requirements on the official Treasury graduate recruitment page before applying.',
  'Use the official National Treasury 2027 CAA advert and e-Recruitment route for the complete eligibility and document requirements.',
  'https://erecruitment.treasury.gov.za/',
  '2026-10-02 12:00:00+02',
  now(),
  'training programme',
  true,
  now(),
  jsonb_build_object(
    'source_url','https://www.treasury.gov.za/graduate/',
    'source_class','official_government',
    'verification_note','Official National Treasury graduate recruitment page verified 2026-09-13',
    'date_posted_basis','ResKonnect verification/ingestion date because the official page does not expose a publication date',
    'official_confirmation_required',true
  )
)
on conflict(slug) do update set
  title=excluded.title,opportunity_type=excluded.opportunity_type,organisation=excluded.organisation,
  location=excluded.location,province=excluded.province,description=excluded.description,
  requirements=excluded.requirements,application_url=excluded.application_url,closing_date=excluded.closing_date,
  employment_type=excluded.employment_type,is_published=true,last_verified_at=excluded.last_verified_at,
  metadata=excluded.metadata,updated_at=now();

insert into public.bursaries(
  name,provider,description,amount,deadline,fields_of_study,requirements,link,type,is_active,
  source_url,last_verified_at,verification_status,metadata
) values
(
  'National Treasury External Bursary 2027',
  'National Treasury',
  'Official National Treasury external bursary opportunity for the 2027 academic year. Confirm the current advert for full fields of study, eligibility and document requirements.',
  null,
  '2026-09-30',
  null,
  array['Confirm eligibility in the official National Treasury 2027 External Bursary advert'],
  'https://www.treasury.gov.za/graduate/',
  'government',
  true,
  'https://www.treasury.gov.za/graduate/',
  now(),
  'verified',
  jsonb_build_object('source_class','official_government','official_confirmation_required',true)
),
(
  'NDMC External Bursary 2027',
  'National Disaster Management Centre',
  'The NDMC 2027 bursary supports qualifying students pursuing full programmes in Disaster Management or Fire Technology / Fire Engineering at recognised South African public higher education institutions.',
  '100% tuition fees including registration; qualifying Masters research allowance capped at R11,000',
  '2026-09-30',
  array['Disaster Management','Fire Technology','Fire Engineering'],
  array[
    'Certified South African identity document',
    'Certified matric certificate',
    'Minimum 60% academic average for undergraduate/postgraduate diploma/advanced diploma applicants',
    'Minimum 65% academic average for Masters applicants',
    'Proof of application, acceptance or registration at a recognised public higher education institution',
    'Masters applicants require a brief CV and research proposal aligned to an NDMC priority thematic area'
  ],
  'https://onlinebursary.ndmc.gov.za/',
  'government',
  true,
  'https://onlinebursary.ndmc.gov.za/',
  now(),
  'verified',
  jsonb_build_object('source_class','official_government','official_confirmation_required',true,'mobile_note','Official NDMC application system states that it does not support mobile devices')
),
(
  'South African Reserve Bank Economics External Bursary 2027',
  'South African Reserve Bank',
  'The SARB Economic Research Department and SARB Academy invite prospective first-year undergraduate economics students to apply for the 2027 external bursary programme.',
  null,
  '2026-09-30',
  array['Economics','Economics and Econometrics','Economics and Mathematical Statistics','Economic Science'],
  array[
    'Provisional acceptance into an undergraduate economics-related degree',
    'Current-year average of at least 70%',
    'English and Mathematics at 70% or above',
    'Younger than 30 years',
    'Financial need',
    'Submit examination results and proof of acceptance/student number with the application'
  ],
  'https://www.resbank.co.za/en/home/publications/publication-detail-pages/bursary/2026/economics-2027',
  'government',
  true,
  'https://www.resbank.co.za/en/home/publications/publication-detail-pages/bursary/2026/economics-2027',
  now(),
  'verified',
  jsonb_build_object(
    'source_class','official_public_entity',
    'deadline_confirmation_source','https://www.sanews.gov.za/node/83482',
    'promo_code','SARBERD27',
    'official_confirmation_required',true
  )
)
on conflict(name) do update set
  provider=excluded.provider,description=excluded.description,amount=excluded.amount,deadline=excluded.deadline,
  fields_of_study=excluded.fields_of_study,requirements=excluded.requirements,link=excluded.link,type=excluded.type,
  is_active=true,source_url=excluded.source_url,last_verified_at=excluded.last_verified_at,
  verification_status=excluded.verification_status,metadata=excluded.metadata,updated_at=now();

create or replace function public.reskonnect_opportunity_feed(
  p_query text default null,
  p_type text default null,
  p_limit integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_course text;
  v_campus text;
  v_limit integer:=least(greatest(coalesce(p_limit,60),1),100);
  v_items jsonb:='[]'::jsonb;
begin
  if v_uid is not null then
    select nullif(trim(course),''),nullif(trim(campus),'')
      into v_course,v_campus
    from public.profiles where id=v_uid;
  end if;

  with unified as (
    select
      o.id,
      'public_opportunity'::text as source_type,
      o.slug,
      '/opportunity/'||o.slug as to_path,
      o.title,
      coalesce(nullif(o.opportunity_type,''),'opportunity') as opportunity_type,
      o.organisation,
      o.location,
      o.province,
      o.description,
      o.requirements,
      o.application_url,
      o.closing_date,
      o.date_posted,
      o.employment_type,
      o.last_verified_at,
      coalesce(o.metadata,'{}'::jsonb) as metadata,
      concat_ws(' ',o.title,o.opportunity_type,o.organisation,o.location,o.province,o.description,o.requirements,o.employment_type) as search_text
    from public.public_opportunities o
    where o.is_published=true
      and (o.closing_date is null or o.closing_date>=now())

    union all

    select
      b.id,
      'bursary'::text,
      null::text,
      '/bursary/'||b.id::text,
      b.name,
      'bursary'::text,
      b.provider,
      null::text,
      null::text,
      b.description,
      array_to_string(b.requirements,E'\n'),
      b.link,
      case when b.deadline is null then null else (b.deadline::timestamp + interval '23 hours 59 minutes') at time zone 'Africa/Johannesburg' end,
      b.created_at,
      'bursary'::text,
      b.last_verified_at,
      coalesce(b.metadata,'{}'::jsonb)||jsonb_build_object('amount',b.amount,'fields_of_study',b.fields_of_study,'verification_status',b.verification_status),
      concat_ws(' ',b.name,b.provider,b.description,array_to_string(b.fields_of_study,' '),array_to_string(b.requirements,' '),b.type)
    from public.bursaries b
    where b.is_active=true
      and (b.deadline is null or b.deadline>=current_date)
  ),
  filtered as (
    select *,
      case
        when v_uid is null then 50
        when v_course is not null and lower(search_text) like '%'||lower(v_course)||'%' then 90
        when v_campus is not null and lower(search_text) like '%'||lower(v_campus)||'%' then 75
        else 60
      end as match_score,
      case
        when v_uid is null then 'Sign in to add your profile context'
        when v_course is not null and lower(search_text) like '%'||lower(v_course)||'%' then 'Strong textual match to your saved course'
        when v_campus is not null and lower(search_text) like '%'||lower(v_campus)||'%' then 'Matches your saved campus/location context'
        else 'Current verified opportunity available on ResKonnect'
      end as match_reason
    from unified
    where
      (nullif(trim(coalesce(p_query,'')),'') is null or lower(search_text) like '%'||lower(trim(p_query))||'%')
      and (
        nullif(trim(coalesce(p_type,'')),'') is null
        or lower(source_type)=lower(trim(p_type))
        or lower(opportunity_type)=lower(trim(p_type))
        or lower(opportunity_type) like '%'||lower(trim(p_type))||'%'
      )
  ),
  ranked as (
    select * from filtered
    order by match_score desc, closing_date asc nulls last, date_posted desc nulls last
    limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,
    'source_type',r.source_type,
    'slug',r.slug,
    'to_path',r.to_path,
    'title',r.title,
    'opportunity_type',r.opportunity_type,
    'organisation',r.organisation,
    'location',r.location,
    'province',r.province,
    'description',r.description,
    'requirements',r.requirements,
    'application_url',r.application_url,
    'closing_date',r.closing_date,
    'date_posted',r.date_posted,
    'employment_type',r.employment_type,
    'last_verified_at',r.last_verified_at,
    'verification_state',case
      when r.last_verified_at is null then 'verification_due'
      when r.last_verified_at>=now()-interval '30 days' then 'verified'
      else 'review_due'
    end,
    'match_score',r.match_score,
    'match_reason',r.match_reason,
    'user_action',case when v_uid is null then null else (
      select a.action from public.student_opportunity_actions a
      where a.user_id=v_uid and a.source_type=r.source_type and a.source_id=r.id
      limit 1
    ) end,
    'metadata',r.metadata
  ) order by r.match_score desc,r.closing_date asc nulls last), '[]'::jsonb)
  into v_items
  from ranked r;

  return jsonb_build_object(
    'items',v_items,
    'authenticated',v_uid is not null,
    'profile_context',case when v_uid is null then null else jsonb_build_object('course',v_course,'campus',v_campus) end,
    'generated_at',now()
  );
end;
$$;

revoke all on function public.reskonnect_opportunity_feed(text,text,integer) from public;
grant execute on function public.reskonnect_opportunity_feed(text,text,integer) to anon,authenticated,service_role;

create or replace function public.set_student_opportunity_action(
  p_source_type text,
  p_source_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_title text;
  v_exists boolean:=false;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;
  if p_source_type not in ('public_opportunity','bursary') then
    raise exception 'Invalid opportunity source';
  end if;
  if p_action not in ('saved','interested','applied','dismissed') then
    raise exception 'Invalid opportunity action';
  end if;

  if p_source_type='public_opportunity' then
    select title,true into v_title,v_exists
    from public.public_opportunities
    where id=p_source_id and is_published=true and (closing_date is null or closing_date>=now());
  else
    select name,true into v_title,v_exists
    from public.bursaries
    where id=p_source_id and is_active=true and (deadline is null or deadline>=current_date);
  end if;

  if not coalesce(v_exists,false) then
    raise exception 'Opportunity is not currently available';
  end if;

  insert into public.student_opportunity_actions(user_id,source_type,source_id,action,updated_at)
  values(v_uid,p_source_type,p_source_id,p_action,now())
  on conflict(user_id,source_type,source_id) do update
    set action=excluded.action,updated_at=now();

  insert into public.adminos_customer_events(
    user_id,event_category,event_type,source_table,source_id,title,summary,status,metadata,occurred_at
  ) values(
    v_uid,'opportunity','opportunity_'||p_action,'student_opportunity_actions',p_source_id,
    'Opportunity '||p_action,v_title,p_action,
    jsonb_build_object('source_type',p_source_type,'source_id',p_source_id),now()
  );

  return jsonb_build_object('ok',true,'source_type',p_source_type,'source_id',p_source_id,'action',p_action,'title',v_title);
end;
$$;

revoke all on function public.set_student_opportunity_action(text,uuid,text) from public,anon;
grant execute on function public.set_student_opportunity_action(text,uuid,text) to authenticated,service_role;

-- ---------------------------------------------------------------------------
-- RG4 · Tracked My ResKonnect service cases
-- ---------------------------------------------------------------------------

alter table public.student_requests add column if not exists subject text;
alter table public.student_requests add column if not exists priority text not null default 'normal';
alter table public.student_requests add column if not exists department_key text not null default 'operations';
alter table public.student_requests add column if not exists source_surface text not null default 'service_centre';
alter table public.student_requests add column if not exists related_entity_type text;
alter table public.student_requests add column if not exists related_entity_id uuid;
alter table public.student_requests add column if not exists assigned_staff_id uuid;
alter table public.student_requests add column if not exists due_at timestamptz;
alter table public.student_requests add column if not exists last_activity_at timestamptz not null default now();
alter table public.student_requests add column if not exists resolved_at timestamptz;
alter table public.student_requests add column if not exists resolution_summary text;
alter table public.student_requests add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists student_requests_owner_status_idx
  on public.student_requests(user_id,status,updated_at desc);
create index if not exists student_requests_department_status_idx
  on public.student_requests(department_key,status,due_at);

create table if not exists public.student_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.student_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid,
  event_type text not null,
  old_status text,
  new_status text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists student_request_events_request_idx
  on public.student_request_events(request_id,created_at desc);
create index if not exists student_request_events_user_idx
  on public.student_request_events(user_id,created_at desc);

alter table public.student_request_events enable row level security;
drop policy if exists student_request_events_owner_read on public.student_request_events;
create policy student_request_events_owner_read
on public.student_request_events for select to authenticated
using (user_id=auth.uid());
drop policy if exists student_request_events_staff_read on public.student_request_events;
create policy student_request_events_staff_read
on public.student_request_events for select to authenticated
using (
  public.is_platform_staff()
  or exists(
    select 1 from public.student_requests r
    where r.id=request_id and (
      public.has_admin_department_access(r.department_key)
      or public.has_admin_department_access('operations')
      or public.has_admin_department_access('executive')
    )
  )
);
revoke all on public.student_request_events from anon;
revoke insert,update,delete on public.student_request_events from authenticated;
grant select on public.student_request_events to authenticated;

drop policy if exists "Users can insert requests" on public.student_requests;
drop policy if exists "Users can update own requests" on public.student_requests;
drop policy if exists "Users can view own requests" on public.student_requests;
drop policy if exists my_reskonnect_requests_owner_read on public.student_requests;
create policy my_reskonnect_requests_owner_read
on public.student_requests for select to authenticated
using (user_id=auth.uid());

drop policy if exists my_reskonnect_requests_staff_manage on public.student_requests;
create policy my_reskonnect_requests_staff_manage
on public.student_requests for all to authenticated
using (
  public.is_platform_staff()
  or public.has_admin_department_access(department_key)
  or public.has_admin_department_access('operations')
  or public.has_admin_department_access('executive')
)
with check (
  public.is_platform_staff()
  or public.has_admin_department_access(department_key)
  or public.has_admin_department_access('operations')
  or public.has_admin_department_access('executive')
);

revoke all on public.student_requests from public,anon;
revoke insert,delete on public.student_requests from authenticated;
grant select,update on public.student_requests to authenticated;

create or replace function public.rg4_student_request_before_update()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  new.updated_at:=now();
  new.last_activity_at:=now();
  if new.status is distinct from old.status and lower(coalesce(new.status,'')) in ('resolved','closed','completed') then
    new.resolved_at:=coalesce(new.resolved_at,now());
  elsif new.status is distinct from old.status and lower(coalesce(new.status,'')) not in ('resolved','closed','completed') then
    new.resolved_at:=null;
  end if;
  return new;
end;
$$;

revoke all on function public.rg4_student_request_before_update() from public,anon,authenticated;
grant execute on function public.rg4_student_request_before_update() to service_role;

drop trigger if exists rg4_student_request_before_update_trg on public.student_requests;
create trigger rg4_student_request_before_update_trg
before update on public.student_requests
for each row execute function public.rg4_student_request_before_update();

create or replace function public.rg4_student_request_after_update()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if new.status is distinct from old.status
     or new.assigned_staff_id is distinct from old.assigned_staff_id
     or new.resolution_summary is distinct from old.resolution_summary then

    insert into public.student_request_events(
      request_id,user_id,actor_user_id,event_type,old_status,new_status,note,metadata
    ) values(
      new.id,new.user_id,auth.uid(),
      case when new.status is distinct from old.status then 'status_changed' else 'request_updated' end,
      old.status,new.status,
      case
        when new.resolution_summary is distinct from old.resolution_summary then new.resolution_summary
        when new.status is distinct from old.status then 'Request status changed to '||coalesce(new.status,'updated')
        else 'Request updated'
      end,
      jsonb_build_object('department_key',new.department_key,'assigned_staff_id',new.assigned_staff_id)
    );

    if new.status is distinct from old.status then
      insert into public.notifications(user_id,title,message,is_read,type,metadata,created_at)
      values(
        new.user_id,
        'Service request update',
        coalesce(new.subject,'Your ResKonnect request')||' is now '||replace(coalesce(new.status,'updated'),'_',' ')||'.',
        false,'service_request',
        jsonb_build_object('request_id',new.id,'status',new.status),
        now()
      );

      insert into public.adminos_customer_events(
        user_id,event_category,event_type,source_table,source_id,title,summary,status,metadata,occurred_at
      ) values(
        new.user_id,'service','service_request_status_changed','student_requests',new.id,
        'Service request updated',coalesce(new.subject,new.request_type),new.status,
        jsonb_build_object('old_status',old.status,'new_status',new.status,'department_key',new.department_key),now()
      );
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.rg4_student_request_after_update() from public,anon,authenticated;
grant execute on function public.rg4_student_request_after_update() to service_role;

drop trigger if exists rg4_student_request_after_update_trg on public.student_requests;
create trigger rg4_student_request_after_update_trg
after update on public.student_requests
for each row execute function public.rg4_student_request_after_update();

create or replace function public.create_my_reskonnect_request(
  p_request_type text,
  p_subject text,
  p_description text,
  p_related_entity_type text default null,
  p_related_entity_id uuid default null,
  p_source_surface text default 'service_centre'
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_department text;
  v_id uuid;
  v_due timestamptz;
  v_type text:=lower(trim(coalesce(p_request_type,'')));
  v_subject text:=left(trim(coalesce(p_subject,'')),160);
  v_description text:=left(trim(coalesce(p_description,'')),4000);
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;
  if v_type not in ('living','application','opportunity','account','technical','other') then
    raise exception 'Choose a valid request type';
  end if;
  if length(v_subject)<4 or length(v_description)<8 then
    raise exception 'Add a clear subject and description';
  end if;

  v_department:=case v_type
    when 'living' then 'accommodation'
    when 'application' then 'student_opportunities'
    when 'opportunity' then 'student_opportunities'
    when 'technical' then 'technology_systems'
    else 'operations'
  end;
  v_due:=now()+case when v_type='technical' then interval '12 hours' else interval '24 hours' end;

  insert into public.student_requests(
    user_id,request_type,subject,description,status,priority,department_key,source_surface,
    related_entity_type,related_entity_id,due_at,last_activity_at,metadata,created_at,updated_at
  ) values(
    v_uid,v_type,v_subject,v_description,'submitted','normal',v_department,
    left(coalesce(nullif(trim(p_source_surface),''),'service_centre'),80),
    nullif(trim(coalesce(p_related_entity_type,'')),''),
    p_related_entity_id,v_due,now(),
    jsonb_build_object('release_gate',4,'customer_created',true),now(),now()
  ) returning id into v_id;

  insert into public.student_request_events(
    request_id,user_id,actor_user_id,event_type,new_status,note,metadata
  ) values(
    v_id,v_uid,v_uid,'submitted','submitted','Request submitted to ResKonnect.',
    jsonb_build_object('department_key',v_department,'source_surface',p_source_surface)
  );

  insert into public.staff_tasks(
    title,description,source_table,source_id,user_id,priority,status,due_at,next_action,tags,metadata,department_key
  ) values(
    'My ResKonnect service request · '||v_type,
    v_subject||' · '||left(v_description,500),
    'student_requests',v_id,v_uid,'normal','open',v_due,
    'Review the customer request, update the request status and record the next step.',
    array['rg4','service-request',v_type],
    jsonb_build_object('release_gate',4,'request_type',v_type,'source_surface',p_source_surface),
    v_department
  );

  insert into public.notifications(user_id,title,message,is_read,type,metadata,created_at)
  values(
    v_uid,'Request received',
    'ResKonnect received "'||v_subject||'". Track it from My ResKonnect Service Centre.',
    false,'service_request',jsonb_build_object('request_id',v_id,'status','submitted'),now()
  );

  insert into public.adminos_customer_events(
    user_id,event_category,event_type,source_table,source_id,title,summary,status,metadata,occurred_at
  ) values(
    v_uid,'service','service_request_submitted','student_requests',v_id,
    'Service request submitted',v_subject,'submitted',
    jsonb_build_object('request_type',v_type,'department_key',v_department),now()
  );

  return jsonb_build_object(
    'ok',true,'request_id',v_id,'status','submitted','department_key',v_department,
    'review_target_at',v_due
  );
end;
$$;

revoke all on function public.create_my_reskonnect_request(text,text,text,text,uuid,text) from public,anon;
grant execute on function public.create_my_reskonnect_request(text,text,text,text,uuid,text) to authenticated,service_role;

create or replace function public.my_reskonnect_service_centre()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_requests jsonb:='[]'::jsonb;
  v_open integer:=0;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;

  select count(*) filter (where lower(coalesce(status,'')) not in ('resolved','closed','completed','cancelled'))::int
    into v_open
  from public.student_requests where user_id=v_uid;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,
    'request_type',r.request_type,
    'subject',r.subject,
    'description',r.description,
    'status',r.status,
    'priority',r.priority,
    'department_key',r.department_key,
    'source_surface',r.source_surface,
    'related_entity_type',r.related_entity_type,
    'related_entity_id',r.related_entity_id,
    'review_target_at',r.due_at,
    'last_activity_at',r.last_activity_at,
    'resolved_at',r.resolved_at,
    'resolution_summary',r.resolution_summary,
    'created_at',r.created_at,
    'updated_at',r.updated_at,
    'timeline',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',e.id,'event_type',e.event_type,'old_status',e.old_status,'new_status',e.new_status,
        'note',e.note,'created_at',e.created_at
      ) order by e.created_at desc)
      from public.student_request_events e where e.request_id=r.id
    ),'[]'::jsonb)
  ) order by r.updated_at desc),'[]'::jsonb)
  into v_requests
  from (
    select * from public.student_requests
    where user_id=v_uid
    order by updated_at desc
    limit 50
  ) r;

  return jsonb_build_object(
    'open_count',coalesce(v_open,0),
    'requests',v_requests,
    'generated_at',now()
  );
end;
$$;

revoke all on function public.my_reskonnect_service_centre() from public,anon;
grant execute on function public.my_reskonnect_service_centre() to authenticated,service_role;

-- Public Opportunity metadata now describes an actual live engine.
update public.seo_pages
set
  title='Student Opportunities, Bursaries & WIL | ResKonnect Opportunity',
  description='Explore verified current bursaries, graduate programmes, WIL and student opportunities through the ResKonnect Opportunity Engine, with signed-in relevance guidance and official application routes.',
  h1='Verified opportunities. Better next steps.',
  answer_summary='ResKonnect Opportunity combines current verified bursaries, WIL pathways and published student opportunities. Signed-in users can see contextual relevance guidance, save or mark opportunities as applied, while official providers retain final eligibility and selection authority.',
  updated_at=now(),
  last_verified_at=now()
where path='/opportunities';

-- Rebuild RG9 catalog health and potential matches after the new verified supply lands.
do $$
begin
  if to_regprocedure('public.adminos_rg9_student_opportunities_cycle()') is not null then
    perform public.adminos_rg9_student_opportunities_cycle();
  end if;
end $$;
