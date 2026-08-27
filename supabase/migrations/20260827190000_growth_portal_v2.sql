-- ResKonnect premium growth, landlord CRM, room pricing, creator and demand network layer.
-- Idempotent production migration. Does not invent residence prices, coordinates or promotions.

create or replace function public.can_manage_growth()
returns boolean language sql stable security definer set search_path='' set row_security='off' as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id=auth.uid() and ur.role::text in ('admin','growth_lead','operations_lead','system_operator')
  )
$$;

-- ---------------------------------------------------------------------------
-- Contact completeness enforcement for high-value student actions.
-- ---------------------------------------------------------------------------
create or replace function public.profile_has_required_contact(_user_id uuid)
returns boolean language sql stable security definer set search_path='' set row_security='off' as $$
  select exists (
    select 1 from public.profiles p
    where p.id=_user_id
      and nullif(btrim(coalesce(p.full_name,'')),'') is not null
      and nullif(btrim(coalesce(p.phone,'')),'') is not null
      and nullif(btrim(coalesce(p.student_number,'')),'') is not null
      and nullif(btrim(coalesce(p.campus,'')),'') is not null
  )
$$;

create or replace function public.enforce_student_contact_before_action()
returns trigger language plpgsql security definer set search_path='public' as $$
begin
  if new.user_id is not null and not public.profile_has_required_contact(new.user_id) then
    raise exception 'Complete your full name, phone number, student number and campus before continuing.' using errcode='P0001';
  end if;
  return new;
end $$;

drop trigger if exists trg_application_contact_required on public.applications;
create trigger trg_application_contact_required before insert on public.applications
for each row execute function public.enforce_student_contact_before_action();

drop trigger if exists trg_reservation_contact_required on public.accommodation_reservations;
create trigger trg_reservation_contact_required before insert on public.accommodation_reservations
for each row execute function public.enforce_student_contact_before_action();

-- ---------------------------------------------------------------------------
-- Room-level commercial architecture and verification.
-- ---------------------------------------------------------------------------
alter table public.residences
  add column if not exists pricing_year integer default 2027,
  add column if not exists price_verified_at timestamptz,
  add column if not exists price_verified_by uuid references auth.users(id) on delete set null,
  add column if not exists contact_phone text,
  add column if not exists whatsapp_phone text;

