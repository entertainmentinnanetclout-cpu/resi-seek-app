-- GOD MODE: null-safe source repair + controlled release of historical handover holds.
create or replace function public.handover_safe_auto_repair(_residence_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  _normalized_profiles int:=0;
  _normalized_apps int:=0;
  _duplicates int:=0;
  _released int:=0;
  _remaining int:=0;
begin
  if not public.can_manage_handover_export() then raise exception 'Handover export access required' using errcode='42501'; end if;

  with targets as (
    select distinct a.user_id from public.applications a
    where a.user_id is not null and (_residence_id is null or a.residence_id=_residence_id)
  )
  update public.profiles p
  set full_name=coalesce(nullif(btrim(regexp_replace(coalesce(p.full_name,''),'[[:space:]]+',' ','g')),''),p.full_name),
      surname=coalesce(nullif(btrim(regexp_replace(coalesce(p.surname,''),'[[:space:]]+',' ','g')),''),p.surname),
      email=coalesce(nullif(lower(btrim(p.email)),''),nullif(lower(btrim(u.email)),''),p.email),
      phone=coalesce(nullif(btrim(p.phone),''),nullif(btrim(p.phone_number),''),nullif(btrim(u.phone),''),nullif(btrim(u.raw_user_meta_data->>'phone'),''),nullif(btrim(u.raw_user_meta_data->>'phone_number'),''),p.phone),
      student_number=coalesce(nullif(btrim(p.student_number),''),nullif(btrim(u.raw_user_meta_data->>'student_number'),''),p.student_number),
      identity_number=coalesce(nullif(regexp_replace(p.identity_number,'[^0-9]','','g'),''),nullif(regexp_replace(coalesce(u.raw_user_meta_data->>'identity_number',u.raw_user_meta_data->>'id_number',''),'[^0-9]','','g'),''),p.identity_number),
      campus=coalesce(nullif(btrim(p.campus),''),nullif(btrim(u.raw_user_meta_data->>'campus'),''),p.campus),
      course=coalesce(nullif(btrim(p.course),''),p.course),
      updated_at=now()
  from auth.users u
  where p.id=u.id and p.id in (select user_id from targets)
    and (btrim(coalesce(p.email,''))='' or btrim(coalesce(p.phone,''))='' or btrim(coalesce(p.student_number,''))='' or btrim(coalesce(p.identity_number,''))='' or btrim(coalesce(p.campus,''))='' or p.full_name is distinct from coalesce(nullif(btrim(regexp_replace(coalesce(p.full_name,''),'[[:space:]]+',' ','g')),''),p.full_name));
  get diagnostics _normalized_profiles=row_count;

  update public.applications a
  set funding_type=case
        when nullif(btrim(a.funding_type),'') is null or lower(btrim(a.funding_type))='unknown' then 'undecided'
        when lower(btrim(a.funding_type)) in ('self funded','self-funded','cash') then 'private'
        when lower(btrim(a.funding_type)) in ('nsfas funded','nsfas-funded') then 'nsfas'
        else lower(btrim(a.funding_type)) end,
      updated_at=now()
  where (_residence_id is null or a.residence_id=_residence_id)
    and (nullif(btrim(a.funding_type),'') is null or lower(btrim(a.funding_type)) in ('unknown','self funded','self-funded','cash','nsfas funded','nsfas-funded'));
  get diagnostics _normalized_apps=row_count;

  with candidates as (
    select a.*,
      row_number() over(partition by a.user_id,a.residence_id order by
        case lower(coalesce(a.status,'')) when 'approved' then 70 when 'conditionally_approved' then 60 when 'under_review' then 50 when 'documents_required' then 40 when 'submitted' then 30 when 'pending' then 20 when 'rejected' then 10 when 'withdrawn' then 0 else 5 end desc,
        (a.funding_type is not null) desc,coalesce(a.updated_at,a.created_at) desc,a.id) rn,
      first_value(a.id) over(partition by a.user_id,a.residence_id order by
        case lower(coalesce(a.status,'')) when 'approved' then 70 when 'conditionally_approved' then 60 when 'under_review' then 50 when 'documents_required' then 40 when 'submitted' then 30 when 'pending' then 20 when 'rejected' then 10 when 'withdrawn' then 0 else 5 end desc,
        (a.funding_type is not null) desc,coalesce(a.updated_at,a.created_at) desc,a.id) canonical_id
    from public.applications a
    left join public.handover_application_exclusions hx on hx.application_id=a.id and hx.reason='duplicate_same_user_residence'
    where hx.application_id is null and a.user_id is not null and a.residence_id is not null and (_residence_id is null or a.residence_id=_residence_id)
  ), inserted as (
    insert into public.handover_application_exclusions(application_id,canonical_application_id,reason,metadata,excluded_by,queue_status)
    select id,canonical_id,'duplicate_same_user_residence',jsonb_build_object('auto_repaired',true,'policy_version','GOD-MODE-3.1'),auth.uid(),'quarantined'
    from candidates where rn>1 on conflict(application_id) do nothing returning 1
  ) select count(*) into _duplicates from inserted;

  with held as (
    select v.application_id,v.user_id,v.student_number,v.identity_number
    from public.residence_handover_export_v v
    join public.handover_application_exclusions hx on hx.application_id=v.application_id and hx.reason='historical_integrity_hold'
    where (_residence_id is null or v.residence_id=_residence_id)
      and v.status in ('approved','conditionally_approved')
      and v.full_name is not null and v.student_surname is not null
      and (v.student_number is not null or v.identity_number is not null)
      and v.funding_source is not null and v.funding_source<>'unknown'
      and v.email is not null and v.phone is not null and v.campus is not null and v.residence_name is not null
  ), unique_held as (
    select h.* from held h where not exists (
      select 1 from public.residence_handover_export_v x
      where x.application_id<>h.application_id and x.user_id<>h.user_id
        and ((h.student_number is not null and x.student_number=h.student_number) or (h.identity_number is not null and x.identity_number=h.identity_number))
    )
  ), released as (
    delete from public.handover_application_exclusions hx using unique_held h
    where hx.application_id=h.application_id and hx.reason='historical_integrity_hold' returning 1
  ) select count(*) into _released from released;

  select count(*) into _remaining from public.handover_application_exclusions hx
  join public.applications a on a.id=hx.application_id
  where hx.reason='historical_integrity_hold' and (_residence_id is null or a.residence_id=_residence_id);

  return jsonb_build_object('normalized_profiles',_normalized_profiles,'normalized_applications',_normalized_apps,'duplicate_rows_quarantined',_duplicates,'historical_rows_released',_released,'historical_rows_remaining',_remaining,'scan',public.handover_integrity_scan(_residence_id,'strict_handover'));
end;
$$;
revoke all on function public.handover_safe_auto_repair(uuid) from public;
grant execute on function public.handover_safe_auto_repair(uuid) to authenticated;

create or replace function public.handover_update_record(_application_id uuid,_patch jsonb)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare _uid uuid; _old jsonb; _new jsonb; _auth_email text;
begin
  if not public.can_manage_handover_export() then raise exception 'Handover export access required' using errcode='42501'; end if;
  select a.user_id into _uid from public.applications a where a.id=_application_id;
  if _uid is null then raise exception 'Application not found'; end if;
  select email into _auth_email from auth.users where id=_uid;
  select to_jsonb(v) into _old from public.residence_handover_export_v v where v.application_id=_application_id;
  update public.profiles p set
    full_name=case when _patch ? 'full_name' then coalesce(nullif(btrim(_patch->>'full_name'),''),p.full_name) else p.full_name end,
    surname=case when _patch ? 'surname' then coalesce(nullif(btrim(_patch->>'surname'),''),p.surname) else p.surname end,
    student_number=case when _patch ? 'student_number' then nullif(btrim(_patch->>'student_number'),'') else p.student_number end,
    identity_number=case when _patch ? 'identity_number' then nullif(regexp_replace(_patch->>'identity_number','[^0-9]','','g'),'') else p.identity_number end,
    email=case when _patch ? 'email' then coalesce(nullif(lower(btrim(_patch->>'email')),''),nullif(lower(btrim(_auth_email)),''),p.email) else p.email end,
    phone=case when _patch ? 'phone' then coalesce(nullif(btrim(_patch->>'phone'),''),p.phone,p.phone_number) else p.phone end,
    campus=case when _patch ? 'campus' then coalesce(nullif(btrim(_patch->>'campus'),''),p.campus) else p.campus end,
    course=case when _patch ? 'course' then nullif(btrim(_patch->>'course'),'') else p.course end,
    updated_at=now()
  where p.id=_uid;
  update public.applications a set funding_type=case when _patch ? 'funding_type' then coalesce(nullif(lower(btrim(_patch->>'funding_type')),''),'undecided') else a.funding_type end,updated_at=now() where a.id=_application_id;
  select to_jsonb(v) into _new from public.residence_handover_export_v v where v.application_id=_application_id;
  insert into public.handover_corrections(application_id,user_id,old_values,new_values,changed_by) values(_application_id,_uid,coalesce(_old,'{}'::jsonb),coalesce(_new,'{}'::jsonb),auth.uid());
  return _new;
end;
$$;
revoke all on function public.handover_update_record(uuid,jsonb) from public;
grant execute on function public.handover_update_record(uuid,jsonb) to authenticated;
