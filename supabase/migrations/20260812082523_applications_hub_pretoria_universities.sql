-- ResKonnect Applications Hub — Pretoria v1
-- Mirrors production migration applications_hub_pretoria_universities.

create table if not exists public.application_hub_institutions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions(id) on delete set null,
  slug text not null unique,
  category public.institution_kind not null,
  short_name text not null,
  display_name text not null,
  city text not null default 'Pretoria',
  province text not null default 'Gauteng',
  description text,
  logo_url text,
  cover_image_url text,
  brand_primary text,
  brand_secondary text,
  application_url text,
  official_url text,
  matcher_key text,
  matcher_enabled boolean not null default false,
  featured boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint application_hub_institutions_category_check check (
    category in (
      'university'::public.institution_kind,
      'tvet'::public.institution_kind,
      'private_college'::public.institution_kind
    )
  ),
  constraint application_hub_matcher_key_check check (
    matcher_key is null or matcher_key in ('tut','up','unisa')
  )
);

create index if not exists application_hub_institutions_category_sort_idx
  on public.application_hub_institutions(category,is_active,sort_order);

alter table public.application_hub_institutions enable row level security;

drop policy if exists "Public can read active application hub institutions" on public.application_hub_institutions;
create policy "Public can read active application hub institutions"
  on public.application_hub_institutions for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "Platform staff can manage application hub institutions" on public.application_hub_institutions;
create policy "Platform staff can manage application hub institutions"
  on public.application_hub_institutions for all
  to authenticated
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

insert into public.application_hub_institutions (
  institution_id,slug,category,short_name,display_name,description,brand_primary,brand_secondary,
  application_url,official_url,matcher_key,matcher_enabled,featured,is_active,sort_order,metadata
)
select i.id,'tut','university','TUT','Tshwane University of Technology',
       'Technology-focused programmes across TUT campuses. Course Match uses the captured 2027 published minimums and flags TUT selection/verification before the official application step.',
       '#1F3C8C','#F4C300','https://applications-prod.tut.ac.za/','https://www.tut.ac.za','tut',true,true,true,10,
       jsonb_build_object(
         'cycle','2027',
         'match_note','Published minimums met does not guarantee admission. TUT capacity, selection and official verification still apply.',
         'source_scope','phase3_tut_2027_verified_seed'
       )
from public.institutions i where i.slug='tshwane-university-of-technology'
on conflict (slug) do update set
  institution_id=excluded.institution_id,
  category=excluded.category,
  short_name=excluded.short_name,
  display_name=excluded.display_name,
  description=excluded.description,
  brand_primary=excluded.brand_primary,
  brand_secondary=excluded.brand_secondary,
  application_url=excluded.application_url,
  official_url=excluded.official_url,
  matcher_key=excluded.matcher_key,
  matcher_enabled=excluded.matcher_enabled,
  featured=excluded.featured,
  is_active=excluded.is_active,
  sort_order=excluded.sort_order,
  metadata=public.application_hub_institutions.metadata || excluded.metadata,
  updated_at=now();

insert into public.application_hub_institutions (
  institution_id,slug,category,short_name,display_name,description,brand_primary,brand_secondary,
  application_url,official_url,matcher_key,matcher_enabled,featured,is_active,sort_order,metadata
)
select i.id,'up','university','UP','University of Pretoria',
       '2027 NSC/IEB undergraduate Course Match with APS, subject, alternative-subject, conditional curriculum and selection rules.',
       '#003B5C','#9D2235','https://www.up.ac.za/online-application','https://www.up.ac.za','up',true,true,true,20,
       jsonb_build_object(
         'cycle','2027',
         'qualification_system','nsc_ieb',
         'match_note','Meeting minimum requirements does not guarantee placement; ranking, selection and capacity apply.'
       )
from public.institutions i where i.slug='university-of-pretoria'
on conflict (slug) do update set
  institution_id=excluded.institution_id,
  category=excluded.category,
  short_name=excluded.short_name,
  display_name=excluded.display_name,
  description=excluded.description,
  brand_primary=excluded.brand_primary,
  brand_secondary=excluded.brand_secondary,
  application_url=excluded.application_url,
  official_url=excluded.official_url,
  matcher_key=excluded.matcher_key,
  matcher_enabled=excluded.matcher_enabled,
  featured=excluded.featured,
  is_active=excluded.is_active,
  sort_order=excluded.sort_order,
  metadata=public.application_hub_institutions.metadata || excluded.metadata,
  updated_at=now();

