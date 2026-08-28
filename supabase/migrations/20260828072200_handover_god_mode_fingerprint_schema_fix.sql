create or replace function public.handover_integrity_scan(_residence_id uuid default null, _mode text default 'strict_handover')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _issues jsonb;
  _errors int;
  _warnings int;
  _eligible int;
  _students int;
  _excluded int;
  _duplicate_errors int;
  _issue_counts jsonb;
  _fingerprint text;
  _score int;
  _result jsonb;
begin
  if not public.can_manage_handover_export() then raise exception 'Handover export access required' using errcode='42501'; end if;
  if _mode not in ('strict_handover','document_handover','pipeline','audit') then raise exception 'Unsupported handover mode'; end if;

  select coalesce(jsonb_agg(to_jsonb(i) order by case i.severity when 'error' then 0 else 1 end,i.code,i.application_id),'[]'::jsonb),
         count(*) filter(where i.severity='error')::int,
         count(*) filter(where i.severity='warning')::int,
         count(*) filter(where i.category='duplicate' and i.severity='error')::int
  into _issues,_errors,_warnings,_duplicate_errors
  from public.handover_integrity_issue_rows_internal(_residence_id,_mode) i;

  select count(*)::int,count(distinct v.user_id)::int
  into _eligible,_students
  from public.residence_handover_export_v v
  where not v.handover_excluded and (_residence_id is null or v.residence_id=_residence_id)
    and case _mode when 'strict_handover' then v.status in ('approved','conditionally_approved') when 'document_handover' then v.status in ('approved','conditionally_approved') when 'pipeline' then coalesce(v.status,'') not in ('rejected','withdrawn') when 'audit' then true else false end;

  select count(*)::int into _excluded from public.residence_handover_export_v v where v.handover_excluded and (_residence_id is null or v.residence_id=_residence_id);

  select coalesce(jsonb_object_agg(code,cnt),'{}'::jsonb) into _issue_counts from (
    select code,count(*)::int cnt
    from public.handover_integrity_issue_rows_internal(_residence_id,_mode)
    group by code order by code
  ) s;

  select encode(extensions.digest(coalesce(string_agg(concat_ws('|',v.application_id,v.user_id,v.residence_id,v.full_name,v.student_surname,v.student_number,v.identity_number,v.funding_source,v.email,v.phone,v.campus,v.course,v.status,v.application_date), E'\n' order by v.residence_id,v.application_id),''),'sha256'),'hex')
  into _fingerprint
  from public.residence_handover_export_v v
  where not v.handover_excluded and (_residence_id is null or v.residence_id=_residence_id)
    and case _mode when 'strict_handover' then v.status in ('approved','conditionally_approved') when 'document_handover' then v.status in ('approved','conditionally_approved') when 'pipeline' then coalesce(v.status,'') not in ('rejected','withdrawn') when 'audit' then true else false end;

  _score := greatest(0,100 - least(100,(_errors*4)+least(20,_warnings)));
  _result := jsonb_build_object(
    'ok',_errors=0,
    'policy_version','GOD-MODE-3.0',
    'mode',_mode,
    'residence_id',_residence_id,
    'integrity_score',_score,
    'blocking_errors',_errors,
    'warnings',_warnings,
    'eligible_rows',_eligible,
    'total_students',_students,
    'excluded_rows',_excluded,
    'duplicates_found',_duplicate_errors,
    'issue_counts',_issue_counts,
    'issues',_issues,
    'fingerprint',_fingerprint,
    'generated_at',now()
  );
  return _result;
end;
$$;
revoke all on function public.handover_integrity_scan(uuid,text) from public;
grant execute on function public.handover_integrity_scan(uuid,text) to authenticated,service_role;
