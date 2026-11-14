-- Expose linked student identity only for the MFA-verified admin case queue.
-- Landlord-scoped case lists retain no Student 360 user ID.
CREATE OR REPLACE FUNCTION public.rk_case_queue(p_kind text, p_scope text DEFAULT 'admin'::text, p_limit integer DEFAULT 60, p_offset integer DEFAULT 0, p_stage text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
   'residence_id',residence_id,'residence_name',residence_name,
   'student_user_id',case when p_scope='admin' then student_id else null end,'student_name',full_name,
   'student_number',student_number,'campus',campus,'course',course,'funding_type',funding_type,
   'eligibility_decision',eligibility_decision,'review_source',review_source,
   'handover_approved_at',handover_approved_at,'task_id',task_id,'task_status',task_status,
   'document_readiness',case when kind='wil' then jsonb_build_object('ready',false,'reason','WIL document review uses its separate workflow') else reskonnect_internal.rk_case_document_readiness(kind,id) end
 ) order by created_at desc,id desc),'[]'::jsonb),coalesce(max(total),0)
 into v_rows,v_total from allowed where rn>p_offset and rn<=p_offset+p_limit;
 return jsonb_build_object('items',v_rows,'total',v_total,'offset',p_offset,'limit',p_limit);
end $function$

revoke all on function public.rk_case_queue(text,text,integer,integer,text) from public,anon,authenticated;
grant execute on function public.rk_case_queue(text,text,integer,integer,text) to authenticated;