insert into public.application_hub_institutions (
  institution_id,slug,category,short_name,display_name,description,brand_primary,brand_secondary,
  application_url,official_url,matcher_key,matcher_enabled,featured,is_active,sort_order,metadata
)
select i.id,'unisa','university','UNISA','University of South Africa',
       'Distance-learning undergraduate Course Match using the verified UNISA qualification catalogue and admission-rule graph.',
       '#002F6C','#A7A9AC','https://www.unisa.ac.za/sites/corporate/default/Apply-for-admission/Apply-for-admission-to-study%3A-application-tool','https://www.unisa.ac.za','unisa',true,true,true,30,
       jsonb_build_object(
         'cycle','2027',
         'match_note','Published minimums met does not guarantee admission; space, selection and official UNISA verification apply.'
       )
from public.institutions i where i.slug='unisa'
on conflict (slug) do update set
  institution_id=excluded.institution_id,
  category=excluded.category,
  short_name=excluded.short_name,
  display_name=excluded.display_name,
  description=excluded.description,
  brand_primary=excluded.brand_primary,
  brand_secondary=excluded.brand_secondary,
  application_url=excluded.application_url,
  official_url=excluded.official_url,
  matcher_key=excluded.matcher_key,
  matcher_enabled=excluded.matcher_enabled,
  featured=excluded.featured,
  is_active=excluded.is_active,
  sort_order=excluded.sort_order,
  metadata=public.application_hub_institutions.metadata || excluded.metadata,
  updated_at=now();

insert into public.application_hub_institutions (
  institution_id,slug,category,short_name,display_name,description,brand_primary,brand_secondary,
  application_url,official_url,matcher_key,matcher_enabled,featured,is_active,sort_order,metadata
)
select i.id,'tshwane-south-tvet-college','tvet','TSC','Tshwane South TVET College',
       'Pretoria-region public TVET college. Programme-level Course Match will be enabled once the TVET rule import is verified.',
       '#17365D','#F4B400','https://www.tsc.edu.za/how-to-apply','https://www.tsc.edu.za',null,false,true,true,10,
       jsonb_build_object(
         'match_status','coming_soon',
         'guidance','Official application link is available now; programme-level matching is not active yet.'
       )
from public.institutions i where i.slug='tshwane-south-tvet-college'
on conflict (slug) do update set
  institution_id=excluded.institution_id,
  category=excluded.category,
  short_name=excluded.short_name,
  display_name=excluded.display_name,
  description=excluded.description,
  brand_primary=excluded.brand_primary,
  brand_secondary=excluded.brand_secondary,
  application_url=excluded.application_url,
  official_url=excluded.official_url,
  matcher_key=excluded.matcher_key,
  matcher_enabled=excluded.matcher_enabled,
  featured=excluded.featured,
  is_active=excluded.is_active,
  sort_order=excluded.sort_order,
  metadata=public.application_hub_institutions.metadata || excluded.metadata,
  updated_at=now();

update public.institutions
set application_url='https://applications-prod.tut.ac.za/', updated_at=now()
where slug='tshwane-university-of-technology';

update public.institutions
set application_url='https://www.up.ac.za/online-application', updated_at=now()
where slug='university-of-pretoria';

update public.institutions
set application_url='https://www.unisa.ac.za/sites/corporate/default/Apply-for-admission/Apply-for-admission-to-study%3A-application-tool', updated_at=now()
where slug='unisa';

update public.institutions
set application_url='https://www.tsc.edu.za/how-to-apply', updated_at=now()
where slug='tshwane-south-tvet-college';

