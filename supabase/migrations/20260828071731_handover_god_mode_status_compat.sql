alter function public.handover_integrity_issue_rows_internal(uuid,text) rename to handover_integrity_issue_rows_internal_v1;

create or replace function public.handover_integrity_issue_rows_internal(_residence_id uuid default null, _mode text default 'strict_handover')
returns table(
  severity text,
  code text,
  category text,
  application_id uuid,
  user_id uuid,
  residence_id uuid,
  field_name text,
  reason text,
  suggested_action text,
  auto_fixable boolean,
  metadata jsonb
)
language sql
stable
security definer
set search_path=public
as $$
  select i.*
  from public.handover_integrity_issue_rows_internal_v1(_residence_id,_mode) i
  where not (
    i.code='invalid_status'
    and coalesce(i.metadata->>'value','') in ('interview_scheduled','waitlisted')
  );
$$;
revoke all on function public.handover_integrity_issue_rows_internal(uuid,text) from public;
