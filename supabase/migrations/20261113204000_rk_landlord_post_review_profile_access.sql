-- Keep assigned residence profiles accessible after a recommendation is returned.
-- Ineligible and needs-document recommendations move the workflow back to under_review/documents_required;
-- the assignment continues until ResKonnect closes the handover and access is still scoped to the same residence.
create or replace function public.rk_case_profile_packet(p_kind text,p_case_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_row record;v_profile public.profiles%rowtype;v_w public.rk_case_workflows%rowtype;
 v_docs jsonb;v_access boolean:=false;
begin
 if p_kind not in ('application','reservation') then raise exception 'Choose a residence application or reservation' using errcode='22023';end if;
 if p_kind='application' then
  select id,user_id,residence_id,status,funding_type,academic_year,academic_cycle,student_stage,study_level
   into v_row from public.applications where id=p_case_id;
 else
  select id,user_id,residence_id,status,funding_type,academic_year,academic_cycle,student_stage,study_level
   into v_row from public.accommodation_reservations where id=p_case_id;
 end if;
 if not found then raise exception 'Case was not found';end if;
 select * into v_w from public.rk_case_workflows where kind=p_kind and case_id=p_case_id;
 v_access:=reskonnect_internal.rk_godmode_authorized() or (
   public.is_authorized_residence_user(v_row.residence_id) and
    v_w.delegated_at is not null and
    exists(select 1 from public.rk_case_tasks t where t.kind=p_kind and t.case_id=p_case_id and t.assigned_scope='landlord' and t.task_type='eligibility_review')
 );
 if not v_access then raise exception 'Student eligibility packet has not been delegated to your residence' using errcode='42501';end if;
 select * into v_profile from public.profiles where id=v_row.user_id;
 v_docs:=reskonnect_internal.rk_case_document_readiness(p_kind,p_case_id);
 return jsonb_build_object('case_id',p_case_id,'kind',p_kind,'status',v_row.status,'stage',coalesce(v_w.stage,'untriaged'),
   'student',jsonb_build_object('name',v_profile.full_name,'student_number',v_profile.student_number,
     'campus',v_profile.campus,'course',v_profile.course,'year_of_study',v_profile.year_of_study,
     'academic_year',v_row.academic_year,'cycle',v_row.academic_cycle,'study_level',v_row.study_level,
     'student_stage',v_row.student_stage,'funding_type',v_row.funding_type),
   'document_readiness',v_docs,'landlord_decision',v_w.eligibility_decision,
   'handover_approved_at',v_w.handover_approved_at,
   'contact',case when v_w.handover_approved_at is not null
      then jsonb_build_object('email',v_profile.email,'phone',coalesce(v_profile.phone_e164,v_profile.phone))
      else null end,
   'disclaimer','Profile evidence summary only. Verify actual documents in authorised private document tools; never infer placement from uploaded files.');
end $$;
revoke all on function public.rk_case_profile_packet(text,uuid) from public,anon,authenticated;
grant execute on function public.rk_case_profile_packet(text,uuid) to authenticated;

