-- Student 360 owns no duplicate personal profile. It links existing systems by auth user ID.
-- All access is via role+MFA-gated RPCs. No student data becomes public and no statuses are auto-approved.
create table if not exists public.rk_student_journey_milestones (
 user_id uuid not null references public.profiles(id) on delete cascade,
 milestone text not null check (milestone in
  ('school_exit','admissions','funding','housing','studying','wil','graduation','employment','alumni')),
 status text not null default 'not_started' check (status in
  ('not_started','preparing','in_progress','blocked','verified_complete')),
 note text,
 evidence_reference text,
 updated_by uuid,
 verified_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key(user_id,milestone)
);
create table if not exists public.rk_student_journey_audit (
 id bigint generated always as identity primary key,
 user_id uuid not null references public.profiles(id) on delete cascade,
 milestone text not null,
 old_status text,
 new_status text not null,
 actor_id uuid not null,
 note text,
 evidence_reference text,
 created_at timestamptz not null default now()
);
create index if not exists rk_student_journey_audit_user_time
 on public.rk_student_journey_audit(user_id,created_at desc);
alter table public.rk_student_journey_milestones enable row level security;
alter table public.rk_student_journey_audit enable row level security;
revoke all on public.rk_student_journey_milestones from public,anon,authenticated;
revoke all on public.rk_student_journey_audit from public,anon,authenticated;
revoke all on sequence public.rk_student_journey_audit_id_seq from public,anon,authenticated;

