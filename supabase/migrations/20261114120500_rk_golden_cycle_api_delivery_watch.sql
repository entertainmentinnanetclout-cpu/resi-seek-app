-- Golden Service Cycle: all service lines remain private; staff control only task coordination.
-- Final application decisions, room confirmations and student documents stay in their verified owners.
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
    'replied_today',count(*) filter(where last_human_response_at>=current_date)
   ) from base),
  'items',coalesce((select jsonb_agg(to_jsonb(rendered)) from rendered),'[]'::jsonb)
 ) into result;
 return result;
end $fn$;
revoke all on function public.rk_golden_service_queue(text,text,integer,integer) from PUBLIC,anon,authenticated;
grant execute on function public.rk_golden_service_queue(text,text,integer,integer) to authenticated;

create or replace function public.rk_golden_case_history(p_kind text,p_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare v_out jsonb;
begin
 if not reskonnect_internal.rk_godmode_authorized() then
  raise exception 'God Mode MFA required' using errcode='42501';end if;
 if not exists(select 1 from public.rk_golden_service_cases where kind=p_kind and source_id=p_id)
 then raise exception 'Case not found' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('event_type',e.event_type,'note',e.note,
  'channel',e.channel,'created_at',e.created_at) order by e.created_at desc),'[]'::jsonb)
 into v_out from (select * from public.rk_golden_service_events
 where kind=p_kind and source_id=p_id order by created_at desc limit 70) e;
 return v_out;
end $fn$;
revoke all on function public.rk_golden_case_history(text,uuid) from PUBLIC,anon,authenticated;
grant execute on function public.rk_golden_case_history(text,uuid) to authenticated;

create or replace function public.rk_golden_service_action(
 p_kind text,p_id uuid,p_action text,p_note text default null,p_due_at timestamptz default null,
 p_channel text default null,p_confirm_sent boolean default false,p_expected_status text default null
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare c public.rk_golden_service_cases%rowtype;
 v_note text:=btrim(coalesce(p_note,''));v_follow integer;v_next text;v_step text;v_actor uuid:=auth.uid();
begin
 if not reskonnect_internal.rk_godmode_authorized() then
  raise exception 'God Mode MFA required' using errcode='42501';end if;
 if p_action not in('begin_review','request_info','waiting_residence','waiting_partner',
  'set_followup','contact_confirmed','complete_cycle','reopen','private_note') then
   raise exception 'Unsupported service task action' using errcode='22023';end if;
 select * into c from public.rk_golden_service_cases
  where kind=p_kind and source_id=p_id for update;
 if not found then raise exception 'Service record not found';end if;
 if p_expected_status is not null and p_expected_status is distinct from c.source_status then
  raise exception 'Business status changed: refresh before applying' using errcode='40001';end if;
 if length(v_note)>1500 then raise exception 'Service note too long';end if;
 if p_action in('request_info','waiting_partner','contact_confirmed','complete_cycle','private_note')
 and length(v_note)<8 then raise exception 'Add a factual note of at least eight characters';end if;
 if c.closed_at is not null and p_action not in('reopen','private_note') then
  raise exception 'This service cycle is closed; reopen it deliberately first';end if;
 select followup_minutes into v_follow from public.rk_golden_service_rules where kind=p_kind;
 v_next:=c.next_action;v_step:=c.step;
 if p_action='begin_review' then
  v_step:='in_review';v_next:='complete_case_assessment';
 elsif p_action='request_info' then
  v_step:='awaiting_customer';v_next:='send_specific_missing_information_request';
 elsif p_action='waiting_residence' then
  if p_kind not in('application','reservation') or not exists(
   select 1 from public.rk_case_tasks t where t.kind=p_kind and t.case_id=p_id
    and t.assigned_scope='landlord' and t.status='open' and t.task_type='eligibility_review')
  then raise exception 'Delegate the actual eligibility task in Case Command Center first';end if;
  v_step:='awaiting_residence';v_next:='monitor_residence_review_and_escalate';
 elsif p_action='waiting_partner' then
  v_step:='awaiting_partner';v_next:='verify_partner_response_and_authorised_handover';
 elsif p_action='set_followup' then
  if p_due_at is null or p_due_at<now()+interval '5 minutes'
     or p_due_at>now()+interval '90 days' then
    raise exception 'Provide a follow-up between five minutes and 90 days';end if;
  v_step:='followup';v_next:='complete_scheduled_followup';
 elsif p_action='contact_confirmed' then
  if p_confirm_sent is distinct from true or p_channel not in('email','whatsapp','phone','in_person') then
   raise exception 'Only record a message or conversation that genuinely happened';end if;
  v_step:=case when c.step='post_service' then 'post_service' else 'followup' end;
  v_next:='confirm_next_customer_step';
 elsif p_action='complete_cycle' then
  if c.source_status not in('approved','confirmed','placed','converted','completed','resolved','closed','cancelled','withdrawn','rejected','moved_in','lost','no_show')
   or length(v_note)<12 then
    raise exception 'Close only a finalised business process with explicit service completion evidence';end if;
  v_step:='closed';v_next:='service_closed';
 elsif p_action='reopen' then
  v_step:='in_review';v_next:='review_customer_reopened_request';
 end if;
 if p_action<>'private_note' then
  update public.rk_golden_service_cases set step=v_step,next_action=v_next,updated_at=now(),
   next_action_due_at=case
    when p_action='set_followup' then p_due_at
    when p_action='contact_confirmed' then now()+make_interval(mins=>coalesce(v_follow,1440))
    when p_action='waiting_residence' then now()+interval '12 hours'
    when p_action in('request_info','waiting_partner') then now()+interval '24 hours'
    when p_action='begin_review' then now()+interval '4 hours'
    when p_action='reopen' then now()+interval '2 hours'
    else next_action_due_at end,
   last_human_response_at=case when p_action='contact_confirmed' then now() else last_human_response_at end,
   last_human_channel=case when p_action='contact_confirmed' then p_channel else last_human_channel end,
   closed_at=case when p_action='complete_cycle' then now() when p_action='reopen' then null else closed_at end,
   snoozed_until=null
  where kind=p_kind and source_id=p_id;
 end if;
 insert into public.rk_golden_service_events(kind,source_id,actor_id,event_type,note,channel,metadata)
 values(p_kind,p_id,v_actor,p_action,nullif(v_note,''),p_channel,
   jsonb_build_object('business_status_unchanged',true,'human_send_attested',p_action='contact_confirmed' and p_confirm_sent));
 return jsonb_build_object('ok',true,'kind',p_kind,'id',p_id,'step',v_step,'next_action',v_next,
  'message','Service coordination recorded; original business status and external messages were not modified.');
end $fn$;
revoke all on function public.rk_golden_service_action(text,uuid,text,text,timestamptz,text,boolean,text) from PUBLIC,anon,authenticated;
grant execute on function public.rk_golden_service_action(text,uuid,text,text,timestamptz,text,boolean,text) to authenticated;

create or replace function public.rk_golden_my_service()
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare v_id uuid:=auth.uid();out_data jsonb;
begin
 if v_id is null then raise exception 'Sign in to see your service journey' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',x.source_id,'kind',x.kind,'status',x.source_status,'step',x.step,
  'next_action',x.next_action,'received_at',x.source_created_at,
  'last_human_response_at',x.last_human_response_at,
  'receipt_recorded',x.receipt_issued_at is not null,
  'closed',x.closed_at is not null) order by x.source_created_at desc),'[]'::jsonb)
 into out_data from (select * from public.rk_golden_service_cases
   where user_id=v_id order by source_created_at desc limit 40) x;
 return jsonb_build_object('items',out_data,
  'notice','A request appearing here is not approval, a confirmed booking, funding or WIL placement. ResKonnect reviews supporting evidence and communicates next steps.');
