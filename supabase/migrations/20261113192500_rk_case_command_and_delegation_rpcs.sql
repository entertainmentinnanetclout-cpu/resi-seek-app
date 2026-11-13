-- Command center: explicit God Mode preview/apply and narrowly scoped residence delegation.
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
 if p_action not in ('acknowledge_received','start_review','request_documents','delegate_review','mark_eligible','approve_handover','confirm_reservation','internal_note','mark_follow_up') then
  v_reason:='Unsupported action';
 elsif v_final and p_action not in ('internal_note','mark_follow_up') then
  v_reason:='Finalised cases cannot be bulk-retroactively advanced';
 elsif p_action in ('request_documents','internal_note','mark_follow_up') and length(btrim(coalesce(p_note,'')))<8 then
  v_reason:='Provide a factual internal note of at least eight characters';
 elsif p_action='delegate_review' then
  if p_kind='wil' then v_reason:='WIL is managed by its own assigned team';
  elsif v_residence is null then v_reason:='Residence assignment is missing';
  elsif not exists(select 1 from public.residence_portal_accounts where residence_id=v_residence and is_active=true and user_id is not null)
    then v_reason:='Residence has no active authenticated portal owner';
  elsif v_stage in ('landlord_review','handover_approved')
    then v_reason:='This case has already been delegated or handed over';
  end if;
 elsif p_action='mark_eligible' then
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

create or replace function public.rk_case_bulk_preview(p_kind text,p_ids uuid[],p_action text,p_note text default '')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_id uuid;v_items jsonb:='[]'::jsonb;v_r jsonb;v_eligible integer:=0;
begin
 if not reskonnect_internal.rk_godmode_authorized() then raise exception 'God Mode admin MFA required' using errcode='42501';end if;
 if p_kind not in ('application','reservation','wil') or
    coalesce(array_length(p_ids,1),0) not between 1 and 75 or
    (select count(distinct x) from unnest(p_ids) as x)<>array_length(p_ids,1) then
  raise exception 'Select 1–75 distinct cases of a supported type' using errcode='22023';end if;
 foreach v_id in array p_ids loop
  v_r:=reskonnect_internal.rk_case_action_check(p_kind,v_id,p_action,p_note);
  v_items:=v_items||jsonb_build_array(v_r);
  if (v_r->>'ok')::boolean then v_eligible:=v_eligible+1;end if;
 end loop;
 return jsonb_build_object('requested',array_length(p_ids,1),'eligible',v_eligible,'items',v_items,
  'message','Preview is not a decision, external email or placement confirmation.');
