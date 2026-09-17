-- Validation hardening for the student care and application assistance workspace.
-- Qualify document ownership; the legacy policy resolved user_id to the joined partner.
drop policy if exists "creator reads assigned assistance documents" on public.application_assistance_documents;
create policy "partner reads consented case documents" on public.application_assistance_documents for select to authenticated
using(public.rk_can_access_assistance(case_id,true));

create or replace function public.creator_update_assistance_case(p_case_id uuid,p_status text,p_notes text default null,p_reference text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_case public.creator_assistance_cases;
begin
 if not public.rk_can_access_assistance(p_case_id,true) then raise exception 'Case unavailable or consent revoked' using errcode='42501'; end if;
 if p_status not in ('requested','documents_pending','ready_to_apply','in_progress','submitted','awaiting_response','completed','closed') then raise exception 'Invalid assistance status'; end if;
 if p_status in ('submitted','awaiting_response','completed') and not exists(select 1 from public.assistance_submissions where case_id=p_case_id and submitted_at is not null) then
  raise exception 'Record an institution application and its submission reference first';
 end if;
 update public.creator_assistance_cases set status=p_status,creator_notes=nullif(btrim(coalesce(p_notes,'')),''),
 application_reference=nullif(btrim(coalesce(p_reference,'')),''),updated_at=now(),last_activity_at=now(),
 submitted_at=case when p_status in ('submitted','awaiting_response','completed') then coalesce(submitted_at,now()) else submitted_at end
 where id=p_case_id returning * into v_case;
 return jsonb_build_object('id',v_case.id,'status',v_case.status,'creator_notes',v_case.creator_notes,'application_reference',v_case.application_reference,'submitted_at',v_case.submitted_at,'updated_at',v_case.updated_at);
end $$;
revoke all on function public.creator_update_assistance_case(uuid,text,text,text) from public,anon;
grant execute on function public.creator_update_assistance_case(uuid,text,text,text) to authenticated;

create or replace function public.rk_guard_assistance_child() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if new.case_id is distinct from old.case_id then raise exception 'A record cannot be moved to another assistance case'; end if;
  if tg_table_name='assistance_call_requests' then
   if new.requested_by is distinct from old.requested_by then raise exception 'Call requester cannot be changed'; end if;
  end if;
 end if;
 if not exists(select 1 from public.creator_assistance_cases c where c.id=new.case_id and c.consent_status='granted' and c.status<>'closed') then raise exception 'This assistance case is closed or consent has been revoked'; end if;
 if tg_table_name='assistance_call_requests' then
  if new.status='scheduled' and new.scheduled_at is null then raise exception 'Confirm the call time before scheduling'; end if;
 end if;
 return new;
end $$;
create trigger rk_call_case_guard before insert or update on public.assistance_call_requests for each row execute function public.rk_guard_assistance_child();
create trigger rk_submission_case_guard before insert or update on public.assistance_submissions for each row execute function public.rk_guard_assistance_child();
create trigger rk_document_request_case_guard before insert or update on public.assistance_document_requests for each row execute function public.rk_guard_assistance_child();
revoke all on function public.rk_guard_assistance_child() from public,anon,authenticated;

-- An explicit care-team decision to restart a search overrides a historical assumption.
create or replace function public.rk_student_is_placed(p_user_id uuid,p_phone text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p left join public.student_care_placements c on c.user_id=p.id
 where (p.id=p_user_id or public.rk_normalize_phone(coalesce(nullif(p.phone_e164,''),nullif(p.phone,''),p.phone_number))=public.rk_normalize_phone(p_phone))
 and case when c.user_id is not null then c.care_status='placed'
 else exists(select 1 from public.applications a where a.user_id=p.id and (a.moved_in or a.status='approved')) end)
$$;
revoke all on function public.rk_student_is_placed(uuid,text) from public,anon,authenticated;
grant execute on function public.rk_student_is_placed(uuid,text) to service_role;

create or replace function public.rk_export_contacts(p_offset integer default 0,p_limit integer default 500) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
 if not public.adminos_is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 with sources as (
  select 'profile:'||p.id as key,p.id as user_id,p.full_name,p.email,coalesce(nullif(p.phone_e164,''),nullif(p.phone,''),p.phone_number) phone,p.campus,p.course,'Platform user' source from public.profiles p
  union all select 'contact:'||c.id,c.profile_user_id,c.full_name,c.email,c.phone,c.campus,null,'CRM / WhatsApp' from public.adminos_contacts c where c.merged_into_id is null
  union all select 'whatsapp:'||t.id,c.profile_user_id,coalesce(c.full_name,t.metadata->>'profile_name'),c.email,t.channel_address,c.campus,null,'WhatsApp' from public.adminos_whatsapp_threads t left join public.adminos_contacts c on c.id=t.contact_id
 ), normalized as (
  select *,coalesce(public.rk_normalize_phone(phone),nullif(lower(email),''),key) identity from sources
 ), merged as (
  select identity,max(user_id::text)::uuid user_id,
    coalesce(max(nullif(btrim(full_name),'')),max(public.rk_normalize_phone(phone)),max(email),'Student') full_name,
    max(nullif(email,'')) email,max(public.rk_normalize_phone(phone)) phone,max(nullif(campus,'')) campus,max(nullif(course,'')) course,
    string_agg(distinct source,', ' order by source) sources
  from normalized group by identity
 ), enriched as (
  select m.identity,m.user_id,m.full_name,m.email,m.phone,coalesce(nullif(m.campus,''),nullif(w.campus,''),l.campus) campus,m.course,m.sources,coalesce(nullif(w.preferred_residence,''),wr.name,r.name) preferred_residence,
    coalesce(a.funding_type,w.funding_type,l.funding) funding_type,coalesce(a.academic_year,w.academic_year,l.academic_year) academic_year,
    case when public.rk_student_is_placed(m.user_id,m.phone) then 'Placed for follow-ups' else coalesce(a.status,l.stage,'Enquiry') end placement_status
  from merged m
  left join lateral (select residence_id,funding_type,academic_year,status from public.applications where user_id=m.user_id order by created_at desc limit 1)a on true
  left join public.residences r on r.id=a.residence_id
  left join lateral (select cl.selected_residence_id,cl.funding,cl.academic_year,cl.stage,cl.campus from public.adminos_whatsapp_conversion_leads cl
    join public.adminos_whatsapp_threads t on t.id=cl.thread_id
    where cl.user_id=m.user_id or public.rk_normalize_phone(t.channel_address)=m.phone order by cl.updated_at desc limit 1)l on true
  left join public.residences wr on wr.id=l.selected_residence_id
  left join lateral (select preferred_residence,funding_type,academic_year,campus from public.single_room_waitlist where user_id=m.user_id order by created_at desc limit 1)w on true
 ) select jsonb_build_object('total',(select count(*) from enriched),'rows',coalesce((select jsonb_agg(to_jsonb(e) order by e.identity) from
   (select * from enriched order by identity offset greatest(p_offset,0) limit greatest(1,least(p_limit,500)))e),'[]'::jsonb)) into v_result;
 return v_result;
end $$;
