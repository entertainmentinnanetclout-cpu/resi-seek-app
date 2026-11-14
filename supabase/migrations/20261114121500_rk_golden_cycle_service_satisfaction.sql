-- Student-rated service quality and a real low-satisfaction recovery loop.
-- Does not touch residence ratings, eligibility, application outcome or private documents.
create table if not exists public.rk_golden_service_feedback(
 kind text not null,
 source_id uuid not null,
 user_id uuid not null,
 rating smallint not null check(rating between 1 and 5),
 comment text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(kind,source_id,user_id),
 foreign key(kind,source_id) references public.rk_golden_service_cases(kind,source_id) on delete cascade,
 check(length(coalesce(comment,''))<=450)
);
create index if not exists rk_golden_feedback_low_idx on public.rk_golden_service_feedback(updated_at desc) where rating<=2;
alter table public.rk_golden_service_feedback enable row level security;
revoke all on public.rk_golden_service_feedback from PUBLIC,anon,authenticated;
grant all on public.rk_golden_service_feedback to service_role;
comment on table public.rk_golden_service_feedback is 'Service quality only, never public accommodation reviews or partner accreditation scores.';

create or replace function public.rk_golden_service_feedback_submit(
 p_kind text,p_id uuid,p_rating integer,p_comment text default null
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_id uuid:=auth.uid();v_case public.rk_golden_service_cases%rowtype;v_prior timestamptz;
begin
 if v_id is null then raise exception 'Sign in to submit service feedback' using errcode='42501';end if;
 select * into v_case from public.rk_golden_service_cases
 where kind=p_kind and source_id=p_id and user_id=v_id;
 if not found then raise exception 'This service does not belong to your profile' using errcode='42501';end if;
 if v_case.step not in('post_service','closed') then raise exception 'Feedback opens after a service outcome or handover';end if;
 if p_rating not between 1 and 5 or length(btrim(coalesce(p_comment,'')))>450 then
  raise exception 'Rating must be 1–5 and feedback at most 450 characters';end if;
 select f.updated_at into v_prior from public.rk_golden_service_feedback f
 where f.kind=p_kind and f.source_id=p_id and f.user_id=v_id;
 if v_prior is not null and v_prior>now()-interval '24 hours' then
  raise exception 'Feedback can be updated after 24 hours';end if;
 insert into public.rk_golden_service_feedback(kind,source_id,user_id,rating,comment)
 values(p_kind,p_id,v_id,p_rating,nullif(btrim(coalesce(p_comment,'')),''))
 on conflict(kind,source_id,user_id) do update
  set rating=excluded.rating,comment=excluded.comment,updated_at=now();
 insert into public.rk_golden_service_events(kind,source_id,actor_id,event_type,note,metadata)
 values(p_kind,p_id,v_id,'customer_feedback',
  case when p_rating<=2 then 'Low service satisfaction reported; operator recovery needed'
   else 'Customer provided a service satisfaction rating' end,
  jsonb_build_object('rating',p_rating));
 if p_rating<=2 then
  update public.rk_golden_service_cases set step='in_review',next_action='recover_unhappy_customer',
    next_action_due_at=now()+interval '2 hours',closed_at=null,first_breach_at=null,updated_at=now()
  where kind=p_kind and source_id=p_id;
 end if;
 return jsonb_build_object('ok',true,'rating',p_rating,
  'message',case when p_rating<=2 then 'Your feedback is recorded and ResKonnect has opened a follow-up action.' else 'Your feedback is recorded. Thank you.' end);
end $fn$;
revoke all on function public.rk_golden_service_feedback_submit(text,uuid,integer,text) from PUBLIC,anon,authenticated;
grant execute on function public.rk_golden_service_feedback_submit(text,uuid,integer,text) to authenticated;

-- Reflect service satisfaction in the existing one-person operator queue and private student tracker.
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
    'needs_recovery',(select count(*) from public.rk_golden_service_feedback where rating<=2)
   ) from base),
  'items',coalesce((select jsonb_agg(to_jsonb(rendered)) from rendered),'[]'::jsonb)
 ) into result;
 return result;
end $fn$;
revoke all on function public.rk_golden_service_queue(text,text,integer,integer) from PUBLIC,anon,authenticated;
grant execute on function public.rk_golden_service_queue(text,text,integer,integer) to authenticated;


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
  'feedback_rating',(select f.rating from public.rk_golden_service_feedback f where f.kind=x.kind and f.source_id=x.source_id and f.user_id=v_id),
  'closed',x.closed_at is not null) order by x.source_created_at desc),'[]'::jsonb)
 into out_data from (select * from public.rk_golden_service_cases
   where user_id=v_id order by source_created_at desc limit 40) x;
 return jsonb_build_object('items',out_data,
  'notice','A request appearing here is not approval, a confirmed booking, funding or WIL placement. ResKonnect reviews supporting evidence and communicates next steps.');
end $fn$;
revoke all on function public.rk_golden_my_service() from PUBLIC,anon,authenticated;
grant execute on function public.rk_golden_my_service() to authenticated;


