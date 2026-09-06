-- Phase 1/10: Universal Customer Timeline
-- Deterministic event ledger: no AI required.

create table if not exists public.adminos_customer_events (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.adminos_contacts(id) on delete set null,
  user_id uuid,
  event_category text not null,
  event_type text not null,
  source_table text not null,
  source_id uuid,
  title text not null,
  summary text,
  status text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_adminos_customer_events_contact on public.adminos_customer_events(contact_id, occurred_at desc);
create index if not exists idx_adminos_customer_events_user on public.adminos_customer_events(user_id, occurred_at desc);
create index if not exists idx_adminos_customer_events_source on public.adminos_customer_events(source_table, source_id);

alter table public.adminos_customer_events enable row level security;
drop policy if exists "AdminOS staff read customer timeline" on public.adminos_customer_events;
create policy "AdminOS staff read customer timeline" on public.adminos_customer_events
  for select to authenticated using ((select public.adminos_is_staff()));
revoke all on public.adminos_customer_events from anon;
grant select on public.adminos_customer_events to authenticated;

create or replace function public.adminos_contact_id_for_user(p_user_id uuid)
returns uuid language sql stable security definer set search_path=public as $$
  select id from public.adminos_contacts
  where profile_user_id = p_user_id and merged_into_id is null
  order by updated_at desc limit 1;
$$;
revoke all on function public.adminos_contact_id_for_user(uuid) from public, anon, authenticated;

create or replace function public.adminos_record_customer_event(
  p_contact_id uuid,
  p_user_id uuid,
  p_category text,
  p_event_type text,
  p_source_table text,
  p_source_id uuid,
  p_title text,
  p_summary text,
  p_status text,
  p_metadata jsonb,
  p_occurred_at timestamptz,
  p_idempotency_key text
) returns void language plpgsql security definer set search_path=public as $$
begin
  insert into public.adminos_customer_events(
    contact_id,user_id,event_category,event_type,source_table,source_id,title,summary,status,metadata,occurred_at,idempotency_key
  ) values (
    p_contact_id,p_user_id,p_category,p_event_type,p_source_table,p_source_id,p_title,p_summary,p_status,
    coalesce(p_metadata,'{}'::jsonb),coalesce(p_occurred_at,now()),p_idempotency_key
  ) on conflict (idempotency_key) do update set
    contact_id=coalesce(excluded.contact_id,adminos_customer_events.contact_id),
    user_id=coalesce(excluded.user_id,adminos_customer_events.user_id),
    summary=coalesce(excluded.summary,adminos_customer_events.summary),
    status=coalesce(excluded.status,adminos_customer_events.status),
    metadata=adminos_customer_events.metadata || excluded.metadata,
    occurred_at=greatest(adminos_customer_events.occurred_at,excluded.occurred_at);
end; $$;
revoke all on function public.adminos_record_customer_event(uuid,uuid,text,text,text,uuid,text,text,text,jsonb,timestamptz,text) from public, anon, authenticated;

create or replace function public.adminos_customer_event_application_trigger() returns trigger
language plpgsql security definer set search_path=public as $$
declare c uuid; rname text;
begin
  c := public.adminos_contact_id_for_user(new.user_id);
  select name into rname from public.residences where id=new.residence_id;
  if tg_op='INSERT' then
    perform public.adminos_record_customer_event(c,new.user_id,'application','application_created','applications',new.id,
      'Accommodation application submitted',coalesce(rname,'Accommodation application'),new.status,
      jsonb_build_object('residence_id',new.residence_id,'residence_name',rname,'funding_type',new.funding_type,'institution_type',new.institution_type),
      coalesce(new.created_at,now()),concat('applications:',new.id,':created'));
  elsif new.status is distinct from old.status then
    perform public.adminos_record_customer_event(c,new.user_id,'application','application_status_changed','applications',new.id,
      'Application status updated',concat(coalesce(rname,'Application'),' → ',coalesce(new.status,'updated')),new.status,
      jsonb_build_object('old_status',old.status,'new_status',new.status,'residence_id',new.residence_id,'residence_name',rname),
      coalesce(new.updated_at,now()),concat('applications:',new.id,':status:',coalesce(new.status,'unknown')));
  end if;
  return new;
end; $$;
drop trigger if exists trg_adminos_customer_event_application on public.applications;
create trigger trg_adminos_customer_event_application after insert or update of status on public.applications
for each row execute function public.adminos_customer_event_application_trigger();

create or replace function public.adminos_customer_event_document_trigger() returns trigger
language plpgsql security definer set search_path=public as $$
declare a public.applications%rowtype; c uuid;
begin
  select * into a from public.applications where id=new.application_id;
  c := public.adminos_contact_id_for_user(a.user_id);
  if tg_op='INSERT' then
    perform public.adminos_record_customer_event(c,a.user_id,'document','document_uploaded','application_documents',new.id,
      'Application document uploaded',new.doc_type,new.status,
      jsonb_build_object('application_id',new.application_id,'doc_type',new.doc_type,'filename',new.original_filename),new.uploaded_at,
      concat('application_documents:',new.id,':created'));
  elsif new.status is distinct from old.status then
    perform public.adminos_record_customer_event(c,a.user_id,'document','document_status_changed','application_documents',new.id,
      'Application document updated',concat(new.doc_type,' → ',new.status),new.status,
      jsonb_build_object('application_id',new.application_id,'doc_type',new.doc_type,'rejection_reason',new.rejection_reason),coalesce(new.verified_at,now()),
      concat('application_documents:',new.id,':status:',new.status));
  end if;
  return new;
end; $$;
drop trigger if exists trg_adminos_customer_event_document on public.application_documents;
create trigger trg_adminos_customer_event_document after insert or update of status on public.application_documents
for each row execute function public.adminos_customer_event_document_trigger();

create or replace function public.adminos_customer_event_reservation_trigger() returns trigger
language plpgsql security definer set search_path=public as $$
declare c uuid; rname text;
begin
  c := public.adminos_contact_id_for_user(new.user_id);
  select name into rname from public.residences where id=new.residence_id;
  if tg_op='INSERT' then
    perform public.adminos_record_customer_event(c,new.user_id,'reservation','reservation_created','accommodation_reservations',new.id,
      'Accommodation reservation created',coalesce(rname,'Accommodation reservation'),new.status,
      jsonb_build_object('residence_id',new.residence_id,'residence_name',rname,'academic_year',new.academic_year,'funding_type',new.funding_type),new.created_at,
      concat('accommodation_reservations:',new.id,':created'));
  elsif new.status is distinct from old.status then
    perform public.adminos_record_customer_event(c,new.user_id,'reservation','reservation_status_changed','accommodation_reservations',new.id,
      'Reservation status updated',concat(coalesce(rname,'Reservation'),' → ',new.status),new.status,
      jsonb_build_object('old_status',old.status,'new_status',new.status,'residence_id',new.residence_id,'residence_name',rname),new.updated_at,
      concat('accommodation_reservations:',new.id,':status:',new.status));
  end if;
  return new;
end; $$;
drop trigger if exists trg_adminos_customer_event_reservation on public.accommodation_reservations;
create trigger trg_adminos_customer_event_reservation after insert or update of status on public.accommodation_reservations
for each row execute function public.adminos_customer_event_reservation_trigger();

create or replace function public.adminos_customer_event_wil_trigger() returns trigger
language plpgsql security definer set search_path=public as $$
declare c uuid;
begin
  c := public.adminos_contact_id_for_user(new.student_id);
  if tg_op='INSERT' then
    perform public.adminos_record_customer_event(c,new.student_id,'wil','wil_application_created','wil_applications',new.id,
      'WIL application submitted',concat_ws(' · ',new.course,new.campus),new.status,
      jsonb_build_object('course',new.course,'campus',new.campus,'wil_duration',new.wil_duration,'funding_status',new.funding_status),new.created_at,
      concat('wil_applications:',new.id,':created'));
  elsif new.status is distinct from old.status then
    perform public.adminos_record_customer_event(c,new.student_id,'wil','wil_status_changed','wil_applications',new.id,
      'WIL status updated',concat(coalesce(new.course,'WIL'),' → ',new.status),new.status,
      jsonb_build_object('old_status',old.status,'new_status',new.status,'course',new.course,'campus',new.campus),new.updated_at,
      concat('wil_applications:',new.id,':status:',new.status));
  end if;
  return new;
end; $$;
drop trigger if exists trg_adminos_customer_event_wil on public.wil_applications;
create trigger trg_adminos_customer_event_wil after insert or update of status on public.wil_applications
for each row execute function public.adminos_customer_event_wil_trigger();

create or replace function public.adminos_customer_event_support_trigger() returns trigger
language plpgsql security definer set search_path=public as $$
declare c uuid;
begin
  c := public.adminos_contact_id_for_user(new.user_id);
  if tg_op='INSERT' then
    perform public.adminos_record_customer_event(c,new.user_id,'support','support_query_created','application_support_queries',new.id,
      'Application support enquiry received',concat_ws(' · ',new.preferred_institution,new.preferred_programme),new.status::text,
      jsonb_build_object('institution_type',new.institution_type::text,'preferred_institution',new.preferred_institution,'preferred_campus',new.preferred_campus,'needs_accommodation',new.needs_accommodation),new.created_at,
      concat('application_support_queries:',new.id,':created'));
  elsif new.status is distinct from old.status then
    perform public.adminos_record_customer_event(c,new.user_id,'support','support_status_changed','application_support_queries',new.id,
      'Support enquiry updated',concat('Support → ',new.status::text),new.status::text,
      jsonb_build_object('old_status',old.status::text,'new_status',new.status::text),new.updated_at,
      concat('application_support_queries:',new.id,':status:',new.status::text));
  end if;
  return new;
end; $$;
drop trigger if exists trg_adminos_customer_event_support on public.application_support_queries;
create trigger trg_adminos_customer_event_support after insert or update of status on public.application_support_queries
for each row execute function public.adminos_customer_event_support_trigger();

create or replace function public.adminos_customer_event_lead_trigger() returns trigger
language plpgsql security definer set search_path=public as $$
declare c uuid; rname text;
begin
  c := public.adminos_contact_id_for_user(new.user_id);
  select name into rname from public.residences where id=new.residence_id;
  if tg_op='INSERT' then
    perform public.adminos_record_customer_event(c,new.user_id,'lead','residence_enquiry_created','residence_leads',new.id,
      'Residence enquiry created',coalesce(rname,new.contact_name,'Residence enquiry'),new.stage,
      jsonb_build_object('residence_id',new.residence_id,'residence_name',rname,'funding_type',new.funding_type,'room_preference',new.room_preference,'academic_year',new.academic_year),new.created_at,
      concat('residence_leads:',new.id,':created'));
  elsif new.stage is distinct from old.stage then
    perform public.adminos_record_customer_event(c,new.user_id,'lead','residence_enquiry_stage_changed','residence_leads',new.id,
      'Residence enquiry progressed',concat(coalesce(rname,'Residence enquiry'),' → ',new.stage),new.stage,
      jsonb_build_object('old_stage',old.stage,'new_stage',new.stage,'residence_id',new.residence_id,'residence_name',rname),new.updated_at,
      concat('residence_leads:',new.id,':stage:',new.stage));
  end if;
  return new;
end; $$;
drop trigger if exists trg_adminos_customer_event_lead on public.residence_leads;
create trigger trg_adminos_customer_event_lead after insert or update of stage on public.residence_leads
for each row execute function public.adminos_customer_event_lead_trigger();

create or replace function public.adminos_customer_event_whatsapp_trigger() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  perform public.adminos_record_customer_event(new.contact_id,null,'communication',concat('whatsapp_',new.direction),'adminos_whatsapp_messages',new.id,
    case when new.direction='inbound' then 'WhatsApp received' else 'WhatsApp sent' end,
    left(coalesce(new.body_text,case when jsonb_array_length(coalesce(new.media,'[]'::jsonb))>0 then 'Media message' else null end),500),new.status,
    jsonb_build_object('thread_id',new.thread_id,'direction',new.direction,'message_kind',new.message_kind,'media_count',jsonb_array_length(coalesce(new.media,'[]'::jsonb)),'author_type',new.metadata->>'author_type'),
    coalesce(new.received_at,new.sent_at,new.created_at),concat('adminos_whatsapp_messages:',new.id));
  return new;
end; $$;
drop trigger if exists trg_adminos_customer_event_whatsapp on public.adminos_whatsapp_messages;
create trigger trg_adminos_customer_event_whatsapp after insert on public.adminos_whatsapp_messages
for each row execute function public.adminos_customer_event_whatsapp_trigger();

-- Backfill current operational history. Safe to rerun because idempotency keys are unique.
insert into public.adminos_customer_events(contact_id,user_id,event_category,event_type,source_table,source_id,title,summary,status,metadata,occurred_at,idempotency_key)
select public.adminos_contact_id_for_user(a.user_id),a.user_id,'application','application_created','applications',a.id,'Accommodation application submitted',coalesce(r.name,'Accommodation application'),a.status,
  jsonb_build_object('residence_id',a.residence_id,'residence_name',r.name,'funding_type',a.funding_type,'institution_type',a.institution_type),coalesce(a.created_at,now()),concat('applications:',a.id,':created')
from public.applications a left join public.residences r on r.id=a.residence_id
on conflict (idempotency_key) do nothing;

insert into public.adminos_customer_events(contact_id,user_id,event_category,event_type,source_table,source_id,title,summary,status,metadata,occurred_at,idempotency_key)
select m.contact_id,c.profile_user_id,'communication',concat('whatsapp_',m.direction),'adminos_whatsapp_messages',m.id,
  case when m.direction='inbound' then 'WhatsApp received' else 'WhatsApp sent' end,left(coalesce(m.body_text,'Media message'),500),m.status,
  jsonb_build_object('thread_id',m.thread_id,'direction',m.direction,'message_kind',m.message_kind,'media_count',jsonb_array_length(coalesce(m.media,'[]'::jsonb)),'author_type',m.metadata->>'author_type'),coalesce(m.received_at,m.sent_at,m.created_at),concat('adminos_whatsapp_messages:',m.id)
from public.adminos_whatsapp_messages m left join public.adminos_contacts c on c.id=m.contact_id
on conflict (idempotency_key) do nothing;

insert into public.adminos_customer_events(contact_id,user_id,event_category,event_type,source_table,source_id,title,summary,status,metadata,occurred_at,idempotency_key)
select public.adminos_contact_id_for_user(w.student_id),w.student_id,'wil','wil_application_created','wil_applications',w.id,'WIL application submitted',concat_ws(' · ',w.course,w.campus),w.status,
  jsonb_build_object('course',w.course,'campus',w.campus,'wil_duration',w.wil_duration,'funding_status',w.funding_status),w.created_at,concat('wil_applications:',w.id,':created')
from public.wil_applications w on conflict (idempotency_key) do nothing;

insert into public.adminos_customer_events(contact_id,user_id,event_category,event_type,source_table,source_id,title,summary,status,metadata,occurred_at,idempotency_key)
select public.adminos_contact_id_for_user(ar.user_id),ar.user_id,'reservation','reservation_created','accommodation_reservations',ar.id,'Accommodation reservation created',coalesce(r.name,'Accommodation reservation'),ar.status,
  jsonb_build_object('residence_id',ar.residence_id,'residence_name',r.name,'academic_year',ar.academic_year,'funding_type',ar.funding_type),ar.created_at,concat('accommodation_reservations:',ar.id,':created')
from public.accommodation_reservations ar left join public.residences r on r.id=ar.residence_id
on conflict (idempotency_key) do nothing;