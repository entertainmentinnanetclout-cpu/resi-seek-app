-- ResKonnect Course Match — Phase 4C
-- External Supabase parity pack
-- Project: mefjzkhobkltlbmhusdh
-- Purpose: production UNISA Course Match engine + authenticated result persistence.
-- Verified against Phase 4B reference suite: 20/20 behavioral edge cases.

create or replace function public.course_match_unisa(
  p_student_aps integer,
  p_subjects jsonb,
  p_include_non_matches boolean default false
)
returns table (
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
set search_path = public, pg_temp
as $$
with canonical_institution as (
  select id
  from public.institutions
  where slug = 'university-of-south-africa'
    and is_active = true
  order by created_at desc nulls last
  limit 1
), input_subjects as (
  select
    ordinality::integer as subject_order,
    trim(coalesce(item->>'name','')) as subject_name,
    lower(trim(regexp_replace(coalesce(item->>'name',''), '[^a-zA-Z0-9]+', ' ', 'g'))) as normalized_name,
    greatest(0::numeric, least(100::numeric,
      case
        when coalesce(item->>'mark','') ~ '^\s*[0-9]+([.][0-9]+)?\s*$'
          then (item->>'mark')::numeric
        else 0::numeric
      end
    )) as mark
  from jsonb_array_elements(coalesce(p_subjects, '[]'::jsonb)) with ordinality as s(item, ordinality)
), candidate as (
  select
    p.id as programme_id,
    r.id as programme_requirement_id,
    p.metadata->>'qualification_code' as qualification_code,
    p.name as programme_name,
    p.qualification_type,
    p.faculty_or_school,
    r.aps_required,
    p.official_url,
    coalesce(p.metadata->>'entry_route','matric_direct') as entry_route
  from public.programmes p
  join canonical_institution i on i.id = p.institution_id
  join public.programme_requirements r
    on r.programme_id = p.id
   and r.is_active = true
  where p.is_active = true
    and coalesce(p.metadata->>'student_facing','false') = 'true'
    and coalesce(p.metadata->>'matric_direct_eligible','false') = 'true'
), rule_eval as (
  select
    c.programme_id,
    c.programme_requirement_id,
    sr.id as subject_rule_id,
    sr.subject_name,
    sr.requirement_kind,
    sr.minimum_percentage,
    sr.alternative_group_key,
    sr.is_required,
    sr.raw_requirement,
    sr.metadata,
    case
      when sr.id is null then true
      when lower(sr.subject_name) = 'language of teaching and learning' then
        coalesce((
          select max(i.mark)
          from input_subjects i
          where i.normalized_name = 'language of teaching and learning'
             or i.normalized_name like '%english%'
             or i.normalized_name like '%language%'
        ),0) >= coalesce(sr.minimum_percentage,0)
      when lower(sr.subject_name) = 'mathematics' then
        coalesce((select max(i.mark) from input_subjects i where i.normalized_name = 'mathematics'),0) >= coalesce(sr.minimum_percentage,0)
      when lower(sr.subject_name) = 'mathematical literacy' then
        coalesce((select max(i.mark) from input_subjects i where i.normalized_name = 'mathematical literacy'),0) >= coalesce(sr.minimum_percentage,0)
      when lower(sr.subject_name) in ('physical science','physical sciences') then
        coalesce((select max(i.mark) from input_subjects i where i.normalized_name in ('physical science','physical sciences')),0) >= coalesce(sr.minimum_percentage,0)
      when lower(sr.subject_name) = 'physical science / technical science' then
        coalesce((select max(i.mark) from input_subjects i where i.normalized_name in ('physical science','physical sciences','technical science')),0) >= coalesce(sr.minimum_percentage,0)
      when lower(sr.subject_name) = 'technical science' then
        coalesce((select max(i.mark) from input_subjects i where i.normalized_name = 'technical science'),0) >= coalesce(sr.minimum_percentage,0)
      when lower(sr.subject_name) = 'engineering science' then
        coalesce((select max(i.mark) from input_subjects i where i.normalized_name = 'engineering science'),0) >= coalesce(sr.minimum_percentage,0)
      when lower(sr.subject_name) = 'life sciences' then
        coalesce((select max(i.mark) from input_subjects i where i.normalized_name in ('life sciences','life science')),0) >= coalesce(sr.minimum_percentage,0)
      when lower(sr.subject_name) in ('agricultural science','agricultural sciences') then
        coalesce((select max(i.mark) from input_subjects i where i.normalized_name in ('agricultural science','agricultural sciences')),0) >= coalesce(sr.minimum_percentage,0)
      when lower(sr.subject_name) = 'engineering and technology or computer subject' then
        coalesce((
          select max(i.mark)
          from input_subjects i
          where i.normalized_name like '%computer%'
             or i.normalized_name like '%information technology%'
             or i.normalized_name like '%engineering graphics%'
             or i.normalized_name = 'technology'
             or i.normalized_name like '%technology%'
        ),0) >= coalesce(sr.minimum_percentage,0)
      when lower(sr.subject_name) = 'four further content subjects' then
        (select count(*)
         from input_subjects i
         where i.mark >= coalesce(sr.minimum_percentage,60)
           and i.normalized_name not like '%life orientation%'
           and i.normalized_name <> 'language of teaching and learning'
           and i.normalized_name not like '%english%'
        ) >= coalesce(nullif(sr.metadata->>'count_required','')::integer,4)
      when lower(sr.subject_name) = 'music (nsc subject)' then
        exists(select 1 from input_subjects i where i.normalized_name = 'music' and i.mark > 0)
      when lower(sr.subject_name) = 'music theory equivalent' then
        exists(select 1 from input_subjects i where i.normalized_name like '%music theory%' and i.mark > 0)
      else
        coalesce((
          select max(i.mark)
          from input_subjects i
          where i.normalized_name = lower(trim(regexp_replace(sr.subject_name, '[^a-zA-Z0-9]+', ' ', 'g')))
        ),0) >= coalesce(sr.minimum_percentage,0)
    end as subject_pass
  from candidate c
  left join public.programme_subject_requirements sr
    on sr.programme_id = c.programme_id
), alternative_groups as (
  select programme_id, alternative_group_key, bool_or(subject_pass) as group_pass
  from rule_eval
  where subject_rule_id is not null
    and requirement_kind <> 'conditional'
    and alternative_group_key is not null
  group by programme_id, alternative_group_key
), selection_agg as (
  select
    s.programme_id,
    jsonb_agg(jsonb_build_object(
      'rule_type', s.rule_type,
      'label', s.rule_label,
      'detail', s.rule_detail,
      'qa_status', s.qa_status
    ) order by s.rule_type, s.rule_label) as rules,
    count(*)::integer as rule_count
  from public.programme_selection_rules s
  join candidate c on c.programme_id = s.programme_id
  group by s.programme_id
), evaluated as (
  select
    c.*,
    (coalesce(p_student_aps,0) >= coalesce(c.aps_required,0)) as aps_pass,
    not exists (
      select 1 from rule_eval r
      where r.programme_id = c.programme_id
        and r.subject_rule_id is not null
        and r.requirement_kind <> 'conditional'
        and r.alternative_group_key is null
        and r.is_required = true
        and r.subject_pass = false
    ) as ungrouped_subjects_pass,
    not exists (
      select 1 from alternative_groups g
      where g.programme_id = c.programme_id
        and g.group_pass = false
    ) as alternative_groups_pass,
    (select count(*)::integer
     from rule_eval r
     where r.programme_id = c.programme_id
       and r.requirement_kind = 'conditional'
       and (r.minimum_percentage is null or r.subject_pass = false)
    ) as unmet_conditional_count,
    coalesce(sa.rule_count,0) as selection_rule_count,
    coalesce(sa.rules,'[]'::jsonb) as selection_rules,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'type','subject','subject',r.subject_name,'kind',r.requirement_kind,
        'minimum_percentage',r.minimum_percentage,'alternative_group',r.alternative_group_key
      ) order by r.subject_name)
      from rule_eval r
      where r.programme_id = c.programme_id
        and r.subject_rule_id is not null
        and r.requirement_kind <> 'conditional'
        and r.subject_pass = true
    ),'[]'::jsonb) as passed_subject_rows,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'type','subject','subject',r.subject_name,'kind',r.requirement_kind,
        'minimum_percentage',r.minimum_percentage,'raw_requirement',r.raw_requirement
      ) order by r.subject_name)
      from rule_eval r
      where r.programme_id = c.programme_id
        and r.subject_rule_id is not null
        and r.requirement_kind <> 'conditional'
        and r.alternative_group_key is null
        and r.is_required = true
        and r.subject_pass = false
    ),'[]'::jsonb) as failed_required_rows,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'type','alternative_group','group_key',g.alternative_group_key,'required','one_of_group'
      ) order by g.alternative_group_key)
      from alternative_groups g
      where g.programme_id = c.programme_id and g.group_pass = false
    ),'[]'::jsonb) as failed_alternative_groups,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'type','conditional','subject',r.subject_name,
        'minimum_percentage',r.minimum_percentage,'raw_requirement',r.raw_requirement
      ) order by r.subject_name)
      from rule_eval r
      where r.programme_id = c.programme_id
        and r.requirement_kind = 'conditional'
        and (r.minimum_percentage is null or r.subject_pass = false)
    ),'[]'::jsonb) as unresolved_conditionals
  from candidate c
  left join selection_agg sa on sa.programme_id = c.programme_id
), final as (
  select e.*,
    case
      when not e.aps_pass then 'not_eligible_aps'
      when not e.ungrouped_subjects_pass or not e.alternative_groups_pass then 'not_eligible_subject'
      when e.selection_rule_count > 0 then 'academic_minimum_selection_required'
      when e.unmet_conditional_count > 0 then 'eligible_with_conditional_curriculum_check'
      else 'eligible'
    end as computed_status
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
  f.computed_status as match_status,
  jsonb_build_object(
    'aps_pass',f.aps_pass,
    'required_subjects_pass',f.ungrouped_subjects_pass,
    'alternative_groups_pass',f.alternative_groups_pass,
    'unmet_conditional_count',f.unmet_conditional_count,
    'selection_rule_count',f.selection_rule_count
  ) as subject_match_summary,
  (case when f.aps_pass then '[]'::jsonb else jsonb_build_array(jsonb_build_object('type','aps','required',f.aps_required,'actual',coalesce(p_student_aps,0))) end
    || f.failed_required_rows || f.failed_alternative_groups || f.unresolved_conditionals) as missing_requirements,
  (case when f.aps_pass then jsonb_build_array(jsonb_build_object('type','aps','required',f.aps_required,'actual',coalesce(p_student_aps,0))) else '[]'::jsonb end
    || f.passed_subject_rows) as matched_requirements,
  f.selection_rules,
  f.official_url,
  f.entry_route
from final f
where p_include_non_matches
   or f.computed_status not in ('not_eligible_aps','not_eligible_subject')
order by
  case f.computed_status
    when 'eligible' then 1
    when 'academic_minimum_selection_required' then 2
    when 'eligible_with_conditional_curriculum_check' then 3
    when 'not_eligible_subject' then 4
    else 5
  end,
  f.aps_required,
  f.programme_name;
$$;

grant execute on function public.course_match_unisa(integer,jsonb,boolean) to anon, authenticated;

create or replace function public.save_unisa_course_match(
  p_student_aps integer,
  p_subjects jsonb,
  p_full_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile_id uuid;
begin
  if v_user_id is null then
    return null;
  end if;

  insert into public.student_marks_profiles(
    user_id, full_name, highest_grade, subjects, estimated_aps,
    readiness_result, summary, requires_official_confirmation, metadata
  ) values (
    v_user_id,
    nullif(trim(p_full_name),''),
    'Grade 12 / NSC',
    coalesce(p_subjects,'[]'::jsonb),
    p_student_aps,
    'course_match_completed',
    'UNISA Course Match evaluated against the Phase 4C production ruleset. Final admission remains subject to official UNISA confirmation, available space, application timing and selection requirements.',
    true,
    jsonb_build_object(
      'institution_slug','university-of-south-africa',
      'matcher_version','phase_4c',
      'reference_suite','phase_4b_46_assertions',
      'evaluated_at',now()
    )
  ) returning id into v_profile_id;

  insert into public.student_programme_match_results(
    user_id, marks_profile_id, programme_id, programme_requirement_id,
    match_status, student_aps, aps_required, subject_match_summary,
    missing_requirements, matched_requirements, source_context
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
      'institution','University of South Africa',
      'qualification_code',m.qualification_code,
      'qualification_type',m.qualification_type,
      'selection_rules',m.selection_rules,
      'entry_route',m.entry_route,
      'official_url',m.official_url,
      'matcher_version','phase_4c'
    )
  from public.course_match_unisa(p_student_aps,p_subjects,false) m;

  return v_profile_id;
end;
$$;

grant execute on function public.save_unisa_course_match(integer,jsonb,text) to authenticated;