end $fn$;
revoke all on function public.rk_golden_my_service() from PUBLIC,anon,authenticated;
grant execute on function public.rk_golden_my_service() to authenticated;

-- Human contacts inherit real delivery evidence from the already connected communication dock.
create or replace function reskonnect_internal.rk_golden_delivery_confirmed()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare v_kind text;v_id uuid;v_time timestamptz;v_channel text;v_success boolean;
begin
 if tg_table_name='reskonnect_outbound_emails' then
  v_success:=new.delivery_status='sent' and new.sent_at is not null;
  if tg_op='UPDATE' and old.delivery_status='sent' then return new;end if;
  v_time:=new.sent_at;v_channel:='email';
 else
  v_success:=new.status in('operator_marked_sent','sent') and new.marked_sent_at is not null;
  if tg_op='UPDATE' and old.status in('operator_marked_sent','sent') then return new;end if;
  v_time:=new.marked_sent_at;v_channel:='whatsapp';
 end if;
 v_kind:=new.target_kind;v_id:=new.target_id;
 if not v_success or v_kind not in('application','reservation') then return new;end if;
 update public.rk_golden_service_cases c set
  last_human_response_at=greatest(coalesce(c.last_human_response_at,v_time),v_time),
  last_human_channel=v_channel,
  next_action_due_at=v_time+make_interval(mins=>(select followup_minutes from public.rk_golden_service_rules where kind=v_kind)),
  step=case when c.step in('received','in_review') then 'followup' else c.step end,
  updated_at=now()
 where c.kind=v_kind and c.source_id=v_id and c.closed_at is null;
 return new;
end $fn$;
revoke all on function reskonnect_internal.rk_golden_delivery_confirmed() from PUBLIC,anon,authenticated;
drop trigger if exists zz_rk_golden_email_sent on public.reskonnect_outbound_emails;
create trigger zz_rk_golden_email_sent after insert or update of delivery_status on public.reskonnect_outbound_emails
for each row execute function reskonnect_internal.rk_golden_delivery_confirmed();
drop trigger if exists zz_rk_golden_whatsapp_sent on public.reskonnect_whatsapp_handoffs;
create trigger zz_rk_golden_whatsapp_sent after insert or update of status on public.reskonnect_whatsapp_handoffs
for each row execute function reskonnect_internal.rk_golden_delivery_confirmed();