create or replace function public.rk_student_360_search(
 p_query text, p_limit integer default 15
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_q text:=left(btrim(coalesce(p_query,'')),80); v_result jsonb;
begin
 if not reskonnect_internal.rk_godmode_authorized() then
   raise exception 'God Mode with verified MFA required' using errcode='42501';
 end if;
 if p_limit not between 1 and 25 then
   raise exception 'Invalid search limit' using errcode='22023';
 end if;
 if length(v_q)<2 then return '[]'::jsonb; end if;
 -- Escape pattern metacharacters so a query cannot enumerate the directory with % or _.
 v_q:=replace(replace(replace(v_q,E'\\',E'\\\\'),'%','\\%'),'_','\\_');
 select coalesce(jsonb_agg(to_jsonb(t) order by t.updated_at desc),'[]'::jsonb) into v_result
 from (
  select p.id as user_id,p.full_name,p.email,p.student_number,p.campus,
   p.student_stage,p.course,p.updated_at
  from public.profiles p
  where coalesce(p.full_name,'') ilike '%'||v_q||'%' escape '\'
    or coalesce(p.email,'') ilike '%'||v_q||'%' escape '\'
    or coalesce(p.student_number,'') ilike '%'||v_q||'%' escape '\'
  order by p.updated_at desc limit p_limit
 ) t;
 return v_result;
end $$;

create or replace function public.rk_student_360_snapshot(
 p_user_id uuid
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_p record; v_result jsonb;
begin
 if not reskonnect_internal.rk_godmode_authorized() then
  raise exception 'God Mode with verified MFA required' using errcode='42501';
 end if;
 if p_user_id is null then raise exception 'Student ID required' using errcode='22023';end if;
 select p.id,p.full_name,p.email,coalesce(nullif(p.phone_e164,''),nullif(p.phone,''),p.phone_number) as phone,
  p.student_number,p.campus,p.course,p.year_of_study,p.academic_year,p.academic_cycle,p.academic_period,
  p.study_level,p.student_stage,p.applicant_stage,p.created_at,p.updated_at
 into v_p from public.profiles p where p.id=p_user_id;
 if not found then return jsonb_build_object('found',false); end if;

 select jsonb_build_object(
  'found',true,
  'profile',to_jsonb(v_p),
  'milestones',(
   select jsonb_agg(jsonb_build_object(
    'key',m.key,'label',m.label,
    'status',coalesce(j.status,'not_started'),
    'recorded',j.user_id is not null,
    'note',j.note,'evidence_reference',j.evidence_reference,
    'verified_at',j.verified_at,'updated_at',j.updated_at
   ) order by m.ord)
   from (values
    (1,'school_exit','School transition'),(2,'admissions','Admission & programme'),
    (3,'funding','Funding'),(4,'housing','Accommodation'),
    (5,'studying','Student progression'),(6,'wil','WIL & practicals'),
    (7,'graduation','Graduation'),(8,'employment','Employment'),
    (9,'alumni','Alumni & mentoring')
   ) as m(ord,key,label)
   left join public.rk_student_journey_milestones j
     on j.user_id=p_user_id and j.milestone=m.key
  ),
  'summary',jsonb_build_object(
   'applications',(select count(*) from public.applications a where a.user_id=p_user_id),
   'reservations',(select count(*) from public.accommodation_reservations r where r.user_id=p_user_id),
   'wil',(select count(*) from public.wil_applications w where w.student_id=p_user_id),
   'admissions_support',(select count(*) from public.application_support_queries q where q.user_id=p_user_id),
   'documents_pending',(select count(*) from public.documents d where d.user_id=p_user_id and d.status='pending'),
   'documents_verified',(select count(*) from public.documents d where d.user_id=p_user_id and d.status='verified'),
   'open_cases',(select count(*) from public.rk_golden_service_cases c where c.user_id=p_user_id and c.closed_at is null),
   'unanswered_cases',(select count(*) from public.rk_golden_service_cases c
      where c.user_id=p_user_id and c.closed_at is null and c.last_human_response_at is null),
   'open_automation',(select count(*) from public.conversion_automation_tasks t where t.user_id=p_user_id and t.status='pending')
  ),
  'applications',coalesce((
   select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
    select a.id,a.status,a.academic_year,a.academic_cycle,a.study_level,a.funding_type,
     a.moved_in,a.residence_id,r.name as residence_name,a.created_at,a.updated_at
    from public.applications a left join public.residences r on r.id=a.residence_id
    where a.user_id=p_user_id order by a.created_at desc limit 30
   )x),'[]'::jsonb),
  'reservations',coalesce((
   select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
    select a.id,a.status,a.academic_year,a.funding_type,a.room_preference,
     a.residence_id,r.name as residence_name,a.created_at,a.updated_at
    from public.accommodation_reservations a left join public.residences r on r.id=a.residence_id
    where a.user_id=p_user_id order by a.created_at desc limit 30
   )x),'[]'::jsonb),
  'admission_assistance',coalesce((
   select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
    select q.id,q.status,q.preferred_institution,q.preferred_programme,q.highest_grade,q.created_at
    from public.application_support_queries q where q.user_id=p_user_id
    order by q.created_at desc limit 20
   )x),'[]'::jsonb),
  'wil',coalesce((
   select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
    select w.id,w.status,w.course,w.campus,w.year_level,w.created_at,w.updated_at
    from public.wil_applications w where w.student_id=p_user_id
    order by w.created_at desc limit 20
   )x),'[]'::jsonb),
  'documents',coalesce((
   select jsonb_agg(to_jsonb(x) order by x.uploaded_at desc) from (
    select d.id,d.document_type,d.status,d.uploaded_at,d.verified_at
    from public.documents d where d.user_id=p_user_id
    order by d.uploaded_at desc limit 40
   )x),'[]'::jsonb),
  'cases',coalesce((
   select jsonb_agg(to_jsonb(x) order by x.source_created_at desc) from (
    select c.kind,c.source_id,c.source_status,c.step,c.priority,c.next_action,
     c.next_action_due_at,c.last_human_response_at,c.closed_at,c.source_created_at
    from public.rk_golden_service_cases c where c.user_id=p_user_id
    order by c.source_created_at desc limit 60
   )x),'[]'::jsonb),
  'communication',jsonb_build_object(
   'provider_sent_email_count',(select count(*) from public.reskonnect_outbound_emails e
       where e.recipient_user_id=p_user_id and e.delivery_status='sent'),
   'outbound_email_failed_count',(select count(*) from public.reskonnect_outbound_emails e
       where e.recipient_user_id=p_user_id and e.delivery_status in('failed','error')),
   'whatsapp_operator_attested_count',(select count(*) from public.reskonnect_whatsapp_handoffs h
       join public.rk_golden_service_cases c on c.kind=h.target_kind and c.source_id=h.target_id
       where c.user_id=p_user_id and h.status='operator_marked_sent'),
   'whatsapp_draft_opened_count',(select count(*) from public.reskonnect_whatsapp_handoffs h
       join public.rk_golden_service_cases c on c.kind=h.target_kind and c.source_id=h.target_id
       where c.user_id=p_user_id and h.status='opened'),
   'linked_whatsapp_messages',(select count(*) from public.adminos_whatsapp_messages m
       join public.adminos_contacts k on k.id=m.contact_id
       where k.profile_user_id=p_user_id and k.merged_into_id is null)
  ),
  'timeline',coalesce((
   select jsonb_agg(to_jsonb(t) order by t.event_at desc) from(
    select c.source_created_at as event_at,'service_intake'::text as event_type,
      c.kind as label,c.source_status as detail,c.source_id as source_id
     from public.rk_golden_service_cases c where c.user_id=p_user_id
    union all
    select h.created_at,'application_status',h.source_table,
      coalesce(h.old_status,'not recorded')||' → '||coalesce(h.new_status,'not recorded'),h.application_id
      from public.application_status_history h where h.user_id=p_user_id
    union all
    select d.uploaded_at,'document_upload',d.document_type,d.status,d.id
      from public.documents d where d.user_id=p_user_id
    union all
    select a.created_at,'journey_milestone',a.milestone,a.new_status,null::uuid
      from public.rk_student_journey_audit a where a.user_id=p_user_id
    order by event_at desc limit 70
   )t),'[]'::jsonb)
 ) into v_result;
 return v_result;
