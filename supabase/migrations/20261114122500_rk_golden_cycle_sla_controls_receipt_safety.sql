-- Make first-touch resilient to downstream notification outages.
-- Let the solo operator configure future SLA targets directly in God Mode.
create or replace function reskonnect_internal.rk_golden_sync(p_kind text,p_id uuid,p_new boolean default false)
returns void language plpgsql security definer set search_path='' as $fn$
declare
 v_status text; v_user uuid;v_residence uuid;v_born timestamptz;v_changed timestamptz;
 v_moved boolean:=false; v_action text;v_step text:='received';v_complete boolean:=false;
 v_priority text:='normal';v_first int;v_follow int;v_new_row boolean:=false;
begin
 if p_kind='application' then
  select a.status,a.user_id,a.residence_id,a.created_at,a.updated_at,coalesce(a.moved_in,false)
  into v_status,v_user,v_residence,v_born,v_changed,v_moved from public.applications a where a.id=p_id;
 elsif p_kind='reservation' then
  select a.status,a.user_id,a.residence_id,a.created_at,a.updated_at
  into v_status,v_user,v_residence,v_born,v_changed from public.accommodation_reservations a where a.id=p_id;
 elsif p_kind='viewing' then
  select a.status,a.user_id,a.residence_id,a.created_at,a.updated_at
  into v_status,v_user,v_residence,v_born,v_changed from public.viewing_requests a where a.id=p_id;
 elsif p_kind='enquiry' then
  select a.stage,a.user_id,a.residence_id,a.created_at,a.updated_at
  into v_status,v_user,v_residence,v_born,v_changed from public.residence_leads a
  where a.id=p_id and a.source_type in('manual','demand');
 elsif p_kind='onboarding' then
  select a.status,a.user_id,a.created_at,a.updated_at
  into v_status,v_user,v_born,v_changed from public.onboarding_requests a where a.id=p_id;
 elsif p_kind='application_support' then
  select a.status,a.user_id,a.created_at,a.updated_at
  into v_status,v_user,v_born,v_changed from public.application_support_queries a where a.id=p_id;
 elsif p_kind='private_rental' then
  select a.status,a.user_id,a.created_at,a.updated_at
  into v_status,v_user,v_born,v_changed from public.private_rental_requests a where a.id=p_id;
 elsif p_kind='student_support' then
  select a.status,a.user_id,a.created_at,a.updated_at
  into v_status,v_user,v_born,v_changed from public.student_requests a where a.id=p_id;
 elsif p_kind='wil' then
  select a.status,a.student_id,a.created_at,a.updated_at
  into v_status,v_user,v_born,v_changed from public.wil_applications a where a.id=p_id;
 elsif p_kind='landlord' then
  select a.status,a.created_at,a.updated_at into v_status,v_born,v_changed
  from public.landlord_applications a where a.id=p_id;
 elsif p_kind='partner' then
  select a.status,a.user_id,a.created_at,a.updated_at into v_status,v_user,v_born,v_changed
  from public.partner_leads a where a.id=p_id;
 else return;
 end if;
 if v_born is null then return;end if;
 select first_response_minutes,followup_minutes into v_first,v_follow
 from public.rk_golden_service_rules where kind=p_kind and enabled=true;
 if not found then return;end if;
 v_status:=lower(coalesce(v_status,'new'));
 v_complete:=v_status in('rejected','withdrawn','cancelled','closed','resolved','completed','lost','no_show')
  or (p_kind='application' and v_status in('approved','moved_in') and v_moved)
  or (p_kind='enquiry' and v_status='placed')
  or (p_kind='viewing' and v_status='completed');
 v_action:=case
  when v_complete then 'service_closed'
  when p_kind='application' then
    case when v_status='approved' then 'verify_move_in_and_satisfaction'
     when v_status='documents_required' then 'guide_document_upload'
     when v_status='under_review' then 'verify_documents_and_eligibility'
     else 'triage_student_application' end
  when p_kind='reservation' then
    case when v_status='confirmed' then 'check_move_in_and_satisfaction'
     when v_status='provisional_hold' then 'verify_room_hold_and_documents'
     when v_status='contacted' then 'follow_up_with_student'
     else 'acknowledge_and_triage_reservation' end
  when p_kind='wil' then
    case when v_status in('placed','approved') then 'check_wil_start_and_student_support'
     else 'qualify_wil_eligibility_and_partner_match' end
  when p_kind='viewing' then 'confirm_property_viewing'
  when p_kind='enquiry' then 'answer_residence_enquiry'
  when p_kind='onboarding' then 'route_persona_to_service'
  when p_kind='application_support' then 'review_institution_admission_readiness'
  when p_kind='private_rental' then 'source_safe_rental_match'
  when p_kind='student_support' then 'respond_to_support_request'
  when p_kind='landlord' then 'verify_landlord_property_onboarding'
  when p_kind='partner' then 'qualify_partner_and_agree_next_step'
  else 'review_case' end;
 if not v_complete and (v_status in('approved','confirmed','placed','converted') or
   (p_kind='application' and v_status='moved_in')) then v_step:='post_service';end if;
 if p_kind in('reservation','student_support','viewing','enquiry') then v_priority:='high';end if;
 if v_complete then v_step:='closed';end if;
 insert into public.rk_golden_service_cases
 (kind,source_id,user_id,residence_id,source_status,step,next_action,priority,
 first_response_due_at,next_action_due_at,closed_at,source_created_at,source_updated_at)
 values(p_kind,p_id,v_user,v_residence,v_status,v_step,v_action,v_priority,
 v_born+make_interval(mins=>v_first),
 case when v_born<now()-interval '30 days' then now()-interval '1 minute'
 else v_born+make_interval(mins=>v_follow) end,
 case when v_complete then now() else null end,
 v_born,coalesce(v_changed,v_born))
 on conflict(kind,source_id) do update set
 user_id=excluded.user_id,residence_id=excluded.residence_id,source_status=excluded.source_status,
 source_updated_at=excluded.source_updated_at,updated_at=now(),
 next_action=case when public.rk_golden_service_cases.source_status is distinct from excluded.source_status
  then excluded.next_action else public.rk_golden_service_cases.next_action end,
 step=case when excluded.step='closed' then 'closed'
  when public.rk_golden_service_cases.step='closed' and excluded.source_status is distinct from public.rk_golden_service_cases.source_status
   then excluded.step
  when excluded.step='post_service' and public.rk_golden_service_cases.step='received' then 'post_service'
  else public.rk_golden_service_cases.step end,
 closed_at=case when excluded.step='closed' then coalesce(public.rk_golden_service_cases.closed_at,now())
  when public.rk_golden_service_cases.step='closed' and excluded.source_status is distinct from public.rk_golden_service_cases.source_status then null
  else public.rk_golden_service_cases.closed_at end;
 if p_new and v_user is not null then
  -- Delivery of the app receipt must NEVER block a student's actual application.
  -- Failure is recorded as an internal recovery task; no fake delivery is marked.
  begin
  insert into public.notifications(user_id,type,title,message,metadata,is_read,event_key)
  select v_user,'service_received','Your ResKonnect request is recorded',
   'Your request is in your ResKonnect service queue. Track its progress under My Service; further information may still be required.',
   jsonb_build_object('kind',p_kind,'source_id',p_id),false,'rk_golden_received_'||p_kind||'_'||p_id::text
  where not exists(select 1 from public.notifications
   where user_id=v_user and event_key='rk_golden_received_'||p_kind||'_'||p_id::text);
  update public.rk_golden_service_cases set receipt_issued_at=coalesce(receipt_issued_at,now())
  where kind=p_kind and source_id=p_id;
  exception when others then
   insert into public.rk_golden_service_events(kind,source_id,event_type,note)
   values(p_kind,p_id,'receipt_delivery_failed',
    left('In-app receipt was NOT delivered. Follow-up needed: '||sqlerrm,500));
  end;
 end if;
