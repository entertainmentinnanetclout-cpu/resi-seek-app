-- Phase 4C parity follow-up: language-of-teaching-and-learning precision guard
-- Run after EXTERNAL_PARITY_PHASE_4C_UNISA_COURSE_MATCH.sql.
-- Prevents a generic high second-language mark from satisfying the LoTL requirement.

do $do$
declare
  v_original text;
  v_updated text;
begin
  select pg_get_functiondef('public.course_match_unisa(integer,jsonb,boolean)'::regprocedure)
    into v_original;

  v_updated := replace(
    v_original,
    E'             or i.normalized_name like ''%language%''\n',
    ''
  );

  if v_updated = v_original then
    raise exception 'Expected broad language alias was not found; precision patch not applied';
  end if;

  execute v_updated;
end
$do$;

-- Guard test: Diploma IT requires LoTL 50. A second-language 90 must not compensate for LoTL 20.
select qualification_code, programme_name, match_status
from public.course_match_unisa(
  30,
  '[{"name":"Language of teaching and learning","mark":20},{"name":"Second language","mark":90},{"name":"Mathematics","mark":90},{"name":"Physical Science","mark":90}]'::jsonb,
  true
)
where qualification_code='98806 - ITE';
-- Expected match_status: not_eligible_subject
