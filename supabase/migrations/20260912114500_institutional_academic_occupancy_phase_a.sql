-- Institutional academic-period and year-isolated accommodation operations.
-- Phase A is backwards-compatible with the currently deployed 3-column
-- accommodation reservation conflict target. Phase B removes that legacy key
-- only after all writers have been upgraded.

-- ---------------------------------------------------------------------------
-- Academic context snapshots
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists academic_year integer,
  add column if not exists academic_cycle text,
  add column if not exists academic_period smallint,
  add column if not exists study_level text,
  add column if not exists student_stage text;

alter table public.applications
  add column if not exists academic_year integer,
  add column if not exists academic_cycle text,
  add column if not exists academic_period smallint,
  add column if not exists study_level text,
  add column if not exists student_stage text;

alter table public.accommodation_reservations
  add column if not exists academic_cycle text,
  add column if not exists academic_period smallint,
  add column if not exists study_level text,
  add column if not exists student_stage text;

update public.profiles
set academic_year=coalesce(academic_year,extract(year from current_date)::integer),
    academic_cycle=coalesce(nullif(lower(trim(academic_cycle)),''),'unspecified'),
    academic_period=coalesce(academic_period,0),
    study_level=coalesce(nullif(lower(trim(study_level)),''),'unspecified'),
    student_stage=coalesce(nullif(lower(trim(student_stage)),''),'unspecified')
where academic_year is null or academic_cycle is null or academic_period is null
   or study_level is null or student_stage is null;

update public.applications a
set academic_year=coalesce(
      a.academic_year,
      extract(year from a.move_in_date)::integer,
      extract(year from a.application_date)::integer,
      extract(year from a.created_at)::integer,
      extract(year from current_date)::integer
    ),
    academic_cycle=coalesce(nullif(lower(trim(a.academic_cycle)),''),nullif(lower(trim(p.academic_cycle)),''),'unspecified'),
    academic_period=coalesce(a.academic_period,p.academic_period,0),
    study_level=coalesce(nullif(lower(trim(a.study_level)),''),nullif(lower(trim(p.study_level)),''),'unspecified'),
    student_stage=coalesce(nullif(lower(trim(a.student_stage)),''),nullif(lower(trim(p.student_stage)),''),'unspecified')
from public.profiles p
where p.id=a.user_id
  and (a.academic_year is null or a.academic_cycle is null or a.academic_period is null
    or a.study_level is null or a.student_stage is null);

update public.applications
set academic_year=coalesce(academic_year,extract(year from application_date)::integer,extract(year from created_at)::integer,extract(year from current_date)::integer),
    academic_cycle=coalesce(nullif(lower(trim(academic_cycle)),''),'unspecified'),
    academic_period=coalesce(academic_period,0),
    study_level=coalesce(nullif(lower(trim(study_level)),''),'unspecified'),
    student_stage=coalesce(nullif(lower(trim(student_stage)),''),'unspecified')
where academic_year is null or academic_cycle is null or academic_period is null
   or study_level is null or student_stage is null;

update public.accommodation_reservations ar
set academic_cycle=coalesce(nullif(lower(trim(ar.academic_cycle)),''),'unspecified'),
    academic_period=coalesce(ar.academic_period,0),
    study_level=coalesce(nullif(lower(trim(ar.study_level)),''),nullif(lower(trim(p.study_level)),''),'unspecified'),
    student_stage=coalesce(nullif(lower(trim(ar.student_stage)),''),nullif(lower(trim(p.student_stage)),''),'unspecified')
from public.profiles p
where p.id=ar.user_id
  and (ar.academic_cycle is null or ar.academic_period is null or ar.study_level is null or ar.student_stage is null);

update public.accommodation_reservations
set academic_cycle=coalesce(nullif(lower(trim(academic_cycle)),''),'unspecified'),
    academic_period=coalesce(academic_period,0),
    study_level=coalesce(nullif(lower(trim(study_level)),''),'unspecified'),
    student_stage=coalesce(nullif(lower(trim(student_stage)),''),'unspecified')
