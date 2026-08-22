create table if not exists public.seo_campus_market_map (
  source_campus text primary key,
  canonical_campus text not null,
  canonical_city text,
  canonical_province text not null,
  institution text,
  updated_at timestamptz not null default now()
);

alter table public.seo_campus_market_map enable row level security;

insert into public.seo_campus_market_map (source_campus, canonical_campus, canonical_city, canonical_province, institution)
values
  ('Pretoria (Main Campus)', 'Pretoria West (Main Campus)', 'Pretoria', 'Gauteng', 'Tshwane University of Technology'),
  ('Pretoria West (Main Campus)', 'Pretoria West (Main Campus)', 'Pretoria', 'Gauteng', 'Tshwane University of Technology'),
  ('Pretoria West', 'Pretoria West (Main Campus)', 'Pretoria', 'Gauteng', 'Tshwane University of Technology'),
  ('Arcadia Campus', 'Arcadia Campus', 'Pretoria', 'Gauteng', 'Tshwane University of Technology'),
  ('Arts Campus', 'Arts Campus', 'Pretoria', 'Gauteng', 'Tshwane University of Technology'),
  ('Soshanguve North Campus', 'Soshanguve North Campus', 'Soshanguve', 'Gauteng', 'Tshwane University of Technology'),
  ('Soshanguve South Campus', 'Soshanguve South Campus', 'Soshanguve', 'Gauteng', 'Tshwane University of Technology'),
  ('Soshanguve', 'Soshanguve', 'Soshanguve', 'Gauteng', 'Tshwane University of Technology'),
  ('Ga-Rankuwa Campus', 'Ga-Rankuwa Campus', 'Ga-Rankuwa', 'Gauteng', 'Tshwane University of Technology'),
  ('Mbombela Campus', 'Mbombela Campus', 'Mbombela', 'Mpumalanga', 'Tshwane University of Technology'),
  ('Polokwane Campus', 'Polokwane Campus', 'Polokwane', 'Limpopo', 'Tshwane University of Technology'),
  ('Polokwane', 'Polokwane Campus', 'Polokwane', 'Limpopo', 'Tshwane University of Technology'),
  ('Pretoria West, Arts & Arcadia', 'Pretoria West, Arts & Arcadia', 'Pretoria', 'Gauteng', 'Tshwane University of Technology'),
  ('Pretoria West, Arts & Arcadia - ONLY CASH', 'Pretoria West, Arts & Arcadia', 'Pretoria', 'Gauteng', 'Tshwane University of Technology'),
  ('Pretoria West & Arcadia', 'Pretoria West & Arcadia', 'Pretoria', 'Gauteng', 'Tshwane University of Technology'),
  ('Pretoria West, Arcadia and Arts', 'Pretoria West, Arts & Arcadia', 'Pretoria', 'Gauteng', 'Tshwane University of Technology'),
  ('Pretoria West,Arts & Arcadia Campus', 'Pretoria West, Arts & Arcadia', 'Pretoria', 'Gauteng', 'Tshwane University of Technology'),
  ('Arcadia, Pretoria West and Arts Campus', 'Pretoria West, Arts & Arcadia', 'Pretoria', 'Gauteng', 'Tshwane University of Technology'),
  ('Arcadia, Pretoria West and Arts', 'Pretoria West, Arts & Arcadia', 'Pretoria', 'Gauteng', 'Tshwane University of Technology'),
  ('Pretoria & Soshanguve', 'Pretoria & Soshanguve', 'Pretoria', 'Gauteng', 'Tshwane University of Technology')
on conflict (source_campus) do update set
  canonical_campus = excluded.canonical_campus,
  canonical_city = excluded.canonical_city,
  canonical_province = excluded.canonical_province,
  institution = excluded.institution,
  updated_at = now();

drop view if exists public.public_student_accommodation_market_v;

create view public.public_student_accommodation_market_v as
select
  coalesce(m.canonical_province, nullif(trim(r.province), ''), 'Unknown') as province,
  coalesce(m.canonical_campus, nullif(trim(r.campus), ''), 'Unspecified') as campus,
  count(*)::integer as residence_count,
  coalesce(sum(r.capacity), 0)::integer as advertised_capacity,
  coalesce(sum(greatest(coalesce(r.available_spots, 0), 0)), 0)::integer as advertised_available_spots,
  min(r.price) filter (where r.price > 0) as min_advertised_price,
  round(avg(r.price) filter (where r.price > 0), 2) as avg_advertised_price,
  max(r.price) filter (where r.price > 0) as max_advertised_price,
  count(*) filter (where r.accepts_nsfas)::integer as nsfas_accepting_residences,
  count(*) filter (where r.accepts_private)::integer as private_accepting_residences,
  count(*) filter (where coalesce(r.has_wifi, false))::integer as wifi_residences,
  count(*) filter (where coalesce(r.is_furnished, false))::integer as furnished_residences,
  max(r.updated_at) as data_updated_at
from public.residences r
left join public.seo_campus_market_map m
  on m.source_campus = nullif(trim(r.campus), '')
where coalesce(r.is_visible, true)
group by
  coalesce(m.canonical_province, nullif(trim(r.province), ''), 'Unknown'),
  coalesce(m.canonical_campus, nullif(trim(r.campus), ''), 'Unspecified');

comment on table public.seo_campus_market_map is 'Canonical geography mapping used by public SEO/AI market views without rewriting operational residence records.';
comment on view public.public_student_accommodation_market_v is 'Privacy-safe aggregated accommodation market facts using canonical campus geography for SEO/AEO and original ResKonnect data products.';
