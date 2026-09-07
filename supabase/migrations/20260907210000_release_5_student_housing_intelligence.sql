-- RELEASE 5 — Student Housing Intelligence Network
-- Phases 20–24: live supply, demand heat, property partner analytics,
-- institution intelligence, and development/investment opportunity intelligence.
-- All public RPCs return coarse aggregate data only. No student PII is exposed.

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
set search_path = public
as $$
with mapped as (
  select r.*,
    c.campus_key,
    c.name as canonical_campus_name,
    c.latitude as campus_lat,
    c.longitude as campus_lng
  from public.residences r
  left join public.resmap_campuses c on c.is_active = true and (
    lower(trim(coalesce(r.campus,''))) = lower(trim(c.name))
    or lower(trim(coalesce(r.campus,''))) = lower(trim(coalesce(c.short_name,'')))
    or exists(select 1 from unnest(coalesce(c.aliases,'{}'::text[])) a where lower(trim(a)) = lower(trim(coalesce(r.campus,''))))
  )
  where coalesce(r.is_visible,true)=true and coalesce(r.map_hidden,false)=false and r.geo is not null
)
select
  coalesce(campus_key, nullif(regexp_replace(lower(trim(coalesce(campus,'unknown'))),'[^a-z0-9]+','-','g'),''), 'unknown') as campus_key,
  coalesce(max(canonical_campus_name), nullif(max(campus),''), 'Other / Unspecified') as campus_name,
  coalesce(max(campus_lat), avg(latitude))::double precision as latitude,
  coalesce(max(campus_lng), avg(longitude))::double precision as longitude,
  count(*)::int as residence_count,
  coalesce(sum(greatest(coalesce(capacity,0),0)),0)::bigint as total_capacity,
  coalesce(sum(greatest(coalesce(available_spots,0),0)),0)::bigint as available_spots,
  coalesce(sum(greatest(coalesce(capacity,0)-coalesce(available_spots,0),0)),0)::bigint as occupied_proxy,
  round(100.0 * coalesce(sum(greatest(coalesce(available_spots,0),0)),0)::numeric / nullif(coalesce(sum(greatest(coalesce(capacity,0),0)),0),0),1) as availability_rate,
  round(avg(coalesce(private_price,price)) filter(where coalesce(private_price,price) is not null),0) as average_price,
  count(*) filter(where coalesce(accepts_nsfas,false)=true)::int as nsfas_residences,
  count(*) filter(where coalesce(accepts_private,false)=true)::int as private_residences,
  count(*) filter(where location_verification_status in ('verified','exact','manual') or coalesce(location_quality_score,0)>=80)::int as verified_location_count,
  max(updated_at) as updated_at
