-- Release 5 signal alignment.
-- Canonicalise legacy/multi-campus residence labels into the nine ResMap campus anchors
-- and treat applications/reservations as qualified demand signals when explicit demand forms are sparse.

create or replace function public.housing_intel_campus_key(p_campus text)
returns text
language sql
immutable
set search_path=public
as $$
  select case
    when lower(coalesce(p_campus,'')) like '%mbombela%' then 'tut-mbombela'
    when lower(coalesce(p_campus,'')) like '%emalahleni%' or lower(coalesce(p_campus,'')) like '%e-malahleni%' then 'tut-emalahleni'
    when lower(coalesce(p_campus,'')) like '%polokwane%' then 'tut-polokwane'
    when lower(coalesce(p_campus,'')) like '%ga-rankuwa%' or lower(coalesce(p_campus,'')) like '%ga rankuwa%' then 'tut-ga-rankuwa'
    when lower(coalesce(p_campus,'')) like '%soshanguve south%' then 'tut-sosh-south'
    when lower(coalesce(p_campus,'')) like '%soshanguve north%' then 'tut-sosh-north'
    when lower(coalesce(p_campus,'')) like '%soshanguve%' then 'tut-sosh-south'
    when lower(coalesce(p_campus,'')) like '%pretoria%' or lower(coalesce(p_campus,'')) like '%main campus%' then 'tut-pretoria'
    when lower(coalesce(p_campus,'')) like '%arcadia%' then 'tut-arcadia'
    when lower(coalesce(p_campus,'')) like '%arts%' then 'tut-arts'
    else coalesce(nullif(regexp_replace(lower(trim(coalesce(p_campus,'unknown'))),'[^a-z0-9]+','-','g'),''),'unknown')
  end;
$$;

revoke all on function public.housing_intel_campus_key(text) from public,anon,authenticated;
grant execute on function public.housing_intel_campus_key(text) to service_role;

