-- Only the protected God Mode service queue may include a linked person ID.
-- Records with no verified account owner stay unlinked (never name-matched).
CREATE OR REPLACE FUNCTION public.rk_golden_service_queue(p_filter text DEFAULT 'all'::text, p_kind text DEFAULT NULL::text, p_limit integer DEFAULT 80, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 if not reskonnect_internal.rk_godmode_authorized() then
  raise exception 'God Mode with verified MFA required' using errcode='42501';end if;
 if p_filter not in('all','recent','overdue','needs_reply','waiting','post_service','closed')
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
  or (p_filter='recent' and closed_at is null and source_created_at>=now()-interval '72 hours')
  or (p_filter='overdue' and overdue)
  or (p_filter='needs_reply' and needs_reply)
  or (p_filter='waiting' and closed_at is null and step in('awaiting_customer','awaiting_residence','awaiting_partner'))
  or (p_filter='post_service' and closed_at is null and step='post_service')
  or (p_filter='closed' and closed_at is not null)
  order by
   case when p_filter='recent' then source_created_at end desc,
   case when overdue then 0 else 1 end,
   case priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,
   case when last_human_response_at is null then first_response_due_at else next_action_due_at end asc
  limit p_limit offset p_offset
 ), rendered as(
  select q.kind,q.user_id as student_user_id,q.source_id as id,q.source_status as status,q.step,q.next_action,q.priority,
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
    'recent_open',count(*) filter(where closed_at is null and source_created_at>=now()-interval '72 hours'),
    'recent_unanswered',count(*) filter(where closed_at is null and last_human_response_at is null and source_created_at>=now()-interval '72 hours'),
    -- Operator sprint workload: global aggregates only, no documents or PII are returned.
    'pending_documents',(select count(*) from public.documents d
      where d.status='pending' and d.verified_at is null),
    'pending_documents_older_48h',(select count(*) from public.documents d
      where d.status='pending' and d.verified_at is null
        and d.uploaded_at<now()-interval '48 hours'),
    'pending_application_documents',(select count(*) from public.application_documents d
      where d.status in ('pending','uploaded','under_review') and d.verified_at is null),
    'delegated_residence_open',(select count(*) from public.rk_case_tasks t
      where t.status='open' and t.assigned_scope='landlord' and t.task_type='eligibility_review'),
    'residence_recommendations_pending',(select count(*) from public.rk_case_tasks t
      join public.rk_case_workflows w on w.kind=t.kind and w.case_id=t.case_id
      where t.status='completed' and t.assigned_scope='landlord'
        and t.task_type='eligibility_review' and w.handover_approved_at is null),
    'wil_open',(select count(*) from public.rk_golden_service_cases s
      where s.kind='wil' and s.closed_at is null),
    'partner_open',(select count(*) from public.rk_golden_service_cases s
      where s.kind='partner' and s.closed_at is null),
    'feedback_count',(select count(*) from public.rk_golden_service_feedback),
    'feedback_average',(select round(avg(rating)::numeric,1) from public.rk_golden_service_feedback),
    'needs_recovery',(select count(*) from public.rk_golden_service_feedback f
     join public.rk_golden_service_cases c on c.kind=f.kind and c.source_id=f.source_id
     where f.rating<=2 and c.closed_at is null and c.next_action='recover_unhappy_customer')
   ) from base),
  'items',coalesce((select jsonb_agg(to_jsonb(rendered)) from rendered),'[]'::jsonb)
 ) into result;
 return result;
end $function$;
revoke all on function public.rk_golden_service_queue(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.rk_golden_service_queue(text,text,integer,integer) to authenticated;