where academic_cycle is null or academic_period is null or study_level is null or student_stage is null;

alter table public.profiles
  alter column academic_year set default (extract(year from current_date)::integer),
  alter column academic_cycle set default 'unspecified',
  alter column academic_period set default 0,
  alter column study_level set default 'unspecified',
  alter column student_stage set default 'unspecified';

alter table public.applications
  alter column academic_year set default (extract(year from current_date)::integer),
  alter column academic_cycle set default 'unspecified',
  alter column academic_period set default 0,
  alter column study_level set default 'unspecified',
  alter column student_stage set default 'unspecified',
  alter column academic_year set not null,
  alter column academic_cycle set not null,
  alter column academic_period set not null,
  alter column study_level set not null,
  alter column student_stage set not null;

alter table public.accommodation_reservations
  alter column academic_cycle set default 'unspecified',
  alter column academic_period set default 0,
  alter column study_level set default 'unspecified',
  alter column student_stage set default 'unspecified',
  alter column academic_cycle set not null,
  alter column academic_period set not null,
  alter column study_level set not null,
  alter column student_stage set not null;

do $$
begin
  if exists(select 1 from pg_constraint where conname='accommodation_reservations_academic_year_check' and conrelid='public.accommodation_reservations'::regclass) then
    alter table public.accommodation_reservations drop constraint accommodation_reservations_academic_year_check;
  end if;
  if exists(select 1 from pg_constraint where conname='resmap_room_holds_academic_year_check' and conrelid='public.resmap_room_holds'::regclass) then
    alter table public.resmap_room_holds drop constraint resmap_room_holds_academic_year_check;
  end if;
end $$;

alter table public.accommodation_reservations
  add constraint accommodation_reservations_academic_year_check check (academic_year between 2020 and 2100);
alter table public.resmap_room_holds
  add constraint resmap_room_holds_academic_year_check check (academic_year between 2020 and 2100);

do $$
declare t text;
begin
  foreach t in array array['profiles','applications','accommodation_reservations'] loop
    execute format('alter table public.%I drop constraint if exists %I',t,t||'_academic_cycle_check');
    execute format('alter table public.%I add constraint %I check (academic_cycle in (''unspecified'',''annual'',''semester'',''trimester''))',t,t||'_academic_cycle_check');
    execute format('alter table public.%I drop constraint if exists %I',t,t||'_academic_period_check');
    execute format('alter table public.%I add constraint %I check ((academic_cycle=''unspecified'' and academic_period=0) or (academic_cycle=''annual'' and academic_period=1) or (academic_cycle=''semester'' and academic_period between 1 and 2) or (academic_cycle=''trimester'' and academic_period between 1 and 3))',t,t||'_academic_period_check');
    execute format('alter table public.%I drop constraint if exists %I',t,t||'_study_level_check');
    execute format('alter table public.%I add constraint %I check (study_level in (''unspecified'',''undergraduate'',''postgraduate'',''advanced'',''other''))',t,t||'_study_level_check');
    execute format('alter table public.%I drop constraint if exists %I',t,t||'_student_stage_check');
    execute format('alter table public.%I add constraint %I check (student_stage in (''unspecified'',''first_time'',''continuing'',''returning'',''advanced'',''graduating'',''other''))',t,t||'_student_stage_check');
  end loop;
end $$;

alter table public.profiles drop constraint if exists profiles_academic_year_check;
alter table public.profiles add constraint profiles_academic_year_check check (academic_year is null or academic_year between 2020 and 2100);
alter table public.applications drop constraint if exists applications_academic_year_check;
alter table public.applications add constraint applications_academic_year_check check (academic_year between 2020 and 2100);

-- New conflict target is added in Phase A while the old target remains temporarily.
alter table public.accommodation_reservations
  drop constraint if exists accommodation_reservations_academic_period_key;
