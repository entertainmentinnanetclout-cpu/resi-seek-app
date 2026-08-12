-- ResKonnect Course Match — Phase 5A UP 2027 regression suite
-- Target: external Supabase project mefjzkhobkltlbmhusdh

-- Structural boundary
with i as (select id from public.institutions where slug='university-of-pretoria'),
p as (select * from public.programmes where institution_id=(select id from i))
select
 (select count(*) from p where is_active) as active_programmes,
 (select count(*) from p where is_active and metadata->>'qualification_system'='nsc_ieb') as domestic_programmes,
 (select count(*) from p where is_active and coalesce(metadata->>'student_facing','false')='true' and coalesce(metadata->>'matric_direct_eligible','false')='true') as matcher_candidates,
 (select count(*) from p where is_active and metadata->>'entry_route'='faculty_placement') as faculty_placement,
 (select count(*) from p where is_active and metadata->>'entry_route'='faculty_placement' and coalesce(metadata->>'student_facing','false')='true') as placement_leakage,
 (select count(*) from p where is_active and metadata->>'qualification_system'<>'nsc_ieb') as international_leakage,
 (select count(*) from (select slug,count(*) c from p group by slug having count(*)>1)d) as duplicate_slugs,
 (select count(*) from (select metadata->>'qualification_code' code,count(*) c from p where is_active group by 1 having count(*)>1)d) as duplicate_codes,
 (select count(*) from p left join public.programme_requirements r on r.programme_id=p.id and r.is_active where p.is_active and r.id is null) as missing_requirements,
 (select count(*) from public.programme_requirements r join p on p.id=r.programme_id where r.is_active and r.verified_status='pending_review') as pending_requirements,
 (select count(*) from public.programme_requirements r join p on p.id=r.programme_id where r.is_active and r.aps_required is null and p.metadata->>'qualification_code'<>'01130014') as unexpected_null_aps,
 (select count(*) from public.programme_subject_requirements s join p on p.id=s.programme_id) as subject_rows,
 (select count(*) from public.programme_subject_requirements s join p on p.id=s.programme_id where s.requirement_kind='conditional') as conditional_rows,
 (select count(*) from public.programme_selection_rules s join p on p.id=s.programme_id) as selection_rows,
 (select count(distinct s.programme_id) from public.programme_selection_rules s join p on p.id=s.programme_id) as selection_programmes,
 (select count(*) from public.course_match_up(42,'[{"name":"English Home Language","mark":100},{"name":"Mathematics","mark":100},{"name":"Mathematical Literacy","mark":100},{"name":"Physical Sciences","mark":100},{"name":"Life Sciences","mark":100},{"name":"Accounting","mark":100},{"name":"Music","mark":100}]'::jsonb,true)) as full_output_rows;

-- Expected structural values:
-- active_programmes=128, domestic_programmes=128, matcher_candidates=127,
-- faculty_placement=1, placement_leakage=0, international_leakage=0,
-- duplicate_slugs=0, duplicate_codes=0, missing_requirements=0,
-- pending_requirements=0, unexpected_null_aps=0, subject_rows=311,
-- conditional_rows=4, selection_rows=24, selection_programmes=24,
-- full_output_rows=127.