end $$;
revoke all on function public.rk_case_bulk_preview(text,uuid[],text,text) from public,anon,authenticated;
grant execute on function public.rk_case_bulk_preview(text,uuid[],text,text) to authenticated;

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
   elsif p_action='mark_eligible' then
    update public.rk_case_workflows set stage='ready_for_handover',eligibility_decision='eligible',
     review_source='reskonnect',review_completed_at=now(),updated_at=now(),updated_by=v_actor
     where kind=p_kind and case_id=v_id;
   elsif p_action='approve_handover' then
    update public.rk_case_workflows set stage='handover_approved',handover_approved_by=v_actor,
     handover_approved_at=now(),updated_at=now(),updated_by=v_actor where kind=p_kind and case_id=v_id;
    update public.rk_case_tasks set status='completed',completed_at=now(),completed_by=v_actor,updated_at=now()
     where kind=p_kind and case_id=v_id and task_type='handover_signoff' and status='open';
   elsif p_action='confirm_reservation' then
    update public.accommodation_reservations set status='confirmed' where id=v_id;
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
create or replace function public.rk_case_queue(p_kind text,p_scope text default 'admin',p_limit integer default 60,p_offset integer default 0,p_stage text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_rows jsonb;v_total integer;v_actor uuid:=auth.uid();
begin
 if p_kind not in ('application','reservation','wil') or p_scope not in ('admin','landlord') or
   p_limit not between 1 and 100 or p_offset not between 0 and 100000 then
  raise exception 'Invalid queue filters' using errcode='22023';end if;
 if p_scope='admin' and not reskonnect_internal.rk_godmode_authorized() then
  raise exception 'God Mode admin MFA required' using errcode='42501';end if;
 if p_scope='landlord' and (v_actor is null or p_kind='wil') then
  raise exception 'Residence work must be assigned to an authorised portal' using errcode='42501';end if;
 with base as(
  select 'application'::text kind,id,coalesce(status,'submitted') status,created_at,residence_id,user_id student_id,coalesce(funding_type,'') funding_type
   from public.applications where p_kind='application'
  union all
  select 'reservation',id,status,created_at,residence_id,user_id,coalesce(funding_type,'')
   from public.accommodation_reservations where p_kind='reservation'
  union all
  select 'wil',id,coalesce(status,'submitted'),created_at,null::uuid,student_id,coalesce(funding_status,'')
   from public.wil_applications where p_kind='wil'
 ), allowed as (
  select b.*,coalesce(w.stage,'untriaged') stage,w.eligibility_decision,w.review_source,w.handover_approved_at,
    w.delegated_at,pr.full_name,pr.student_number,pr.campus,pr.course,
    r.name residence_name,qt.id task_id,qt.status task_status,
    row_number()over(order by b.created_at desc,b.id desc) rn,
    count(*)over() total
  from base b left join public.rk_case_workflows w on w.kind=b.kind and w.case_id=b.id
   left join public.profiles pr on pr.id=b.student_id left join public.residences r on r.id=b.residence_id
   left join lateral (
     select t.id,t.status from public.rk_case_tasks t where t.kind=b.kind and t.case_id=b.id
       and t.assigned_scope='landlord' and t.task_type='eligibility_review'
       order by t.created_at desc limit 1
   ) qt on true
  where (p_stage is null or coalesce(w.stage,'untriaged')=p_stage)
    and (p_scope='admin' or (
      public.is_authorized_residence_user(b.residence_id)
      and (qt.id is not null or w.stage='handover_approved')
    ))
 )
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',id,'kind',kind,'status',status,'stage',stage,'created_at',created_at,
   'residence_id',residence_id,'residence_name',residence_name,'student_name',full_name,
   'student_number',student_number,'campus',campus,'course',course,'funding_type',funding_type,
   'eligibility_decision',eligibility_decision,'review_source',review_source,
   'handover_approved_at',handover_approved_at,'task_id',task_id,'task_status',task_status,
   'document_readiness',case when kind='wil' then jsonb_build_object('ready',false,'reason','WIL document review uses its separate workflow') else reskonnect_internal.rk_case_document_readiness(kind,id) end
 ) order by created_at desc,id desc),'[]'::jsonb),coalesce(max(total),0)
 into v_rows,v_total from allowed where rn>p_offset and rn<=p_offset+p_limit;
 return jsonb_build_object('items',v_rows,'total',v_total,'offset',p_offset,'limit',p_limit);
end $$;
revoke all on function public.rk_case_queue(text,text,integer,integer,text) from public,anon,authenticated;
grant execute on function public.rk_case_queue(text,text,integer,integer,text) to authenticated;