-- Auto-resolve delegated task waiting only after the residence has actually submitted its recommendation.
create or replace function reskonnect_internal.rk_golden_task_changed()
returns trigger language plpgsql security definer set search_path='' as $fn$
begin
 if new.kind in('application','reservation') and new.task_type='eligibility_review' then
  if new.status='completed' then
   update public.rk_golden_service_cases set step='in_review',
    next_action='review_residence_recommendation_and_approve_handover',
    next_action_due_at=now()+interval '2 hours',updated_at=now()
   where kind=new.kind and source_id=new.case_id and closed_at is null;
  elsif new.status='open' then
   update public.rk_golden_service_cases set step='awaiting_residence',
    next_action='monitor_delegated_eligibility_review',
    next_action_due_at=coalesce(new.due_at,now()+interval '12 hours'),updated_at=now()
   where kind=new.kind and source_id=new.case_id and closed_at is null;
  end if;
 end if;
 return new;
end $fn$;
revoke all on function reskonnect_internal.rk_golden_task_changed() from PUBLIC,anon,authenticated;
drop trigger if exists zz_rk_golden_task_changed on public.rk_case_tasks;
create trigger zz_rk_golden_task_changed after insert or update of status
on public.rk_case_tasks for each row execute function reskonnect_internal.rk_golden_task_changed();

-- Reconcile only verified historical contacts. No email is sent during backfill.
update public.rk_golden_service_cases c set
 last_human_response_at=coalesce(h.last_responded_at,c.last_human_response_at),
 last_human_channel=coalesce(h.last_responded_channel,c.last_human_channel)
from public.reskonnect_case_work_items h
where h.source_kind=c.kind and h.source_id=c.source_id and h.last_responded_at is not null;
with delivered as(
 select target_kind kind,target_id id,max(sent_at) responded
 from public.reskonnect_outbound_emails where delivery_status='sent' and sent_at is not null
 and target_kind in('application','reservation') group by 1,2
)
update public.rk_golden_service_cases c
set last_human_response_at=greatest(coalesce(c.last_human_response_at,d.responded),d.responded),
 last_human_channel='email' from delivered d where c.kind=d.kind and c.source_id=d.id;
with delivered as(
 select target_kind kind,target_id id,max(marked_sent_at) responded
 from public.reskonnect_whatsapp_handoffs where status in('operator_marked_sent','sent')
  and marked_sent_at is not null and target_kind in('application','reservation') group by 1,2
)
update public.rk_golden_service_cases c
set last_human_response_at=greatest(coalesce(c.last_human_response_at,d.responded),d.responded),
 last_human_channel='whatsapp' from delivered d where c.kind=d.kind and c.source_id=d.id;

-- The 15-minute watchdog creates at most one digest per admin per Johannesburg day.
-- It NEVER sends unconsented outbound communications or silently changes business statuses.
create or replace function reskonnect_internal.rk_golden_service_tick()
returns integer language plpgsql security definer set search_path='' as $fn$
declare v_breaches integer:=0;v_overdue integer:=0;v_unanswered integer:=0;u record;v_sent uuid;
begin
 update public.rk_golden_service_cases c set first_breach_at=now(),updated_at=now()
 where c.closed_at is null and c.first_breach_at is null
  and (c.snoozed_until is null or c.snoozed_until<=now())
  and ((c.last_human_response_at is null and c.first_response_due_at<now())
   or c.next_action_due_at<now());
 get diagnostics v_breaches=row_count;
 select count(*),count(*) filter(where last_human_response_at is null)
 into v_overdue,v_unanswered from public.rk_golden_service_cases
 where closed_at is null and (snoozed_until is null or snoozed_until<=now())
   and ((last_human_response_at is null and first_response_due_at<now()) or next_action_due_at<now());
 if v_overdue>0 then
  for u in select distinct user_id from public.user_roles where role='admin' loop
   insert into public.rk_golden_digest_receipts(admin_user_id,digest_day)
   values(u.user_id,(now() at time zone 'Africa/Johannesburg')::date)
   on conflict do nothing returning admin_user_id into v_sent;
   if v_sent is not null then
    insert into public.notifications(user_id,type,title,message,metadata,is_read,event_key)
    values(u.user_id,'golden_service_watch','ResKonnect service actions need attention',
     v_overdue::text||' requests require an operator action; '||v_unanswered::text||
     ' have no confirmed human response. Open Golden Service Cycle.',
     jsonb_build_object('route','/admin/golden-cycle','overdue',v_overdue,'unanswered',v_unanswered),
     false,'rk_golden_watch_'||(now() at time zone 'Africa/Johannesburg')::date::text);
   end if;
   v_sent:=null;
  end loop;
 end if;
 return v_breaches;
end $fn$;
revoke all on function reskonnect_internal.rk_golden_service_tick() from PUBLIC,anon,authenticated;
do $fn$ begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  perform cron.schedule('rk-golden-service-watch','*/15 * * * *',
    'select reskonnect_internal.rk_golden_service_tick()');
 end if;
end $fn$;
