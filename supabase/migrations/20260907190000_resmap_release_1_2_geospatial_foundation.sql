create extension if not exists postgis with schema extensions;

alter table public.residences add column if not exists geo extensions.geography(Point,4326);
alter table public.residences add column if not exists geocode_status text not null default 'pending' check (geocode_status in ('pending','processing','mapped','failed','manual'));
alter table public.residences add column if not exists geocode_source text;
alter table public.residences add column if not exists geocode_confidence numeric(5,4);
alter table public.residences add column if not exists geocode_query text;
alter table public.residences add column if not exists geocoded_at timestamptz;
alter table public.residences add column if not exists map_hidden boolean not null default false;

create or replace function public.resmap_sync_residence_geo()
returns trigger language plpgsql security definer set search_path=public,extensions as $$
begin
  if new.latitude is not null and new.longitude is not null and new.latitude between -90 and 90 and new.longitude between -180 and 180 then
    new.geo := extensions.st_setsrid(extensions.st_makepoint(new.longitude,new.latitude),4326)::extensions.geography;
    if new.geocode_status in ('pending','processing') then new.geocode_status := 'mapped'; end if;
  else
    new.geo := null;
    if new.geocode_status = 'mapped' then new.geocode_status := 'pending'; end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_resmap_sync_residence_geo on public.residences;
create trigger trg_resmap_sync_residence_geo before insert or update of latitude,longitude,geocode_status on public.residences for each row execute function public.resmap_sync_residence_geo();
update public.residences set latitude=latitude where latitude is not null and longitude is not null;
create index if not exists residences_geo_gix on public.residences using gist (geo);
create index if not exists residences_map_status_idx on public.residences (geocode_status,map_hidden,is_visible);

