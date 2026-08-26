alter table public.residences
  add column if not exists private_price numeric,
  add column if not exists nsfas_price numeric,
  add column if not exists promo_active boolean not null default false,
  add column if not exists promo_title text,
  add column if not exists promo_description text,
  add column if not exists promo_price numeric,
  add column if not exists promo_badge text,
  add column if not exists promo_room_type text,
  add column if not exists promo_starts_at timestamptz,
  add column if not exists promo_ends_at timestamptz,
  add column if not exists reservations_2027_open boolean not null default false,
  add column if not exists reservation_note text,
  add column if not exists reservation_fee numeric,
  add column if not exists latitude numeric(9,6),
  add column if not exists longitude numeric(9,6),
  add column if not exists map_label text;

alter table public.residences drop constraint if exists residences_latitude_range;
alter table public.residences add constraint residences_latitude_range check (latitude is null or latitude between -90 and 90);
alter table public.residences drop constraint if exists residences_longitude_range;
alter table public.residences add constraint residences_longitude_range check (longitude is null or longitude between -180 and 180);

update public.residences
set private_price = price
where private_price is null and coalesce(accepts_private,false) = true;

update public.residences
set reservations_2027_open = true,
    reservation_note = coalesce(reservation_note, '2027 reservations are open. A reservation records interest for the 2027 intake and is not a final lease until confirmed by the residence.')
where lower(coalesce(campus,'') || ' ' || coalesce(address,'')) like '%pretoria%';

update public.residences
set promo_active = true,
    promo_title = coalesce(promo_title, 'Private Tenant Promotion'),
    promo_description = coalesce(promo_description, 'Limited private-tenant promotional pricing is available. Confirm the current promotional rate and room availability before payment.'),
    promo_badge = coalesce(promo_badge, 'PRIVATE PROMO')
where lower(coalesce(name,'')) like '%believe%student%living%' or lower(coalesce(name,'')) like '%believe%';

create table if not exists public.accommodation_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  residence_id uuid not null references public.residences(id) on delete cascade,
  academic_year integer not null default 2027 check (academic_year between 2027 and 2100),
  funding_type text not null default 'undecided' check (funding_type in ('private','nsfas','other','undecided')),
  room_preference text,
  notes text,
  status text not null default 'reserved' check (status in ('reserved','pending','confirmed','waitlisted','cancelled')),
  source text not null default 'find_my_res',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,residence_id,academic_year)
);

alter table public.accommodation_reservations enable row level security;

drop policy if exists "Users can view own accommodation reservations" on public.accommodation_reservations;
create policy "Users can view own accommodation reservations"
on public.accommodation_reservations for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create own accommodation reservations" on public.accommodation_reservations;
create policy "Users can create own accommodation reservations"
on public.accommodation_reservations for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own accommodation reservations" on public.accommodation_reservations;
create policy "Users can update own accommodation reservations"
on public.accommodation_reservations for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists accommodation_reservations_residence_year_idx on public.accommodation_reservations(residence_id,academic_year,status);
create index if not exists accommodation_reservations_user_idx on public.accommodation_reservations(user_id,created_at desc);

create or replace function public.set_accommodation_reservation_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists accommodation_reservations_set_updated_at on public.accommodation_reservations;
create trigger accommodation_reservations_set_updated_at
before update on public.accommodation_reservations
for each row execute function public.set_accommodation_reservation_updated_at();

create or replace function public.notify_accommodation_reservation()
returns trigger language plpgsql security definer set search_path = public as $$
declare residence_name text;
begin
  select name into residence_name from public.residences where id = new.residence_id;
  insert into public.notifications(user_id,title,message,type,is_read,metadata)
  values (
    new.user_id,
    '2027 reservation saved',
    'Your 2027 reservation interest for ' || coalesce(residence_name,'this residence') || ' has been recorded. ResKonnect or the residence will contact you when the next confirmation step is ready.',
    'accommodation_reservation',
    false,
    jsonb_build_object('reservation_id',new.id,'residence_id',new.residence_id,'academic_year',new.academic_year,'status',new.status)
  );
  return new;
end; $$;

drop trigger if exists accommodation_reservation_notification on public.accommodation_reservations;
create trigger accommodation_reservation_notification
after insert on public.accommodation_reservations
for each row execute function public.notify_accommodation_reservation();

create table if not exists public.application_support_partners (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  service_scope text[] not null default '{}',
  website_url text,
  logo_url text,
  image_url text,
  cta_label text not null default 'Get assisted',
  integration_status text not null default 'planned' check (integration_status in ('planned','active','paused')),
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.application_support_partners enable row level security;
drop policy if exists "Public can view active application support partners" on public.application_support_partners;
create policy "Public can view active application support partners"
on public.application_support_partners for select to anon, authenticated
using (is_active = true);

insert into public.application_support_partners(slug,name,description,service_scope,cta_label,integration_status,is_active,display_order)
values (
  'setup',
  'SETUP',
  'Hands-on application assistance partner. ResKonnect helps students prepare and understand what they need; SETUP can support the assisted application process once the partner website integration is connected.',
  array['University applications','TVET applications','Application submission assistance','Document readiness handover'],
  'Application assistance',
  'planned',
  true,
  10
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  service_scope = excluded.service_scope,
  cta_label = excluded.cta_label,
  is_active = excluded.is_active,
  updated_at = now();