-- Behavioural parity
with t(test_id,aps,subjects,code,expected) as (values
('T01',35,'[{"name":"English Home Language","mark":70}]'::jsonb,'04130012','eligible'),
('T02',35,'[{"name":"English Home Language","mark":69}]'::jsonb,'04130012','not_eligible_subject'),
('T03',34,'[{"name":"English First Additional Language","mark":60},{"name":"Mathematics","mark":70}]'::jsonb,'07130045','eligible'),
('T04',34,'[{"name":"English First Additional Language","mark":60},{"name":"Mathematics","mark":69}]'::jsonb,'07130045','not_eligible_subject'),
('T05',28,'[{"name":"English Home Language","mark":60},{"name":"Mathematics","mark":39},{"name":"Mathematical Literacy","mark":50}]'::jsonb,'07131175','eligible'),
('T06',30,'[{"name":"English Home Language","mark":60},{"name":"Mathematics","mark":60},{"name":"Physical Sciences","mark":50}]'::jsonb,'12132034','eligible'),
('T07',30,'[{"name":"English Home Language","mark":60},{"name":"Mathematics","mark":60},{"name":"Accounting","mark":50}]'::jsonb,'12132034','eligible'),
('T08',35,'[{"name":"English Home Language","mark":60},{"name":"Mathematics","mark":70},{"name":"Physical Sciences","mark":70}]'::jsonb,'12130017','eligible'),
('T09',33,'[{"name":"English Home Language","mark":65},{"name":"Mathematics","mark":65},{"name":"Physical Sciences","mark":65}]'::jsonb,'12136017','eligible'),
('T10',33,'[{"name":"English Home Language","mark":65},{"name":"Mathematics","mark":64},{"name":"Physical Sciences","mark":65}]'::jsonb,'12136017','not_eligible_subject'),
('T11',28,'[{"name":"English Home Language","mark":50},{"name":"Mathematics","mark":50},{"name":"Life Sciences","mark":50}]'::jsonb,'10130012','academic_minimum_selection_required'),
('T12',30,'[{"name":"English Home Language","mark":50},{"name":"Mathematics","mark":50},{"name":"Physical Sciences","mark":50}]'::jsonb,'10135010','academic_minimum_selection_required'),
('T13',28,'[{"name":"English Home Language","mark":60}]'::jsonb,'01130015','eligible'),
('T14',28,'[{"name":"English Home Language","mark":60}]'::jsonb,'01130117','academic_minimum_selection_required'),
('T15',26,'[{"name":"English Home Language","mark":50}]'::jsonb,'01130118','academic_minimum_selection_required'),
('T16',26,'[{"name":"English Home Language","mark":50}]'::jsonb,'01130120','academic_minimum_selection_required'),
('T17',32,'[{"name":"English Home Language","mark":60},{"name":"Mathematics","mark":60},{"name":"Physical Sciences","mark":60}]'::jsonb,'02133398','eligible'),
('T18',36,'[{"name":"English Home Language","mark":60},{"name":"Mathematics","mark":80}]'::jsonb,'02133413','eligible'),
('T19',36,'[{"name":"English Home Language","mark":60},{"name":"Mathematics","mark":79}]'::jsonb,'02133413','not_eligible_subject'),
('T20',32,'[{"name":"English Home Language","mark":58},{"name":"Mathematics","mark":65}]'::jsonb,'02131003','eligible'),
('T21',30,'[{"name":"English Home Language","mark":58},{"name":"Mathematics","mark":58},{"name":"Physical Sciences","mark":58}]'::jsonb,'02131009','eligible'),
('T22',24,'[{"name":"English Home Language","mark":50}]'::jsonb,'06120004','eligible'),
('T23',28,'[{"name":"English Home Language","mark":50},{"name":"Mathematics","mark":50},{"name":"Life Sciences","mark":50}]'::jsonb,'08130006','academic_minimum_selection_required'),
('T24',28,'[{"name":"English Home Language","mark":50}]'::jsonb,'12131012','eligible_with_conditional_curriculum_check'),
('T25',28,'[{"name":"English Home Language","mark":50}]'::jsonb,'09133015','eligible_with_conditional_curriculum_check'),
('T26',28,'[{"name":"English Home Language","mark":60},{"name":"Music","mark":50}]'::jsonb,'01132003','academic_minimum_selection_required'),
('T27',28,'[{"name":"English Home Language","mark":60}]'::jsonb,'01132003','not_eligible_subject')
), r as (
 select t.*,m.match_status actual_status
 from t left join lateral (
   select match_status from public.course_match_up(t.aps,t.subjects,true)
   where qualification_code=t.code limit 1
 ) m on true
)
select test_id,code,expected,actual_status,(expected=actual_status) passed
from r order by test_id;

-- Expected: 27/27 passed=true.
