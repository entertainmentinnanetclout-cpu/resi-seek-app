-- ResKonnect Golden Service Cycle: one private operational projection across all service lines.
-- Never changes legal application status, creates external outbound messages or exposes documents.
create table if not exists public.rk_golden_service_rules(
 kind text primary key check(kind in('application','reservation','viewing','enquiry','onboarding','application_support','private_rental','student_support','wil','landlord','partner')),
 first_response_minutes integer not null default 240 check(first_response_minutes between 15 and 4320),
 followup_minutes integer not null default 1440 check(followup_minutes between 60 and 20160),
 enabled boolean not null default true,
 updated_at timestamptz not null default now()
);
insert into public.rk_golden_service_rules(kind,first_response_minutes,followup_minutes)
values ('application',240,1440),('reservation',120,720),('viewing',120,720),('enquiry',120,720),
('onboarding',120,1440),('application_support',240,1440),('private_rental',240,1440),
('student_support',120,720),('wil',240,1440),('landlord',240,1440),('partner',240,1440)
on conflict(kind) do nothing;

create table if not exists public.rk_golden_service_cases(
 kind text not null references public.rk_golden_service_rules(kind),
 source_id uuid not null,
 user_id uuid,
 residence_id uuid,
 source_status text not null,
 step text not null default 'received'
  check(step in('received','in_review','awaiting_customer','awaiting_residence','awaiting_partner','followup','post_service','closed')),
 next_action text not null,
 priority text not null default 'normal' check(priority in('urgent','high','normal','low')),
 first_response_due_at timestamptz not null,
 next_action_due_at timestamptz not null,
 last_human_response_at timestamptz,
 last_human_channel text,
 receipt_issued_at timestamptz,
 snoozed_until timestamptz,
 first_breach_at timestamptz,
 closed_at timestamptz,
 source_created_at timestamptz not null,
 source_updated_at timestamptz not null,
 updated_at timestamptz not null default now(),
 primary key(kind,source_id)
);
create index if not exists rk_golden_pending_idx
 on public.rk_golden_service_cases(next_action_due_at,priority) where closed_at is null;
create index if not exists rk_golden_first_reply_idx
 on public.rk_golden_service_cases(first_response_due_at) where closed_at is null and last_human_response_at is null;
create index if not exists rk_golden_user_idx on public.rk_golden_service_cases(user_id,source_created_at desc) where user_id is not null;
create index if not exists rk_golden_residence_idx on public.rk_golden_service_cases(residence_id,source_created_at desc) where residence_id is not null;

create table if not exists public.rk_golden_service_events(
 id bigint generated always as identity primary key,
 kind text not null,
 source_id uuid not null,
 actor_id uuid,
 event_type text not null check(length(event_type) between 3 and 50),
 note text,
 channel text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 foreign key(kind,source_id) references public.rk_golden_service_cases(kind,source_id) on delete cascade,
 check(length(coalesce(note,''))<=1500)
);
create index if not exists rk_golden_event_source_idx on public.rk_golden_service_events(kind,source_id,created_at desc);

create table if not exists public.rk_golden_digest_receipts(
 admin_user_id uuid not null,
 digest_day date not null,
 created_at timestamptz not null default now(),
 primary key(admin_user_id,digest_day)
);
alter table public.rk_golden_service_rules enable row level security;
alter table public.rk_golden_service_cases enable row level security;
alter table public.rk_golden_service_events enable row level security;
alter table public.rk_golden_digest_receipts enable row level security;
revoke all on public.rk_golden_service_rules,public.rk_golden_service_cases,
 public.rk_golden_service_events,public.rk_golden_digest_receipts from PUBLIC,anon,authenticated;
grant all on public.rk_golden_service_rules,public.rk_golden_service_cases,
 public.rk_golden_service_events,public.rk_golden_digest_receipts to service_role;
comment on table public.rk_golden_service_cases is 'Private derived task-state; customer-facing statuses remain owned by their original business tables. Automatic receipt is not proof of human response.';