from mapped
group by coalesce(campus_key, nullif(regexp_replace(lower(trim(coalesce(campus,'unknown'))),'[^a-z0-9]+','-','g'),''), 'unknown');
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
set search_path = public
as $$
with campus_list as (
  select c.campus_key,c.name,c.short_name,c.aliases,c.latitude,c.longitude from public.resmap_campuses c where c.is_active=true
), demand as (
  select
    coalesce(c.campus_key, nullif(regexp_replace(lower(trim(coalesce(d.campus,'unknown'))),'[^a-z0-9]+','-','g'),''), 'unknown') campus_key,
    coalesce(c.name,nullif(d.campus,''),'Other / Unspecified') campus_name,
    c.latitude,c.longitude,
    count(*) demand_count,
    count(*) filter(where d.status='searching') active_searchers,
    count(*) filter(where d.academic_year>=2027) demand_2027,
    count(*) filter(where lower(coalesce(d.funding_type,''))='nsfas') nsfas_demand,
    count(*) filter(where lower(coalesce(d.funding_type,'')) in ('private','self-funded','self_funded')) private_demand,
    avg(d.monthly_budget) filter(where d.monthly_budget is not null and d.monthly_budget>0) average_budget
  from public.accommodation_demands d
  left join campus_list c on (
    lower(trim(coalesce(d.campus,'')))=lower(trim(c.name))
    or lower(trim(coalesce(d.campus,'')))=lower(trim(coalesce(c.short_name,'')))
    or exists(select 1 from unnest(coalesce(c.aliases,'{}'::text[])) a where lower(trim(a))=lower(trim(coalesce(d.campus,''))))
  )
  where d.created_at >= now() - make_interval(days => greatest(1,least(coalesce(p_days,90),730)))
  group by coalesce(c.campus_key, nullif(regexp_replace(lower(trim(coalesce(d.campus,'unknown'))),'[^a-z0-9]+','-','g'),''), 'unknown'),coalesce(c.name,nullif(d.campus,''),'Other / Unspecified'),c.latitude,c.longitude
), signals as (
  select
    coalesce(c.campus_key, nullif(regexp_replace(lower(trim(coalesce(r.campus,'unknown'))),'[^a-z0-9]+','-','g'),''), 'unknown') campus_key,
    count(*) filter(where e.event_type in ('view','save','map','tour','apply','reserve','share')) search_signals
  from public.resmap_feed_events e
  join public.residences r on r.id=e.residence_id
  left join campus_list c on (
    lower(trim(coalesce(r.campus,'')))=lower(trim(c.name))
    or lower(trim(coalesce(r.campus,'')))=lower(trim(coalesce(c.short_name,'')))
    or exists(select 1 from unnest(coalesce(c.aliases,'{}'::text[])) a where lower(trim(a))=lower(trim(coalesce(r.campus,''))))
  )
  where e.created_at >= now() - make_interval(days => greatest(1,least(coalesce(p_days,90),730)))
  group by coalesce(c.campus_key, nullif(regexp_replace(lower(trim(coalesce(r.campus,'unknown'))),'[^a-z0-9]+','-','g'),''), 'unknown')
)
select d.campus_key,d.campus_name,d.latitude,d.longitude,d.demand_count,d.active_searchers,d.demand_2027,d.nsfas_demand,d.private_demand,
  round(d.average_budget,0) average_budget,coalesce(s.search_signals,0) search_signals,
  least(100,round(10*ln(1+d.demand_count::numeric)+4*ln(1+coalesce(s.search_signals,0)::numeric)))::int demand_index
from demand d left join signals s using(campus_key)
order by demand_index desc,d.demand_count desc;
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
  select coalesce(c.campus_key, regexp_replace(lower(trim(coalesce(r.campus,'unknown'))),'[^a-z0-9]+','-','g')) campus_key,
         count(a.*) application_count
  from public.applications a join public.residences r on r.id=a.residence_id
  left join public.resmap_campuses c on c.is_active=true and (
    lower(trim(coalesce(r.campus,'')))=lower(trim(c.name)) or lower(trim(coalesce(r.campus,'')))=lower(trim(coalesce(c.short_name,'')))
    or exists(select 1 from unnest(coalesce(c.aliases,'{}'::text[])) x where lower(trim(x))=lower(trim(coalesce(r.campus,'')))) )
  where a.created_at>=now()-make_interval(days=>greatest(1,least(coalesce(p_days,90),730)))
  group by 1
), resv as (
  select coalesce(c.campus_key, regexp_replace(lower(trim(coalesce(r.campus,'unknown'))),'[^a-z0-9]+','-','g')) campus_key,
         count(ar.*) reservation_count
  from public.accommodation_reservations ar join public.residences r on r.id=ar.residence_id
  left join public.resmap_campuses c on c.is_active=true and (
    lower(trim(coalesce(r.campus,'')))=lower(trim(c.name)) or lower(trim(coalesce(r.campus,'')))=lower(trim(coalesce(c.short_name,'')))
    or exists(select 1 from unnest(coalesce(c.aliases,'{}'::text[])) x where lower(trim(x))=lower(trim(coalesce(r.campus,'')))) )
  where ar.created_at>=now()-make_interval(days=>greatest(1,least(coalesce(p_days,90),730))) and ar.status<>'cancelled'
  group by 1
)
select s.campus_key,s.campus_name,s.latitude,s.longitude,s.residence_count,s.total_capacity,s.available_spots,
  coalesce(d.demand_count,0),coalesce(a.application_count,0),coalesce(rv.reservation_count,0),coalesce(d.nsfas_demand,0),d.average_budget,s.average_price,
  greatest(coalesce(d.demand_count,0)+coalesce(a.application_count,0)+coalesce(rv.reservation_count,0)-coalesce(s.available_spots,0),0)::bigint supply_gap,
  round(coalesce(s.available_spots,0)::numeric/nullif((coalesce(d.demand_count,0)+coalesce(a.application_count,0)+coalesce(rv.reservation_count,0)),0),2) coverage_ratio,
  least(100,round(100.0*(coalesce(d.demand_count,0)+coalesce(a.application_count,0)+coalesce(rv.reservation_count,0))::numeric/nullif((coalesce(d.demand_count,0)+coalesce(a.application_count,0)+coalesce(rv.reservation_count,0)+coalesce(s.available_spots,0)),0)))::int pressure_score
