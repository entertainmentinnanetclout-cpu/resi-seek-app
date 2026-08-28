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
set search_path = public
as $$
with base as (
  select v.*
  from public.residence_handover_export_v v
  where not v.handover_excluded
    and (_residence_id is null or v.residence_id=_residence_id)
    and case _mode
      when 'strict_handover' then v.status in ('approved','conditionally_approved')
      when 'document_handover' then v.status in ('approved','conditionally_approved')
      when 'pipeline' then coalesce(v.status,'') not in ('rejected','withdrawn')
      when 'audit' then true
      else false
    end
), docs as (
  select d.user_id,
    bool_or(lower(d.document_type) in ('id','id_document','identity_document')) as has_id_doc,
    bool_or(lower(d.document_type) in ('registration','proof_of_registration','student_card')) as has_registration_doc
  from public.documents d group by d.user_id
), issues as (
  select 'error'::text severity,'missing_name'::text code,'identity'::text category,b.application_id,b.user_id,b.residence_id,'full_name'::text field_name,'Applicant full name is missing'::text reason,'Capture the applicant legal name before handover'::text suggested_action,false auto_fixable,'{}'::jsonb metadata from base b where b.full_name is null
  union all select 'error','missing_surname','identity',b.application_id,b.user_id,b.residence_id,'surname','Applicant surname is missing','Capture/verify the applicant surname',false,'{}'::jsonb from base b where b.student_surname is null
  union all select 'error','missing_identity','identity',b.application_id,b.user_id,b.residence_id,'student_number_or_id','Neither student number nor South African ID is available','Capture a student number, or a 13-digit ID for TVET/matric/private applicants',false,'{}'::jsonb from base b where b.student_number is null and b.identity_number is null
  union all select 'error','invalid_identity_number','identity',b.application_id,b.user_id,b.residence_id,'identity_number','South African ID must contain exactly 13 digits','Correct the ID number or use a valid student number',false,jsonb_build_object('value',b.identity_number) from base b where b.identity_number is not null and regexp_replace(b.identity_number,'[^0-9]','','g') !~ '^[0-9]{13}$'
  union all select 'error','missing_funding','funding',b.application_id,b.user_id,b.residence_id,'funding_type','Funding source is missing','Set NSFAS, private/self-funded, bursary, scholarship, employer, family, other or undecided',false,'{}'::jsonb from base b where b.funding_source is null or b.funding_source in ('unknown','')
  union all select 'error','invalid_funding','funding',b.application_id,b.user_id,b.residence_id,'funding_type','Funding source is not recognized','Normalize funding to an approved ResKonnect value',true,jsonb_build_object('value',b.funding_source) from base b where b.funding_source is not null and b.funding_source not in ('nsfas','private','self-funded','self funded','bursary','scholarship','employer','family','other','undecided')
  union all select 'error','missing_email','contact',b.application_id,b.user_id,b.residence_id,'email','Applicant email is missing','Capture a valid applicant email',false,'{}'::jsonb from base b where b.email is null
  union all select 'error','invalid_email','contact',b.application_id,b.user_id,b.residence_id,'email','Applicant email format is invalid','Correct the applicant email',false,jsonb_build_object('value',b.email) from base b where b.email is not null and b.email !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
  union all select 'error','missing_phone','contact',b.application_id,b.user_id,b.residence_id,'phone','Applicant phone/WhatsApp number is missing','Capture a reachable South African mobile number',false,'{}'::jsonb from base b where b.phone is null
  union all select 'error','invalid_phone','contact',b.application_id,b.user_id,b.residence_id,'phone','Applicant phone number format is invalid','Use a valid South African mobile number',false,jsonb_build_object('value',b.phone) from base b where b.phone is not null and regexp_replace(b.phone,'[^0-9]','','g') !~ '^(27|0)?[6-8][0-9]{8}$'
  union all select 'error','missing_campus','education',b.application_id,b.user_id,b.residence_id,'campus','Campus/institution context is missing','Capture the applicant campus or institution context',false,'{}'::jsonb from base b where b.campus is null
  union all select 'warning','missing_course','education',b.application_id,b.user_id,b.residence_id,'course','Course/qualification is not captured','Add the current or intended qualification where available',false,'{}'::jsonb from base b where b.course is null
  union all select 'error','invalid_residence','residence',b.application_id,b.user_id,b.residence_id,'residence_id','Application is not linked to a valid residence','Repair the residence link before export',false,'{}'::jsonb from base b where b.residence_name is null or b.residence_id is null
  union all select 'error','missing_application_date','application',b.application_id,b.user_id,b.residence_id,'application_date','Application date is missing','Restore the application timestamp',false,'{}'::jsonb from base b where b.application_date is null
  union all select 'error','invalid_status','application',b.application_id,b.user_id,b.residence_id,'status','Application status is missing or unsupported','Move the application to a supported workflow status',false,jsonb_build_object('value',b.status) from base b where b.status is null or b.status not in ('submitted','documents_required','under_review','conditionally_approved','approved','rejected','withdrawn','pending')
  union all select 'error','moved_in_without_date','application',b.application_id,b.user_id,b.residence_id,'move_in_date','Applicant is marked moved-in but no move-in date exists','Capture the actual move-in date',false,'{}'::jsonb from base b where b.moved_in is true and b.move_in_date is null
  union all
  select 'error','duplicate_application','duplicate',min(b.application_id::text)::uuid,b.user_id,b.residence_id,'user_id','Same user has multiple active applications for the same residence','Run Safe Auto-Repair to preserve one canonical application and quarantine duplicate rows',true,jsonb_build_object('application_ids',jsonb_agg(b.application_id order by b.created_at))
  from base b where b.user_id is not null and b.residence_id is not null group by b.user_id,b.residence_id having count(*)>1
  union all
  select 'error','duplicate_student_number','duplicate',min(b.application_id::text)::uuid,min(b.user_id::text)::uuid,b.residence_id,'student_number','The same student number belongs to multiple user accounts in this residence','Resolve the identity collision manually before handover',false,jsonb_build_object('student_number',b.student_number,'application_ids',jsonb_agg(b.application_id))
  from base b where b.student_number is not null group by b.student_number,b.residence_id having count(distinct b.user_id)>1
  union all
  select 'error','duplicate_identity_number','duplicate',min(b.application_id::text)::uuid,min(b.user_id::text)::uuid,b.residence_id,'identity_number','The same identity number belongs to multiple user accounts in this residence','Resolve the identity collision manually before handover',false,jsonb_build_object('identity_number',b.identity_number,'application_ids',jsonb_agg(b.application_id))
  from base b where b.identity_number is not null group by b.identity_number,b.residence_id having count(distinct b.user_id)>1
  union all
  select 'warning','shared_email','contact',min(b.application_id::text)::uuid,min(b.user_id::text)::uuid,b.residence_id,'email','Multiple applicant accounts share the same email in this residence','Verify that the shared email is intentional',false,jsonb_build_object('email',b.email,'users',count(distinct b.user_id))
  from base b where b.email is not null group by b.email,b.residence_id having count(distinct b.user_id)>1
  union all
  select 'warning','shared_phone','contact',min(b.application_id::text)::uuid,min(b.user_id::text)::uuid,b.residence_id,'phone','Multiple applicant accounts share the same phone number in this residence','Verify that the shared contact number is intentional',false,jsonb_build_object('phone',b.phone,'users',count(distinct b.user_id))
  from base b where b.phone is not null group by b.phone,b.residence_id having count(distinct b.user_id)>1
  union all
  select case when _mode='document_handover' then 'error' else 'warning' end,'missing_id_document','documents',b.application_id,b.user_id,b.residence_id,'documents','No ID document is stored for this applicant','Upload an ID/passport copy before a document handover pack',false,'{}'::jsonb
  from base b left join docs d on d.user_id=b.user_id where coalesce(d.has_id_doc,false)=false
  union all
  select case when _mode='document_handover' then 'error' else 'warning' end,'missing_registration_document','documents',b.application_id,b.user_id,b.residence_id,'documents','No registration/student proof is stored for this applicant','Upload proof of registration/student card when applicable',false,'{}'::jsonb
  from base b left join docs d on d.user_id=b.user_id where coalesce(d.has_registration_doc,false)=false and coalesce(b.applicant_stage,'') not in ('matriculant','private_applicant')
)
select * from issues;
$$;
revoke all on function public.handover_integrity_issue_rows_internal(uuid,text) from public;

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

  select coalesce(jsonb_object_agg(code,cnt),'{}'::jsonb) into _issue_counts from (select code,count(*)::int cnt from public.handover_integrity_issue_rows_internal(_residence_id,_mode) group by code order by code) s;

  select encode(digest(coalesce(string_agg(concat_ws('|',v.application_id,v.user_id,v.residence_id,v.full_name,v.student_surname,v.student_number,v.identity_number,v.funding_source,v.email,v.phone,v.campus,v.course,v.status,v.application_date), E'\n' order by v.residence_id,v.application_id),''),'sha256'),'hex')
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
