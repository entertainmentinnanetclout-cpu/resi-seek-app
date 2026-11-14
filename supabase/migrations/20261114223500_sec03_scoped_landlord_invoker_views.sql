-- SEC-03 (completion): eliminate the remaining owner-privileged landlord views
-- without widening RLS on private profiles or residence lead contact columns.
-- Keep original view names, columns and select order to preserve portal clients.

create table if not exists public.rk_residence_portal_application_cards (
 id uuid primary key references public.applications(id) on delete cascade,
 user_id uuid,
 residence_id uuid,
 status text,
 funding_type text,
 created_at timestamptz,
 updated_at timestamptz,
 notes text,
 application_date timestamptz,
 move_in_date date,
 moved_in boolean,
 institution_type text,
 applicant_name text,
 student_number text,
 campus text,
 course text
);
create index if not exists rk_portal_application_cards_residence_idx
 on public.rk_residence_portal_application_cards(residence_id,created_at desc);
alter table public.rk_residence_portal_application_cards enable row level security;
revoke all on public.rk_residence_portal_application_cards from public,anon,authenticated;
drop policy if exists rk_portal_application_cards_scoped_select
 on public.rk_residence_portal_application_cards;
create policy rk_portal_application_cards_scoped_select
 on public.rk_residence_portal_application_cards
 for select to authenticated using (
  auth.uid() is not null and
  (public.is_authorized_residence_user(residence_id) or public.can_manage_growth())
 );
grant select on public.rk_residence_portal_application_cards to authenticated;

create table if not exists public.rk_residence_portal_lead_cards (
 id uuid primary key references public.residence_leads(id) on delete cascade,
 residence_id uuid not null,
 user_id uuid,
 source_type text not null,
 source_id uuid,
 stage text not null,
 funding_type text,
 room_preference text,
 academic_year integer,
 contact_name text,
 admin_notes text,
 last_contacted_at timestamptz,
 next_follow_up_at timestamptz,
 created_at timestamptz not null,
 updated_at timestamptz not null
);
create index if not exists rk_portal_lead_cards_residence_idx
 on public.rk_residence_portal_lead_cards(residence_id,created_at desc);
alter table public.rk_residence_portal_lead_cards enable row level security;
revoke all on public.rk_residence_portal_lead_cards from public,anon,authenticated;
drop policy if exists rk_portal_lead_cards_scoped_select
 on public.rk_residence_portal_lead_cards;
create policy rk_portal_lead_cards_scoped_select
 on public.rk_residence_portal_lead_cards
 for select to authenticated using (
  auth.uid() is not null and
  (public.is_authorized_residence_user(residence_id) or public.can_manage_growth())
 );
grant select on public.rk_residence_portal_lead_cards to authenticated;

-- Profile updates refresh ONLY four previously permitted academic identity fields.
-- Full profile documents, identity numbers, phones and emails never enter these cards.
create or replace function reskonnect_internal.rk_refresh_portal_profile_cards()
returns trigger language plpgsql security definer set search_path='' as $f$
begin
 if TG_OP='DELETE' then
  update public.rk_residence_portal_application_cards
    set applicant_name=null,student_number=null,campus=null,course=null
    where user_id=old.id;
  return old;
 end if;
 update public.rk_residence_portal_application_cards
  set applicant_name=new.full_name,student_number=new.student_number,
      campus=new.campus,course=new.course
  where user_id=new.id;
 return new;
end $f$;
revoke all on function reskonnect_internal.rk_refresh_portal_profile_cards()
 from public,anon,authenticated;
drop trigger if exists rk_refresh_portal_profile_cards on public.profiles;
create trigger rk_refresh_portal_profile_cards
 after update of full_name,student_number,campus,course or delete on public.profiles
 for each row execute function reskonnect_internal.rk_refresh_portal_profile_cards();

create or replace function reskonnect_internal.rk_sync_portal_application_card()
returns trigger language plpgsql security definer set search_path='' as $f$
declare v_name text;v_number text;v_campus text;v_course text;
begin
 if TG_OP='DELETE' then
  delete from public.rk_residence_portal_application_cards where id=old.id;
  return old;
 end if;
 select p.full_name,p.student_number,p.campus,p.course
 into v_name,v_number,v_campus,v_course
 from public.profiles p where p.id=new.user_id;
 insert into public.rk_residence_portal_application_cards
  (id,user_id,residence_id,status,funding_type,created_at,updated_at,
   notes,application_date,move_in_date,moved_in,institution_type,
   applicant_name,student_number,campus,course)
 values(new.id,new.user_id,new.residence_id,new.status,new.funding_type,
  new.created_at,new.updated_at,new.notes,new.application_date,new.move_in_date,
  new.moved_in,new.institution_type,v_name,v_number,v_campus,v_course)
 on conflict(id) do update set
  user_id=excluded.user_id,residence_id=excluded.residence_id,
  status=excluded.status,funding_type=excluded.funding_type,
  created_at=excluded.created_at,updated_at=excluded.updated_at,
  notes=excluded.notes,application_date=excluded.application_date,
  move_in_date=excluded.move_in_date,moved_in=excluded.moved_in,
  institution_type=excluded.institution_type,applicant_name=excluded.applicant_name,
  student_number=excluded.student_number,campus=excluded.campus,course=excluded.course;
 return new;
end $f$;
revoke all on function reskonnect_internal.rk_sync_portal_application_card()
 from public,anon,authenticated;
