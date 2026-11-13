-- Complete independent ResKonnect eligibility assessment so a case can be declined without forcing landlord delegation.
-- A factual reason is required and every action is independently audited.
-- Extend God Mode bulk processing to final application sign-off and audited negative decisions.
-- These routines replace only their definitions; all required RLS/MFA and table triggers remain intact.
create or replace function reskonnect_internal.rk_case_action_check(p_kind text,p_case_id uuid,p_action text,p_note text default '')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_status text;v_residence uuid;v_user uuid;v_stage text;v_eligibility text;
 v_docs jsonb;v_reason text:=null;v_final boolean;
begin
 if p_kind='application' then
  select status,residence_id,user_id into v_status,v_residence,v_user from public.applications where id=p_case_id;
 elsif p_kind='reservation' then
  select status,residence_id,user_id into v_status,v_residence,v_user from public.accommodation_reservations where id=p_case_id;
 elsif p_kind='wil' then
  select status,null::uuid,student_id into v_status,v_residence,v_user from public.wil_applications where id=p_case_id;
 else return jsonb_build_object('ok',false,'reason','Unknown case type');end if;
 if not found then return jsonb_build_object('ok',false,'reason','Case no longer exists');end if;
 select stage,eligibility_decision into v_stage,v_eligibility from public.rk_case_workflows where kind=p_kind and case_id=p_case_id;
 v_stage:=coalesce(v_stage,'untriaged');
 v_docs:=reskonnect_internal.rk_case_document_readiness(p_kind,p_case_id);
 v_final:=v_stage='closed' or
   (p_kind='reservation' and v_status in ('confirmed','cancelled')) or
   (p_kind='application' and v_status in ('approved','rejected','withdrawn')) or
   (p_kind='wil' and v_status in ('approved','rejected','placed','completed','cancelled'));
 if p_action not in ('acknowledge_received','start_review','request_documents','delegate_review','mark_eligible','mark_ineligible','approve_handover','confirm_reservation','approve_application','reject_application','cancel_reservation','internal_note','mark_follow_up') then
  v_reason:='Unsupported action';
 elsif v_final and p_action not in ('internal_note','mark_follow_up') then
  v_reason:='Finalised cases cannot be bulk-retroactively advanced';
 elsif p_action in ('request_documents','internal_note','mark_follow_up','mark_eligible','mark_ineligible','reject_application','cancel_reservation') and length(btrim(coalesce(p_note,'')))<8 then
  v_reason:='Provide a factual internal note of at least eight characters';
 elsif p_action='delegate_review' then
  if p_kind='wil' then v_reason:='WIL is managed by its own assigned team';
  elsif v_residence is null then v_reason:='Residence assignment is missing';
  elsif not exists(select 1 from public.residence_portal_accounts where residence_id=v_residence and is_active=true and user_id is not null)
    then v_reason:='Residence has no active authenticated portal owner';
  elsif v_stage in ('landlord_review','handover_approved')
    then v_reason:='This case has already been delegated or handed over';
  end if;
 elsif p_action in ('mark_eligible','mark_ineligible') then
  if p_kind='wil' then v_reason:='WIL approval must follow the WIL placement workflow';
  elsif v_stage='landlord_review' and exists(select 1 from public.rk_case_tasks where kind=p_kind and case_id=p_case_id and task_type='eligibility_review' and status='open')
    then v_reason:='Complete the delegated landlord review before overriding its assessment';
  end if;
 elsif p_action='approve_handover' then
  if p_kind='wil' then v_reason:='WIL placements have a separate approval workflow';
  elsif v_eligibility is distinct from 'eligible' then v_reason:='A completed positive eligibility assessment is required';
  elsif coalesce((v_docs->>'ready')::boolean,false) is not true then v_reason:='Required verified identity, academic and funding evidence is missing';
  elsif exists(select 1 from public.rk_case_tasks where kind=p_kind and case_id=p_case_id and task_type='eligibility_review' and status='open')
   then v_reason:='Landlord eligibility review is still open';
  end if;
 elsif p_action='approve_application' then
  if p_kind<>'application' then v_reason:='Only accommodation applications can be approved';
  elsif v_stage<>'handover_approved' then v_reason:='ResKonnect-approved handover is compulsory';
  elsif v_eligibility is distinct from 'eligible' then v_reason:='Positive eligibility assessment is missing';
  elsif coalesce((v_docs->>'ready')::boolean,false) is not true then v_reason:='Identity, academic and funding documents are not all verified';
  end if;
 elsif p_action='reject_application' then
  if p_kind<>'application' then v_reason:='Only applications can be rejected';
  elsif v_eligibility is distinct from 'ineligible' then v_reason:='A recorded ineligible assessment must precede formal rejection';
  end if;
 elsif p_action='cancel_reservation' then
  if p_kind<>'reservation' then v_reason:='Only reservations can be cancelled';end if;
 elsif p_action='confirm_reservation' then
  if p_kind<>'reservation' then v_reason:='Only reservations can be confirmed';
  elsif v_stage<>'handover_approved' then v_reason:='ResKonnect handover sign-off is required';
  elsif v_eligibility is distinct from 'eligible' then v_reason:='Eligibility approval is missing';
  elsif coalesce((v_docs->>'ready')::boolean,false) is not true then v_reason:='Required documents have not been verified';
  elsif not exists(select 1 from public.accommodation_reservations r
    join public.resmap_room_holds h on h.id=r.room_hold_id
    join public.resmap_rooms rm on rm.id=r.room_id
    where r.id=p_case_id and h.status='active' and h.expires_at>now()
      and h.user_id=r.user_id and h.residence_id=r.residence_id and h.room_id=r.room_id
      and rm.is_verified=true and rm.reservable=true and rm.is_published=true
      and rm.inventory_kind='physical_room')
   then v_reason:='A valid verified physical room and active hold are required';
  end if;
 elsif p_action='acknowledge_received' and v_stage not in ('untriaged','received') then
  v_reason:='The case has already progressed past receipt';
 elsif p_action='start_review' and v_stage in ('landlord_review','ready_for_handover','handover_approved') then
  v_reason:='This case is already in a later review stage';
 end if;
 return jsonb_build_object('ok',v_reason is null,'reason',v_reason,'id',p_case_id,
   'kind',p_kind,'status',v_status,'stage',v_stage,'residence_id',v_residence,
   'document_readiness',v_docs,'eligibility_decision',v_eligibility);