create table if not exists public.resmap_campuses (
  id uuid primary key default gen_random_uuid(), campus_key text not null unique, institution_key text not null,
  institution_name text not null, name text not null, short_name text, aliases text[] not null default '{}', address text,
  search_query text, latitude double precision, longitude double precision, geo extensions.geography(Point,4326),
  geocode_status text not null default 'pending' check (geocode_status in ('pending','processing','mapped','failed','manual')),
  geocode_source text, geocode_confidence numeric(5,4), geocoded_at timestamptz, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists resmap_campuses_geo_gix on public.resmap_campuses using gist (geo);

create or replace function public.resmap_sync_campus_geo()
returns trigger language plpgsql security definer set search_path=public,extensions as $$
begin
  if new.latitude is not null and new.longitude is not null and new.latitude between -90 and 90 and new.longitude between -180 and 180 then
    new.geo := extensions.st_setsrid(extensions.st_makepoint(new.longitude,new.latitude),4326)::extensions.geography;
    if new.geocode_status in ('pending','processing') then new.geocode_status := 'mapped'; end if;
  else new.geo := null; end if;
  new.updated_at := now(); return new;
end $$;
drop trigger if exists trg_resmap_sync_campus_geo on public.resmap_campuses;
create trigger trg_resmap_sync_campus_geo before insert or update of latitude,longitude,geocode_status on public.resmap_campuses for each row execute function public.resmap_sync_campus_geo();

insert into public.resmap_campuses(campus_key,institution_key,institution_name,name,short_name,aliases,search_query)
values
('tut-pretoria','tut','Tshwane University of Technology','TUT Pretoria Campus','Pretoria',ARRAY['Pretoria West','Pretoria (Main Campus)','Main Campus'],'Tshwane University of Technology Pretoria Campus, Staatsartillerie Road, Pretoria West, South Africa'),
('tut-arcadia','tut','Tshwane University of Technology','TUT Arcadia Campus','Arcadia',ARRAY['Arcadia Campus','Arcadia'],'Tshwane University of Technology Arcadia Campus, Pretoria, South Africa'),
('tut-arts','tut','Tshwane University of Technology','TUT Arts Campus','Arts',ARRAY['Arts Campus','Arts (Pretoria)'],'Tshwane University of Technology Arts Campus, Pretoria, South Africa'),
('tut-sosh-north','tut','Tshwane University of Technology','TUT Soshanguve North Campus','Soshanguve North',ARRAY['Soshanguve North Campus','Soshanguve North','Sosh North'],'Tshwane University of Technology Soshanguve North Campus, Soshanguve, South Africa'),
('tut-sosh-south','tut','Tshwane University of Technology','TUT Soshanguve South Campus','Soshanguve South',ARRAY['Soshanguve South Campus','Soshanguve South','Sosh South'],'Tshwane University of Technology Soshanguve South Campus, Soshanguve, South Africa'),
('tut-ga-rankuwa','tut','Tshwane University of Technology','TUT Ga-Rankuwa Campus','Ga-Rankuwa',ARRAY['Ga-Rankuwa Campus','Ga-Rankuwa','Garankuwa'],'Tshwane University of Technology Ga-Rankuwa Campus, Ga-Rankuwa, South Africa'),
('tut-polokwane','tut','Tshwane University of Technology','TUT Polokwane Campus','Polokwane',ARRAY['Polokwane Campus','Polokwane'],'Tshwane University of Technology Polokwane Campus, Polokwane, South Africa'),
('tut-mbombela','tut','Tshwane University of Technology','TUT Mbombela Campus','Mbombela',ARRAY['Mbombela Campus','Mbombela','Nelspruit'],'Tshwane University of Technology Mbombela Campus, Mbombela, South Africa'),
('tut-emalahleni','tut','Tshwane University of Technology','TUT eMalahleni Campus','eMalahleni',ARRAY['eMalahleni Campus','eMalahleni','Witbank'],'Tshwane University of Technology eMalahleni Campus, eMalahleni, South Africa')
on conflict (campus_key) do update set aliases=excluded.aliases,search_query=excluded.search_query,is_active=true,updated_at=now();

create table if not exists public.resmap_geocode_queue (
 id bigserial primary key, entity_type text not null check (entity_type in ('residence','campus')), entity_id uuid not null,
 query text not null, status text not null default 'pending' check (status in ('pending','processing','mapped','failed','skipped')),
 attempts integer not null default 0,last_error text,available_at timestamptz not null default now(),processed_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(entity_type,entity_id)
);
create index if not exists resmap_geocode_queue_due_idx on public.resmap_geocode_queue(status,available_at);
insert into public.resmap_geocode_queue(entity_type,entity_id,query)
select 'residence',id,coalesce(nullif(btrim(address),''),concat_ws(', ',name,campus,city,province,'South Africa')) from public.residences where latitude is null or longitude is null
on conflict(entity_type,entity_id) do update set query=excluded.query,status=case when resmap_geocode_queue.status='mapped' then resmap_geocode_queue.status else 'pending' end,updated_at=now();
insert into public.resmap_geocode_queue(entity_type,entity_id,query)
select 'campus',id,coalesce(nullif(btrim(search_query),''),concat_ws(', ',name,address,'South Africa')) from public.resmap_campuses where latitude is null or longitude is null
on conflict(entity_type,entity_id) do update set query=excluded.query,status=case when resmap_geocode_queue.status='mapped' then resmap_geocode_queue.status else 'pending' end,updated_at=now();

create or replace function public.resmap_queue_residence_geocode()
returns trigger language plpgsql security definer set search_path=public as $$
declare q text;
begin
 if new.latitude is not null and new.longitude is not null then return new; end if;
 q:=coalesce(nullif(btrim(new.address),''),concat_ws(', ',new.name,new.campus,new.city,new.province,'South Africa'));
 if q is null or length(q)<4 then return new; end if;
 insert into public.resmap_geocode_queue(entity_type,entity_id,query,status,available_at,updated_at) values('residence',new.id,q,'pending',now(),now())
 on conflict(entity_type,entity_id) do update set query=excluded.query,status='pending',available_at=now(),last_error=null,updated_at=now();
 return new;
end $$;
drop trigger if exists trg_resmap_queue_residence_geocode on public.residences;
create trigger trg_resmap_queue_residence_geocode after insert or update of address,name,campus,city,province on public.residences for each row when (new.latitude is null or new.longitude is null) execute function public.resmap_queue_residence_geocode();

create table if not exists public.resmap_route_cache (
 route_key text primary key,profile text not null,origin_lat double precision not null,origin_lng double precision not null,destination_lat double precision not null,destination_lng double precision not null,distance_m integer not null,duration_s integer not null,geometry jsonb not null,provider text not null,expires_at timestamptz not null default (now()+interval '7 days'),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists resmap_route_cache_expiry_idx on public.resmap_route_cache(expires_at);
create table if not exists public.resmap_transport_routes (
 id uuid primary key default gen_random_uuid(),institution_key text not null default 'tut',route_key text not null unique,name text not null,route_type text not null default 'shuttle',origin_campus_key text,destination_campus_key text,geometry jsonb,stops jsonb not null default '[]'::jsonb,schedule jsonb not null default '{}'::jsonb,is_verified boolean not null default false,is_active boolean not null default true,source_note text,updated_at timestamptz not null default now()
);
create table if not exists public.resmap_ai_usage (
 id bigserial primary key,visitor_hash text not null,usage_day date not null default current_date,request_count integer not null default 0,last_used_at timestamptz not null default now(),unique(visitor_hash,usage_day)
);

create or replace function public.resmap_nearby_residences(p_lat double precision,p_lng double precision,p_radius_m integer default 5000,p_limit integer default 200)
returns table(id uuid,distance_m double precision)
language sql stable security definer set search_path=public,extensions as $$
 select r.id,extensions.st_distance(r.geo,extensions.st_setsrid(extensions.st_makepoint(p_lng,p_lat),4326)::extensions.geography) as distance_m
 from public.residences r where r.geo is not null and coalesce(r.is_visible,true)=true and coalesce(r.map_hidden,false)=false
 and extensions.st_dwithin(r.geo,extensions.st_setsrid(extensions.st_makepoint(p_lng,p_lat),4326)::extensions.geography,greatest(100,least(p_radius_m,50000)))
 order by distance_m asc limit greatest(1,least(p_limit,500));
$$;
grant execute on function public.resmap_nearby_residences(double precision,double precision,integer,integer) to anon,authenticated;

create or replace view public.adminos_resmap_geo_readiness as
select count(*)::int total_residences,count(*) filter(where geo is not null)::int mapped_residences,count(*) filter(where geo is null)::int unmapped_residences,count(*) filter(where geocode_status='failed')::int failed_geocodes,round(100.0*count(*) filter(where geo is not null)/nullif(count(*),0),1) mapped_percent,count(*) filter(where coalesce(is_visible,true)=true and coalesce(map_hidden,false)=false)::int visible_for_map from public.residences;

alter table public.resmap_campuses enable row level security;
alter table public.resmap_geocode_queue enable row level security;
alter table public.resmap_route_cache enable row level security;
alter table public.resmap_transport_routes enable row level security;
alter table public.resmap_ai_usage enable row level security;
drop policy if exists "resmap campuses public read" on public.resmap_campuses;
create policy "resmap campuses public read" on public.resmap_campuses for select using (is_active=true);
drop policy if exists "resmap verified transport public read" on public.resmap_transport_routes;
create policy "resmap verified transport public read" on public.resmap_transport_routes for select using (is_active=true and is_verified=true);
grant select on public.resmap_campuses to anon,authenticated;
grant select on public.resmap_transport_routes to anon,authenticated;
grant select on public.adminos_resmap_geo_readiness to authenticated;
