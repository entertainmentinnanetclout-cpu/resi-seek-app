-- ResKonnect phases 4–5: event-driven conversion cases using existing
-- applications, reservations, viewing requests and manual enquiries as truth.
-- Personal contact details remain in their existing protected tables.

create table if not exists public.reskonnect_residence_service_targets (
  residence_id uuid primary key references public.residences(id) on delete cascade,
  first_response_hours integer not null default 24 check(first_response_hours between 1 and 168),
  followup_hours integer not null default 48 check(followup_hours between 4 and 336),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.reskonnect_residence_service_targets enable row level security;
revoke all on public.reskonnect_residence_service_targets from public,anon,authenticated;
grant select,insert,update on public.reskonnect_residence_service_targets to authenticated;
grant all on public.reskonnect_residence_service_targets to service_role;
create policy rk_service_targets_read on public.reskonnect_residence_service_targets for select to authenticated
using (public.is_platform_staff() or public.is_authorized_residence_user(residence_id));
create policy rk_service_targets_insert on public.reskonnect_residence_service_targets for insert to authenticated
with check (public.is_platform_staff() and updated_by=(select auth.uid()));
create policy rk_service_targets_update on public.reskonnect_residence_service_targets for update to authenticated
using (public.is_platform_staff())
with check (public.is_platform_staff() and updated_by=(select auth.uid()));

create table if not exists public.reskonnect_case_work_items (
 source_kind text not null check(source_kind in ('application','reservation','viewing','enquiry')),
 source_id uuid not null,
 residence_id uuid not null references public.residences(id) on delete cascade,
 student_user_id uuid references auth.users(id),
 academic_year integer,
 source_status text not null,
 document_signal text not null default 'not_applicable'
   check(document_signal in ('not_applicable','none_uploaded','submitted_for_review','verified_documents_present','rejected_documents_present')),
 next_action text not null default 'review_case',
 first_response_due_at timestamptz,
 followup_due_at timestamptz,
 last_responded_at timestamptz,
 last_responded_channel text,
 closed_at timestamptz,
 source_created_at timestamptz not null,
 source_updated_at timestamptz not null,
 updated_at timestamptz not null default now(),
 primary key(source_kind,source_id)
);
create index if not exists rk_cases_residence_queue on public.reskonnect_case_work_items(residence_id,closed_at,first_response_due_at);
create index if not exists rk_cases_due on public.reskonnect_case_work_items(first_response_due_at) where closed_at is null and last_responded_at is null;
create index if not exists rk_cases_student on public.reskonnect_case_work_items(student_user_id) where student_user_id is not null;
alter table public.reskonnect_case_work_items enable row level security;
revoke all on public.reskonnect_case_work_items from public,anon,authenticated;
grant select on public.reskonnect_case_work_items to authenticated;
grant all on public.reskonnect_case_work_items to service_role;
create policy rk_case_read on public.reskonnect_case_work_items for select to authenticated
using (public.is_platform_staff() or public.is_authorized_residence_user(residence_id)
       or student_user_id=(select auth.uid()));

create table if not exists public.reskonnect_case_interactions (
 id uuid primary key default gen_random_uuid(),
 source_kind text not null,
 source_id uuid not null,
 actor_user_id uuid not null references auth.users(id),
 action text not null check(action in ('contact_confirmed','followup_scheduled','internal_note')),
 channel text check(channel in ('whatsapp','email','phone','in_person')),
 note text,
 occurred_at timestamptz not null default now(),
 metadata jsonb not null default '{}'::jsonb,
 foreign key(source_kind,source_id) references public.reskonnect_case_work_items(source_kind,source_id) on delete cascade,
 constraint rk_case_note_limit check(length(coalesce(note,''))<=1200)
);
create index if not exists rk_interaction_source on public.reskonnect_case_interactions(source_kind,source_id,occurred_at desc);
create index if not exists rk_interaction_actor on public.reskonnect_case_interactions(actor_user_id,occurred_at desc);
alter table public.reskonnect_case_interactions enable row level security;
revoke all on public.reskonnect_case_interactions from public,anon,authenticated;
grant select on public.reskonnect_case_interactions to authenticated;
grant all on public.reskonnect_case_interactions to service_role;
create policy rk_case_interactions_read on public.reskonnect_case_interactions for select to authenticated
using (exists(select 1 from public.reskonnect_case_work_items c
  where c.source_kind=reskonnect_case_interactions.source_kind and c.source_id=reskonnect_case_interactions.source_id
    and (public.is_platform_staff() or public.is_authorized_residence_user(c.residence_id))));

-- Derived case state never replaces existing application/reservation statuses.
create or replace function reskonnect_internal.refresh_service_case(p_kind text,p_id uuid)
returns void language plpgsql security definer set search_path=''
as $fn$
declare rid uuid; sid uuid; state text; yr int; born timestamptz; touched timestamptz;
doc_signal text:='not_applicable'; action text:='review_case'; closed boolean:=false;
target_hours int:=24; doc_total int:=0; doc_pending int:=0; doc_rejected int:=0;
begin
 case p_kind
 when 'application' then
  select a.residence_id,a.user_id,a.status,a.academic_year,a.created_at,a.updated_at
  into rid,sid,state,yr,born,touched from public.applications a where a.id=p_id;
  if rid is null then return; end if;
  select count(*),count(*) filter(where lower(coalesce(d.status,'')) in ('submitted','pending','under_review')),
         count(*) filter(where lower(coalesce(d.status,''))='rejected')
  into doc_total,doc_pending,doc_rejected
  from public.application_documents d where d.application_id=p_id;
  doc_signal:=case when doc_total=0 then 'none_uploaded'
   when doc_rejected>0 then 'rejected_documents_present'
   when doc_pending>0 then 'submitted_for_review'
   else 'verified_documents_present' end;
  closed:=state in ('approved','rejected','withdrawn','cancelled','moved_in');
  action:=case
   when closed then 'complete'
   when doc_total=0 then 'request_documents'
   when doc_rejected>0 then 'request_replacement_documents'
   when doc_pending>0 then 'review_uploaded_documents'
   else 'review_application_status' end;
 when 'reservation' then
  select r.residence_id,r.user_id,r.status,r.academic_year,r.created_at,r.updated_at
  into rid,sid,state,yr,born,touched from public.accommodation_reservations r where r.id=p_id;
  if rid is null then return;end if;
  closed:=state in ('confirmed','cancelled');
  action:=case state when 'reserved' then 'contact_about_reservation'
     when 'contacted' then 'follow_up_reservation'
     when 'provisional_hold' then 'verify_hold_and_next_steps'
     when 'confirmed' then 'complete' when 'cancelled' then 'complete'
     else 'review_case' end;
 when 'viewing' then
  select v.residence_id,v.user_id,v.status,
    extract(year from v.preferred_date)::int,v.created_at,v.updated_at
  into rid,sid,state,yr,born,touched from public.viewing_requests v where v.id=p_id;
  if rid is null then return;end if;
  closed:=state in ('completed','cancelled','no_show');
  action:=case state when 'requested' then 'propose_viewing_time'
    when 'contacted' then 'schedule_viewing'
    when 'scheduled' then 'confirm_viewing_details'
    when 'completed' then 'complete' when 'cancelled' then 'complete'
    when 'no_show' then 'complete' else 'review_case' end;
 when 'enquiry' then
  select l.residence_id,l.user_id,l.stage,l.academic_year,l.created_at,l.updated_at
  into rid,sid,state,yr,born,touched from public.residence_leads l
    where l.id=p_id and l.source_type in ('manual','demand');
  if rid is null then return;end if;
  closed:=state in ('placed','lost');
  action:=case state when 'new' then 'answer_enquiry'
    when 'contacted' then 'follow_up_enquiry'
    when 'viewing' then 'arrange_viewing'
    when 'documents' then 'request_documents'
    when 'reserved' then 'confirm_reservation_steps'
    when 'lease_pending' then 'follow_up_lease'
    when 'placed' then 'complete' when 'lost' then 'complete'
    else 'review_case' end;
 else return;
 end case;
 select first_response_hours into target_hours from public.reskonnect_residence_service_targets where residence_id=rid;
 target_hours:=coalesce(target_hours,24);
 insert into public.reskonnect_case_work_items
 (source_kind,source_id,residence_id,student_user_id,academic_year,source_status,document_signal,
 next_action,first_response_due_at,closed_at,source_created_at,source_updated_at,updated_at)
 values(p_kind,p_id,rid,sid,yr,state,doc_signal,action,
   case when born>=current_date-30 then born+make_interval(hours=>target_hours) else null end,
   case when closed then now() else null end,born,coalesce(touched,born),now())
 on conflict(source_kind,source_id) do update set
   residence_id=excluded.residence_id,student_user_id=excluded.student_user_id,
   academic_year=excluded.academic_year,source_status=excluded.source_status,
   document_signal=excluded.document_signal,next_action=excluded.next_action,
   source_updated_at=excluded.source_updated_at,updated_at=now(),
   closed_at=case when closed then coalesce(public.reskonnect_case_work_items.closed_at,now()) else null end;
end;
$fn$;
revoke all on function reskonnect_internal.refresh_service_case(text,uuid) from public,anon,authenticated;

create or replace function reskonnect_internal.case_source_changed()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare kind text; source_id uuid;
begin
 kind:=case tg_table_name when 'applications' then 'application'
   when 'accommodation_reservations' then 'reservation'
   when 'viewing_requests' then 'viewing'
   when 'residence_leads' then 'enquiry' end;
 source_id:=new.id;
 if kind='enquiry' and new.source_type not in ('manual','demand') then return new;end if;
 perform reskonnect_internal.refresh_service_case(kind,source_id);
 return new;
end;
$fn$;
revoke all on function reskonnect_internal.case_source_changed() from public,anon,authenticated;
create trigger rk_case_from_application after insert or update of status,residence_id,academic_year on public.applications
 for each row execute function reskonnect_internal.case_source_changed();
create trigger rk_case_from_reservation after insert or update of status,residence_id,academic_year on public.accommodation_reservations
 for each row execute function reskonnect_internal.case_source_changed();
create trigger rk_case_from_viewing after insert or update of status,preferred_date,residence_id on public.viewing_requests
 for each row execute function reskonnect_internal.case_source_changed();
create trigger rk_case_from_enquiry after insert or update of stage,residence_id on public.residence_leads
 for each row execute function reskonnect_internal.case_source_changed();

create or replace function reskonnect_internal.case_document_changed()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare aid uuid;
begin
 aid:=case when tg_op='DELETE' then old.application_id else new.application_id end;
 perform reskonnect_internal.refresh_service_case('application',aid);
 return coalesce(new,old);
end;
$fn$;
revoke all on function reskonnect_internal.case_document_changed() from public,anon,authenticated;
create trigger rk_case_from_application_docs after insert or update of status or delete on public.application_documents
 for each row execute function reskonnect_internal.case_document_changed();

-- A sent email is automatically reflected in the case response clock.
create or replace function reskonnect_internal.case_email_confirmed()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare kind text;
begin
 if new.delivery_status<>'sent' or new.sent_at is null then return new; end if;
 if tg_op='UPDATE' and old.delivery_status='sent' then return new;end if;
 kind:=case new.target_kind when 'application' then 'application' when 'reservation' then 'reservation' else null end;
 if kind is not null then
   update public.reskonnect_case_work_items
   set last_responded_at=new.sent_at,last_responded_channel='email',updated_at=now()
   where source_kind=kind and source_id=new.target_id;
 end if;
 return new;
end;
$fn$;
revoke all on function reskonnect_internal.case_email_confirmed() from public,anon,authenticated;
create trigger rk_case_email_delivery after insert or update of delivery_status on public.reskonnect_outbound_emails
 for each row execute function reskonnect_internal.case_email_confirmed();

create or replace function reskonnect_internal.case_whatsapp_confirmed()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare kind text;
begin
 if new.status<>'sent' or new.marked_sent_at is null then return new;end if;
 if tg_op='UPDATE' and old.status='sent' then return new;end if;
 kind:=case new.target_kind when 'application' then 'application' when 'reservation' then 'reservation' else null end;
 if kind is not null then
  update public.reskonnect_case_work_items
  set last_responded_at=new.marked_sent_at,last_responded_channel='whatsapp',updated_at=now()
  where source_kind=kind and source_id=new.target_id;
 end if;
 return new;
end;
$fn$;
revoke all on function reskonnect_internal.case_whatsapp_confirmed() from public,anon,authenticated;
create trigger rk_case_whatsapp_delivery after insert or update of status on public.reskonnect_whatsapp_handoffs
 for each row execute function reskonnect_internal.case_whatsapp_confirmed();

-- No platform messages are sent here: staff explicitly confirm any manual
-- contact after they have actually sent it in the external app.
create or replace function public.reskonnect_record_case_action(
 p_kind text,p_id uuid,p_action text,p_channel text default null,
 p_note text default null,p_followup_at timestamptz default null,
 p_confirm_sent boolean default false
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare item public.reskonnect_case_work_items%rowtype;
begin
 if auth.uid() is null then raise exception 'Login required' using errcode='42501';end if;
 select * into item from public.reskonnect_case_work_items
 where source_kind=p_kind and source_id=p_id for update;
 if not found then raise exception 'Service case not found';end if;
 if not (public.is_platform_staff() or public.is_authorized_residence_user(item.residence_id)) then
    raise exception 'You cannot act on this residence' using errcode='42501';
 end if;
 if p_action not in ('contact_confirmed','followup_scheduled','internal_note') then raise exception 'Invalid action';end if;
 if length(coalesce(p_note,''))>1200 then raise exception 'Note too long';end if;
 if p_action='contact_confirmed' and (not p_confirm_sent or p_channel not in ('whatsapp','email','phone','in_person')) then
   raise exception 'Only record contact that was actually sent or completed';end if;
 if p_action='followup_scheduled' and (p_followup_at is null or p_followup_at<=now() or p_followup_at>now()+interval '180 days')
   then raise exception 'Select a future follow-up date'; end if;
 insert into public.reskonnect_case_interactions
 (source_kind,source_id,actor_user_id,action,channel,note,metadata)
 values(p_kind,p_id,auth.uid(),p_action,p_channel,nullif(trim(coalesce(p_note,'')),''),
   jsonb_build_object('manual_attestation',p_action='contact_confirmed' and p_confirm_sent));
 if p_action='contact_confirmed' then
  update public.reskonnect_case_work_items set last_responded_at=now(),last_responded_channel=p_channel,
      followup_due_at=coalesce(p_followup_at,now()+interval '48 hours'),updated_at=now()
  where source_kind=p_kind and source_id=p_id;
 elsif p_action='followup_scheduled' then
  update public.reskonnect_case_work_items set followup_due_at=p_followup_at,updated_at=now()
  where source_kind=p_kind and source_id=p_id;
 end if;
 insert into public.reskonnect_service_events(residence_id,entity_type,entity_id,action,actor_user_id,metadata)
 values(item.residence_id,'case_interaction',p_id,p_action,auth.uid(),jsonb_build_object('kind',p_kind,'channel',p_channel));
 return jsonb_build_object('ok',true,'source_kind',p_kind,'source_id',p_id);
end;
$fn$;
revoke all on function public.reskonnect_record_case_action(text,uuid,text,text,text,timestamptz,boolean) from public,anon;
grant execute on function public.reskonnect_record_case_action(text,uuid,text,text,timestamptz,boolean) to authenticated,service_role;

-- Profile-derived viewing request, user-authenticated, opt-in, deduplicated,
-- no guaranteed appointment. Existing viewing_requests is the system of record.
create or replace function public.reskonnect_request_property_viewing(
 p_residence_id uuid,p_date date,p_window text,p_note text,p_consent boolean
) returns uuid language plpgsql security invoker set search_path=''
as $fn$
declare profile_row public.profiles%rowtype; result_id uuid;
begin
 if auth.uid() is null then raise exception 'Please log in to request a viewing' using errcode='42501';end if;
 if not p_consent then raise exception 'Contact consent is required';end if;
 if not exists(select 1 from public.residences where id=p_residence_id and is_visible=true)
   then raise exception 'This residence is not available for viewing requests';end if;
 if p_date<current_date or p_date>current_date+90 then raise exception 'Choose a day within the next 90 days';end if;
 if p_window not in ('morning','afternoon','evening','flexible') then raise exception 'Choose a viewing window';end if;
 if length(coalesce(p_note,''))>700 then raise exception 'Request message too long';end if;
 select * into profile_row from public.profiles where id=auth.uid();
 if profile_row.full_name is null or length(trim(profile_row.full_name))<2
    or coalesce(nullif(trim(profile_row.phone),''),nullif(trim(profile_row.phone_number),'')) is null
    or profile_row.email is null then
  raise exception 'Complete your name, email and phone number in your profile before requesting a viewing';
 end if;
 if (select count(*) from public.viewing_requests
   where user_id=auth.uid() and status in ('requested','contacted','scheduled'))>=3
    then raise exception 'You already have three active viewing requests';end if;
 if exists(select 1 from public.viewing_requests where user_id=auth.uid() and residence_id=p_residence_id
  and preferred_date=p_date and status in ('requested','contacted','scheduled')) then
  raise exception 'You already requested a viewing for this residence on that date';end if;
 insert into public.viewing_requests
 (user_id,residence_id,contact_name,contact_phone,contact_email,preferred_date,preferred_time_window,
  status,note,consent_to_be_contacted,popia_consent,metadata)
 values(auth.uid(),p_residence_id,trim(profile_row.full_name),
  coalesce(nullif(trim(profile_row.phone),''),nullif(trim(profile_row.phone_number),'')),
  trim(profile_row.email),p_date,p_window,'requested',nullif(trim(coalesce(p_note,'')),''),
  true,true,jsonb_build_object('source','reskonnect_residence_detail'))
 returning id into result_id;
 return result_id;
end;
$fn$;
revoke all on function public.reskonnect_request_property_viewing(uuid,date,text,text,boolean) from public,anon;
grant execute on function public.reskonnect_request_property_viewing(uuid,date,text,text,boolean) to authenticated,service_role;

-- Reservation interest is not a confirmed bed. Prevent client-controlled
-- confirmation/room allocation on the existing public upsert route.
create or replace function reskonnect_internal.student_reservation_guard()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 if auth.uid() is null or public.is_platform_staff() or auth.uid() is distinct from new.user_id then return new;end if;
 if tg_op='INSERT' then
   if new.status<>'reserved' or new.academic_year<>2027 then
     raise exception 'Students may only submit 2027 reservation interest';end if;
   if not exists(select 1 from public.residences where id=new.residence_id and reservations_2027_open=true and is_visible=true)
     then raise exception '2027 reservation interest is closed for this residence';end if;
 else
   if (old.residence_id,old.user_id,old.academic_year,old.room_id,old.room_hold_id) is distinct from
      (new.residence_id,new.user_id,new.academic_year,new.room_id,new.room_hold_id)
      or new.admin_notes is distinct from old.admin_notes
      or new.residence_notes is distinct from old.residence_notes
      or new.last_contacted_at is distinct from old.last_contacted_at then
     raise exception 'Only staff can change reservation allocation or internal review fields';end if;
   if new.status<>old.status then
     if not (old.status='reserved' and new.status='cancelled'
       or old.status='cancelled' and new.status='reserved'
         and exists(select 1 from public.residences where id=old.residence_id and reservations_2027_open=true)) then
       raise exception 'Reservation progression and confirmation require staff review';end if;
   end if;
 end if;
 return new;
end;
$fn$;
revoke all on function reskonnect_internal.student_reservation_guard() from public,anon,authenticated;
create trigger aa_reskonnect_student_reservation_guard before insert or update on public.accommodation_reservations
 for each row execute function reskonnect_internal.student_reservation_guard();

-- Backfill without touching original records or generating outbound messages.
insert into public.reskonnect_case_work_items
 (source_kind,source_id,residence_id,student_user_id,academic_year,source_status,document_signal,
  next_action,first_response_due_at,closed_at,source_created_at,source_updated_at)
select 'application',a.id,a.residence_id,a.user_id,a.academic_year,a.status,
 case when not exists(select 1 from public.application_documents d where d.application_id=a.id) then 'none_uploaded'
      when exists(select 1 from public.application_documents d where d.application_id=a.id and lower(coalesce(d.status,''))='rejected') then 'rejected_documents_present'
      when exists(select 1 from public.application_documents d where d.application_id=a.id and lower(coalesce(d.status,'')) in ('submitted','pending','under_review')) then 'submitted_for_review'
      else 'verified_documents_present' end,
 case when a.status in ('approved','rejected','withdrawn','cancelled','moved_in') then 'complete'
      when not exists(select 1 from public.application_documents d where d.application_id=a.id) then 'request_documents'
      else 'review_application_status' end,
 null,case when a.status in ('approved','rejected','withdrawn','cancelled','moved_in') then now() end,
 a.created_at,coalesce(a.updated_at,a.created_at) from public.applications a
on conflict do nothing;

insert into public.reskonnect_case_work_items
 (source_kind,source_id,residence_id,student_user_id,academic_year,source_status,next_action,
 first_response_due_at,closed_at,source_created_at,source_updated_at)
select 'reservation',r.id,r.residence_id,r.user_id,r.academic_year,r.status,
 case r.status when 'reserved' then 'contact_about_reservation' when 'contacted' then 'follow_up_reservation'
 when 'provisional_hold' then 'verify_hold_and_next_steps' else 'complete' end,
 null,case when r.status in ('confirmed','cancelled') then now() end,r.created_at,coalesce(r.updated_at,r.created_at)
from public.accommodation_reservations r on conflict do nothing;

insert into public.reskonnect_case_work_items
 (source_kind,source_id,residence_id,student_user_id,academic_year,source_status,next_action,
 first_response_due_at,closed_at,source_created_at,source_updated_at)
select 'viewing',v.id,v.residence_id,v.user_id,extract(year from v.preferred_date)::int,v.status,
 case when v.status='requested' then 'propose_viewing_time' else 'review_case' end,
 null,case when v.status in ('completed','cancelled','no_show') then now() end,
 v.created_at,coalesce(v.updated_at,v.created_at)
from public.viewing_requests v on conflict do nothing;

insert into public.reskonnect_case_work_items
 (source_kind,source_id,residence_id,student_user_id,academic_year,source_status,next_action,
 first_response_due_at,closed_at,source_created_at,source_updated_at)
select 'enquiry',l.id,l.residence_id,l.user_id,l.academic_year,l.stage,
 case when l.stage='new' then 'answer_enquiry' else 'follow_up_enquiry' end,
 null,case when l.stage in ('placed','lost') then now() end,
 l.created_at,coalesce(l.updated_at,l.created_at)
from public.residence_leads l where l.source_type in ('manual','demand') on conflict do nothing;

comment on table public.reskonnect_case_work_items is 'Privacy-minimized operational projection; never source of truth for student status or inventory.';
comment on table public.reskonnect_case_interactions is 'Attested manual contact history, no automatic emails/WhatsApp or false delivery claims.';
