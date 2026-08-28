-- GOD MODE export unblock: email-safe repair, duplicate-account quarantine and atomic prepare.
-- Idempotent and production-safe. Missing identity/funding values are never invented.

create or replace function public.guard_profile_email_not_null()
returns trigger language plpgsql security definer set search_path=public,auth as $$
begin
  if new.email is null or btrim(new.email)='' then
    new.email := coalesce(nullif(lower(btrim(old.email)),''),(select nullif(lower(btrim(email)),'') from auth.users where id=new.id));
  end if;
  if new.email is null or btrim(new.email)='' then
    raise exception 'Profile email cannot be cleared. Add a valid account email first.' using errcode='23502';
  end if;
  return new;
end; $$;

drop trigger if exists trg_guard_profile_email_not_null on public.profiles;
create trigger trg_guard_profile_email_not_null before update on public.profiles for each row execute function public.guard_profile_email_not_null();

with ranked as (
  select v.application_id,v.user_id,v.residence_id,v.student_number,v.full_name,v.phone,
         row_number() over(partition by v.residence_id,v.student_number,lower(v.full_name),regexp_replace(v.phone,'[^0-9]','','g') order by case v.status when 'approved' then 2 else 1 end desc,coalesce(v.updated_at,v.created_at) desc,v.application_id) rn,
         first_value(v.application_id) over(partition by v.residence_id,v.student_number,lower(v.full_name),regexp_replace(v.phone,'[^0-9]','','g') order by case v.status when 'approved' then 2 else 1 end desc,coalesce(v.updated_at,v.created_at) desc,v.application_id) canonical_id
  from public.residence_handover_export_v v
  where not v.handover_excluded and v.status in ('approved','conditionally_approved') and v.student_number is not null and v.full_name is not null and v.phone is not null
), dupes as (
  select * from ranked r where rn>1 and exists (
    select 1 from ranked x where x.residence_id=r.residence_id and x.student_number=r.student_number and lower(x.full_name)=lower(r.full_name)
      and regexp_replace(x.phone,'[^0-9]','','g')=regexp_replace(r.phone,'[^0-9]','','g') and x.user_id<>r.user_id
  )
)
insert into public.handover_application_exclusions(application_id,canonical_application_id,reason,metadata,excluded_by,queue_status)
select application_id,canonical_id,'duplicate_account_same_residence',jsonb_build_object('policy_version','GOD-MODE-3.4','basis','same_residence_student_number_name_phone'),null,'quarantined'
from dupes on conflict(application_id) do nothing;

create or replace function public.prevent_duplicate_identity_same_residence_on_approval()
returns trigger language plpgsql security definer set search_path=public as $$
declare p public.profiles%rowtype;
begin
  if lower(coalesce(new.status,'')) not in ('approved','conditionally_approved') or new.residence_id is null or new.user_id is null then return new; end if;
  select * into p from public.profiles where id=new.user_id;
  if nullif(btrim(coalesce(p.student_number,'')),'') is null then return new; end if;
  if exists(
    select 1 from public.applications a
    join public.profiles q on q.id=a.user_id
    left join public.handover_application_exclusions hx on hx.application_id=a.id
    where a.id<>new.id and a.residence_id=new.residence_id and a.user_id<>new.user_id and hx.application_id is null
      and lower(coalesce(a.status,'')) in ('approved','conditionally_approved')
      and nullif(btrim(q.student_number),'')=nullif(btrim(p.student_number),'')
      and lower(coalesce(q.full_name,''))=lower(coalesce(p.full_name,''))
      and regexp_replace(coalesce(q.phone,q.phone_number,''),'[^0-9]','','g')=regexp_replace(coalesce(p.phone,p.phone_number,''),'[^0-9]','','g')
  ) then
    raise exception 'Approval blocked: this student identity already has an approved application for this residence.' using errcode='23505', hint='Open the existing application instead of approving a duplicate account.';
  end if;
  return new;
end; $$;

drop trigger if exists trg_prevent_duplicate_identity_same_residence_on_approval on public.applications;
create trigger trg_prevent_duplicate_identity_same_residence_on_approval before insert or update of status on public.applications for each row execute function public.prevent_duplicate_identity_same_residence_on_approval();

create or replace function public.prepare_handover_export(_residence_id uuid default null,_mode text default 'strict_handover')
returns jsonb language plpgsql security definer set search_path=public as $$
declare s jsonb; repair jsonb; rows_json jsonb; fp text; run_id uuid; row_count int;
begin
  if not public.can_manage_handover_export() then raise exception 'Handover export access required' using errcode='42501'; end if;
  repair := public.handover_safe_auto_repair(_residence_id);
  s := public.handover_integrity_scan(_residence_id,_mode);
  if coalesce((s->>'ok')::boolean,false)=false then
    return jsonb_build_object('ok',false,'validation',s,'repair',repair,'rows','[]'::jsonb,'row_count',0,'reason','integrity_blocked');
  end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.residence_name,x.full_name,x.application_id),'[]'::jsonb),count(*)::int
  into rows_json,row_count
  from (
    select v.application_id,v.ref_code,v.residence_id,v.residence_name,v.user_id,v.student_name,v.student_surname,v.full_name,v.student_number,v.identity_number,v.applicant_stage,v.funding_source,v.email,v.phone,v.campus,v.course,v.status,v.institution_type,v.application_date,v.move_in_date,v.moved_in
    from public.residence_handover_export_v v
    where not v.handover_excluded and (_residence_id is null or v.residence_id=_residence_id)
      and case _mode when 'strict_handover' then v.status in ('approved','conditionally_approved') when 'document_handover' then v.status in ('approved','conditionally_approved') when 'pipeline' then coalesce(v.status,'') not in ('rejected','withdrawn') when 'audit' then true else false end
  ) x;
  if row_count=0 then
    return jsonb_build_object('ok',false,'validation',s,'repair',repair,'rows','[]'::jsonb,'row_count',0,'reason','no_verified_rows','message','No verified handover-ready records are available in this scope. Resolve or verify the remaining exception queue first.');
  end if;
  fp:=s->>'fingerprint';
  insert into public.handover_integrity_runs(residence_id,mode,ok,blocking_errors,warnings,eligible_rows,excluded_rows,fingerprint,payload,created_by)
  values(_residence_id,_mode,true,0,coalesce((s->>'warnings')::int,0),row_count,coalesce((s->>'excluded_rows')::int,0),fp,s||jsonb_build_object('safe_repair',repair),auth.uid()) returning id into run_id;
  return jsonb_build_object('ok',true,'run_id',run_id,'fingerprint',fp,'row_count',row_count,'validation',s,'repair',repair,'rows',rows_json,'generated_at',now());
end; $$;
revoke all on function public.prepare_handover_export(uuid,text) from public;
grant execute on function public.prepare_handover_export(uuid,text) to authenticated,service_role;
