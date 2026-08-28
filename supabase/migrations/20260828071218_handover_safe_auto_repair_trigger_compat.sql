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
  where p.id in (select user_id from targets)
    and (
      p.full_name is distinct from nullif(btrim(regexp_replace(coalesce(p.full_name,''),'[[:space:]]+',' ','g')),'') or
      p.surname is distinct from nullif(btrim(regexp_replace(coalesce(p.surname,''),'[[:space:]]+',' ','g')),'') or
      p.email is distinct from nullif(lower(btrim(coalesce(p.email,''))),'') or
      p.phone is distinct from (case when nullif(btrim(coalesce(p.phone,'')),'') is null and nullif(btrim(coalesce(p.phone_number,'')),'') is not null then btrim(p.phone_number) else nullif(btrim(p.phone),'') end) or
      p.campus is distinct from nullif(btrim(coalesce(p.campus,'')),'') or
      p.course is distinct from nullif(btrim(coalesce(p.course,'')),'')
    );
  get diagnostics _normalized_profiles=row_count;

  update public.applications a set funding_type=case
      when lower(btrim(a.funding_type)) in ('self funded','self-funded','cash') then 'private'
      when lower(btrim(a.funding_type)) in ('nsfas funded','nsfas-funded') then 'nsfas'
      else lower(btrim(a.funding_type)) end,
    updated_at=now()
  where (_residence_id is null or a.residence_id=_residence_id)
    and a.funding_type is not null
    and lower(btrim(a.funding_type)) in ('self funded','self-funded','cash','nsfas funded','nsfas-funded');
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
  ) select count(*) into _duplicates from inserted;

  return jsonb_build_object('normalized_profiles',_normalized_profiles,'normalized_applications',_normalized_apps,'duplicate_rows_quarantined',_duplicates,'scan',public.handover_integrity_scan(_residence_id,'pipeline'));
end;
$$;