from s left join d using(campus_key) left join apps a using(campus_key) left join resv rv using(campus_key)
order by pressure_score desc nulls last,supply_gap desc;
$$;

create or replace function public.housing_intel_opportunities(p_days integer default 90)
returns table(
  campus_key text,
  campus_name text,
  latitude double precision,
  longitude double precision,
  opportunity_score integer,
  pressure_score integer,
  supply_gap bigint,
  available_spots bigint,
  demand_count bigint,
  search_signals bigint,
  average_budget numeric,
  average_price numeric,
  affordability_gap numeric,
  signal text
)
language sql
stable
security definer
set search_path=public
as $$
with i as (select * from public.housing_intel_institution_snapshot(p_days)),
d as (select * from public.housing_intel_demand_heat(p_days))
select i.campus_key,i.campus_name,i.latitude,i.longitude,
  least(100,greatest(0,
    round(coalesce(i.pressure_score,0)*0.55 + least(100,coalesce(d.demand_index,0))*0.30 + least(100,10*ln(1+greatest(i.supply_gap,0)::numeric))*0.15)
  ))::int opportunity_score,
  coalesce(i.pressure_score,0),i.supply_gap,i.available_spots,i.demand_count,coalesce(d.search_signals,0),i.average_budget,i.average_price,
  case when i.average_budget is not null and i.average_price is not null then round(i.average_budget-i.average_price,0) end affordability_gap,
  case
    when coalesce(i.pressure_score,0)>=75 and i.supply_gap>0 then 'high-shortage'
    when coalesce(i.pressure_score,0)>=55 then 'rising-pressure'
    when coalesce(i.available_spots,0)>coalesce(i.demand_count,0) then 'supply-buffer'
    else 'balanced'
  end signal
from i left join d using(campus_key)
order by opportunity_score desc;
$$;

