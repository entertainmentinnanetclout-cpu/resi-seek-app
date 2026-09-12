-- RG3 data-quality hardening after production demand smoke.
-- Canonicalises campus aggregation and separates reported inventory from
-- public-claimable verified inventory.

update public.resmap_campuses
set name='Pretoria West (Main Campus)',
    short_name='Pretoria West',
    aliases=array(
      select distinct x
      from unnest(coalesce(aliases,'{}'::text[]) || array['Pretoria West','Pretoria (Main Campus)','Pretoria Campus','Main Campus']) x
      where nullif(trim(x),'') is not null
    ),
    updated_at=now()
where campus_key='tut-pretoria';

drop function if exists public.luna_academic_supply_live(integer);

create function public.luna_academic_supply_live(
  p_academic_year integer default extract(year from current_date)::integer
)
returns table(
  campus_key text,
  campus_name text,
  residence_count bigint,
  reported_residence_count bigint,
  verified_residence_count bigint,
  total_capacity bigint,
  available_spots bigint,
  verified_available_spots bigint,
  blocked_beds bigint,
  availability_rate numeric,
  average_price numeric
)
language sql stable security definer set search_path=public
as $function$
with normalized as (
  select
    public.housing_intel_campus_key(r.campus) as campus_key,
    i.residence_id,
    i.capacity,
    i.reported_available_beds,
    i.blocked_beds,
    i.inventory_status,
    r.price
  from public.residence_academic_inventory i
  join public.residences r on r.id=i.residence_id
  where i.academic_year=p_academic_year
), grouped as (
  select
    n.campus_key,
    count(distinct n.residence_id)::bigint as residence_count,
    count(*) filter(where n.reported_available_beds is not null)::bigint as reported_residence_count,
    count(*) filter(where n.inventory_status='verified' and n.reported_available_beds is not null)::bigint as verified_residence_count,
    coalesce(sum(n.capacity),0)::bigint as total_capacity,
    coalesce(sum(n.reported_available_beds) filter(where n.reported_available_beds is not null),0)::bigint as available_spots,
    coalesce(sum(n.reported_available_beds) filter(where n.inventory_status='verified' and n.reported_available_beds is not null),0)::bigint as verified_available_spots,
    coalesce(sum(n.blocked_beds),0)::bigint as blocked_beds,
    case
      when coalesce(sum(n.capacity) filter(where n.reported_available_beds is not null),0)>0
      then round(
        100.0*coalesce(sum(n.reported_available_beds) filter(where n.reported_available_beds is not null),0)
        / nullif(sum(n.capacity) filter(where n.reported_available_beds is not null),0),2
      )
      else 0
    end as availability_rate,
    round(avg(n.price) filter(where n.price>0)::numeric,2) as average_price
  from normalized n
  where nullif(trim(n.campus_key),'') is not null
  group by n.campus_key
)
select
  g.campus_key,
  coalesce(c.name,g.campus_key) as campus_name,
  g.residence_count,
  g.reported_residence_count,
  g.verified_residence_count,
  g.total_capacity,
  g.available_spots,
  g.verified_available_spots,
  g.blocked_beds,
  g.availability_rate,
  g.average_price
from grouped g
left join public.resmap_campuses c on c.campus_key=g.campus_key and c.is_active=true
order by g.available_spots desc,g.campus_key;
$function$;

revoke all on function public.luna_academic_supply_live(integer) from public,anon;
grant execute on function public.luna_academic_supply_live(integer) to authenticated,service_role;

comment on function public.luna_academic_supply_live(integer) is
'Year-isolated internal planning supply. reported availability may rank demand; only verified_available_spots is suitable for exact public availability claims.';
