-- Harden the 2027 growth portal surface and backfill existing accommodation activity.

-- Demand Network is also a high-value student action: require complete contact details.
drop trigger if exists trg_demand_contact_required on public.accommodation_demands;
create trigger trg_demand_contact_required before insert on public.accommodation_demands
for each row execute function public.enforce_student_contact_before_action();

-- Split public/private read policies so anonymous traffic never needs privileged helpers.
drop policy if exists "public read active room pricing" on public.residence_room_types;
drop policy if exists "anon read active room pricing" on public.residence_room_types;
drop policy if exists "authenticated read room pricing" on public.residence_room_types;
create policy "anon read active room pricing" on public.residence_room_types
for select to anon using (is_active = true);
create policy "authenticated read room pricing" on public.residence_room_types
for select to authenticated
using (is_active = true or public.can_manage_growth() or public.is_authorized_residence_user(residence_id));

drop policy if exists "public read active creators" on public.creator_partners;
drop policy if exists "anon read active creators" on public.creator_partners;
drop policy if exists "authenticated read creator profiles" on public.creator_partners;
create policy "anon read active creators" on public.creator_partners
for select to anon using (status = 'active');
create policy "authenticated read creator profiles" on public.creator_partners
for select to authenticated
using (status = 'active' or user_id = auth.uid() or public.can_manage_growth());

-- Narrow first-party growth event capture instead of accepting arbitrary anonymous rows.
drop policy if exists "clients capture growth events" on public.growth_events;
drop policy if exists "anon capture public growth events" on public.growth_events;
drop policy if exists "authenticated capture own growth events" on public.growth_events;
create policy "anon capture public growth events" on public.growth_events
for insert to anon
with check (
  user_id is null
  and source = 'web'
  and event_type in ('page_view','accommodation_search')
  and octet_length(metadata::text) <= 8192
  and (
    creator_id is null or exists (
      select 1 from public.creator_partners cp where cp.id = creator_id and cp.status = 'active'
    )
  )
);
create policy "authenticated capture own growth events" on public.growth_events
for insert to authenticated
with check (
  (user_id is null or user_id = auth.uid())
  and source = 'web'
  and event_type in ('page_view','accommodation_search')
  and octet_length(metadata::text) <= 8192
  and (
    creator_id is null or exists (
      select 1 from public.creator_partners cp where cp.id = creator_id and cp.status = 'active'
    )
  )
);

-- Remove accidental PUBLIC/anon RPC exposure from internal trigger/helper functions.
revoke all on function public.profile_has_required_contact(uuid) from public;
revoke all on function public.enforce_student_contact_before_action() from public;
revoke all on function public.touch_residence_room_type() from public;
revoke all on function public.touch_residence_lead() from public;
revoke all on function public.sync_application_to_residence_lead() from public;
revoke all on function public.sync_reservation_to_residence_lead() from public;
revoke all on function public.touch_creator_partner() from public;
revoke all on function public.touch_accommodation_demand() from public;
revoke all on function public.capture_core_growth_event() from public;
revoke all on function public.track_creator_conversion_from_action() from public;
revoke all on function public.track_creator_placement_from_lead() from public;

-- Privileged helpers remain callable only by authenticated users and retain their own authorization checks.
revoke all on function public.can_manage_growth() from public;
grant execute on function public.can_manage_growth() to authenticated;

revoke all on function public.match_accommodation_demand(uuid) from public;
grant execute on function public.match_accommodation_demand(uuid) to authenticated;

revoke all on function public.get_residence_demand_summary(uuid) from public;
grant execute on function public.get_residence_demand_summary(uuid) to authenticated;

revoke all on function public.admin_growth_command_centre(integer) from public;
grant execute on function public.admin_growth_command_centre(integer) to authenticated;

revoke all on function public.attribute_creator(uuid,text,text,text) from public;
grant execute on function public.attribute_creator(uuid,text,text,text) to authenticated;

-- Public creator lookup only returns RLS-approved active profiles, so it can run as invoker.
alter function public.get_creator_public(text) security invoker;
revoke all on function public.get_creator_public(text) from public;
grant execute on function public.get_creator_public(text) to anon, authenticated;

-- Backfill the landlord CRM from all existing residence applications.
insert into public.residence_leads(
  residence_id,user_id,source_type,source_id,stage,funding_type,academic_year,
  contact_name,contact_phone,contact_email,created_at,updated_at
)
select
  a.residence_id,a.user_id,'application',a.id,
  case
    when a.status in ('approved','conditionally_approved') then 'lease_pending'
    when a.status in ('rejected','withdrawn') then 'lost'
    else 'new'
  end,
  a.funding_type,
  extract(year from coalesce(a.application_date,a.created_at,now()))::int,
  coalesce(nullif(btrim(p.full_name),''),'Applicant'),
  coalesce(nullif(btrim(p.phone),''),nullif(btrim(p.phone_number),'')),
  p.email,
  coalesce(a.created_at,now()),now()
from public.applications a
left join public.profiles p on p.id = a.user_id
where a.residence_id is not null
on conflict (source_type,source_id) where source_id is not null do update set
  stage = excluded.stage,
  funding_type = coalesce(excluded.funding_type,public.residence_leads.funding_type),
  contact_name = coalesce(excluded.contact_name,public.residence_leads.contact_name),
  contact_phone = coalesce(excluded.contact_phone,public.residence_leads.contact_phone),
  contact_email = coalesce(excluded.contact_email,public.residence_leads.contact_email),
  updated_at = now();

-- Backfill all existing 2027/current accommodation reservations into the same CRM.
insert into public.residence_leads(
  residence_id,user_id,source_type,source_id,stage,funding_type,room_preference,academic_year,
  contact_name,contact_phone,contact_email,last_contacted_at,created_at,updated_at
)
select
  r.residence_id,r.user_id,'reservation',r.id,
  case
    when r.status = 'confirmed' then 'reserved'
    when r.status = 'cancelled' then 'lost'
    when r.status = 'contacted' then 'contacted'
    else 'new'
  end,
  r.funding_type,r.room_preference,r.academic_year,
  coalesce(nullif(btrim(p.full_name),''),'Student'),
  coalesce(nullif(btrim(p.phone),''),nullif(btrim(p.phone_number),'')),
  p.email,
  r.last_contacted_at,
  coalesce(r.created_at,now()),now()
from public.accommodation_reservations r
left join public.profiles p on p.id = r.user_id
where r.residence_id is not null
on conflict (source_type,source_id) where source_id is not null do update set
  stage = excluded.stage,
  funding_type = coalesce(excluded.funding_type,public.residence_leads.funding_type),
  room_preference = coalesce(excluded.room_preference,public.residence_leads.room_preference),
  academic_year = coalesce(excluded.academic_year,public.residence_leads.academic_year),
  contact_name = coalesce(excluded.contact_name,public.residence_leads.contact_name),
  contact_phone = coalesce(excluded.contact_phone,public.residence_leads.contact_phone),
  contact_email = coalesce(excluded.contact_email,public.residence_leads.contact_email),
  last_contacted_at = coalesce(excluded.last_contacted_at,public.residence_leads.last_contacted_at),
  updated_at = now();