end $fn$;

revoke all on function reskonnect_internal.rk_golden_sync(text,uuid,boolean) from PUBLIC,anon,authenticated;

create table if not exists public.rk_golden_service_rule_audit(
 id bigint generated always as identity primary key,
 kind text not null,
 actor_id uuid not null,
 previous_first_response integer not null,
 previous_followup integer not null,
 next_first_response integer not null,
 next_followup integer not null,
 changed_at timestamptz not null default now()
);
alter table public.rk_golden_service_rule_audit enable row level security;
revoke all on public.rk_golden_service_rule_audit from PUBLIC,anon,authenticated;
grant all on public.rk_golden_service_rule_audit to service_role;

create or replace function public.rk_golden_service_rules_list()
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare r jsonb;
begin
 if not reskonnect_internal.rk_godmode_authorized() then
  raise exception 'God Mode MFA required' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('kind',kind,
 'first_response_minutes',first_response_minutes,'followup_minutes',followup_minutes)
 order by kind),'[]'::jsonb) into r from public.rk_golden_service_rules;
 return r;
end $fn$;
revoke all on function public.rk_golden_service_rules_list() from PUBLIC,anon,authenticated;
grant execute on function public.rk_golden_service_rules_list() to authenticated;

create or replace function public.rk_golden_service_rule_update(
 p_kind text,p_first_minutes integer,p_followup_minutes integer)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare previous public.rk_golden_service_rules%rowtype;