end $$;
revoke all on function reskonnect_internal.rk_case_action_check(text,uuid,text,text) from public,anon,authenticated;


create or replace function public.rk_case_bulk_apply(
 p_kind text,p_ids uuid[],p_action text,p_note text,p_expected jsonb,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_case jsonb;v_old_status text;v_old_stage text;v_new_status text;v_new_stage text;
 v_residence uuid;v_student uuid;v_items jsonb:='[]'::jsonb;v_updated integer:=0;
 v_note text:=btrim(coalesce(p_note,''));v_actor uuid:=auth.uid();v_assigned boolean;
begin
 if not reskonnect_internal.rk_godmode_authorized() then raise exception 'God Mode admin MFA required' using errcode='42501';end if;
 if p_operation_id is null or jsonb_typeof(p_expected)<>'object' or
    p_kind not in ('application','reservation','wil') or
    coalesce(array_length(p_ids,1),0) not between 1 and 75 or
    (select count(distinct x) from unnest(p_ids) as x)<>array_length(p_ids,1) then
  raise exception 'Invalid confirmed bulk operation' using errcode='22023';end if;
 foreach v_id in array p_ids loop
  begin
   if not (p_expected ? v_id::text) then raise exception 'A fresh case preview is required';end if;
   -- Underlying case rows are locked before comparison and transition.
   if p_kind='application' then
    select status,residence_id,user_id into v_old_status,v_residence,v_student from public.applications where id=v_id for update;
   elsif p_kind='reservation' then
    select status,residence_id,user_id into v_old_status,v_residence,v_student from public.accommodation_reservations where id=v_id for update;
   else
    select status,null::uuid,student_id into v_old_status,v_residence,v_student from public.wil_applications where id=v_id for update;
   end if;
   if not found then raise exception 'Case no longer exists';end if;
   select stage into v_old_stage from public.rk_case_workflows where kind=p_kind and case_id=v_id for update;
   v_old_stage:=coalesce(v_old_stage,'untriaged');
   if coalesce(p_expected->(v_id::text)->>'status','') is distinct from coalesce(v_old_status,'') or
      coalesce(p_expected->(v_id::text)->>'stage','')<>v_old_stage then
    raise exception 'Case status or review stage changed. Refresh the preview';
   end if;
   if exists(select 1 from public.rk_case_operation_audit
     where actor_user_id=v_actor and operation_id=p_operation_id and kind=p_kind and case_id=v_id)
     then raise exception 'This operation was already applied to this case';end if;
   v_case:=reskonnect_internal.rk_case_action_check(p_kind,v_id,p_action,v_note);
   if not coalesce((v_case->>'ok')::boolean,false) then raise exception '%',coalesce(v_case->>'reason','Not eligible');end if;
   insert into public.rk_case_workflows(kind,case_id,residence_id,student_id,stage,updated_by)
    values(p_kind,v_id,v_residence,v_student,'received',v_actor)
    on conflict(kind,case_id) do nothing;
   if p_action='acknowledge_received' then
    update public.rk_case_workflows set stage='received',updated_at=now(),updated_by=v_actor where kind=p_kind and case_id=v_id;
   elsif p_action='start_review' then
    update public.rk_case_workflows set stage='under_review',updated_at=now(),updated_by=v_actor where kind=p_kind and case_id=v_id;
    if p_kind='application' and v_old_status in ('submitted','pending') then
      update public.applications set status='under_review' where id=v_id;end if;
   elsif p_action='request_documents' then
    update public.rk_case_workflows set stage='documents_required',updated_at=now(),updated_by=v_actor where kind=p_kind and case_id=v_id;
    if p_kind='application' and v_old_status in ('submitted','pending','under_review') then
      update public.applications set status='documents_required' where id=v_id;end if;
    insert into public.rk_case_tasks(kind,case_id,residence_id,assigned_scope,task_type,summary,assigned_by)
     values(p_kind,v_id,v_residence,'reskonnect','document_followup','Follow up on outstanding evidence',v_actor)
     on conflict(kind,case_id,assigned_scope,task_type) where status='open' do nothing;
   elsif p_action='delegate_review' then
    update public.rk_case_workflows set stage='landlord_review',delegated_at=now(),
     eligibility_decision=null,review_source=null,review_completed_at=null,
     handover_approved_at=null,handover_approved_by=null,updated_at=now(),updated_by=v_actor
     where kind=p_kind and case_id=v_id;
    insert into public.rk_case_tasks(kind,case_id,residence_id,assigned_scope,task_type,summary,assigned_by)
     values(p_kind,v_id,v_residence,'landlord','eligibility_review','Assess student profile and eligibility; do not confirm placement',v_actor)
     on conflict(kind,case_id,assigned_scope,task_type) where status='open' do nothing;
    -- Private task notification only: no applicant PII or documents in notification metadata.
    insert into public.notifications(user_id,type,title,message,metadata,is_read)
     select rpa.user_id,'residence_eligibility_task','New student eligibility task',
      'ResKonnect assigned an eligibility assessment to your residence. Open your Property OS task queue.',
      jsonb_build_object('case_id',v_id,'kind',p_kind,'residence_id',v_residence),false
     from public.residence_portal_accounts rpa
     where rpa.residence_id=v_residence and rpa.is_active=true and rpa.user_id is not null;
   elsif p_action='mark_eligible' then
    update public.rk_case_workflows set stage='ready_for_handover',eligibility_decision='eligible',
     review_source='reskonnect',review_completed_at=now(),updated_at=now(),updated_by=v_actor
     where kind=p_kind and case_id=v_id;
   elsif p_action='mark_ineligible' then
    update public.rk_case_workflows set stage='under_review',eligibility_decision='ineligible',
     review_source='reskonnect',review_completed_at=now(),
     handover_approved_at=null,handover_approved_by=null,updated_at=now(),updated_by=v_actor
     where kind=p_kind and case_id=v_id;
    insert into public.rk_case_collaboration(kind,case_id,residence_id,sender_id,visibility,message)
      values(p_kind,v_id,v_residence,v_actor,'reskonnect_only','Eligibility assessment: '||left(v_note,500));
   elsif p_action='approve_handover' then
    update public.rk_case_workflows set stage='handover_approved',handover_approved_by=v_actor,
     handover_approved_at=now(),updated_at=now(),updated_by=v_actor where kind=p_kind and case_id=v_id;
    update public.rk_case_tasks set status='completed',completed_at=now(),completed_by=v_actor,updated_at=now()
     where kind=p_kind and case_id=v_id and task_type='handover_signoff' and status='open';
   elsif p_action='confirm_reservation' then
    update public.accommodation_reservations set status='confirmed' where id=v_id;
   elsif p_action='approve_application' then
    update public.applications set status='approved' where id=v_id;
   elsif p_action='reject_application' then
    update public.applications set status='rejected' where id=v_id;
    update public.rk_case_workflows set stage='closed',updated_at=now(),updated_by=v_actor where kind=p_kind and case_id=v_id;
   elsif p_action='cancel_reservation' then
    update public.accommodation_reservations set status='cancelled' where id=v_id;
    update public.rk_case_workflows set stage='closed',updated_at=now(),updated_by=v_actor where kind=p_kind and case_id=v_id;
   elsif p_action='mark_follow_up' then
    insert into public.rk_case_tasks(kind,case_id,residence_id,assigned_scope,task_type,summary,assigned_by)
     values(p_kind,v_id,v_residence,'reskonnect','case_followup',left(v_note,240),v_actor)
     on conflict(kind,case_id,assigned_scope,task_type) where status='open' do nothing;
   elsif p_action='internal_note' then
    insert into public.rk_case_collaboration(kind,case_id,residence_id,sender_id,visibility,message)
      values(p_kind,v_id,v_residence,v_actor,'reskonnect_only',left(v_note,2000));
   end if;
   if p_action in ('acknowledge_received','start_review','request_documents') and v_student is not null then
    insert into public.notifications(user_id,type,title,message,metadata,is_read)
     values(v_student,'reskonnect_case_update','ResKonnect case update',
       case p_action when 'acknowledge_received' then 'We received your '||p_kind||'. Eligibility and documents are not yet approved.'
        when 'start_review' then 'Your '||p_kind||' is under review. This is not a reservation confirmation or final decision.'
        else 'Additional information is needed for your '||p_kind||'. Please check your ResKonnect account.' end,
       jsonb_build_object('case_id',v_id,'kind',p_kind,'action',p_action),false);
   end if;
   select stage into v_new_stage from public.rk_case_workflows where kind=p_kind and case_id=v_id;
   if p_kind='application' then select status into v_new_status from public.applications where id=v_id;
   elsif p_kind='reservation' then select status into v_new_status from public.accommodation_reservations where id=v_id;
   else select status into v_new_status from public.wil_applications where id=v_id;end if;
   insert into public.rk_case_operation_audit(operation_id,actor_user_id,kind,case_id,action,old_stage,new_stage,old_status,new_status,detail)
     values(p_operation_id,v_actor,p_kind,v_id,p_action,v_old_stage,v_new_stage,v_old_status,v_new_status,
       jsonb_build_object('note',left(v_note,500),'verified_docs_ready',coalesce((v_case->'document_readiness'->>'ready')::boolean,false)));
   v_updated:=v_updated+1;
   v_items:=v_items||jsonb_build_array(jsonb_build_object('id',v_id,'ok',true,'stage',v_new_stage,'status',v_new_status));
  exception when others then
   v_items:=v_items||jsonb_build_array(jsonb_build_object('id',v_id,'ok',false,'reason',left(sqlerrm,230)));
  end;
 end loop;
 return jsonb_build_object('requested',array_length(p_ids,1),'applied',v_updated,
   'skipped',array_length(p_ids,1)-v_updated,'items',v_items,'emails_sent',0,
   'message','In-app status updates only. External Gmail and WhatsApp use separate supervised actions.');
end $$;
revoke all on function public.rk_case_bulk_apply(text,uuid[],text,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.rk_case_bulk_apply(text,uuid[],text,text,jsonb,uuid) to authenticated;

-- One typed queue for ResKonnect case operators; delegated landlord cases are filtered server-side.
