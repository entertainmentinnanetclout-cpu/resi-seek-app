-- GOD MODE OS: even a clean integrity scan may not emit an empty handover pack.
create or replace function public.prepare_handover_export(_residence_id uuid default null,_mode text default 'strict_handover')
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare s jsonb; rows_json jsonb; fp text; run_id uuid; row_count int;
begin
  if not public.can_manage_handover_export() then raise exception 'Handover export access required' using errcode='42501'; end if;
  s:=public.handover_integrity_scan(_residence_id,_mode);
  if coalesce((s->>'ok')::boolean,false)=false then
    return jsonb_build_object('ok',false,'validation',s,'rows','[]'::jsonb,'row_count',0,'reason','integrity_blocked');
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.residence_name,x.full_name,x.application_id),'[]'::jsonb),count(*)::int
  into rows_json,row_count
  from (
    select v.application_id,v.ref_code,v.residence_id,v.residence_name,v.user_id,v.student_name,v.student_surname,v.full_name,v.student_number,v.identity_number,v.applicant_stage,v.funding_source,v.email,v.phone,v.campus,v.course,v.status,v.institution_type,v.application_date,v.move_in_date,v.moved_in
    from public.residence_handover_export_v v
    where not v.handover_excluded and (_residence_id is null or v.residence_id=_residence_id)
      and case _mode
        when 'strict_handover' then v.status in ('approved','conditionally_approved')
        when 'document_handover' then v.status in ('approved','conditionally_approved')
        when 'pipeline' then coalesce(v.status,'') not in ('rejected','withdrawn')
        when 'audit' then true
        else false end
  ) x;

  if row_count=0 then
    return jsonb_build_object(
      'ok',false,
      'validation',s,
      'rows','[]'::jsonb,
      'row_count',0,
      'reason','no_verified_rows',
      'message','No verified handover-ready records are available in this scope. Historical holds must be repaired and released first.'
    );
  end if;

  fp:=s->>'fingerprint';
  insert into public.handover_integrity_runs(residence_id,mode,ok,blocking_errors,warnings,eligible_rows,excluded_rows,fingerprint,payload,created_by)
  values(_residence_id,_mode,true,0,coalesce((s->>'warnings')::int,0),row_count,coalesce((s->>'excluded_rows')::int,0),fp,s,auth.uid())
  returning id into run_id;

  return jsonb_build_object('ok',true,'run_id',run_id,'fingerprint',fp,'row_count',row_count,'validation',s,'rows',rows_json,'generated_at',now());
end;
$$;

revoke all on function public.prepare_handover_export(uuid,text) from public;
grant execute on function public.prepare_handover_export(uuid,text) to authenticated,service_role;
