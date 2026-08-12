-- Phase 4C production matcher regression suite
-- Expected result: 20 / 20 PASS.

with profiles(profile_id,aps,subjects) as (
 values
 ('P02_HC_ACCOUNT_BOUNDARY',14,'[{"name":"Language of teaching and learning","mark":30}]'::jsonb),
 ('P03_SUPERVISORY_MATHLIT',15,'[{"name":"Language of teaching and learning","mark":30},{"name":"Mathematics","mark":29},{"name":"Mathematical Literacy","mark":70}]'::jsonb),
 ('P04_HC_MATH_BOUNDARY',15,'[{"name":"Language of teaching and learning","mark":30},{"name":"Mathematics","mark":40}]'::jsonb),
 ('P05_ANIMAL_LIFE_ALT',15,'[{"name":"Language of teaching and learning","mark":30},{"name":"Life Sciences","mark":30}]'::jsonb),
 ('P06_ANIMAL_AGRI_ALT',15,'[{"name":"Language of teaching and learning","mark":30},{"name":"Agricultural Science","mark":30}]'::jsonb),
 ('P07_SOCIAL_SELECTION',15,'[{"name":"Language of teaching and learning","mark":30}]'::jsonb),
 ('P08_ENGINEERING_PHYS',18,'[{"name":"Language of teaching and learning","mark":50},{"name":"Mathematics","mark":50},{"name":"Physical Science","mark":50}]'::jsonb),
 ('P09_ENGINEERING_TECH',18,'[{"name":"Language of teaching and learning","mark":50},{"name":"Mathematics","mark":50},{"name":"Technical Science","mark":50}]'::jsonb),
 ('P10_DIP_IT_CONDITIONAL',18,'[{"name":"Language of teaching and learning","mark":50},{"name":"Mathematics","mark":50}]'::jsonb),
 ('P11_LLB_BOUNDARY',20,'[{"name":"Language of teaching and learning","mark":50}]'::jsonb),
 ('P12_BCOM_MATH_FAIL',21,'[{"name":"Language of teaching and learning","mark":50},{"name":"Mathematics","mark":49}]'::jsonb),
 ('P13_BAS_MATHLIT_ALT',21,'[{"name":"Language of teaching and learning","mark":50},{"name":"Mathematics","mark":49},{"name":"Mathematical Literacy","mark":60}]'::jsonb),
 ('P14_BSC_CONDITIONAL_LOWSCI',20,'[{"name":"Language of teaching and learning","mark":50},{"name":"Mathematics","mark":50},{"name":"Physical Science","mark":49}]'::jsonb),
 ('P15_BSC_CONDITIONAL_MET',20,'[{"name":"Language of teaching and learning","mark":50},{"name":"Mathematics","mark":50},{"name":"Physical Science","mark":50}]'::jsonb),
 ('P16_MUSIC_NSC_ALT',20,'[{"name":"Language of teaching and learning","mark":50},{"name":"Music","mark":50}]'::jsonb),
 ('P17_MUSIC_MISSING',20,'[{"name":"Language of teaching and learning","mark":50}]'::jsonb)
), results as (
 select p.profile_id,m.*
 from profiles p
 cross join lateral public.course_match_unisa(p.aps,p.subjects,true) m
), tests(test_id,profile_id,code,expected_status) as (
 values
 ('T01','P02_HC_ACCOUNT_BOUNDARY','98201','eligible'),
 ('T02','P03_SUPERVISORY_MATHLIT','90015','eligible'),
 ('T03','P03_SUPERVISORY_MATHLIT','90129','not_eligible_subject'),
 ('T04','P03_SUPERVISORY_MATHLIT','90101','not_eligible_subject'),
 ('T05','P04_HC_MATH_BOUNDARY','90129','eligible'),
 ('T06','P04_HC_MATH_BOUNDARY','90101','eligible'),
 ('T07','P05_ANIMAL_LIFE_ALT','90098','eligible'),
 ('T08','P06_ANIMAL_AGRI_ALT','90098','eligible'),
 ('T09','P07_SOCIAL_SELECTION','90011','academic_minimum_selection_required'),
 ('T10','P08_ENGINEERING_PHYS','90130','eligible'),
 ('T11','P08_ENGINEERING_PHYS','90137','eligible'),
 ('T12','P09_ENGINEERING_TECH','90130','eligible'),
 ('T13','P10_DIP_IT_CONDITIONAL','98806 - ITE','eligible_with_conditional_curriculum_check'),
 ('T14','P11_LLB_BOUNDARY','98680 - NEW','eligible'),
 ('T15','P12_BCOM_MATH_FAIL','98314 - GEN','not_eligible_subject'),
 ('T16','P13_BAS_MATHLIT_ALT','98302 - FA1','eligible'),
 ('T17','P14_BSC_CONDITIONAL_LOWSCI','98801 - GEN','eligible_with_conditional_curriculum_check'),
 ('T18','P15_BSC_CONDITIONAL_MET','98801 - GEN','eligible'),
 ('T19','P16_MUSIC_NSC_ALT','90089','eligible'),
 ('T20','P17_MUSIC_MISSING','90089','not_eligible_subject')
)
select
  t.test_id,
  t.profile_id,
  t.code,
  t.expected_status,
  r.match_status as actual_status,
  (t.expected_status=r.match_status) as passed
from tests t
left join results r
  on r.profile_id=t.profile_id
 and r.qualification_code=t.code
order by t.test_id;

-- Full candidate boundary check: expected total_candidates=381 and both leakage counts=0.
with all_rows as (
  select *
  from public.course_match_unisa(
    99,
    '[{"name":"Language of teaching and learning","mark":99},{"name":"Mathematics","mark":99},{"name":"Mathematical Literacy","mark":99},{"name":"Physical Science","mark":99},{"name":"Technical Science","mark":99},{"name":"Engineering Science","mark":99},{"name":"Life Sciences","mark":99},{"name":"Agricultural Science","mark":99},{"name":"Information Technology","mark":99},{"name":"Music","mark":99},{"name":"Music Theory equivalent","mark":99},{"name":"History","mark":99},{"name":"Geography","mark":99},{"name":"Business Studies","mark":99},{"name":"Economics","mark":99}]'::jsonb,
    true
  )
)
select
  count(*) as total_candidates,
  count(*) filter(where entry_route<>'matric_direct') as advanced_route_leakage,
  count(*) filter(where qualification_type in ('Advanced Certificate','Advanced Diploma')) as advanced_type_leakage,
  count(distinct qualification_code) as unique_codes
from all_rows;