end $$;

create or replace function public.rk_student_360_milestone_set(
 p_user_id uuid,p_milestone text,p_status text,p_note text,
 p_evidence_reference text default null,p_expected_updated_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_old public.rk_student_journey_milestones%rowtype;
 v_note text:=btrim(coalesce(p_note,''));v_evidence text:=nullif(btrim(coalesce(p_evidence_reference,'')),'');
 v_actor uuid:=auth.uid();v_new public.rk_student_journey_milestones%rowtype;
begin
 if not reskonnect_internal.rk_godmode_authorized() then
  raise exception 'God Mode with verified MFA required' using errcode='42501';
 end if;
 if p_user_id is null or not exists(select 1 from public.profiles where id=p_user_id) or
   p_milestone not in ('school_exit','admissions','funding','housing','studying','wil','graduation','employment','alumni') or
   p_status not in ('not_started','preparing','in_progress','blocked','verified_complete') or
   length(v_note)>1000 or length(coalesce(v_evidence,''))>240 then
  raise exception 'Invalid student journey update' using errcode='22023';
 end if;
 if length(v_note)<12 or (p_status='verified_complete' and length(coalesce(v_evidence,''))<8) then
  raise exception 'Record a factual review note and an evidence reference for verified milestones' using errcode='22023';
 end if;
 select * into v_old from public.rk_student_journey_milestones
  where user_id=p_user_id and milestone=p_milestone for update;
 if found and (p_expected_updated_at is null or v_old.updated_at is distinct from p_expected_updated_at) then
   raise exception 'Milestone changed since it was opened; refresh before updating' using errcode='40001';
 end if;
 if not found and p_expected_updated_at is not null then
   raise exception 'Milestone changed since it was opened; refresh before updating' using errcode='40001';
 end if;
 insert into public.rk_student_journey_milestones
 (user_id,milestone,status,note,evidence_reference,updated_by,verified_at,updated_at)
 values (p_user_id,p_milestone,p_status,v_note,v_evidence,v_actor,
   case when p_status='verified_complete' then now() else null end,now())
 on conflict(user_id,milestone) do update set
  status=excluded.status,note=excluded.note,evidence_reference=excluded.evidence_reference,
  updated_by=excluded.updated_by,verified_at=excluded.verified_at,updated_at=excluded.updated_at
 returning * into v_new;
 insert into public.rk_student_journey_audit
 (user_id,milestone,old_status,new_status,actor_id,note,evidence_reference)
 values(p_user_id,p_milestone,v_old.status,p_status,v_actor,v_note,v_evidence);
 return jsonb_build_object('saved',true,'milestone',p_milestone,'status',p_status,
  'updated_at',v_new.updated_at,'external_messages_sent',false,'business_decision_changed',false);
end $$;
revoke all on function public.rk_student_360_search(text,integer) from public,anon,authenticated;
revoke all on function public.rk_student_360_snapshot(uuid) from public,anon,authenticated;
revoke all on function public.rk_student_360_milestone_set(uuid,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.rk_student_360_search(text,integer) to authenticated;
grant execute on function public.rk_student_360_snapshot(uuid) to authenticated;
grant execute on function public.rk_student_360_milestone_set(uuid,text,text,text,text,timestamptz) to authenticated;