alter table public.accommodation_reservations
  add constraint accommodation_reservations_academic_period_key
  unique(user_id,residence_id,academic_year,academic_cycle,academic_period);

create index if not exists idx_applications_academic_context
  on public.applications(academic_year,academic_cycle,academic_period,study_level,status);
create index if not exists idx_reservations_academic_context
  on public.accommodation_reservations(academic_year,academic_cycle,academic_period,study_level,status);

-- ---------------------------------------------------------------------------
-- Academic calendar catalogue (no invented institutional dates)
-- ---------------------------------------------------------------------------
create table if not exists public.academic_periods(
  id uuid primary key default gen_random_uuid(),
  academic_year integer not null check (academic_year between 2020 and 2100),
  institution_sector text not null default 'all' check (institution_sector in ('all','university','tvet','private','other')),
  academic_cycle text not null check (academic_cycle in ('annual','semester','trimester')),
  period_number smallint not null,
  label text not null,
  starts_on date,
  ends_on date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(academic_year,institution_sector,academic_cycle,period_number),
  check (
    (academic_cycle='annual' and period_number=1)
    or (academic_cycle='semester' and period_number between 1 and 2)
    or (academic_cycle='trimester' and period_number between 1 and 3)
  ),
  check (starts_on is null or ends_on is null or ends_on>=starts_on)
);

alter table public.academic_periods enable row level security;
drop policy if exists "Academic periods readable" on public.academic_periods;
create policy "Academic periods readable" on public.academic_periods
for select to anon,authenticated using (true);
drop policy if exists "Staff manage academic periods" on public.academic_periods;
create policy "Staff manage academic periods" on public.academic_periods
for all to authenticated
using (
  exists(select 1 from public.user_roles ur where ur.user_id=(select auth.uid())
    and ur.role::text in ('admin','super_admin','developer','owner','growth_lead','operations_lead','system_operator'))
)
with check (
  exists(select 1 from public.user_roles ur where ur.user_id=(select auth.uid())
    and ur.role::text in ('admin','super_admin','developer','owner','growth_lead','operations_lead','system_operator'))
);
grant select on public.academic_periods to anon,authenticated;
grant insert,update,delete on public.academic_periods to authenticated;
create index if not exists idx_academic_periods_year_cycle
  on public.academic_periods(academic_year,academic_cycle,period_number,is_active);

insert into public.academic_periods(academic_year,institution_sector,academic_cycle,period_number,label)
select y,'all','annual',1,y::text||' Annual'
from (values (extract(year from current_date)::integer),(extract(year from current_date)::integer+1)) v(y)
on conflict do nothing;
insert into public.academic_periods(academic_year,institution_sector,academic_cycle,period_number,label)
select y,'all','semester',p,y::text||' Semester '||p
from (values (extract(year from current_date)::integer),(extract(year from current_date)::integer+1)) v(y)
cross join (values (1),(2)) n(p)
on conflict do nothing;
insert into public.academic_periods(academic_year,institution_sector,academic_cycle,period_number,label)
select y,'tvet','trimester',p,y::text||' Trimester '||p
from (values (extract(year from current_date)::integer),(extract(year from current_date)::integer+1)) v(y)
cross join (values (1),(2),(3)) n(p)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Year-isolated physical bed inventory
-- ---------------------------------------------------------------------------
create table if not exists public.residence_academic_inventory(
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences(id) on delete cascade,
  academic_year integer not null check (academic_year between 2020 and 2100),
  capacity integer not null default 0 check (capacity>=0),
  reported_available_beds integer check (reported_available_beds is null or reported_available_beds>=0),
  blocked_beds integer not null default 0 check (blocked_beds>=0),
  inventory_status text not null default 'planning' check (inventory_status in ('planning','reported','verified','closed')),
  notes text,
  verified_at timestamptz,
  verified_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(residence_id,academic_year),
  check (reported_available_beds is null or reported_available_beds+blocked_beds<=capacity)
);

