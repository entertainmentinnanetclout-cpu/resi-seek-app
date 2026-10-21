-- Keep an evidence history instead of replacing a previously reviewed document.
drop index if exists public.accommodation_compliance_evidence_case_requirement_idx;
create index if not exists accommodation_compliance_evidence_case_requirement_created_idx
  on public.accommodation_compliance_evidence(case_id, requirement_code, created_at desc);
