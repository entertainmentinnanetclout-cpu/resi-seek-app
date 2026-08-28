create or replace function public.validate_handover_pack(_residence_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare s jsonb;
begin
  s := public.handover_integrity_scan(_residence_id,'pipeline');
  return s || jsonb_build_object(
    'totals',jsonb_build_object(
      'total_applications',coalesce((s->>'eligible_rows')::int,0),
      'total_students',coalesce((s->>'total_students')::int,0),
      'missing_names',coalesce((s->'issue_counts'->>'missing_name')::int,0),
      'missing_surnames',coalesce((s->'issue_counts'->>'missing_surname')::int,0),
      'missing_student_no',coalesce((s->'issue_counts'->>'missing_identity')::int,0),
      'missing_funding',coalesce((s->'issue_counts'->>'missing_funding')::int,0),
      'invalid_residence',coalesce((s->'issue_counts'->>'invalid_residence')::int,0),
      'duplicates_found',coalesce((s->>'duplicates_found')::int,0)
    ),
    'errors',coalesce((select jsonb_agg(x) from jsonb_array_elements(s->'issues') x where x->>'severity'='error'),'[]'::jsonb)
  );
end;
$$;
revoke all on function public.validate_handover_pack(uuid) from public;
grant execute on function public.validate_handover_pack(uuid) to authenticated,service_role;

create or replace function public.handover_safe_auto_repair(_residence_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare _normalized_profiles int:=0; _normalized_apps int:=0; _duplicates int:=0;
begin
  if not public.can_manage_handover_export() then raise exception 'Handover export access required' using errcode='42501'; end if;

  with targets as (
    select distinct a.user_id from public.applications a
    where a.user_id is not null and (_residence_id is null or a.residence_id=_residence_id)
  )
  update public.profiles p set
    full_name=nullif(btrim(regexp_replace(coalesce(p.full_name,''),'[[:space:]]+',' ','g')),''),
    surname=nullif(btrim(regexp_replace(coalesce(p.surname,''),'[[:space:]]+',' ','g')),''),
    email=nullif(lower(btrim(coalesce(p.email,''))),''),
    phone=case when nullif(btrim(coalesce(p.phone,'')),'') is null and nullif(btrim(coalesce(p.phone_number,'')),'') is not null then btrim(p.phone_number) else nullif(btrim(p.phone),'') end,
    campus=nullif(btrim(coalesce(p.campus,'')),''),
    course=nullif(btrim(coalesce(p.course,'')),'')
  where p.id in (select user_id from targets);
  get diagnostics _normalized_profiles=row_count;

  update public.applications a set
    funding_type=case
      when lower(btrim(a.funding_type)) in ('self funded','self-funded','cash') then 'private'
      when lower(btrim(a.funding_type)) in ('nsfas funded','nsfas-funded') then 'nsfas'
      else nullif(lower(btrim(a.funding_type)),'') end,
    status=replace(lower(btrim(a.status)),' ','_')
  where (_residence_id is null or a.residence_id=_residence_id)
    and (a.funding_type is not null or a.status is not null);
  get diagnostics _normalized_apps=row_count;

  with candidates as (
    select a.*,
      row_number() over(partition by a.user_id,a.residence_id order by
        case lower(coalesce(a.status,'')) when 'approved' then 70 when 'conditionally_approved' then 60 when 'under_review' then 50 when 'documents_required' then 40 when 'submitted' then 30 when 'pending' then 20 when 'rejected' then 10 when 'withdrawn' then 0 else 5 end desc,
        (a.funding_type is not null) desc,coalesce(a.updated_at,a.created_at) desc,a.id) as rn,
      first_value(a.id) over(partition by a.user_id,a.residence_id order by
        case lower(coalesce(a.status,'')) when 'approved' then 70 when 'conditionally_approved' then 60 when 'under_review' then 50 when 'documents_required' then 40 when 'submitted' then 30 when 'pending' then 20 when 'rejected' then 10 when 'withdrawn' then 0 else 5 end desc,
        (a.funding_type is not null) desc,coalesce(a.updated_at,a.created_at) desc,a.id) as canonical_id
    from public.applications a
    left join public.handover_application_exclusions hx on hx.application_id=a.id
    where hx.application_id is null and a.user_id is not null and a.residence_id is not null
      and (_residence_id is null or a.residence_id=_residence_id)
  ), inserted as (
    insert into public.handover_application_exclusions(application_id,canonical_application_id,reason,metadata,excluded_by)
    select id,canonical_id,'duplicate_same_user_residence',jsonb_build_object('auto_repaired',true,'policy_version','GOD-MODE-3.0'),auth.uid()
    from candidates where rn>1
    on conflict(application_id) do nothing returning 1
  )
  select count(*) into _duplicates from inserted;

  return jsonb_build_object(
    'normalized_profiles',_normalized_profiles,
    'normalized_applications',_normalized_apps,
    'duplicate_rows_quarantined',_duplicates,
    'scan',public.handover_integrity_scan(_residence_id,'pipeline')
  );
end;
$$;
revoke all on function public.handover_safe_auto_repair(uuid) from public;
grant execute on function public.handover_safe_auto_repair(uuid) to authenticated;

create or replace function public.handover_update_record(_application_id uuid,_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare _uid uuid; _old jsonb; _new jsonb;
begin
  if not public.can_manage_handover_export() then raise exception 'Handover export access required' using errcode='42501'; end if;
  select a.user_id into _uid from public.applications a where a.id=_application_id;
  if _uid is null then raise exception 'Application not found'; end if;
  select to_jsonb(v) into _old from public.residence_handover_export_v v where v.application_id=_application_id;

  update public.profiles p set
    full_name=case when _patch ? 'full_name' then nullif(btrim(_patch->>'full_name'),'') else p.full_name end,
    surname=case when _patch ? 'surname' then nullif(btrim(_patch->>'surname'),'') else p.surname end,
    student_number=case when _patch ? 'student_number' then nullif(btrim(_patch->>'student_number'),'') else p.student_number end,
    identity_number=case when _patch ? 'identity_number' then nullif(regexp_replace(_patch->>'identity_number','[^0-9]','','g'),'') else p.identity_number end,
    email=case when _patch ? 'email' then nullif(lower(btrim(_patch->>'email')),'') else p.email end,
    phone=case when _patch ? 'phone' then nullif(btrim(_patch->>'phone'),'') else p.phone end,
    campus=case when _patch ? 'campus' then nullif(btrim(_patch->>'campus'),'') else p.campus end,
    course=case when _patch ? 'course' then nullif(btrim(_patch->>'course'),'') else p.course end,
    updated_at=now()
  where p.id=_uid;

  update public.applications a set
    funding_type=case when _patch ? 'funding_type' then nullif(lower(btrim(_patch->>'funding_type')),'') else a.funding_type end,
    updated_at=now()
  where a.id=_application_id;

  select to_jsonb(v) into _new from public.residence_handover_export_v v where v.application_id=_application_id;
  insert into public.handover_corrections(application_id,user_id,old_values,new_values,changed_by)
  values(_application_id,_uid,coalesce(_old,'{}'::jsonb),coalesce(_new,'{}'::jsonb),auth.uid());
  return _new;
end;
$$;
revoke all on function public.handover_update_record(uuid,jsonb) from public;
grant execute on function public.handover_update_record(uuid,jsonb) to authenticated;

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
    return jsonb_build_object('ok',false,'validation',s,'rows','[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.residence_name,x.full_name,x.application_id),'[]'::jsonb),count(*)::int
  into rows_json,row_count
  from (
    select v.application_id,v.ref_code,v.residence_id,v.residence_name,v.user_id,v.student_name,v.student_surname,v.full_name,v.student_number,v.identity_number,v.applicant_stage,v.funding_source,v.email,v.phone,v.campus,v.course,v.status,v.institution_type,v.application_date,v.move_in_date,v.moved_in
    from public.residence_handover_export_v v
    where not v.handover_excluded and (_residence_id is null or v.residence_id=_residence_id)
      and case _mode when 'strict_handover' then v.status in ('approved','conditionally_approved') when 'document_handover' then v.status in ('approved','conditionally_approved') when 'pipeline' then coalesce(v.status,'') not in ('rejected','withdrawn') when 'audit' then true else false end
  ) x;

  fp:=s->>'fingerprint';
  insert into public.handover_integrity_runs(residence_id,mode,ok,blocking_errors,warnings,eligible_rows,excluded_rows,fingerprint,payload,created_by)
  values(_residence_id,_mode,true,0,coalesce((s->>'warnings')::int,0),row_count,coalesce((s->>'excluded_rows')::int,0),fp,s,auth.uid())
  returning id into run_id;

  return jsonb_build_object('ok',true,'run_id',run_id,'fingerprint',fp,'row_count',row_count,'validation',s,'rows',rows_json,'generated_at',now());
end;
$$;
revoke all on function public.prepare_handover_export(uuid,text) from public;
grant execute on function public.prepare_handover_export(uuid,text) to authenticated,service_role;

create or replace function public.prevent_duplicate_application_same_residence()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.user_id is null or new.residence_id is null then return new; end if;
  if exists(
    select 1 from public.applications a
    left join public.handover_application_exclusions hx on hx.application_id=a.id
    where a.user_id=new.user_id and a.residence_id=new.residence_id
      and a.id<>coalesce(new.id,'00000000-0000-0000-0000-000000000000'::uuid)
      and hx.application_id is null
  ) then
    raise exception 'Duplicate application blocked: this applicant already has an application for the selected residence.'
      using errcode='23505',hint='Open the existing application instead of creating another one.';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_prevent_duplicate_application_same_residence on public.applications;
create trigger trg_prevent_duplicate_application_same_residence
before insert or update of user_id,residence_id on public.applications
for each row execute function public.prevent_duplicate_application_same_residence();

create or replace function public.enforce_handover_readiness_on_approval()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare p public.profiles%rowtype; missing text[]:=array[]::text[];
begin
  if lower(coalesce(new.status,'')) not in ('approved','conditionally_approved') then return new; end if;
  select * into p from public.profiles where id=new.user_id;
  if p.id is null then missing:=array_append(missing,'profile'); end if;
  if nullif(btrim(coalesce(p.full_name,'')),'') is null then missing:=array_append(missing,'full name'); end if;
  if nullif(btrim(coalesce(p.student_number,'')),'') is null and nullif(btrim(coalesce(p.identity_number,'')),'') is null then missing:=array_append(missing,'student number or ID'); end if;
  if nullif(btrim(coalesce(p.email,'')),'') is null then missing:=array_append(missing,'email'); end if;
  if nullif(btrim(coalesce(p.phone,p.phone_number,'')),'') is null then missing:=array_append(missing,'phone'); end if;
  if nullif(btrim(coalesce(p.campus,'')),'') is null then missing:=array_append(missing,'campus'); end if;
  if nullif(btrim(coalesce(new.funding_type,'')),'') is null or lower(btrim(new.funding_type))='unknown' then missing:=array_append(missing,'funding'); end if;
  if cardinality(missing)>0 then
    raise exception 'Approval blocked: handover-critical fields are incomplete (%).',array_to_string(missing,', ')
      using errcode='23514',hint='Complete the applicant record before approval.';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_enforce_handover_readiness_on_approval on public.applications;
create trigger trg_enforce_handover_readiness_on_approval
before insert or update of status on public.applications
for each row when (new.status in ('approved','conditionally_approved'))
execute function public.enforce_handover_readiness_on_approval();