alter table public.residence_academic_inventory enable row level security;
drop policy if exists "Staff and residence portals read academic inventory" on public.residence_academic_inventory;
create policy "Staff and residence portals read academic inventory" on public.residence_academic_inventory
for select to authenticated using (
  exists(select 1 from public.user_roles ur where ur.user_id=(select auth.uid())
    and ur.role::text in ('admin','super_admin','developer','owner','growth_lead','operations_lead','system_operator'))
  or exists(select 1 from public.residence_portal_accounts rpa
    where rpa.residence_id=residence_academic_inventory.residence_id
      and rpa.user_id=(select auth.uid()) and rpa.is_active=true)
);
drop policy if exists "Staff and residence portals manage academic inventory" on public.residence_academic_inventory;
create policy "Staff and residence portals manage academic inventory" on public.residence_academic_inventory
for all to authenticated
using (
  exists(select 1 from public.user_roles ur where ur.user_id=(select auth.uid())
    and ur.role::text in ('admin','super_admin','developer','owner','growth_lead','operations_lead','system_operator'))
  or exists(select 1 from public.residence_portal_accounts rpa
    where rpa.residence_id=residence_academic_inventory.residence_id
      and rpa.user_id=(select auth.uid()) and rpa.is_active=true)
)
with check (
  exists(select 1 from public.user_roles ur where ur.user_id=(select auth.uid())
    and ur.role::text in ('admin','super_admin','developer','owner','growth_lead','operations_lead','system_operator'))
  or exists(select 1 from public.residence_portal_accounts rpa
    where rpa.residence_id=residence_academic_inventory.residence_id
      and rpa.user_id=(select auth.uid()) and rpa.is_active=true)
);
grant select,insert,update,delete on public.residence_academic_inventory to authenticated;
create index if not exists idx_residence_academic_inventory_year
  on public.residence_academic_inventory(academic_year,residence_id,inventory_status);

-- Current-year availability is the only legacy availability copied.
insert into public.residence_academic_inventory(
  residence_id,academic_year,capacity,reported_available_beds,inventory_status,notes
)
select r.id,extract(year from current_date)::integer,coalesce(r.capacity,0),
       case when r.available_spots is null then null else greatest(0,least(coalesce(r.capacity,0),r.available_spots)) end,
       case when r.available_spots is null then 'planning' else 'reported' end,
       'Migrated from the legacy current-year residence availability field.'
from public.residences r
on conflict(residence_id,academic_year) do nothing;

-- Future year receives capacity only. Occupancy/open beds must be independently reported.
insert into public.residence_academic_inventory(
  residence_id,academic_year,capacity,reported_available_beds,inventory_status,notes
)
select r.id,extract(year from current_date)::integer+1,coalesce(r.capacity,0),null,'planning',
       'Future-year capacity shell. Availability is intentionally independent from the prior year.'
from public.residences r
on conflict(residence_id,academic_year) do nothing;

create or replace function public.sync_legacy_residence_inventory_current_year()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.residence_academic_inventory(
    residence_id,academic_year,capacity,reported_available_beds,inventory_status,notes,updated_at
  ) values (
    new.id,extract(year from current_date)::integer,coalesce(new.capacity,0),
    case when new.available_spots is null then null else greatest(0,least(coalesce(new.capacity,0),new.available_spots)) end,
    case when new.available_spots is null then 'planning' else 'reported' end,
    'Synced from legacy current-year residence fields.',now()
  )
  on conflict(residence_id,academic_year) do update set
    capacity=excluded.capacity,
    reported_available_beds=excluded.reported_available_beds,
    inventory_status=case when public.residence_academic_inventory.inventory_status='verified'
      then 'verified' else excluded.inventory_status end,
    updated_at=now();
  return new;
end $$;
revoke all on function public.sync_legacy_residence_inventory_current_year() from public,anon,authenticated;

