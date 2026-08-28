-- GOD MODE OS: quarantine historical approved applications that cannot be safely handed over.
-- Records are preserved and remain repairable; they are excluded from release until verified.

alter table public.handover_application_exclusions add column if not exists queue_status text not null default 'quarantined';
alter table public.handover_application_exclusions add column if not exists blocker_codes text[] not null default '{}'::text[];
alter table public.handover_application_exclusions add column if not exists resolved_at timestamptz;
alter table public.handover_application_exclusions add column if not exists resolved_by uuid;

with base as (
  select * from public.residence_handover_export_v
  where not handover_excluded and status in ('approved','conditionally_approved')
), dup_sn as (
  select student_number from base where student_number is not null group by student_number having count(distinct user_id)>1
), dup_id as (
  select identity_number from base where identity_number is not null group by identity_number having count(distinct user_id)>1
), flagged as (
  select b.application_id,
    array_remove(array[
      case when b.full_name is null then 'missing_name' end,
      case when b.student_surname is null then 'missing_surname' end,
      case when b.student_number is null and b.identity_number is null then 'missing_identity' end,
      case when b.funding_source is null or b.funding_source='unknown' then 'missing_funding' end,
      case when b.email is null then 'missing_email' end,
      case when b.phone is null then 'missing_phone' end,
      case when b.campus is null then 'missing_campus' end,
      case when b.residence_name is null then 'invalid_residence' end,
      case when b.student_number in (select student_number from dup_sn) then 'duplicate_student_number' end,
      case when b.identity_number in (select identity_number from dup_id) then 'duplicate_identity_number' end
    ],null)::text[] as blockers
  from base b
)
insert into public.handover_application_exclusions(application_id,canonical_application_id,reason,metadata,excluded_by,queue_status,blocker_codes)
select f.application_id,null,'historical_integrity_hold',jsonb_build_object('policy_version','GOD-MODE-4.0','captured_at',now(),'blockers',to_jsonb(f.blockers)),null,'quarantined',f.blockers
from flagged f where cardinality(f.blockers)>0
on conflict(application_id) do update set
  reason=excluded.reason,
  metadata=excluded.metadata,
  queue_status='quarantined',
  blocker_codes=excluded.blocker_codes,
  resolved_at=null,
  resolved_by=null;

create or replace view public.handover_remediation_queue_v with (security_invoker=on) as
select
  hx.application_id,
  hx.reason,
  hx.queue_status,
  hx.blocker_codes,
  hx.excluded_at,
  hx.resolved_at,
  v.residence_id,
  v.residence_name,
  v.user_id,
  v.full_name,
  v.student_name,
  v.student_surname,
  v.student_number,
  v.identity_number,
  v.funding_source,
  v.email,
  v.phone,
  v.campus,
  v.course,
  v.status,
  v.application_date
from public.handover_application_exclusions hx
join public.residence_handover_export_v v on v.application_id=hx.application_id
where hx.reason='historical_integrity_hold' and hx.queue_status='quarantined';

grant select on public.handover_remediation_queue_v to authenticated,service_role;

create or replace function public.handover_release_quarantine(_application_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.residence_handover_export_v%rowtype; blockers text[]:=array[]::text[]; dup_count int:=0;
begin
  if not public.can_manage_handover_export() then raise exception 'Handover export access required' using errcode='42501'; end if;
  select * into v from public.residence_handover_export_v where application_id=_application_id;
  if v.application_id is null then raise exception 'Application not found'; end if;
  if v.full_name is null then blockers:=array_append(blockers,'missing_name'); end if;
  if v.student_surname is null then blockers:=array_append(blockers,'missing_surname'); end if;
  if v.student_number is null and v.identity_number is null then blockers:=array_append(blockers,'missing_identity'); end if;
  if v.funding_source is null or v.funding_source='unknown' then blockers:=array_append(blockers,'missing_funding'); end if;
  if v.email is null then blockers:=array_append(blockers,'missing_email'); end if;
  if v.phone is null then blockers:=array_append(blockers,'missing_phone'); end if;
  if v.campus is null then blockers:=array_append(blockers,'missing_campus'); end if;
  if v.residence_name is null then blockers:=array_append(blockers,'invalid_residence'); end if;
  if v.student_number is not null then
    select count(distinct user_id) into dup_count from public.residence_handover_export_v
    where student_number=v.student_number and application_id<>_application_id and not handover_excluded;
    if dup_count>0 then blockers:=array_append(blockers,'duplicate_student_number'); end if;
  end if;
  if v.identity_number is not null then
    select count(distinct user_id) into dup_count from public.residence_handover_export_v
    where identity_number=v.identity_number and application_id<>_application_id and not handover_excluded;
    if dup_count>0 then blockers:=array_append(blockers,'duplicate_identity_number'); end if;
  end if;
  if cardinality(blockers)>0 then
    update public.handover_application_exclusions
    set blocker_codes=blockers,metadata=metadata||jsonb_build_object('last_release_check',now(),'blockers',to_jsonb(blockers))
    where application_id=_application_id;
    return jsonb_build_object('released',false,'blockers',blockers);
  end if;
  delete from public.handover_application_exclusions
  where application_id=_application_id and reason='historical_integrity_hold';
  return jsonb_build_object('released',true,'application_id',_application_id);
end;
$$;

revoke all on function public.handover_release_quarantine(uuid) from public;
grant execute on function public.handover_release_quarantine(uuid) to authenticated;

create or replace function public.handover_quarantine_summary()
returns jsonb language sql stable security definer set search_path=public as $$
  select case when public.can_manage_handover_export() then jsonb_build_object(
    'historical_quarantined',count(*) filter(where reason='historical_integrity_hold' and queue_status='quarantined'),
    'duplicate_quarantined',count(*) filter(where reason like 'duplicate%'),
    'all_excluded',count(*)
  ) else jsonb_build_object('historical_quarantined',0,'duplicate_quarantined',0,'all_excluded',0) end
  from public.handover_application_exclusions;
$$;

revoke all on function public.handover_quarantine_summary() from public;
grant execute on function public.handover_quarantine_summary() to authenticated;
