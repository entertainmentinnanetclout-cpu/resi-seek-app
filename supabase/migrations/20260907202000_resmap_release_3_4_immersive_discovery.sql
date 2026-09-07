create table if not exists public.resmap_residence_media (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences(id) on delete cascade,
  media_type text not null check (media_type in ('photo','tour_360','video','model_3d','floorplan')),
  title text,
  url text not null,
  thumbnail_url text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  is_published boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(residence_id,url)
);
create index if not exists resmap_residence_media_idx on public.resmap_residence_media(residence_id,media_type,is_published,sort_order);

create table if not exists public.resmap_digital_twins (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null unique references public.residences(id) on delete cascade,
  model_url text,
  model_format text,
  source text not null default 'procedural' check (source in ('procedural','uploaded','photogrammetry','lidar','partner')),
  scene_json jsonb not null default '{}'::jsonb,
  scale numeric(10,4) not null default 1,
  rotation_json jsonb not null default '{"x":0,"y":0,"z":0}'::jsonb,
  is_verified boolean not null default false,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resmap_floors (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences(id) on delete cascade,
  floor_number integer,
  label text not null,
  sort_order integer not null default 0,
  plan_image_url text,
  layout_json jsonb not null default '{}'::jsonb,
  is_verified boolean not null default false,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(residence_id,label)
);
create index if not exists resmap_floors_residence_idx on public.resmap_floors(residence_id,sort_order);

create table if not exists public.resmap_rooms (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences(id) on delete cascade,
  floor_id uuid references public.resmap_floors(id) on delete set null,
  room_type_id uuid,
  room_code text,
  name text not null,
  room_type text,
  inventory_kind text not null default 'overview' check (inventory_kind in ('physical_room','room_type','overview')),
  capacity integer not null default 1,
  available_beds integer not null default 0,
  private_price numeric,
  nsfas_price numeric,
  image_url text,
  status text not null default 'available' check (status in ('available','limited','full','offline')),
  position_json jsonb not null default '{}'::jsonb,
  is_verified boolean not null default false,
  reservable boolean not null default false,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(residence_id,room_code)
);
create index if not exists resmap_rooms_residence_idx on public.resmap_rooms(residence_id,floor_id,status,is_published);

alter table public.accommodation_reservations add column if not exists room_id uuid references public.resmap_rooms(id) on delete set null;
alter table public.accommodation_reservations add column if not exists room_hold_id uuid;

create table if not exists public.resmap_room_holds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  residence_id uuid not null references public.residences(id) on delete cascade,
  room_id uuid not null references public.resmap_rooms(id) on delete cascade,
  academic_year integer not null default 2027 check (academic_year between 2027 and 2100),
  status text not null default 'active' check (status in ('active','converted','released','expired')),
  expires_at timestamptz not null default (now()+interval '20 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists resmap_room_holds_active_idx on public.resmap_room_holds(room_id,status,expires_at);
create unique index if not exists resmap_room_holds_user_active_ux on public.resmap_room_holds(user_id,room_id,academic_year) where status='active';

do $$ begin
  if not exists (select 1 from pg_constraint where conname='accommodation_reservations_room_hold_id_fkey') then
    alter table public.accommodation_reservations add constraint accommodation_reservations_room_hold_id_fkey foreign key (room_hold_id) references public.resmap_room_holds(id) on delete set null;
  end if;
end $$;

create table if not exists public.resmap_preference_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  campus text,
  institution_type text,
  institution_tag text,
  funding_type text,
  budget_min integer not null default 0,
  budget_max integer not null default 10000,
  room_types text[] not null default '{}',
  amenities text[] not null default '{}',
  priorities text[] not null default array['distance','price','availability'],
  style_tags text[] not null default '{}',
  travel_mode text not null default 'walk',
  max_travel_minutes integer,
  group_size integer not null default 1,
  dna_version integer not null default 1,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.resmap_search_groups (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  invite_code text not null unique default lower(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
  name text not null default 'My accommodation group',
  group_size integer not null default 2 check (group_size between 2 and 20),
  campus text,
  funding_type text,
  budget_per_person integer,
  room_types text[] not null default '{}',
  amenities text[] not null default '{}',
  status text not null default 'active' check (status in ('active','matched','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resmap_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.resmap_search_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  unique(group_id,user_id)
);

create table if not exists public.resmap_feed_events (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  visitor_hash text,
  residence_id uuid not null references public.residences(id) on delete cascade,
  event_type text not null check (event_type in ('view','save','map','tour','apply','reserve','share','skip')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists resmap_feed_events_residence_idx on public.resmap_feed_events(residence_id,event_type,created_at desc);

create table if not exists public.resmap_visual_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  visitor_hash text,
  input_hash text,
  derived_tags jsonb not null default '{}'::jsonb,
  result_count integer not null default 0,
  model_used text,
  created_at timestamptz not null default now()
);

insert into public.resmap_residence_media(residence_id,media_type,title,url,sort_order,is_primary,is_published,metadata)
select id,'photo','Cover image',coalesce(nullif(cover_image_url,''),nullif(image_url,'')),0,true,true,'{"source":"residence"}'::jsonb
from public.residences where coalesce(nullif(cover_image_url,''),nullif(image_url,'')) is not null
on conflict(residence_id,url) do nothing;

insert into public.resmap_residence_media(residence_id,media_type,title,url,sort_order,is_primary,is_published,metadata)
select r.id,'photo','Residence image',img,10+ord,false,true,'{"source":"gallery"}'::jsonb
from public.residences r cross join lateral unnest(coalesce(r.images,'{}'::text[])) with ordinality as t(img,ord)
where nullif(img,'') is not null
on conflict(residence_id,url) do nothing;

insert into public.resmap_residence_media(residence_id,media_type,title,url,sort_order,is_primary,is_published,metadata)
select id,'tour_360','360 / virtual tour',virtual_tour_url,0,true,true,jsonb_build_object('provider',coalesce(virtual_tour_provider,'external'))
from public.residences where nullif(virtual_tour_url,'') is not null
on conflict(residence_id,url) do nothing;

insert into public.resmap_digital_twins(residence_id,source,scene_json,is_verified,is_published)
select r.id,'procedural',jsonb_build_object('floors',greatest(1,ceil(greatest(coalesce(r.capacity,1),1)/24.0)::int),'capacity',coalesce(r.capacity,0),'generator','resmap-v1'),false,true
from public.residences r
on conflict(residence_id) do nothing;

insert into public.resmap_floors(residence_id,label,sort_order,layout_json,is_verified,is_published)
select r.id,'Inventory overview',0,jsonb_build_object('type','generated_overview','capacity',coalesce(r.capacity,0)),false,true
from public.residences r on conflict(residence_id,label) do nothing;

insert into public.resmap_rooms(residence_id,floor_id,room_type_id,room_code,name,room_type,inventory_kind,capacity,available_beds,private_price,nsfas_price,status,is_verified,reservable,is_published)
select rt.residence_id,f.id,rt.id,'TYPE-'||substr(replace(rt.id::text,'-',''),1,8),coalesce(rt.name,'Room type'),coalesce(rt.name,'room'),'room_type',greatest(coalesce(rt.capacity,1),1),greatest(coalesce(rt.available_beds,0),0),rt.private_price,rt.nsfas_price,
case when coalesce(rt.available_beds,0)<=0 then 'full' when coalesce(rt.available_beds,0)<=3 then 'limited' else 'available' end,
(rt.landlord_confirmed_at is not null),coalesce(rt.available_beds,0)>0,true
from public.residence_room_types rt
join public.resmap_floors f on f.residence_id=rt.residence_id and f.label='Inventory overview'
where coalesce(rt.is_active,true)=true
on conflict(residence_id,room_code) do update set name=excluded.name,room_type=excluded.room_type,capacity=excluded.capacity,available_beds=excluded.available_beds,private_price=excluded.private_price,nsfas_price=excluded.nsfas_price,status=excluded.status,is_verified=excluded.is_verified,reservable=excluded.reservable,is_published=true,updated_at=now();

insert into public.resmap_rooms(residence_id,floor_id,room_code,name,room_type,inventory_kind,capacity,available_beds,private_price,nsfas_price,status,is_verified,reservable,is_published)
select r.id,f.id,'OVERVIEW','Published inventory',coalesce(r.room_type,'Accommodation'),'overview',greatest(coalesce(r.capacity,1),1),greatest(coalesce(r.available_spots,0),0),coalesce(r.private_price,r.price),r.nsfas_price,
case when coalesce(r.available_spots,0)<=0 then 'full' when coalesce(r.available_spots,0)<=3 then 'limited' else 'available' end,false,false,true
from public.residences r
join public.resmap_floors f on f.residence_id=r.id and f.label='Inventory overview'
where not exists(select 1 from public.resmap_rooms rr where rr.residence_id=r.id and rr.inventory_kind='room_type')
on conflict(residence_id,room_code) do update set capacity=excluded.capacity,available_beds=excluded.available_beds,private_price=excluded.private_price,nsfas_price=excluded.nsfas_price,status=excluded.status,updated_at=now();

create or replace function public.resmap_hold_room(p_room_id uuid,p_academic_year integer default 2027,p_funding_type text default 'undecided')
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); room_row public.resmap_rooms%rowtype; active_holds integer; hold_id uuid; reservation_id uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_academic_year<2027 or p_academic_year>2100 then raise exception 'Invalid academic year'; end if;
  if p_funding_type not in ('private','nsfas','other','undecided') then p_funding_type:='undecided'; end if;
  update public.resmap_room_holds set status='expired',updated_at=now() where status='active' and expires_at<=now();
  select * into room_row from public.resmap_rooms where id=p_room_id and is_published=true for update;
  if not found then raise exception 'Room inventory not found'; end if;
  if not room_row.reservable then raise exception 'This room inventory is not open for direct reservation yet'; end if;
  if room_row.available_beds<=0 or room_row.status in ('full','offline') then raise exception 'No spaces are currently available'; end if;
  select count(*) into active_holds from public.resmap_room_holds where room_id=p_room_id and status='active' and expires_at>now();
  if active_holds>=room_row.available_beds then raise exception 'All currently available spaces are being held'; end if;
  insert into public.resmap_room_holds(user_id,residence_id,room_id,academic_year,status,expires_at)
  values(uid,room_row.residence_id,p_room_id,p_academic_year,'active',now()+interval '20 minutes')
  on conflict(user_id,room_id,academic_year) where status='active' do update set expires_at=now()+interval '20 minutes',updated_at=now()
  returning id into hold_id;
  insert into public.accommodation_reservations(user_id,residence_id,academic_year,funding_type,room_preference,status,source,room_id,room_hold_id)
  values(uid,room_row.residence_id,p_academic_year,p_funding_type,coalesce(room_row.room_code,room_row.name),'provisional_hold','resmap_room_select',p_room_id,hold_id)
  on conflict(user_id,residence_id,academic_year) do update set funding_type=excluded.funding_type,room_preference=excluded.room_preference,status='provisional_hold',source='resmap_room_select',room_id=excluded.room_id,room_hold_id=excluded.room_hold_id,updated_at=now()
  returning id into reservation_id;
  return jsonb_build_object('ok',true,'hold_id',hold_id,'reservation_id',reservation_id,'expires_at',now()+interval '20 minutes','room',room_row.name);
end $$;
grant execute on function public.resmap_hold_room(uuid,integer,text) to authenticated;

create or replace function public.resmap_join_group(p_invite_code text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); g public.resmap_search_groups%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select * into g from public.resmap_search_groups where invite_code=lower(btrim(p_invite_code)) and status='active';
  if not found then raise exception 'Group not found or closed'; end if;
  insert into public.resmap_group_members(group_id,user_id,role) values(g.id,uid,case when g.owner_user_id=uid then 'owner' else 'member' end) on conflict(group_id,user_id) do nothing;
  return jsonb_build_object('ok',true,'group_id',g.id,'invite_code',g.invite_code,'name',g.name);
end $$;
grant execute on function public.resmap_join_group(text) to authenticated;

create or replace function public.resmap_log_feed_event(p_residence_id uuid,p_event_type text,p_visitor_hash text default null,p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  if p_event_type not in ('view','save','map','tour','apply','reserve','share','skip') then return; end if;
  insert into public.resmap_feed_events(user_id,visitor_hash,residence_id,event_type,metadata) values(auth.uid(),left(p_visitor_hash,128),p_residence_id,p_event_type,coalesce(p_metadata,'{}'::jsonb));
end $$;
grant execute on function public.resmap_log_feed_event(uuid,text,text,jsonb) to anon,authenticated;

alter table public.resmap_residence_media enable row level security;
alter table public.resmap_digital_twins enable row level security;
alter table public.resmap_floors enable row level security;
alter table public.resmap_rooms enable row level security;
alter table public.resmap_room_holds enable row level security;
alter table public.resmap_preference_profiles enable row level security;
alter table public.resmap_search_groups enable row level security;
alter table public.resmap_group_members enable row level security;
alter table public.resmap_feed_events enable row level security;
alter table public.resmap_visual_searches enable row level security;

drop policy if exists "resmap media public read" on public.resmap_residence_media;
create policy "resmap media public read" on public.resmap_residence_media for select using(is_published=true);
drop policy if exists "resmap twins public read" on public.resmap_digital_twins;
create policy "resmap twins public read" on public.resmap_digital_twins for select using(is_published=true);
drop policy if exists "resmap floors public read" on public.resmap_floors;
create policy "resmap floors public read" on public.resmap_floors for select using(is_published=true);
drop policy if exists "resmap rooms public read" on public.resmap_rooms;
create policy "resmap rooms public read" on public.resmap_rooms for select using(is_published=true);
drop policy if exists "resmap holds own read" on public.resmap_room_holds;
create policy "resmap holds own read" on public.resmap_room_holds for select using(auth.uid()=user_id);
drop policy if exists "resmap prefs own all" on public.resmap_preference_profiles;
create policy "resmap prefs own all" on public.resmap_preference_profiles for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "resmap groups member read" on public.resmap_search_groups;
create policy "resmap groups member read" on public.resmap_search_groups for select using(owner_user_id=auth.uid() or exists(select 1 from public.resmap_group_members m where m.group_id=id and m.user_id=auth.uid()));
drop policy if exists "resmap groups owner write" on public.resmap_search_groups;
create policy "resmap groups owner write" on public.resmap_search_groups for all using(owner_user_id=auth.uid()) with check(owner_user_id=auth.uid());
drop policy if exists "resmap group members member read" on public.resmap_group_members;
create policy "resmap group members member read" on public.resmap_group_members for select using(user_id=auth.uid() or exists(select 1 from public.resmap_search_groups g where g.id=group_id and g.owner_user_id=auth.uid()));

grant select on public.resmap_residence_media,public.resmap_digital_twins,public.resmap_floors,public.resmap_rooms to anon,authenticated;
grant select on public.resmap_room_holds,public.resmap_preference_profiles,public.resmap_search_groups,public.resmap_group_members to authenticated;
grant insert,update,delete on public.resmap_preference_profiles,public.resmap_search_groups to authenticated;

create or replace view public.resmap_discovery_readiness as
select r.id,r.name,
  exists(select 1 from public.resmap_residence_media m where m.residence_id=r.id and m.is_published) as has_media,
  exists(select 1 from public.resmap_residence_media m where m.residence_id=r.id and m.is_published and m.media_type='tour_360') as has_360,
  exists(select 1 from public.resmap_digital_twins d where d.residence_id=r.id and d.is_published) as has_digital_twin,
  exists(select 1 from public.resmap_rooms rm where rm.residence_id=r.id and rm.is_published) as has_room_visual,
  exists(select 1 from public.resmap_rooms rm where rm.residence_id=r.id and rm.is_published and rm.reservable) as has_interactive_reservation,
  r.location_verification_status,
  r.location_quality_score
from public.residences r;
grant select on public.resmap_discovery_readiness to authenticated;

select cron.schedule('resmap-expire-room-holds','*/5 * * * *',$job$update public.resmap_room_holds set status='expired',updated_at=now() where status='active' and expires_at<=now();$job$)
where not exists(select 1 from cron.job where jobname='resmap-expire-room-holds');