create or replace function public.course_match_tut(
  p_student_aps integer,
  p_subjects jsonb,
  p_include_non_matches boolean default false
)
returns table(
  programme_id uuid,
  programme_requirement_id uuid,
  qualification_code text,
  programme_name text,
  qualification_type text,
  faculty_or_school text,
  aps_required integer,
  match_status text,
  subject_match_summary jsonb,
  missing_requirements jsonb,
  matched_requirements jsonb,
  selection_rules jsonb,
  official_url text,
  entry_route text
)
language sql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
with inst as (
  select id
  from public.institutions
  where slug='tshwane-university-of-technology' and is_active=true
  limit 1
), input_subjects as (
  select
    trim(coalesce(item->>'name','')) subject_name,
    lower(trim(regexp_replace(coalesce(item->>'name',''),'[^a-zA-Z0-9]+',' ','g'))) normalized_name,
    greatest(
      0::numeric,
      least(
        100::numeric,
        case
          when coalesce(item->>'mark','') ~ '^\s*[0-9]+([.][0-9]+)?\s*$' then (item->>'mark')::numeric
          else 0
        end
      )
    ) mark
  from jsonb_array_elements(coalesce(p_subjects,'[]'::jsonb)) s(item)
), candidate as (
  select
    p.id programme_id,
    r.id programme_requirement_id,
    coalesce(p.metadata->>'qualification_code',r.metadata->>'qualification_code') qualification_code,
    p.name programme_name,
    p.qualification_type,
    p.faculty_or_school,
    r.aps_required,
    p.official_url,
    coalesce(p.metadata->>'entry_route','matric_direct') entry_route,
    coalesce(r.metadata->>'phase3_status',p.metadata->>'phase3_status','Verified seed import') qa_route
  from public.programmes p
  join inst i on i.id=p.institution_id
  join public.programme_requirements r on r.programme_id=p.id and r.is_active=true
  where p.is_active=true
), rules as (
  select
    c.programme_id,
    c.programme_requirement_id,
    sr.id subject_rule_id,
    sr.subject_name,
    sr.minimum_level,
    sr.minimum_percentage,
    sr.raw_requirement,
    sr.requirement_kind,
    sr.is_required,
    case
      when sr.id is null then true
      when lower(sr.subject_name)='english' then
        coalesce((
          select max(i.mark)
          from input_subjects i
          where i.normalized_name='english'
             or i.normalized_name like 'english home language%'
             or i.normalized_name like 'english first additional language%'
        ),0)
        >= coalesce(
          sr.minimum_percentage,
          case sr.minimum_level::int
            when 1 then 0 when 2 then 30 when 3 then 40 when 4 then 50
            when 5 then 60 when 6 then 70 when 7 then 80 else 0
          end
        )
      when lower(sr.subject_name)='mathematics' then
        (
          coalesce((
            select max(i.mark)
            from input_subjects i
            where i.normalized_name in ('mathematics','technical mathematics')
          ),0) >= coalesce(sr.minimum_percentage,0)
          or
          (
            sr.raw_requirement ~* '[0-9]+% for Mathematical Literacy'
            and coalesce((
              select max(i.mark)
              from input_subjects i
              where i.normalized_name='mathematical literacy'
            ),0) >= coalesce((regexp_match(sr.raw_requirement,'([0-9]+)% for Mathematical Literacy','i'))[1]::numeric,101)
          )
        )
      else
        coalesce((
          select max(i.mark)
          from input_subjects i
          where i.normalized_name=lower(trim(regexp_replace(sr.subject_name,'[^a-zA-Z0-9]+',' ','g')))
        ),0) >= coalesce(sr.minimum_percentage,0)
    end subject_pass
  from candidate c
  left join public.programme_subject_requirements sr
    on sr.programme_id=c.programme_id and sr.is_required=true
), evaluated as (
  select
    c.*,
    coalesce(p_student_aps,0)>=coalesce(c.aps_required,0) aps_pass,
    not exists(
      select 1
      from rules x
      where x.programme_id=c.programme_id
        and x.subject_rule_id is not null
        and x.subject_pass=false
    ) subjects_pass,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'type','subject',
          'subject',x.subject_name,
          'minimum_percentage',x.minimum_percentage,
          'minimum_level',x.minimum_level,
          'raw_requirement',x.raw_requirement
        ) order by x.subject_name
      )
      from rules x
      where x.programme_id=c.programme_id
        and x.subject_rule_id is not null
        and x.subject_pass=false
    ),'[]'::jsonb) failed_rows,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'type','subject',
          'subject',x.subject_name,
          'minimum_percentage',x.minimum_percentage,
          'minimum_level',x.minimum_level,
          'raw_requirement',x.raw_requirement
        ) order by x.subject_name
      )
      from rules x
      where x.programme_id=c.programme_id
        and x.subject_rule_id is not null
        and x.subject_pass=true
    ),'[]'::jsonb) passed_rows
  from candidate c
), final as (
  select
    e.*,
    case
      when not e.aps_pass then 'not_eligible_aps'
      when not e.subjects_pass then 'not_eligible_subject'
      else 'academic_minimum_selection_required'
    end computed_status
  from evaluated e
)
select
  f.programme_id,
  f.programme_requirement_id,
  f.qualification_code,
  f.programme_name,
  f.qualification_type,
  f.faculty_or_school,
  f.aps_required,
  f.computed_status,
  jsonb_build_object(
    'aps_pass',f.aps_pass,
    'required_subjects_pass',f.subjects_pass,
    'alternative_groups_pass',true,
    'unmet_conditional_count',case when f.qa_route='Verified conditional import' then 1 else 0 end,
    'selection_rule_count',1,
    'tut_rule_scope','captured_2027_published_minimums'
  ),
  (
    case
      when f.aps_pass then '[]'::jsonb
      else jsonb_build_array(jsonb_build_object('type','aps','required',f.aps_required,'actual',coalesce(p_student_aps,0)))
    end || f.failed_rows
  ),
  (
    case
      when f.aps_pass then jsonb_build_array(jsonb_build_object('type','aps','required',f.aps_required,'actual',coalesce(p_student_aps,0)))
      else '[]'::jsonb
    end || f.passed_rows
  ),
  jsonb_build_array(
    jsonb_build_object(
      'rule_type','tut_selection_and_verification',
      'label','TUT selection and official verification apply',
      'detail',case
        when f.qa_route='Verified conditional import' then
          'The captured 2027 row contains a conditional/alternate source route. ResKonnect can show the published minimum route, but TUT must verify the final subject route, capacity and selection outcome.'
        else
          'You meet the captured published minimum route. Final admission remains subject to TUT capacity, programme selection, application timing, verified results and the University’s official decision.'
      end,
      'qa_status',lower(replace(f.qa_route,' ','_'))
    )
  ),
  f.official_url,
  f.entry_route