create or replace function public.rk_landlord_review_task(p_task_id uuid,p_decision text,p_note text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_task public.rk_case_tasks%rowtype;v_actor uuid:=auth.uid();v_note text:=btrim(coalesce(p_note,''));
begin
 if v_actor is null or p_task_id is null or p_decision not in ('eligible','ineligible','needs_documents') or length(v_note) not between 8 and 800 then
  raise exception 'Choose a factual eligibility recommendation and an explanation (8–800 characters)' using errcode='22023';end if;
 select * into v_task from public.rk_case_tasks where id=p_task_id for update;
 if not found or v_task.assigned_scope<>'landlord' or v_task.task_type<>'eligibility_review' or v_task.status<>'open' or
   not public.is_authorized_residence_user(v_task.residence_id) then
  raise exception 'This eligibility task is not assigned to your active residence account' using errcode='42501';
 end if;
 update public.rk_case_workflows set
  stage=case when p_decision='eligible' then 'ready_for_handover' when p_decision='needs_documents' then 'documents_required' else 'under_review' end,
  eligibility_decision=p_decision,review_source='landlord',review_completed_at=now(),updated_by=v_actor,updated_at=now()
  where kind=v_task.kind and case_id=v_task.case_id and stage='landlord_review';
 if not found then raise exception 'Case was reassigned or its review stage changed';end if;
 update public.rk_case_tasks set status='completed',completed_by=v_actor,completed_at=now(),updated_at=now() where id=v_task.id;
 insert into public.rk_case_collaboration(kind,case_id,residence_id,sender_id,visibility,message)
  values(v_task.kind,v_task.case_id,v_task.residence_id,v_actor,'shared_with_residence',v_note);
 insert into public.rk_case_tasks(kind,case_id,residence_id,assigned_scope,task_type,summary,assigned_by)
  values(v_task.kind,v_task.case_id,v_task.residence_id,'reskonnect',
   'handover_signoff','ResKonnect decision required: residence recommendation '||p_decision,v_actor)
  on conflict(kind,case_id,assigned_scope,task_type) where status='open' do nothing;
 insert into public.rk_case_operation_audit(operation_id,actor_user_id,kind,case_id,action,new_stage,detail)
  values(gen_random_uuid(),v_actor,v_task.kind,v_task.case_id,'landlord_eligibility_recommendation',
    case when p_decision='eligible' then 'ready_for_handover' when p_decision='needs_documents' then 'documents_required' else 'under_review' end,
    jsonb_build_object('decision',p_decision));
 return jsonb_build_object('saved',true,'decision',p_decision,'case_id',v_task.case_id,
    'message','This is a landlord recommendation. Only ResKonnect can authorise final handover.');
end $$;
revoke all on function public.rk_landlord_review_task(uuid,text,text) from public,anon,authenticated;
grant execute on function public.rk_landlord_review_task(uuid,text,text) to authenticated;

-- Private student eligibility packet; never returns ID numbers, storage paths or file contents.
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
    (v_w.stage in ('landlord_review','ready_for_handover','handover_approved') and v_w.delegated_at is not null)
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

create or replace function public.rk_case_collaboration_list(p_kind text,p_case_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_res uuid;v_access boolean;v_admin boolean:=reskonnect_internal.rk_godmode_authorized();v_rows jsonb;
begin
 select residence_id into v_res from public.rk_case_workflows where kind=p_kind and case_id=p_case_id;
 if not found then raise exception 'Case has no operations workspace';end if;
 v_access:=v_admin or (p_kind<>'wil' and public.is_authorized_residence_user(v_res) and
    exists(select 1 from public.rk_case_tasks where kind=p_kind and case_id=p_case_id and assigned_scope='landlord'));
 if not v_access then raise exception 'Case collaboration is not assigned to your account' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'message',message,'visibility',visibility,'created_at',created_at,'sender_id',sender_id) order by created_at),'[]'::jsonb)
 into v_rows from (select * from public.rk_case_collaboration where kind=p_kind and case_id=p_case_id and (v_admin or visibility='shared_with_residence') order by created_at desc limit 100) m;
 return v_rows;
end $$;
revoke all on function public.rk_case_collaboration_list(text,uuid) from public,anon,authenticated;
grant execute on function public.rk_case_collaboration_list(text,uuid) to authenticated;

create or replace function public.rk_case_collaboration_post(p_kind text,p_case_id uuid,p_message text,p_shared boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_res uuid;v_admin boolean:=reskonnect_internal.rk_godmode_authorized();
 v_actor uuid:=auth.uid();v_msg text:=btrim(coalesce(p_message,''));v_id uuid;
begin
 if length(v_msg) not between 4 and 2000 or v_actor is null then raise exception 'Write 4–2000 characters' using errcode='22023';end if;
 select residence_id into v_res from public.rk_case_workflows where kind=p_kind and case_id=p_case_id;
 if not found then raise exception 'Case is not in the operations workspace';end if;
 if not v_admin and not (p_kind<>'wil' and public.is_authorized_residence_user(v_res) and
     exists(select 1 from public.rk_case_tasks where kind=p_kind and case_id=p_case_id and assigned_scope='landlord'))
 then raise exception 'You cannot post on this case' using errcode='42501';end if;
 insert into public.rk_case_collaboration(kind,case_id,residence_id,sender_id,visibility,message)
 values(p_kind,p_case_id,v_res,v_actor,case when p_shared or not v_admin then 'shared_with_residence' else 'reskonnect_only' end,v_msg)
 returning id into v_id;
 return jsonb_build_object('saved',true,'id',v_id,'external_messages_sent',0);
end $$;
revoke all on function public.rk_case_collaboration_post(text,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.rk_case_collaboration_post(text,uuid,text,boolean) to authenticated;