begin
 if not reskonnect_internal.rk_godmode_authorized() then
  raise exception 'God Mode MFA required' using errcode='42501';end if;
 if p_first_minutes not between 15 and 4320 or p_followup_minutes not between 60 and 20160 then
  raise exception 'First response must be 15 minutes–72 hours; follow-up 1–336 hours';end if;
 select * into previous from public.rk_golden_service_rules where kind=p_kind for update;
 if not found then raise exception 'Service type not found';end if;
 if previous.first_response_minutes is distinct from p_first_minutes
    or previous.followup_minutes is distinct from p_followup_minutes then
  update public.rk_golden_service_rules set first_response_minutes=p_first_minutes,
    followup_minutes=p_followup_minutes,updated_at=now() where kind=p_kind;
  insert into public.rk_golden_service_rule_audit(kind,actor_id,
    previous_first_response,previous_followup,next_first_response,next_followup)
  values(p_kind,auth.uid(),previous.first_response_minutes,previous.followup_minutes,
   p_first_minutes,p_followup_minutes);
 end if;
 return jsonb_build_object('ok',true,'kind',p_kind,
  'message','SLA targets updated for NEW service requests only. Existing due dates are preserved.');
end $fn$;
revoke all on function public.rk_golden_service_rule_update(text,integer,integer) from PUBLIC,anon,authenticated;
grant execute on function public.rk_golden_service_rule_update(text,integer,integer) to authenticated;

