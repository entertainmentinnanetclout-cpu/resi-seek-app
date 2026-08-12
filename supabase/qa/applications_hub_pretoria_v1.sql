-- ResKonnect Applications Hub — Pretoria v1 read-only QA.
-- Run against external Supabase project mefjzkhobkltlbmhusdh.

-- Q1. Student-facing directory boundary.
select
  category,
  count(*) filter (where is_active) as active_rows,
  count(*) filter (where is_active and matcher_enabled) as matcher_enabled_rows
from public.application_hub_institutions
group by category
order by category;
-- Expected initial Pretoria v1:
-- university = 3 active / 3 Course Match enabled
-- tvet = 2 active / 0 Course Match enabled
-- private_college = 0 until verified providers are added

-- Q2. Production Course Match output boundary.
select 'tut' institution, count(*) rows
from public.course_match_tut(
  42,
  '[{"name":"English Home Language","mark":100},{"name":"Mathematics","mark":100},{"name":"Physical Sciences","mark":100},{"name":"Life Sciences","mark":100},{"name":"Accounting","mark":100}]'::jsonb,
  true
)
union all
select 'up', count(*)
from public.course_match_up(
  42,
  '[{"name":"English Home Language","mark":100},{"name":"Mathematics","mark":100},{"name":"Mathematical Literacy","mark":100},{"name":"Physical Sciences","mark":100},{"name":"Life Sciences","mark":100},{"name":"Accounting","mark":100},{"name":"Music","mark":100}]'::jsonb,
  true
)
union all
select 'unisa', count(*)
from public.course_match_unisa(
  100,
  '[{"name":"Language of teaching and learning","mark":100},{"name":"English Home Language","mark":100},{"name":"Mathematics","mark":100},{"name":"Mathematical Literacy","mark":100},{"name":"Physical Science","mark":100},{"name":"Life Sciences","mark":100},{"name":"Accounting","mark":100}]'::jsonb,
  true
);
-- Expected at Pretoria v1 sign-off: TUT 85 / UP 128 / UNISA 381.

-- Q3. TUT safety guard: the current captured TUT minimum route may never emit
-- a plain `eligible` status. Passing rows remain subject to TUT selection and
-- official verification until the final row-by-row TUT QA is complete.
with tut as (
  select *
  from public.course_match_tut(
    42,
    '[{"name":"English Home Language","mark":100},{"name":"Mathematics","mark":100},{"name":"Technical Mathematics","mark":100},{"name":"Mathematical Literacy","mark":100},{"name":"Physical Sciences","mark":100},{"name":"Technical Sciences","mark":100},{"name":"Life Sciences","mark":100},{"name":"Accounting","mark":100}]'::jsonb,
    true
  )
)
select
  count(*) as output_rows,
  count(*) filter (where match_status='academic_minimum_selection_required') as guarded_pass_rows,
  count(*) filter (where match_status='eligible') as unsafe_plain_eligible_rows
from tut;
-- Expected: 85 / 85 / 0.