drop trigger if exists trg_sync_legacy_residence_inventory_current_year on public.residences;
create trigger trg_sync_legacy_residence_inventory_current_year
after insert or update of capacity,available_spots on public.residences
for each row execute function public.sync_legacy_residence_inventory_current_year();

-- Snapshot profile context when an application is created, without rewriting history later.
create or replace function public.snapshot_application_academic_context()
returns trigger language plpgsql security definer set search_path=public as $$
declare p public.profiles%rowtype;
begin
  if new.user_id is not null then select * into p from public.profiles where id=new.user_id; end if;
  new.academic_year:=coalesce(new.academic_year,extract(year from new.move_in_date)::integer,extract(year from new.application_date)::integer,extract(year from current_date)::integer);
  new.academic_cycle:=coalesce(nullif(lower(trim(new.academic_cycle)),''),nullif(lower(trim(p.academic_cycle)),''),'unspecified');
  new.academic_period:=coalesce(new.academic_period,p.academic_period,0);
  new.study_level:=coalesce(nullif(lower(trim(new.study_level)),''),nullif(lower(trim(p.study_level)),''),'unspecified');
  new.student_stage:=coalesce(nullif(lower(trim(new.student_stage)),''),nullif(lower(trim(p.student_stage)),''),'unspecified');
  return new;
end $$;
revoke all on function public.snapshot_application_academic_context() from public,anon,authenticated;
drop trigger if exists trg_snapshot_application_academic_context on public.applications;
create trigger trg_snapshot_application_academic_context
before insert on public.applications for each row
execute function public.snapshot_application_academic_context();

-- ---------------------------------------------------------------------------
-- Admin-safe institutional views
-- ---------------------------------------------------------------------------
create or replace view public.admin_applications_safe with (security_invoker=true) as
select a.id as application_id,a.user_id,a.residence_id,a.status as application_status,
       a.institution_type,a.funding_type,a.notes,a.application_date,a.move_in_date,a.moved_in,
       a.created_at,a.updated_at,r.name as residence_name,r.campus as residence_campus,
       r.accepts_tvet,r.audience_tags,p.full_name as student_name,p.email as student_email,
       p.phone as student_phone,p.student_number,p.campus as student_campus,
       ar.referral_code,ar.referral_agent_user_id,ar.status as referral_status,
       ar.commission_amount,ap.full_name as recruiter_name,ap.email as recruiter_email,
       a.academic_year,a.academic_cycle,a.academic_period,a.study_level,a.student_stage
from public.applications a
left join public.residences r on r.id=a.residence_id
left join public.profiles p on p.id=a.user_id
left join public.application_referrals ar on ar.application_id=a.id
left join public.profiles ap on ap.id=ar.referral_agent_user_id
where exists(
  select 1 from public.user_roles ur where ur.user_id=(select auth.uid())
    and ur.role::text in ('admin','super_admin','developer','owner','growth_lead','operations_lead','system_operator')
);
grant select on public.admin_applications_safe to authenticated;

create or replace view public.accommodation_reservations_admin_v with (security_invoker=true) as
select ar.id,ar.user_id,ar.residence_id,ar.academic_year,ar.funding_type,ar.room_preference,
       ar.status,ar.notes,ar.admin_notes,ar.source,ar.last_contacted_at,ar.created_at,ar.updated_at,
       r.name as residence_name,r.address as residence_address,r.campus as residence_campus,
       p.full_name as student_name,p.student_number,p.email as student_email,p.phone as student_phone,
       ar.academic_cycle,ar.academic_period,ar.study_level,ar.student_stage
from public.accommodation_reservations ar
left join public.residences r on r.id=ar.residence_id
left join public.profiles p on p.id=ar.user_id;
grant select on public.accommodation_reservations_admin_v to authenticated;