-- Outstanding low ratings, not all historical negative ratings, count as recovery tasks.
create or replace function public.rk_golden_service_queue(
 p_filter text default 'all', p_kind text default null,p_limit integer default 80,p_offset integer default 0
) returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare result jsonb;
begin
 if not reskonnect_internal.rk_godmode_authorized() then
  raise exception 'God Mode with verified MFA required' using errcode='42501';end if;
 if p_filter not in('all','overdue','needs_reply','waiting','post_service','closed')
 or p_limit not between 1 and 120 or p_offset not between 0 and 100000 then
  raise exception 'Invalid queue filters' using errcode='22023';end if;
 if p_kind is not null and not exists(select 1 from public.rk_golden_service_rules where kind=p_kind)
 then raise exception 'Unsupported service category' using errcode='22023';end if;
 with base as(
  select c.*,r.first_response_minutes,
   (c.closed_at is null and (c.snoozed_until is null or c.snoozed_until<=now())
      and ((c.last_human_response_at is null and c.first_response_due_at<now())
       or c.next_action_due_at<now())) as overdue,
   (c.closed_at is null and c.last_human_response_at is null) as needs_reply
  from public.rk_golden_service_cases c join public.rk_golden_service_rules r on r.kind=c.kind
  where p_kind is null or c.kind=p_kind
 ), subset as(
  select * from base where
  (p_filter='all' and closed_at is null)
  or (p_filter='overdue' and overdue)
  or (p_filter='needs_reply' and needs_reply)
  or (p_filter='waiting' and closed_at is null and step in('awaiting_customer','awaiting_residence','awaiting_partner'))
  or (p_filter='post_service' and closed_at is null and step='post_service')
  or (p_filter='closed' and closed_at is not null)
  order by
   case when overdue then 0 else 1 end,
   case priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,
   case when last_human_response_at is null then first_response_due_at else next_action_due_at end asc
  limit p_limit offset p_offset
 ), rendered as(
  select q.kind,q.source_id as id,q.source_status as status,q.step,q.next_action,q.priority,
   q.first_response_due_at,q.next_action_due_at,q.last_human_response_at,q.last_human_channel,
   q.receipt_issued_at,q.snoozed_until,q.first_breach_at,q.closed_at,q.updated_at,
   q.source_created_at,q.overdue,q.needs_reply,
   (select f.rating from public.rk_golden_service_feedback f where f.kind=q.kind and f.source_id=q.source_id and f.user_id=q.user_id) as feedback_rating,
   coalesce(nullif(p.full_name,''),
    case q.kind when 'wil' then (select w.full_name from public.wil_applications w where w.id=q.source_id)
     when 'landlord' then (select l.property_name from public.landlord_applications l where l.id=q.source_id)
     when 'partner' then (select x.organisation_name from public.partner_leads x where x.id=q.source_id)
     when 'onboarding' then (select o.full_name from public.onboarding_requests o where o.id=q.source_id)
     when 'application_support' then (select a.full_name from public.application_support_queries a where a.id=q.source_id)
     when 'private_rental' then (select a.full_name from public.private_rental_requests a where a.id=q.source_id)
     when 'enquiry' then (select e.contact_name from public.residence_leads e where e.id=q.source_id)
     when 'viewing' then (select v.contact_name from public.viewing_requests v where v.id=q.source_id)
    end,'Service customer') as customer,
   coalesce(res.name,'') as residence_name,
   (q.kind in('application','reservation') and exists(
     select 1 from public.rk_case_tasks t where t.kind=q.kind and t.case_id=q.source_id
       and t.assigned_scope='landlord' and t.task_type='eligibility_review' and t.status='open'
   )) as delegated_review_open
  from subset q left join public.profiles p on p.id=q.user_id
    left join public.residences res on res.id=q.residence_id
 )
 select jsonb_build_object(
  'metrics',(select jsonb_build_object(
    'total',count(*),
    'open',count(*) filter(where closed_at is null),
    'overdue',count(*) filter(where overdue),
    'unanswered',count(*) filter(where needs_reply),
    'waiting',count(*) filter(where closed_at is null and step in('awaiting_customer','awaiting_residence','awaiting_partner')),
    'post_service',count(*) filter(where closed_at is null and step='post_service'),
    'replied_today',count(*) filter(where last_human_response_at>=current_date),
    'feedback_count',(select count(*) from public.rk_golden_service_feedback),
    'feedback_average',(select round(avg(rating)::numeric,1) from public.rk_golden_service_feedback),
    'needs_recovery',(select count(*) from public.rk_golden_service_feedback f
     join public.rk_golden_service_cases c on c.kind=f.kind and c.source_id=f.source_id
     where f.rating<=2 and c.closed_at is null and c.next_action='recover_unhappy_customer')
   ) from base),
  'items',coalesce((select jsonb_agg(to_jsonb(rendered)) from rendered),'[]'::jsonb)
 ) into result;
 return result;
end $fn$;
revoke all on function public.rk_golden_service_queue(text,text,integer,integer) from PUBLIC,anon,authenticated;
grant execute on function public.rk_golden_service_queue(text,text,integer,integer) to authenticated;