-- One idempotent projection function for the 11 existing intake/decision pipelines.
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
  -- Private in-app receipt only; does NOT claim an email/WhatsApp or human response.
  insert into public.notifications(user_id,type,title,message,metadata,is_read,event_key)
  select v_user,'service_received','Your ResKonnect request is recorded',
   'Your request is in your ResKonnect service queue. Track its progress under My Service; further information may still be required.',
   jsonb_build_object('kind',p_kind,'source_id',p_id),false,'rk_golden_received_'||p_kind||'_'||p_id::text
  where not exists(select 1 from public.notifications
   where user_id=v_user and event_key='rk_golden_received_'||p_kind||'_'||p_id::text);
  update public.rk_golden_service_cases set receipt_issued_at=coalesce(receipt_issued_at,now())
  where kind=p_kind and source_id=p_id;
 end if;
end $fn$;
revoke all on function reskonnect_internal.rk_golden_sync(text,uuid,boolean) from PUBLIC,anon,authenticated;

create or replace function reskonnect_internal.rk_golden_source_changed()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare v_kind text;
begin
 v_kind:=case tg_table_name
  when 'applications' then 'application' when 'accommodation_reservations' then 'reservation'
  when 'viewing_requests' then 'viewing' when 'residence_leads' then 'enquiry'
  when 'onboarding_requests' then 'onboarding' when 'application_support_queries' then 'application_support'
  when 'private_rental_requests' then 'private_rental' when 'student_requests' then 'student_support'
  when 'wil_applications' then 'wil' when 'landlord_applications' then 'landlord'
  when 'partner_leads' then 'partner' end;
 if v_kind is not null then
  perform reskonnect_internal.rk_golden_sync(v_kind,new.id,tg_op='INSERT');
 end if;
 return new;
end $fn$;
revoke all on function reskonnect_internal.rk_golden_source_changed() from PUBLIC,anon,authenticated;

do $fn$
declare t text;
begin
 foreach t in array array['applications','accommodation_reservations','viewing_requests',
  'residence_leads','onboarding_requests','application_support_queries','private_rental_requests',
  'student_requests','wil_applications','landlord_applications','partner_leads']
 loop
  execute format('drop trigger if exists zz_rk_golden_cycle_sync on public.%I',t);
  execute format('create trigger zz_rk_golden_cycle_sync after insert or update of status on public.%I for each row execute function reskonnect_internal.rk_golden_source_changed()',t);
 end loop;
end $fn$;
-- Residence leads use stage rather than status.
drop trigger if exists zz_rk_golden_cycle_sync on public.residence_leads;
create trigger zz_rk_golden_cycle_sync after insert or update of stage
on public.residence_leads for each row execute function reskonnect_internal.rk_golden_source_changed();
-- Post-service move-in changes are important even when the application status stays approved.
drop trigger if exists zz_rk_golden_cycle_sync on public.applications;
create trigger zz_rk_golden_cycle_sync after insert or update of status,moved_in
on public.applications for each row execute function reskonnect_internal.rk_golden_source_changed();

-- Document uploads should wake the operator's work item, never auto-approve evidence.
create or replace function reskonnect_internal.rk_golden_documents_changed()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare v_id uuid;
begin
 v_id:=case when tg_op='DELETE' then old.application_id else new.application_id end;
 update public.rk_golden_service_cases
 set next_action='verify_new_document_evidence',next_action_due_at=least(next_action_due_at,now()+interval '2 hours'),updated_at=now()
 where kind='application' and source_id=v_id and closed_at is null;
 return coalesce(new,old);
end $fn$;
revoke all on function reskonnect_internal.rk_golden_documents_changed() from PUBLIC,anon,authenticated;
drop trigger if exists zz_rk_golden_documents_changed on public.application_documents;
create trigger zz_rk_golden_documents_changed after insert or update of status or delete
on public.application_documents for each row execute function reskonnect_internal.rk_golden_documents_changed();

-- Backfill existing intakes silently: no emails, WhatsApps, or fabricated receipts.
do $fn$
declare c record;
begin
 for c in select 'application' kind,id from public.applications
  union all select 'reservation',id from public.accommodation_reservations
  union all select 'viewing',id from public.viewing_requests
  union all select 'enquiry',id from public.residence_leads where source_type in('manual','demand')
  union all select 'onboarding',id from public.onboarding_requests
  union all select 'application_support',id from public.application_support_queries
  union all select 'private_rental',id from public.private_rental_requests
  union all select 'student_support',id from public.student_requests
  union all select 'wil',id from public.wil_applications
  union all select 'landlord',id from public.landlord_applications
  union all select 'partner',id from public.partner_leads
 loop perform reskonnect_internal.rk_golden_sync(c.kind,c.id,false); end loop;
end $fn$;