create table if not exists public.residence_room_types (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences(id) on delete cascade,
  name text not null,
  slug text,
  description text,
  academic_year integer not null default 2027,
  capacity integer not null default 0 check (capacity >= 0),
  available_beds integer not null default 0 check (available_beds >= 0),
  private_price numeric check (private_price is null or private_price >= 0),
  nsfas_price numeric check (nsfas_price is null or nsfas_price >= 0),
  deposit numeric check (deposit is null or deposit >= 0),
  admin_fee numeric check (admin_fee is null or admin_fee >= 0),
  reservation_fee numeric check (reservation_fee is null or reservation_fee >= 0),
  promo_price numeric check (promo_price is null or promo_price >= 0),
  promo_starts_at timestamptz,
  promo_ends_at timestamptz,
  is_active boolean not null default true,
  price_verified_at timestamptz,
  price_verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists residence_room_types_unique_name_year
  on public.residence_room_types(residence_id,lower(name),academic_year);
create index if not exists residence_room_types_public_idx
  on public.residence_room_types(residence_id,academic_year,is_active,available_beds desc);

alter table public.residence_room_types enable row level security;
drop policy if exists "public read active room pricing" on public.residence_room_types;
create policy "public read active room pricing" on public.residence_room_types for select to anon,authenticated
using (is_active=true or public.can_manage_growth() or public.is_authorized_residence_user(residence_id));
drop policy if exists "residence staff manage room pricing" on public.residence_room_types;
create policy "residence staff manage room pricing" on public.residence_room_types for all to authenticated
using (public.can_manage_growth() or public.is_authorized_residence_user(residence_id))
with check (public.can_manage_growth() or public.is_authorized_residence_user(residence_id));

create or replace function public.touch_residence_room_type()
returns trigger language plpgsql set search_path='public' as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists trg_touch_residence_room_type on public.residence_room_types;
create trigger trg_touch_residence_room_type before update on public.residence_room_types
for each row execute function public.touch_residence_room_type();

create or replace view public.residence_room_pricing_public_v with (security_invoker=true) as
select id,residence_id,name,slug,description,academic_year,capacity,available_beds,private_price,nsfas_price,
       deposit,admin_fee,reservation_fee,promo_price,promo_starts_at,promo_ends_at,price_verified_at,updated_at
from public.residence_room_types where is_active=true;
grant select on public.residence_room_pricing_public_v to anon,authenticated;

-- ---------------------------------------------------------------------------
-- Landlord CRM. Applications + reservations feed a unified lead pipeline.
-- ---------------------------------------------------------------------------
create table if not exists public.residence_leads (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  source_type text not null check (source_type in ('application','reservation','viewing','manual','demand')),
  source_id uuid,
  stage text not null default 'new' check (stage in ('new','contacted','viewing','documents','reserved','lease_pending','placed','lost')),
  funding_type text,
  room_preference text,
  academic_year integer,
  contact_name text,
  contact_phone text,
  contact_email text,
  admin_notes text,
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists residence_leads_source_unique on public.residence_leads(source_type,source_id) where source_id is not null;
create index if not exists residence_leads_pipeline_idx on public.residence_leads(residence_id,stage,created_at desc);

alter table public.residence_leads enable row level security;
drop policy if exists "residence staff read leads" on public.residence_leads;
create policy "residence staff read leads" on public.residence_leads for select to authenticated
using (public.can_manage_growth() or public.is_authorized_residence_user(residence_id));
drop policy if exists "residence staff manage leads" on public.residence_leads;
create policy "residence staff manage leads" on public.residence_leads for all to authenticated
using (public.can_manage_growth() or public.is_authorized_residence_user(residence_id))
with check (public.can_manage_growth() or public.is_authorized_residence_user(residence_id));

create or replace function public.touch_residence_lead()
returns trigger language plpgsql set search_path='public' as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists trg_touch_residence_lead on public.residence_leads;
create trigger trg_touch_residence_lead before update on public.residence_leads for each row execute function public.touch_residence_lead();

create or replace function public.sync_application_to_residence_lead()
returns trigger language plpgsql security definer set search_path='public' as $$
declare p public.profiles%rowtype;
begin
  select * into p from public.profiles where id=new.user_id;
  insert into public.residence_leads(residence_id,user_id,source_type,source_id,stage,funding_type,academic_year,contact_name,contact_phone,contact_email,created_at,updated_at)
  values(new.residence_id,new.user_id,'application',new.id,
    case when new.status in ('approved','conditionally_approved') then 'lease_pending' when new.status in ('rejected','withdrawn') then 'lost' else 'new' end,
    new.funding_type,extract(year from now())::int,coalesce(p.full_name,'Applicant'),p.phone,p.email,coalesce(new.created_at,now()),now())
  on conflict (source_type,source_id) where source_id is not null do update set
    stage=case when new.status in ('approved','conditionally_approved') then 'lease_pending' when new.status in ('rejected','withdrawn') then 'lost' else public.residence_leads.stage end,
    funding_type=coalesce(new.funding_type,public.residence_leads.funding_type),updated_at=now();
  return new;
end $$;
drop trigger if exists trg_sync_application_lead on public.applications;
create trigger trg_sync_application_lead after insert or update of status,funding_type on public.applications
for each row execute function public.sync_application_to_residence_lead();

create or replace function public.sync_reservation_to_residence_lead()
returns trigger language plpgsql security definer set search_path='public' as $$
declare p public.profiles%rowtype;
begin
  select * into p from public.profiles where id=new.user_id;
  insert into public.residence_leads(residence_id,user_id,source_type,source_id,stage,funding_type,room_preference,academic_year,contact_name,contact_phone,contact_email,created_at,updated_at)
  values(new.residence_id,new.user_id,'reservation',new.id,
    case when new.status='confirmed' then 'reserved' when new.status='cancelled' then 'lost' else 'new' end,
    new.funding_type,new.room_preference,new.academic_year,coalesce(p.full_name,'Student'),p.phone,p.email,new.created_at,now())
  on conflict (source_type,source_id) where source_id is not null do update set
    stage=case when new.status='confirmed' then 'reserved' when new.status='cancelled' then 'lost' else public.residence_leads.stage end,
    funding_type=new.funding_type,room_preference=new.room_preference,updated_at=now();
  return new;
end $$;
drop trigger if exists trg_sync_reservation_lead on public.accommodation_reservations;
create trigger trg_sync_reservation_lead after insert or update of status,funding_type,room_preference on public.accommodation_reservations
for each row execute function public.sync_reservation_to_residence_lead();

-- ---------------------------------------------------------------------------
-- Creator Partner Programme.
-- ---------------------------------------------------------------------------
create table if not exists public.creator_partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  display_name text not null,
  platform text not null default 'tiktok',
  handle text,
  follower_count integer not null default 0 check (follower_count >= 0),
  referral_code text not null unique,
  tier text not null default 'creator_partner' check (tier in ('creator_partner','growth_partner','campus_creator','strategic_creator')),
  status text not null default 'pending' check (status in ('pending','active','paused','rejected')),
  payout_per_verified_reservation numeric not null default 0,
  payout_per_placement numeric not null default 0,
  bio text,
  profile_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);
create index if not exists creator_partners_active_idx on public.creator_partners(status,tier,follower_count desc);

create table if not exists public.creator_referral_events (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_partners(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  session_id text,
  event_type text not null check (event_type in ('click','signup','accommodation_search','reservation','application_started','application_assisted','placement')),
  entity_type text,
  entity_id text,
  value numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists creator_referral_events_creator_idx on public.creator_referral_events(creator_id,created_at desc,event_type);

alter table public.creator_partners enable row level security;
alter table public.creator_referral_events enable row level security;
drop policy if exists "public read active creators" on public.creator_partners;
create policy "public read active creators" on public.creator_partners for select to anon,authenticated
using (status='active' or user_id=auth.uid() or public.can_manage_growth());
drop policy if exists "users apply as creator" on public.creator_partners;
create policy "users apply as creator" on public.creator_partners for insert to authenticated with check (user_id=auth.uid());
drop policy if exists "creator update own pending profile" on public.creator_partners;
create policy "creator update own pending profile" on public.creator_partners for update to authenticated
using (user_id=auth.uid() or public.can_manage_growth()) with check (user_id=auth.uid() or public.can_manage_growth());
drop policy if exists "creator read own events" on public.creator_referral_events;
create policy "creator read own events" on public.creator_referral_events for select to authenticated
using (exists(select 1 from public.creator_partners cp where cp.id=creator_id and (cp.user_id=auth.uid() or public.can_manage_growth())));
drop policy if exists "public capture creator events" on public.creator_referral_events;
create policy "public capture creator events" on public.creator_referral_events for insert to anon,authenticated
with check (exists(select 1 from public.creator_partners cp where cp.id=creator_id and cp.status='active'));

drop policy if exists "admin manage creator events" on public.creator_referral_events;
create policy "admin manage creator events" on public.creator_referral_events for all to authenticated
using (public.can_manage_growth()) with check (public.can_manage_growth());

create or replace function public.touch_creator_partner()
returns trigger language plpgsql set search_path='public' as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists trg_touch_creator_partner on public.creator_partners;
create trigger trg_touch_creator_partner before update on public.creator_partners for each row execute function public.touch_creator_partner();

create or replace function public.get_creator_public(_slug text)
returns table(id uuid,slug text,display_name text,platform text,handle text,follower_count integer,referral_code text,tier text,bio text,profile_image_url text)
language sql stable security definer set search_path='' set row_security='off' as $$
  select cp.id,cp.slug,cp.display_name,cp.platform,cp.handle,cp.follower_count,cp.referral_code,cp.tier,cp.bio,cp.profile_image_url
  from public.creator_partners cp where cp.slug=_slug and cp.status='active' limit 1
$$;
grant execute on function public.get_creator_public(text) to anon,authenticated;

-- ---------------------------------------------------------------------------
-- Demand Network and automatic matching.
-- ---------------------------------------------------------------------------
create table if not exists public.accommodation_demands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  academic_year integer not null default 2027,
  campus text not null,
  area text,
  monthly_budget numeric check (monthly_budget is null or monthly_budget >= 0),
  funding_type text not null default 'undecided' check (funding_type in ('private','nsfas','other','undecided')),
  room_type text,
  move_in_date date,
  notes text,
  status text not null default 'searching' check (status in ('searching','matched','contacted','placed','paused','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists accommodation_demands_market_idx on public.accommodation_demands(academic_year,campus,funding_type,status,created_at desc);
alter table public.accommodation_demands enable row level security;
drop policy if exists "users manage own accommodation demand" on public.accommodation_demands;
create policy "users manage own accommodation demand" on public.accommodation_demands for all to authenticated
using (user_id=auth.uid() or public.can_manage_growth()) with check (user_id=auth.uid() or public.can_manage_growth());

create or replace function public.touch_accommodation_demand()
returns trigger language plpgsql set search_path='public' as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists trg_touch_accommodation_demand on public.accommodation_demands;
create trigger trg_touch_accommodation_demand before update on public.accommodation_demands for each row execute function public.touch_accommodation_demand();

create or replace function public.match_accommodation_demand(_demand_id uuid)
returns table(residence_id uuid,match_score integer,reasons jsonb)
language sql stable security definer set search_path='' set row_security='off' as $$
  with d as (
    select * from public.accommodation_demands
    where id=_demand_id and (user_id=auth.uid() or public.can_manage_growth())
  ), scored as (
    select r.id residence_id,
      least(100,
        (case when lower(coalesce(r.campus,'')) like '%'||lower(d.campus)||'%' or lower(coalesce(r.address,'')) like '%'||lower(d.campus)||'%' then 35 else 0 end) +
        (case when d.funding_type='nsfas' and coalesce(r.accepts_nsfas,false) then 20 when d.funding_type='private' and coalesce(r.accepts_private,false) then 20 when d.funding_type in ('other','undecided') then 10 else 0 end) +
        (case when d.monthly_budget is null then 10 when coalesce(case when d.funding_type='nsfas' then r.nsfas_price else r.private_price end,r.price,0) between 1 and d.monthly_budget then 20 else 0 end) +
        (case when coalesce(r.available_spots,0)>0 then 10 else 0 end) +
        (case when d.academic_year=2027 and coalesce(r.reservations_2027_open,false) then 15 else 0 end)
      )::int match_score,
      jsonb_strip_nulls(jsonb_build_object(
        'campus_match', case when lower(coalesce(r.campus,'')) like '%'||lower(d.campus)||'%' or lower(coalesce(r.address,'')) like '%'||lower(d.campus)||'%' then true else null end,
        'funding_match', case when d.funding_type='nsfas' and coalesce(r.accepts_nsfas,false) then true when d.funding_type='private' and coalesce(r.accepts_private,false) then true else null end,
        'within_budget', case when d.monthly_budget is not null and coalesce(case when d.funding_type='nsfas' then r.nsfas_price else r.private_price end,r.price,0) between 1 and d.monthly_budget then true else null end,
        '2027_open', case when d.academic_year=2027 and coalesce(r.reservations_2027_open,false) then true else null end
      )) reasons
    from public.residences r cross join d
    where coalesce(r.is_visible,true)=true
  )
  select residence_id,match_score,reasons from scored where match_score>0 order by match_score desc limit 30
$$;
grant execute on function public.match_accommodation_demand(uuid) to authenticated;

create or replace function public.get_residence_demand_summary(_residence_id uuid)
returns jsonb language sql stable security definer set search_path='' set row_security='off' as $$
  select case when public.can_manage_growth() or public.is_authorized_residence_user(_residence_id) then
    coalesce((select jsonb_build_object(
      'searching',count(*) filter(where d.status='searching'),
      'nsfas',count(*) filter(where d.funding_type='nsfas'),
      'private',count(*) filter(where d.funding_type='private'),
      '2027',count(*) filter(where d.academic_year=2027),
      'average_budget',round(avg(d.monthly_budget) filter(where d.monthly_budget is not null))
    ) from public.accommodation_demands d
      join public.residences r on r.id=_residence_id
      where d.status in ('searching','matched','contacted')
        and (lower(d.campus)=lower(coalesce(r.campus,'')) or lower(coalesce(r.address,'')) like '%'||lower(d.campus)||'%')
    ),'{}'::jsonb)
  else '{}'::jsonb end
$$;
grant execute on function public.get_residence_demand_summary(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Daily Growth Command Centre and lightweight event stream.
-- ---------------------------------------------------------------------------
create table if not exists public.growth_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  source text not null default 'web',
  entity_type text,
  entity_id text,
  creator_id uuid references public.creator_partners(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists growth_events_time_idx on public.growth_events(occurred_at desc,event_type);
create index if not exists growth_events_creator_idx on public.growth_events(creator_id,occurred_at desc);
alter table public.growth_events enable row level security;
drop policy if exists "clients capture growth events" on public.growth_events;
create policy "clients capture growth events" on public.growth_events for insert to anon,authenticated with check (true);
drop policy if exists "growth staff read events" on public.growth_events;
create policy "growth staff read events" on public.growth_events for select to authenticated using (public.can_manage_growth());

create or replace function public.capture_core_growth_event()
returns trigger language plpgsql security definer set search_path='public' as $$
begin
  if tg_table_name='applications' then
    insert into public.growth_events(user_id,event_type,entity_type,entity_id,metadata)
    values(new.user_id,'application_started','application',new.id::text,jsonb_build_object('residence_id',new.residence_id));
  elsif tg_table_name='accommodation_reservations' then
    insert into public.growth_events(user_id,event_type,entity_type,entity_id,metadata)
    values(new.user_id,'reservation','accommodation_reservation',new.id::text,jsonb_build_object('residence_id',new.residence_id,'academic_year',new.academic_year,'funding_type',new.funding_type));
  elsif tg_table_name='accommodation_demands' then
    insert into public.growth_events(user_id,event_type,entity_type,entity_id,metadata)
    values(new.user_id,'demand_created','accommodation_demand',new.id::text,jsonb_build_object('campus',new.campus,'academic_year',new.academic_year,'funding_type',new.funding_type));
  end if;
  return new;
end $$;

drop trigger if exists trg_growth_application on public.applications;
create trigger trg_growth_application after insert on public.applications for each row execute function public.capture_core_growth_event();
drop trigger if exists trg_growth_reservation on public.accommodation_reservations;
create trigger trg_growth_reservation after insert on public.accommodation_reservations for each row execute function public.capture_core_growth_event();
drop trigger if exists trg_growth_demand on public.accommodation_demands;
create trigger trg_growth_demand after insert on public.accommodation_demands for each row execute function public.capture_core_growth_event();

create or replace function public.admin_growth_command_centre(_days integer default 7)
returns jsonb language plpgsql stable security definer set search_path='' set row_security='off' as $$
declare result jsonb;
begin
  if not public.can_manage_growth() then raise exception 'Not authorized'; end if;
  select jsonb_build_object(
    'generatedAt',now(),
    'today',jsonb_build_object(
      'pageViews',(select count(*) from public.growth_events where event_type='page_view' and occurred_at>=date_trunc('day',now())),
      'newAccounts',(select count(*) from auth.users where created_at>=date_trunc('day',now())),
      'reservations',(select count(*) from public.accommodation_reservations where created_at>=date_trunc('day',now())),
      'applications',(select count(*) from public.applications where created_at>=date_trunc('day',now())),
      'demands',(select count(*) from public.accommodation_demands where created_at>=date_trunc('day',now())),
      'creatorEvents',(select count(*) from public.creator_referral_events where created_at>=date_trunc('day',now()))
    ),
    'period',jsonb_build_object(
      'days',greatest(_days,1),
      'pageViews',(select count(*) from public.growth_events where event_type='page_view' and occurred_at>=now()-make_interval(days=>greatest(_days,1))),
      'newAccounts',(select count(*) from auth.users where created_at>=now()-make_interval(days=>greatest(_days,1))),
      'reservations',(select count(*) from public.accommodation_reservations where created_at>=now()-make_interval(days=>greatest(_days,1))),
      'applications',(select count(*) from public.applications where created_at>=now()-make_interval(days=>greatest(_days,1))),
      'demands',(select count(*) from public.accommodation_demands where created_at>=now()-make_interval(days=>greatest(_days,1))),
      'placements',(select count(*) from public.residence_leads where stage='placed' and updated_at>=now()-make_interval(days=>greatest(_days,1)))
    ),
    'funnel',jsonb_build_object(
      'visitors',(select count(distinct coalesce(user_id::text,metadata->>'visitor_id')) from public.growth_events where event_type='page_view' and occurred_at>=now()-make_interval(days=>greatest(_days,1))),
      'accounts',(select count(*) from auth.users where created_at>=now()-make_interval(days=>greatest(_days,1))),
      'searches',(select count(*) from public.growth_events where event_type='accommodation_search' and occurred_at>=now()-make_interval(days=>greatest(_days,1))),
      'reservations',(select count(*) from public.accommodation_reservations where created_at>=now()-make_interval(days=>greatest(_days,1))),
      'placed',(select count(*) from public.residence_leads where stage='placed' and updated_at>=now()-make_interval(days=>greatest(_days,1)))
    ),
    'topCampuses',coalesce((select jsonb_agg(x) from (
      select campus,count(*) value from public.accommodation_demands
      where created_at>=now()-make_interval(days=>greatest(_days,1)) group by campus order by value desc limit 8
    ) x),'[]'::jsonb),
    'topCreators',coalesce((select jsonb_agg(x) from (
      select cp.id,cp.display_name,cp.slug,count(cre.id) events,
             count(cre.id) filter(where cre.event_type='reservation') reservations,
             count(cre.id) filter(where cre.event_type='placement') placements
      from public.creator_partners cp left join public.creator_referral_events cre on cre.creator_id=cp.id and cre.created_at>=now()-make_interval(days=>greatest(_days,1))
      where cp.status='active' group by cp.id order by events desc limit 10
    ) x),'[]'::jsonb)
  ) into result;
  return result;
end $$;
grant execute on function public.admin_growth_command_centre(integer) to authenticated;