-- ---------------------------------------------------------------------------
-- Institutional provider dashboard RPC
-- ---------------------------------------------------------------------------
drop function if exists public.admin_dashboard_overview();
create function public.admin_dashboard_overview(
  p_academic_year integer default extract(year from current_date)::integer,
  p_academic_cycle text default null,
  p_academic_period smallint default null,
  p_study_level text default null,
  p_student_stage text default null
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  allowed boolean;
  metrics jsonb;
  recent_apps jsonb;
  recent_events jsonb;
  unresolved_alerts jsonb;
  cycle_breakdown jsonb;
  level_breakdown jsonb;
  stage_breakdown jsonb;
  y integer:=coalesce(p_academic_year,extract(year from current_date)::integer);
begin
  select exists(select 1 from public.user_roles ur where ur.user_id=auth.uid()
    and ur.role::text in ('admin','super_admin','developer','owner','growth_lead','operations_lead','system_operator')) into allowed;
  if auth.uid() is null or not allowed then raise exception 'not authorized'; end if;
  if y<2020 or y>2100 then raise exception 'invalid academic year'; end if;
  if p_academic_cycle is not null and p_academic_cycle not in ('annual','semester','trimester','unspecified') then raise exception 'invalid academic cycle'; end if;
  if p_study_level is not null and p_study_level not in ('undergraduate','postgraduate','advanced','other','unspecified') then raise exception 'invalid study level'; end if;
  if p_student_stage is not null and p_student_stage not in ('first_time','continuing','returning','advanced','graduating','other','unspecified') then raise exception 'invalid student stage'; end if;

  select jsonb_build_object(
    'academicYear',y,'academicCycle',p_academic_cycle,'academicPeriod',p_academic_period,
    'studyLevel',p_study_level,'studentStage',p_student_stage,
    'academicCapacity',(select coalesce(sum(capacity),0) from public.residence_academic_inventory where academic_year=y),
    'reportedAvailableBeds',(select coalesce(sum(reported_available_beds),0) from public.residence_academic_inventory where academic_year=y and reported_available_beds is not null),
    'reportedOccupiedBeds',(select coalesce(sum(greatest(capacity-reported_available_beds-blocked_beds,0)),0) from public.residence_academic_inventory where academic_year=y and reported_available_beds is not null),
    'inventoryResidenceCount',(select count(*) from public.residence_academic_inventory where academic_year=y),
    'inventoryReportedCount',(select count(*) from public.residence_academic_inventory where academic_year=y and reported_available_beds is not null),
    'inventoryVerifiedCount',(select count(*) from public.residence_academic_inventory where academic_year=y and inventory_status='verified'),
    'fullAcademicResidences',(select count(*) from public.residence_academic_inventory where academic_year=y and reported_available_beds=0),
    'academicApplications',(select count(*) from public.applications a where a.academic_year=y
      and (p_academic_cycle is null or a.academic_cycle=p_academic_cycle)
      and (p_academic_period is null or a.academic_period=p_academic_period)
      and (p_study_level is null or a.study_level=p_study_level)
      and (p_student_stage is null or a.student_stage=p_student_stage)),
    'academicPendingApplications',(select count(*) from public.applications a where a.academic_year=y
      and a.status in ('pending','submitted','documents_required','under_review','conditionally_approved')
      and (p_academic_cycle is null or a.academic_cycle=p_academic_cycle)
      and (p_academic_period is null or a.academic_period=p_academic_period)
      and (p_study_level is null or a.study_level=p_study_level)
      and (p_student_stage is null or a.student_stage=p_student_stage)),
    'academicApprovedApplications',(select count(*) from public.applications a where a.academic_year=y and a.status='approved'
      and (p_academic_cycle is null or a.academic_cycle=p_academic_cycle)
      and (p_academic_period is null or a.academic_period=p_academic_period)
      and (p_study_level is null or a.study_level=p_study_level)
      and (p_student_stage is null or a.student_stage=p_student_stage)),
    'academicMovedInStudents',(select count(distinct a.user_id) from public.applications a where a.academic_year=y and coalesce(a.moved_in,false)=true
      and (p_academic_cycle is null or a.academic_cycle=p_academic_cycle)
      and (p_academic_period is null or a.academic_period=p_academic_period)
      and (p_study_level is null or a.study_level=p_study_level)
      and (p_student_stage is null or a.student_stage=p_student_stage)),
    'academicReservations',(select count(*) from public.accommodation_reservations ar where ar.academic_year=y and ar.status<>'cancelled'
      and (p_academic_cycle is null or ar.academic_cycle=p_academic_cycle)
      and (p_academic_period is null or ar.academic_period=p_academic_period)
      and (p_study_level is null or ar.study_level=p_study_level)
      and (p_student_stage is null or ar.student_stage=p_student_stage)),
    'academicConfirmedReservations',(select count(*) from public.accommodation_reservations ar where ar.academic_year=y and ar.status='confirmed'
      and (p_academic_cycle is null or ar.academic_cycle=p_academic_cycle)
      and (p_academic_period is null or ar.academic_period=p_academic_period)
      and (p_study_level is null or ar.study_level=p_study_level)
      and (p_student_stage is null or ar.student_stage=p_student_stage)),
    'academicProvisionalHolds',(select count(*) from public.accommodation_reservations ar where ar.academic_year=y and ar.status='provisional_hold'
      and (p_academic_cycle is null or ar.academic_cycle=p_academic_cycle)
      and (p_academic_period is null or ar.academic_period=p_academic_period)
      and (p_study_level is null or ar.study_level=p_study_level)
      and (p_student_stage is null or ar.student_stage=p_student_stage)),
    -- Existing platform-wide metrics remain available for the rest of AdminOS.
    'totalResidences',(select count(*) from public.residences),
    'totalApplications',(select count(*) from public.applications),
    'pendingApplications',(select count(*) from public.applications where status in('pending','submitted','documents_required','under_review','conditionally_approved')),
    'approvedApplications',(select count(*) from public.applications where status='approved'),
    'rejectedApplications',(select count(*) from public.applications where status='rejected'),
    'totalUsers',(select count(*) from public.profiles),
    'totalListings',(select count(*) from public.marketplace_listings),
    'unverifiedListings',(select count(*) from public.marketplace_listings where coalesce(verified,false)=false),
    'totalViews',(select count(*) from public.residence_analytics),
    'activeBursaries',(select count(*) from public.bursaries where is_active=true),
    'activeDiscounts',(select count(*) from public.student_discounts where is_active=true),
    'totalStores',(select count(*) from public.stores),
    'totalWilApps',(select count(*) from public.wil_applications),
    'pendingWilApps',(select count(*) from public.wil_applications where status in('submitted','under_review','pending')),
    'totalPortals',(select count(*) from public.residence_portal_accounts where is_active=true),
    'totalHamperOrders',(select count(*) from public.hamper_orders),
    'totalDiscountOrders',(select count(*) from public.discount_orders),
    'totalSlides',(select count(*) from public.hero_slides where coalesce(is_active,true)=true),
    'totalNews',(select count(*) from public.campus_news where coalesce(is_published,true)=true),
    'totalEvents',(select count(*) from public.events),
    'totalSections',(select count(*) from public.residence_sections where is_active=true),
    'totalAvailableSpots',(select coalesce(sum(coalesce(available_spots,0)),0) from public.residences),
    'fullResidences',(select count(*) from public.residences where coalesce(available_spots,0)=0),
    'unresolvedAlerts',(select count(*) from public.admin_alerts where coalesce(resolved,false)=false),
    'publishedPartners',(select count(*) from public.partner_showcase where is_published=true),
    'totalReservations2027',(select count(*) from public.accommodation_reservations where academic_year=2027),
    'pendingReservations2027',(select count(*) from public.accommodation_reservations where academic_year=2027 and status in('reserved','contacted','provisional_hold')),
    'confirmedReservations2027',(select count(*) from public.accommodation_reservations where academic_year=2027 and status='confirmed'),
    'activeSiteAnnouncements',(select count(*) from public.site_announcements where is_active=true and(starts_at is null or starts_at<=now()) and(ends_at is null or ends_at>=now())),
    'generatedAt',now()
  ) into metrics;

  select jsonb_build_object(
    'annual',(select count(*) from public.applications where academic_year=y and academic_cycle='annual'),
    'semester',(select count(*) from public.applications where academic_year=y and academic_cycle='semester'),
    'trimester',(select count(*) from public.applications where academic_year=y and academic_cycle='trimester'),
    'unspecified',(select count(*) from public.applications where academic_year=y and academic_cycle='unspecified')
  ) into cycle_breakdown;

  select jsonb_build_object(
    'undergraduate',(select count(*) from public.applications where academic_year=y and study_level='undergraduate'),
    'postgraduate',(select count(*) from public.applications where academic_year=y and study_level='postgraduate'),
    'advanced',(select count(*) from public.applications where academic_year=y and study_level='advanced'),
    'other',(select count(*) from public.applications where academic_year=y and study_level='other'),
    'unspecified',(select count(*) from public.applications where academic_year=y and study_level='unspecified')
  ) into level_breakdown;

  select jsonb_build_object(
    'first_time',(select count(*) from public.applications where academic_year=y and student_stage='first_time'),
    'continuing',(select count(*) from public.applications where academic_year=y and student_stage='continuing'),
    'returning',(select count(*) from public.applications where academic_year=y and student_stage='returning'),
    'advanced',(select count(*) from public.applications where academic_year=y and student_stage='advanced'),
    'graduating',(select count(*) from public.applications where academic_year=y and student_stage='graduating'),
    'other',(select count(*) from public.applications where academic_year=y and student_stage='other'),
    'unspecified',(select count(*) from public.applications where academic_year=y and student_stage='unspecified')
  ) into stage_breakdown;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into recent_apps
  from(
    select a.id,a.status,a.created_at,a.funding_type,p.full_name student_name,p.student_number,
           r.name residence_name,a.academic_year,a.academic_cycle,a.academic_period,a.study_level,a.student_stage
    from public.applications a
    left join public.profiles p on p.id=a.user_id
    left join public.residences r on r.id=a.residence_id
    where a.academic_year=y
      and (p_academic_cycle is null or a.academic_cycle=p_academic_cycle)
      and (p_academic_period is null or a.academic_period=p_academic_period)
      and (p_study_level is null or a.study_level=p_study_level)
      and (p_student_stage is null or a.student_stage=p_student_stage)
    order by a.created_at desc limit 8
  )x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into recent_events
  from(select id,type,entity,entity_id,metadata,payload,created_at from public.system_events order by created_at desc limit 12)x;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into unresolved_alerts
  from(select id,title,description,severity,created_at from public.admin_alerts where coalesce(resolved,false)=false order by created_at desc limit 10)x;

  return jsonb_build_object(
    'metrics',metrics,
    'academicBreakdown',jsonb_build_object('cycle',cycle_breakdown,'studyLevel',level_breakdown,'studentStage',stage_breakdown),
    'recentApplications',recent_apps,'recentEvents',recent_events,'alerts',unresolved_alerts
  );
end $$;

revoke all on function public.admin_dashboard_overview(integer,text,smallint,text,text) from public,anon;
grant execute on function public.admin_dashboard_overview(integer,text,smallint,text,text) to authenticated;

comment on table public.residence_academic_inventory is
'Year-isolated accommodation capacity and reported availability. Never infer a future academic year occupancy from another year.';
comment on column public.residences.available_spots is
'Legacy/current-year public listing availability. Institutional occupancy reporting must use residence_academic_inventory keyed by academic_year.';