from final f
where p_include_non_matches
   or f.computed_status not in ('not_eligible_aps','not_eligible_subject')
order by
  case f.computed_status
    when 'academic_minimum_selection_required' then 1
    when 'not_eligible_subject' then 2
    else 3
  end,
  f.aps_required,
  f.programme_name;
$function$;

create or replace function public.save_tut_course_match(
  p_student_aps integer,
  p_subjects jsonb,
  p_full_name text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_user_id uuid:=auth.uid();
  v_profile_id uuid;
begin
  if v_user_id is null then
    return null;
  end if;

  insert into public.student_marks_profiles(
    user_id,full_name,highest_grade,subjects,estimated_aps,readiness_result,summary,
    requires_official_confirmation,metadata
  )
  values(
    v_user_id,
    nullif(trim(p_full_name),''),
    'Grade 12 / NSC',
    coalesce(p_subjects,'[]'::jsonb),
    p_student_aps,
    'course_match_completed',
    'TUT Course Match evaluated against the captured 2027 published minimum route. Final admission requires official TUT verification, capacity and programme selection.',
    true,
    jsonb_build_object(
      'institution_slug','tshwane-university-of-technology',
      'matcher_version','applications_hub_tut_2027_v1',
      'qualification_system','nsc',
      'evaluated_at',now()
    )
  )
  returning id into v_profile_id;

  insert into public.student_programme_match_results(
    user_id,marks_profile_id,programme_id,programme_requirement_id,match_status,student_aps,
    aps_required,subject_match_summary,missing_requirements,matched_requirements,source_context
  )
  select
    v_user_id,
    v_profile_id,
    m.programme_id,
    m.programme_requirement_id,
    m.match_status,
    p_student_aps,
    m.aps_required,
    m.subject_match_summary,
    m.missing_requirements,
    m.matched_requirements,
    jsonb_build_object(
      'institution','Tshwane University of Technology',
      'qualification_code',m.qualification_code,
      'qualification_type',m.qualification_type,
      'selection_rules',m.selection_rules,
      'entry_route',m.entry_route,
      'official_url',m.official_url,
      'matcher_version','applications_hub_tut_2027_v1',
      'qualification_system','nsc'
    )
  from public.course_match_tut(p_student_aps,p_subjects,false) m;

  return v_profile_id;
end;
$function$;