create or replace function public.housing_intel_property_partner(p_residence_id uuid,p_days integer default 90)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  uid uuid:=auth.uid();
  r public.residences%rowtype;
  apps bigint:=0; reservations bigint:=0; leads bigint:=0; placed bigint:=0; views bigint:=0; saves bigint:=0;
  campus_apps numeric:=0; campus_reservations numeric:=0; campus_price numeric:=0; campus_residences bigint:=0;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if not (public.is_authorized_residence_user(p_residence_id) or public.is_reskonnect_admin(uid)) then raise exception 'Not authorized for this residence'; end if;
  select * into r from public.residences where id=p_residence_id;
  if not found then raise exception 'Residence not found'; end if;

  select count(*) into apps from public.applications where residence_id=p_residence_id and created_at>=now()-make_interval(days=>greatest(1,least(coalesce(p_days,90),730)));
  select count(*) into reservations from public.accommodation_reservations where residence_id=p_residence_id and status<>'cancelled' and created_at>=now()-make_interval(days=>greatest(1,least(coalesce(p_days,90),730)));
  select count(*),count(*) filter(where stage='placed') into leads,placed from public.residence_leads where residence_id=p_residence_id and created_at>=now()-make_interval(days=>greatest(1,least(coalesce(p_days,90),730)));
  select count(*) filter(where event_type='view'),count(*) filter(where event_type='save') into views,saves from public.resmap_feed_events where residence_id=p_residence_id and created_at>=now()-make_interval(days=>greatest(1,least(coalesce(p_days,90),730)));

  select count(*),avg(coalesce(private_price,price)) filter(where coalesce(private_price,price) is not null)
    into campus_residences,campus_price from public.residences x where coalesce(x.is_visible,true)=true and lower(trim(coalesce(x.campus,'')))=lower(trim(coalesce(r.campus,'')));
  select avg(v) into campus_apps from (select count(*)::numeric v from public.applications a join public.residences x on x.id=a.residence_id where lower(trim(coalesce(x.campus,'')))=lower(trim(coalesce(r.campus,''))) and a.created_at>=now()-make_interval(days=>greatest(1,least(coalesce(p_days,90),730))) group by x.id) q;
  select avg(v) into campus_reservations from (select count(*)::numeric v from public.accommodation_reservations ar join public.residences x on x.id=ar.residence_id where lower(trim(coalesce(x.campus,'')))=lower(trim(coalesce(r.campus,''))) and ar.status<>'cancelled' and ar.created_at>=now()-make_interval(days=>greatest(1,least(coalesce(p_days,90),730))) group by x.id) q;

  return jsonb_build_object(
    'residence',jsonb_build_object('id',r.id,'name',r.name,'campus',r.campus,'capacity',r.capacity,'available_spots',r.available_spots,'price',coalesce(r.private_price,r.price),'nsfas_price',r.nsfas_price,'quality_score',r.data_quality_score,'location_quality_score',r.location_quality_score),
    'period_days',greatest(1,least(coalesce(p_days,90),730)),
    'performance',jsonb_build_object('applications',apps,'reservations',reservations,'leads',leads,'placements',placed,'views',views,'saves',saves,'lead_to_placement_rate',case when leads>0 then round(100.0*placed/leads,1) else 0 end),
    'benchmark',jsonb_build_object('campus_residences',campus_residences,'average_applications_per_residence',round(coalesce(campus_apps,0),1),'average_reservations_per_residence',round(coalesce(campus_reservations,0),1),'average_private_price',round(coalesce(campus_price,0),0)),
    'market_position',jsonb_build_object('application_index',case when coalesce(campus_apps,0)>0 then round(100*apps/campus_apps,0) else null end,'reservation_index',case when coalesce(campus_reservations,0)>0 then round(100*reservations/campus_reservations,0) else null end,'price_delta',case when campus_price is not null and coalesce(r.private_price,r.price) is not null then round(coalesce(r.private_price,r.price)-campus_price,0) else null end)
  );
end $$;

revoke all on function public.housing_intel_supply_live() from public;
revoke all on function public.housing_intel_demand_heat(integer) from public;
revoke all on function public.housing_intel_institution_snapshot(integer) from public;
revoke all on function public.housing_intel_opportunities(integer) from public;
revoke all on function public.housing_intel_property_partner(uuid,integer) from public;

grant execute on function public.housing_intel_supply_live() to anon,authenticated,service_role;
grant execute on function public.housing_intel_demand_heat(integer) to anon,authenticated,service_role;
grant execute on function public.housing_intel_institution_snapshot(integer) to anon,authenticated,service_role;
grant execute on function public.housing_intel_opportunities(integer) to anon,authenticated,service_role;
grant execute on function public.housing_intel_property_partner(uuid,integer) to authenticated,service_role;

comment on function public.housing_intel_supply_live is 'Release 5 Phase 20: live, aggregate student housing supply by campus.';
comment on function public.housing_intel_demand_heat(integer) is 'Release 5 Phase 21: coarse demand heat-map signals without student PII.';
comment on function public.housing_intel_property_partner(uuid,integer) is 'Release 5 Phase 22: residence-authorized partner performance and campus benchmark analytics.';
comment on function public.housing_intel_institution_snapshot(integer) is 'Release 5 Phase 23: institution/campus accommodation supply-demand intelligence.';
comment on function public.housing_intel_opportunities(integer) is 'Release 5 Phase 24: development/investment opportunity scoring from supply-demand pressure.';