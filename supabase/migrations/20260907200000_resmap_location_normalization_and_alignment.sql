alter table public.residences add column if not exists raw_address text;
alter table public.residences add column if not exists canonical_address text;
alter table public.residences add column if not exists canonical_city text;
alter table public.residences add column if not exists canonical_province text;
alter table public.residences add column if not exists google_maps_url text;
alter table public.residences add column if not exists geocoder_display_name text;
alter table public.residences add column if not exists location_verification_status text not null default 'pending';
alter table public.residences add column if not exists location_quality_score integer not null default 0;
alter table public.residences add column if not exists location_accuracy_m integer;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='residences_location_verification_status_check') then
    alter table public.residences add constraint residences_location_verification_status_check check (location_verification_status in ('pending','geocoded','approximate','manual_verified','google_maps_verified'));
  end if;
end $$;

create or replace function public.resmap_clean_address_text(p text)
returns text language plpgsql immutable as $$
declare v text;
begin
  v := btrim(coalesce(p,''));
  v := regexp_replace(v, '\s+', ' ', 'g');
  v := regexp_replace(v, '\bStonhenge\b', 'Stonehenge', 'gi');
  v := regexp_replace(v, '\bSunnyide\b', 'Sunnyside', 'gi');
  v := regexp_replace(v, '\bGa[ ]?Rankuwa\b|\bGarankuwa\b', 'Ga-Rankuwa', 'gi');
  v := regexp_replace(v, '\bSonhuewel\b', 'Sonheuwel', 'gi');
  v := regexp_replace(v, '\bPhilipNel\b|\bPhillip Nel Park\b|\bPhillip Nel\b', 'Philip Nel Park', 'gi');
  v := regexp_replace(v, '\bNelspruit\b', 'Mbombela', 'gi');
  v := regexp_replace(v, '\bVan Heerdan\b', 'Van Heerden', 'gi');
  v := regexp_replace(v, '\bCresent\b', 'Crescent', 'gi');
  v := regexp_replace(v, '\bBloc H\b', 'Block H', 'gi');
  v := regexp_replace(v, '\bBloc K\b', 'Block K', 'gi');
  v := regexp_replace(v, '\bSoshanguve block\b', 'Soshanguve Block', 'gi');
  v := regexp_replace(v, '\bPretoria west\b', 'Pretoria West', 'gi');
  v := regexp_replace(v, '\bPretoria north\b', 'Pretoria North', 'gi');
  v := regexp_replace(v, '\bPretoria central\b', 'Pretoria Central', 'gi');
  v := regexp_replace(v, '\bcapital park\b', 'Capital Park', 'gi');
  v := regexp_replace(v, '\bsunnyside\b', 'Sunnyside', 'gi');
  v := regexp_replace(v, '\barcadia\b', 'Arcadia', 'gi');
  v := regexp_replace(v, '\bmuckleneuk\b', 'Muckleneuk', 'gi');
  v := regexp_replace(v, '\beersterust\b', 'Eersterust', 'gi');
  v := regexp_replace(v, '\bkarenpark\b', 'Karenpark', 'gi');
  v := regexp_replace(v, '\bsteiltes\b', 'Steiltes', 'gi');
  v := regexp_replace(v, '\bstonehenge\b', 'Stonehenge', 'gi');
  v := regexp_replace(v, '\bsonheuwel\b', 'Sonheuwel', 'gi');
  v := regexp_replace(v, '\bmbombela\b', 'Mbombela', 'gi');
  v := regexp_replace(v, '\bpolokwane\b', 'Polokwane', 'gi');
  v := regexp_replace(v, '\bemalahleni\b', 'eMalahleni', 'gi');
  v := regexp_replace(v, '\s+,', ',', 'g');
  v := regexp_replace(v, ',\s*,+', ', ', 'g');
  return nullif(btrim(v, ' ,'), '');
end $$;

