-- ResKonnect Course Match — Phase 5A.1 UPOnline reconciliation
-- External Supabase: mefjzkhobkltlbmhusdh
-- Adds the distinct 2027 UPOnline Higher Certificate in Sports Sciences route.
-- Official programme code: 09110003
-- Source: https://www.up.ac.za/programmes/uponline/higher-certificate-sports-sciences-uponline-part-time/2027
-- The one-year contact Higher Certificate (09110004) remains a separate programme.

begin;

insert into public.programmes(
  institution_id,campus,name,slug,qualification_type,faculty_or_school,duration,
  official_url,application_method,is_active,metadata
)
select
  i.id,'UPOnline','Higher Certificate in Sports Sciences (UPOnline) Part-time',
  'up-09110003','Higher Certificate','Education','2 years fully online',
  'https://www.up.ac.za/programmes/uponline/higher-certificate-sports-sciences-uponline-part-time/2027',
  'UPOnline application portal',true,
  jsonb_build_object(
    'phase','5A.1','entry_route','matric_direct','source_year','2027',
    'student_facing',true,'catalogue_status','current_2027_verified_up_online',
    'qualification_code','09110003','selection_required',false,
    'qualification_system','nsc_ieb','matric_direct_eligible',true,
    'life_orientation_excluded',true,'delivery_mode','fully_online','study_mode','part_time',
    'source_reconciliation','official UPOnline 2027 page + official international prospectus',
    'sports_practical_access_required',true
  )
from public.institutions i
where i.slug='university-of-pretoria'
on conflict (institution_id,slug) do update set
  campus=excluded.campus,name=excluded.name,qualification_type=excluded.qualification_type,
  faculty_or_school=excluded.faculty_or_school,duration=excluded.duration,
  official_url=excluded.official_url,application_method=excluded.application_method,
  is_active=true,metadata=excluded.metadata,updated_at=now();

delete from public.programme_selection_rules
where programme_id=(select p.id from public.programmes p join public.institutions i on i.id=p.institution_id where i.slug='university-of-pretoria' and p.slug='up-09110003');
delete from public.programme_subject_requirements
where programme_id=(select p.id from public.programmes p join public.institutions i on i.id=p.institution_id where i.slug='university-of-pretoria' and p.slug='up-09110003');
delete from public.programme_requirements
where programme_id=(select p.id from public.programmes p join public.institutions i on i.id=p.institution_id where i.slug='university-of-pretoria' and p.slug='up-09110003');

insert into public.programme_requirements(
  programme_id,institution_name,institution_type,campus,programme_name,qualification_type,
  requirement_type,aps_required,english_min,minimum_grade,requirement_notes,source_url,
  source_year,verified_status,is_active,metadata
)
select p.id,'University of Pretoria','university','UPOnline',p.name,p.qualification_type,
  'aps',20,50,'NSC/IEB',
  '2027 NSC/IEB minimum: APS 20 and English Home Language or English First Additional Language at level 4 (50%). Life Orientation is excluded from the APS. This is a 2-year fully online part-time route. Part-time access to a school, sports club and/or accredited training facility is required for the Sports Practical module. Meeting minimum requirements does not guarantee admission.',
  p.official_url,'2027','official',true,
  jsonb_build_object('phase','5A.1','qualification_system','nsc_ieb','delivery_mode','fully_online','life_orientation_excluded',true,'sports_practical_access_required',true)
from public.programmes p join public.institutions i on i.id=p.institution_id
where i.slug='university-of-pretoria' and p.slug='up-09110003';

insert into public.programme_subject_requirements(
  programme_id,programme_requirement_id,subject_name,subject_group,requirement_kind,
  minimum_level,minimum_percentage,is_required,raw_requirement,qa_status,metadata
)
select p.id,r.id,'English','language','required',4,50,true,
  'English Home Language or English First Additional Language: NSC/IEB level 4 (50-59%).',
  'official_verified',jsonb_build_object('phase','5A.1','qualification_system','nsc_ieb')
from public.programmes p
join public.institutions i on i.id=p.institution_id
join public.programme_requirements r on r.programme_id=p.id and r.is_active
where i.slug='university-of-pretoria' and p.slug='up-09110003';

commit;

-- Expected aggregate after reconciliation:
-- active UP programmes = 129
-- NSC/IEB matcher candidates = 128
-- requirements = 129
-- subject rows = 312
-- selection rows = 24
-- faculty-placement rows excluded from matcher = 1
-- duplicate qualification codes = 0

-- New behavioural guard:
select qualification_code,programme_name,match_status
from public.course_match_up(
  20,
  '[{"name":"English Home Language","mark":50}]'::jsonb,
  true
)
where qualification_code='09110003';
-- Expected: eligible
