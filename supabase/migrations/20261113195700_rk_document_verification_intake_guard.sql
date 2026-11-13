-- Prevent a signed-in student from forging verified document statuses during upload.
-- This closes the cross-table trust gap before enforcing mandatory final handover checks.
create or replace function reskonnect_internal.rk_guard_document_verification()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_admin boolean:=false;v_staff boolean:=false;
 v_portal boolean:=false;v_verified boolean;v_old_verified boolean:=false;
begin
 if v_actor is null then
  -- Trusted service-role imports and controlled server jobs; any anonymous
  -- PostgREST request remains denied by existing user-scoped RLS.
  return new;
 end if;
 v_admin:=public.has_role(v_actor,'admin'::public.app_role);
 v_staff:=v_admin or public.has_admin_department_access('accommodation');
 if tg_table_name='application_documents' then
  v_portal:=public.is_authorized_residence_user(new.residence_id);
 end if;
 v_verified:=lower(coalesce(new.status,'')) in ('verified','approved','accepted');
 if tg_op='INSERT' then
  -- All user and landlord submissions start unreviewed. Existing uploaded
  -- files are not the same thing as a human eligibility decision.
  if not v_admin and (v_verified or new.verified_at is not null or new.verified_by is not null) then
   raise exception 'Uploaded documents cannot be pre-verified. Use authorised review instead'
    using errcode='42501';
  end if;
 else
  v_old_verified:=lower(coalesce(old.status,'')) in ('verified','approved','accepted');
  if (new.status is distinct from old.status or new.verified_at is distinct from old.verified_at
        or new.verified_by is distinct from old.verified_by) and
     not (v_staff or (tg_table_name='application_documents' and v_portal)) then
   raise exception 'Only authorised document reviewers may change verification' using errcode='42501';
  end if;
  if new.verified_at is distinct from old.verified_at and new.verified_at is not null and
    not v_admin and new.verified_by is distinct from v_actor then
   raise exception 'Document verification must record the authorised reviewer' using errcode='42501';
  end if;
 end if;
 if v_verified and (new.verified_by is null or new.verified_at is null) then
  -- Preserve existing legacy rows unchanged until explicitly reviewed again;
  -- new verified transitions must carry both audit fields.
  if tg_op='INSERT' or not v_old_verified or
     new.status is distinct from old.status or new.verified_at is distinct from old.verified_at then
   raise exception 'Verified documents require reviewer and verification timestamp'
    using errcode='23514';
  end if;
 end if;
 return new;
end $$;
revoke all on function reskonnect_internal.rk_guard_document_verification() from public,anon,authenticated;
drop trigger if exists aa_rk_document_verification_guard on public.documents;
create trigger aa_rk_document_verification_guard before insert or update of status,verified_at,verified_by on public.documents
 for each row execute function reskonnect_internal.rk_guard_document_verification();
drop trigger if exists aa_rk_application_document_verification_guard on public.application_documents;
create trigger aa_rk_application_document_verification_guard before insert or update of status,verified_at,verified_by on public.application_documents
 for each row execute function reskonnect_internal.rk_guard_document_verification();
comment on function reskonnect_internal.rk_guard_document_verification() is
'Prevents student and non-reviewer verified-status forgery; requirements are independently rechecked at final handover.';