create or replace function public.resmap_canonical_city_for_campus(p_campus text, p_address text)
returns text language sql immutable as $$
  select case
    when lower(coalesce(p_campus,'')) like '%mbombela%' or lower(coalesce(p_address,'')) like '%mbombela%' or lower(coalesce(p_address,'')) like '%nelspruit%' then 'Mbombela'
    when lower(coalesce(p_campus,'')) like '%polokwane%' then 'Polokwane'
    when lower(coalesce(p_campus,'')) like '%emalahleni%' or lower(coalesce(p_campus,'')) like '%witbank%' then 'eMalahleni'
    when lower(coalesce(p_campus,'')) like '%ga-rankuwa%' or lower(coalesce(p_campus,'')) like '%garankuwa%' or lower(coalesce(p_address,'')) like '%ga-rankuwa%' or lower(coalesce(p_address,'')) like '%garankuwa%' then 'Ga-Rankuwa'
    when lower(coalesce(p_campus,'')) like '%soshanguve%' or lower(coalesce(p_address,'')) like '%soshanguve%' then 'Soshanguve'
    else 'Pretoria'
  end
$$;

create or replace function public.resmap_canonical_province_for_campus(p_campus text, p_address text)
returns text language sql immutable as $$
  select case
    when lower(coalesce(p_campus,'')) like '%mbombela%' or lower(coalesce(p_address,'')) like '%mbombela%' or lower(coalesce(p_address,'')) like '%nelspruit%' then 'Mpumalanga'
    when lower(coalesce(p_campus,'')) like '%emalahleni%' or lower(coalesce(p_campus,'')) like '%witbank%' then 'Mpumalanga'
    when lower(coalesce(p_campus,'')) like '%polokwane%' then 'Limpopo'
    else 'Gauteng'
  end
$$;

create or replace function public.resmap_prepare_residence_location()
returns trigger language plpgsql security definer set search_path=public as $$
declare q text;
begin
  if new.raw_address is null and new.address is not null then new.raw_address := new.address; end if;
  new.address := public.resmap_clean_address_text(new.address);
  new.canonical_address := new.address;
  new.canonical_city := public.resmap_canonical_city_for_campus(new.campus,new.address);
  new.canonical_province := public.resmap_canonical_province_for_campus(new.campus,new.address);
  new.city := new.canonical_city;
  new.province := new.canonical_province;
  q := concat_ws(', ', nullif(new.canonical_address,''), new.canonical_city, new.canonical_province, 'South Africa');
  new.google_maps_url := 'https://www.google.com/maps/search/?api=1&query=' || replace(replace(q,' ','+'),',','%2C');
  new.location_quality_score := least(100,
      case when new.canonical_address is not null and length(new.canonical_address)>=8 then 40 else 0 end
    + case when new.canonical_city is not null then 20 else 0 end
    + case when new.canonical_province is not null then 10 else 0 end
    + case when new.latitude is not null and new.longitude is not null then 30 else 0 end
  );
  return new;
end $$;

drop trigger if exists trg_resmap_prepare_residence_location on public.residences;
create trigger trg_resmap_prepare_residence_location
before insert or update of address,campus,city,province,latitude,longitude on public.residences
for each row execute function public.resmap_prepare_residence_location();

update public.residences set raw_address=coalesce(raw_address,address), address=address;

update public.residences
set location_verification_status = case
  when latitude is not null and longitude is not null and geocode_source in ('google_maps','google_geocoding') then 'google_maps_verified'
  when latitude is not null and longitude is not null then 'geocoded'
  else 'pending' end,
location_quality_score = least(100,
  case when canonical_address is not null and length(canonical_address)>=8 then 40 else 0 end
 +case when canonical_city is not null then 20 else 0 end
 +case when canonical_province is not null then 10 else 0 end
 +case when latitude is not null and longitude is not null then 30 else 0 end
);

insert into public.resmap_geocode_queue(entity_type,entity_id,query,status,attempts,last_error,available_at,processed_at,updated_at)
select 'residence',r.id,concat_ws(', ',r.canonical_address,r.canonical_city,r.canonical_province,'South Africa'),'pending',0,null,now(),null,now()
from public.residences r
where coalesce(r.location_verification_status,'pending') not in ('manual_verified','google_maps_verified')
on conflict(entity_type,entity_id) do update set query=excluded.query,status='pending',attempts=0,last_error=null,available_at=now(),processed_at=null,updated_at=now();

create or replace view public.adminos_resmap_location_issues as
select id,name,raw_address,address as canonical_address,canonical_city,canonical_province,campus,latitude,longitude,geocode_status,geocode_source,location_verification_status,location_quality_score,google_maps_url
from public.residences
where latitude is null or longitude is null or location_verification_status in ('pending','approximate') or location_quality_score<70;

grant select on public.adminos_resmap_location_issues to authenticated;