create or replace function public.housing_intel_supply_live()
returns table(
  campus_key text,
  campus_name text,
  latitude double precision,
  longitude double precision,
  residence_count integer,
  total_capacity bigint,
  available_spots bigint,
  occupied_proxy bigint,
  availability_rate numeric,
  average_price numeric,
  nsfas_residences integer,
  private_residences integer,
  verified_location_count integer,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path=public
as $$
with grouped as (
  select public.housing_intel_campus_key(r.campus) campus_key,
         count(*)::int residence_count,
         coalesce(sum(greatest(coalesce(r.capacity,0),0)),0)::bigint total_capacity,
         coalesce(sum(greatest(coalesce(r.available_spots,0),0)),0)::bigint available_spots,
         coalesce(sum(greatest(coalesce(r.capacity,0)-coalesce(r.available_spots,0),0)),0)::bigint occupied_proxy,
         round(avg(coalesce(nullif(r.private_price,0),nullif(r.price,0))) filter(where coalesce(nullif(r.private_price,0),nullif(r.price,0)) is not null),0) average_price,
         count(*) filter(where coalesce(r.accepts_nsfas,false)=true)::int nsfas_residences,
         count(*) filter(where coalesce(r.accepts_private,false)=true)::int private_residences,
         count(*) filter(where r.location_verification_status in ('verified','exact','manual') or coalesce(r.location_quality_score,0)>=80)::int verified_location_count,
         max(r.updated_at) updated_at,
         avg(r.latitude) fallback_lat,
         avg(r.longitude) fallback_lng,
         max(nullif(r.campus,'')) fallback_name
  from public.residences r
  where coalesce(r.is_visible,true)=true and coalesce(r.map_hidden,false)=false and r.geo is not null
  group by public.housing_intel_campus_key(r.campus)
)
select g.campus_key,coalesce(c.name,g.fallback_name,'Other / Unspecified') campus_name,
       coalesce(c.latitude,g.fallback_lat)::double precision latitude,
       coalesce(c.longitude,g.fallback_lng)::double precision longitude,
       g.residence_count,g.total_capacity,g.available_spots,g.occupied_proxy,
       round(100.0*g.available_spots::numeric/nullif(g.total_capacity,0),1) availability_rate,
       g.average_price,g.nsfas_residences,g.private_residences,g.verified_location_count,g.updated_at
from grouped g left join public.resmap_campuses c on c.campus_key=g.campus_key and c.is_active=true
order by g.residence_count desc;
$$;

create or replace function public.housing_intel_demand_heat(p_days integer default 90)
returns table(
  campus_key text,
  campus_name text,
  latitude double precision,
  longitude double precision,
  demand_count bigint,
  active_searchers bigint,
  demand_2027 bigint,
  nsfas_demand bigint,
  private_demand bigint,
  average_budget numeric,
  search_signals bigint,
  demand_index integer
)
language sql
stable
security definer
set search_path=public
as $$
with direct as (
  select public.housing_intel_campus_key(d.campus) campus_key,
         count(*)::bigint direct_count,
         count(*) filter(where d.status='searching')::bigint active_searchers,
         count(*) filter(where d.academic_year>=2027)::bigint demand_2027,
         count(*) filter(where lower(coalesce(d.funding_type,''))='nsfas')::bigint nsfas_demand,
         count(*) filter(where lower(coalesce(d.funding_type,'')) in ('private','self-funded','self_funded'))::bigint private_demand,
         avg(d.monthly_budget) filter(where d.monthly_budget>0) average_budget
  from public.accommodation_demands d
  where d.created_at>=now()-make_interval(days=>greatest(1,least(coalesce(p_days,90),730)))
  group by 1
), app as (
  select public.housing_intel_campus_key(r.campus) campus_key,
         count(*)::bigint application_signals,
         count(*) filter(where lower(coalesce(a.funding_type,''))='nsfas')::bigint nsfas_apps,
         count(*) filter(where lower(coalesce(a.funding_type,'')) in ('private','self-funded','self_funded'))::bigint private_apps
  from public.applications a join public.residences r on r.id=a.residence_id
  where a.created_at>=now()-make_interval(days=>greatest(1,least(coalesce(p_days,90),730)))
  group by 1
), resv as (
  select public.housing_intel_campus_key(r.campus) campus_key,
         count(*)::bigint reservation_signals,
         count(*) filter(where ar.academic_year>=2027)::bigint resv_2027,
         count(*) filter(where lower(coalesce(ar.funding_type,''))='nsfas')::bigint nsfas_resv,
         count(*) filter(where lower(coalesce(ar.funding_type,'')) in ('private','self-funded','self_funded'))::bigint private_resv
  from public.accommodation_reservations ar join public.residences r on r.id=ar.residence_id
  where ar.status<>'cancelled' and ar.created_at>=now()-make_interval(days=>greatest(1,least(coalesce(p_days,90),730)))
  group by 1
), feed as (
  select public.housing_intel_campus_key(r.campus) campus_key,
         count(*) filter(where e.event_type in ('view','save','map','tour','apply','reserve','share'))::bigint search_signals
  from public.resmap_feed_events e join public.residences r on r.id=e.residence_id
  where e.created_at>=now()-make_interval(days=>greatest(1,least(coalesce(p_days,90),730)))
  group by 1
), keys as (
  select campus_key from direct union select campus_key from app union select campus_key from resv union select campus_key from feed
), merged as (
  select k.campus_key,
         coalesce(d.direct_count,0)+coalesce(a.application_signals,0)+coalesce(rv.reservation_signals,0) demand_count,
         coalesce(d.active_searchers,0) active_searchers,
         coalesce(d.demand_2027,0)+coalesce(rv.resv_2027,0) demand_2027,
         coalesce(d.nsfas_demand,0)+coalesce(a.nsfas_apps,0)+coalesce(rv.nsfas_resv,0) nsfas_demand,
         coalesce(d.private_demand,0)+coalesce(a.private_apps,0)+coalesce(rv.private_resv,0) private_demand,
         d.average_budget,
         coalesce(f.search_signals,0) search_signals
  from keys k left join direct d using(campus_key) left join app a using(campus_key) left join resv rv using(campus_key) left join feed f using(campus_key)
)
select m.campus_key,coalesce(c.name,m.campus_key) campus_name,c.latitude,c.longitude,m.demand_count,m.active_searchers,m.demand_2027,m.nsfas_demand,m.private_demand,
       round(m.average_budget,0) average_budget,m.search_signals,
       least(100,round(12*ln(1+m.demand_count::numeric)+4*ln(1+m.search_signals::numeric)))::int demand_index
from merged m left join public.resmap_campuses c on c.campus_key=m.campus_key and c.is_active=true
order by demand_index desc,demand_count desc;
$$;

create or replace function public.housing_intel_institution_snapshot(p_days integer default 90)
returns table(
  campus_key text,
  campus_name text,
  latitude double precision,
  longitude double precision,
  residences integer,
  capacity bigint,
  available_spots bigint,
  demand_count bigint,
  application_count bigint,
  reservation_count bigint,
  nsfas_demand bigint,
  average_budget numeric,
  average_price numeric,
  supply_gap bigint,
  coverage_ratio numeric,
  pressure_score integer
)
language sql
stable
security definer
set search_path=public
as $$
with s as (select * from public.housing_intel_supply_live()),
d as (select * from public.housing_intel_demand_heat(p_days)),
apps as (
  select public.housing_intel_campus_key(r.campus) campus_key,count(*)::bigint application_count
  from public.applications a join public.residences r on r.id=a.residence_id
  where a.created_at>=now()-make_interval(days=>greatest(1,least(coalesce(p_days,90),730))) group by 1
),resv as (
  select public.housing_intel_campus_key(r.campus) campus_key,count(*)::bigint reservation_count
  from public.accommodation_reservations ar join public.residences r on r.id=ar.residence_id
  where ar.status<>'cancelled' and ar.created_at>=now()-make_interval(days=>greatest(1,least(coalesce(p_days,90),730))) group by 1
)
select s.campus_key,s.campus_name,s.latitude,s.longitude,s.residence_count,s.total_capacity,s.available_spots,
       coalesce(d.demand_count,0),coalesce(a.application_count,0),coalesce(rv.reservation_count,0),coalesce(d.nsfas_demand,0),d.average_budget,s.average_price,
       greatest(coalesce(d.demand_count,0)-coalesce(s.available_spots,0),0)::bigint supply_gap,
       round(coalesce(s.available_spots,0)::numeric/nullif(coalesce(d.demand_count,0),0),2) coverage_ratio,
       least(100,round(100.0*coalesce(d.demand_count,0)::numeric/nullif(coalesce(d.demand_count,0)+coalesce(s.available_spots,0),0)))::int pressure_score
from s left join d using(campus_key) left join apps a using(campus_key) left join resv rv using(campus_key)
order by pressure_score desc nulls last,supply_gap desc;
$$;

comment on function public.housing_intel_campus_key(text) is 'Internal canonical campus taxonomy for Release 5 intelligence rollups.';