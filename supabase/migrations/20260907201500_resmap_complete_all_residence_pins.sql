with centers as (
  select r.id,
    case
      when lower(coalesce(r.campus,'')) like '%soshanguve north%' then -25.5350
      when lower(coalesce(r.campus,'')) like '%soshanguve south%' then -25.5425
      when r.canonical_city='Soshanguve' then -25.5227
      when r.canonical_city='Ga-Rankuwa' then -25.6169
      when r.canonical_city='Mbombela' then -25.4658
      when r.canonical_city='Polokwane' then -23.9045
      else -25.7479 end as base_lat,
    case
      when lower(coalesce(r.campus,'')) like '%soshanguve north%' then 28.1015
      when lower(coalesce(r.campus,'')) like '%soshanguve south%' then 28.0940
      when r.canonical_city='Soshanguve' then 28.1001
      when r.canonical_city='Ga-Rankuwa' then 27.9947
      when r.canonical_city='Mbombela' then 30.9853
      when r.canonical_city='Polokwane' then 29.4689
      else 28.2293 end as base_lng
  from public.residences r where r.geo is null
), offsets as (
  select id, base_lat, base_lng,
    ((mod(abs(hashtext(id::text)),10000)::numeric/10000)-0.5)*0.032 as dlat,
    ((mod(abs(hashtext(id::text||':lng')),10000)::numeric/10000)-0.5)*0.032 as dlng
  from centers
)
update public.residences r
set latitude=(o.base_lat+o.dlat)::double precision,
    longitude=(o.base_lng+o.dlng)::double precision,
    geocode_status='mapped',
    geocode_source='campus_area_approximation',
    geocode_confidence=0.12,
    geocoded_at=now(),
    location_verification_status='approximate',
    location_accuracy_m=3000,
    location_quality_score=55
from offsets o where r.id=o.id;

update public.resmap_geocode_queue q
set status='pending', available_at=now(), last_error=coalesce(last_error,'Approximate pin published; exact geocoding still pending'), updated_at=now()
where q.entity_type='residence' and exists (
  select 1 from public.residences r where r.id=q.entity_id and r.location_verification_status='approximate'
);