drop trigger if exists rk_sync_portal_application_card on public.applications;
create trigger rk_sync_portal_application_card
 after insert or update or delete on public.applications
 for each row execute function reskonnect_internal.rk_sync_portal_application_card();

create or replace function reskonnect_internal.rk_sync_portal_lead_card()
returns trigger language plpgsql security definer set search_path='' as $f$
begin
 if TG_OP='DELETE' then
  delete from public.rk_residence_portal_lead_cards where id=old.id;
  return old;
 end if;
 insert into public.rk_residence_portal_lead_cards
  (id,residence_id,user_id,source_type,source_id,stage,
   funding_type,room_preference,academic_year,contact_name,admin_notes,
   last_contacted_at,next_follow_up_at,created_at,updated_at)
 values(new.id,new.residence_id,new.user_id,new.source_type,new.source_id,
  new.stage,new.funding_type,new.room_preference,new.academic_year,
  new.contact_name,new.admin_notes,new.last_contacted_at,new.next_follow_up_at,
  new.created_at,new.updated_at)
 on conflict(id) do update set
  residence_id=excluded.residence_id,user_id=excluded.user_id,
  source_type=excluded.source_type,source_id=excluded.source_id,
  stage=excluded.stage,funding_type=excluded.funding_type,
  room_preference=excluded.room_preference,academic_year=excluded.academic_year,
  contact_name=excluded.contact_name,admin_notes=excluded.admin_notes,
  last_contacted_at=excluded.last_contacted_at,
  next_follow_up_at=excluded.next_follow_up_at,
  created_at=excluded.created_at,updated_at=excluded.updated_at;
 return new;
end $f$;
revoke all on function reskonnect_internal.rk_sync_portal_lead_card()
 from public,anon,authenticated;
drop trigger if exists rk_sync_portal_lead_card on public.residence_leads;
create trigger rk_sync_portal_lead_card
 after insert or update or delete on public.residence_leads
 for each row execute function reskonnect_internal.rk_sync_portal_lead_card();

-- Backfill existing rows before changing the read paths.
insert into public.rk_residence_portal_application_cards
 (id,user_id,residence_id,status,funding_type,created_at,updated_at,
 notes,application_date,move_in_date,moved_in,institution_type,
 applicant_name,student_number,campus,course)
select a.id,a.user_id,a.residence_id,a.status,a.funding_type,a.created_at,a.updated_at,
 a.notes,a.application_date,a.move_in_date,a.moved_in,a.institution_type,
 p.full_name,p.student_number,p.campus,p.course
from public.applications a left join public.profiles p on p.id=a.user_id
on conflict(id) do update set
 user_id=excluded.user_id,residence_id=excluded.residence_id,
 status=excluded.status,funding_type=excluded.funding_type,
 created_at=excluded.created_at,updated_at=excluded.updated_at,
 notes=excluded.notes,application_date=excluded.application_date,
 move_in_date=excluded.move_in_date,moved_in=excluded.moved_in,
 institution_type=excluded.institution_type,applicant_name=excluded.applicant_name,
 student_number=excluded.student_number,campus=excluded.campus,course=excluded.course;

insert into public.rk_residence_portal_lead_cards
 (id,residence_id,user_id,source_type,source_id,stage,funding_type,
 room_preference,academic_year,contact_name,admin_notes,last_contacted_at,
 next_follow_up_at,created_at,updated_at)
select id,residence_id,user_id,source_type,source_id,stage,funding_type,
 room_preference,academic_year,contact_name,admin_notes,last_contacted_at,
 next_follow_up_at,created_at,updated_at
from public.residence_leads
on conflict(id) do update set
 residence_id=excluded.residence_id,user_id=excluded.user_id,
 source_type=excluded.source_type,source_id=excluded.source_id,
 stage=excluded.stage,funding_type=excluded.funding_type,
 room_preference=excluded.room_preference,academic_year=excluded.academic_year,
 contact_name=excluded.contact_name,admin_notes=excluded.admin_notes,
 last_contacted_at=excluded.last_contacted_at,
 next_follow_up_at=excluded.next_follow_up_at,
 created_at=excluded.created_at,updated_at=excluded.updated_at;

-- Preserve the exact view contract for ResidenceInbox, ResidenceApplicationDetail
-- and ResidenceCRM. The caller's RLS, not view-owner privilege, now selects rows.
create or replace view public.residence_portal_applications_safe
 with(security_barrier=true,security_invoker=true) as
select id,user_id,residence_id,status,funding_type,created_at,updated_at,notes,
 application_date,move_in_date,moved_in,institution_type,
 applicant_name,student_number,campus,course
from public.rk_residence_portal_application_cards
where public.is_authorized_residence_user(residence_id) or public.can_manage_growth();

create or replace view public.residence_portal_leads_safe
 with(security_barrier=true,security_invoker=true) as
select id,residence_id,user_id,source_type,source_id,stage,funding_type,
 room_preference,academic_year,contact_name,admin_notes,
 last_contacted_at,next_follow_up_at,created_at,updated_at
from public.rk_residence_portal_lead_cards
where public.is_authorized_residence_user(residence_id) or public.can_manage_growth();

revoke all on public.residence_portal_applications_safe from public,anon,authenticated;
revoke all on public.residence_portal_leads_safe from public,anon,authenticated;
grant select on public.residence_portal_applications_safe to authenticated;
grant select on public.residence_portal_leads_safe to authenticated;

notify pgrst,'reload schema';
