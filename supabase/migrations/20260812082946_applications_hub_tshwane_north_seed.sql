-- ResKonnect Applications Hub — verified Tshwane North TVET College directory seed.
-- Mirrors production migration applications_hub_tshwane_north_seed.

insert into public.institutions(
  name,slug,institution_type,province,city,official_url,application_url,is_active,metadata
)
values(
  'Tshwane North TVET College',
  'tshwane-north-tvet-college',
  'tvet',
  'Gauteng',
  'Tshwane',
  'https://www.tnc.edu.za',
  'https://www.tnc.edu.za/how-to-apply.php',
  true,
  jsonb_build_object(
    'source_scope','official_college_site',
    'verified_for_application_hub',true,
    'campus_scope','Greater Tshwane'
  )
)
on conflict (slug) do update set
  name=excluded.name,
  institution_type=excluded.institution_type,
  province=excluded.province,
  city=excluded.city,
  official_url=excluded.official_url,
  application_url=excluded.application_url,
  is_active=true,
  metadata=public.institutions.metadata || excluded.metadata,
  updated_at=now();

insert into public.application_hub_institutions(
  institution_id,slug,category,short_name,display_name,description,brand_primary,brand_secondary,
  application_url,official_url,matcher_key,matcher_enabled,featured,is_active,sort_order,metadata
)
select
  i.id,
  'tshwane-north-tvet-college',
  'tvet',
  'TNC',
  'Tshwane North TVET College',
  'Public TVET college serving Greater Tshwane. The official application route is available now; programme-level Course Match will be enabled after the TVET rule import is verified.',
  '#0B5A9A',
  '#F4B400',
  'https://www.tnc.edu.za/how-to-apply.php',
  'https://www.tnc.edu.za',
  null,
  false,
  true,
  true,
  20,
  jsonb_build_object(
    'match_status','coming_soon',
    'guidance','Official application route is available now; programme-level matching is not active yet.',
    'campuses',jsonb_build_array('Mamelodi','Pretoria','Rosslyn','Soshanguve North','Soshanguve South','Temba')
  )
from public.institutions i
where i.slug='tshwane-north-tvet-college'
on conflict (slug) do update set
  institution_id=excluded.institution_id,
  category=excluded.category,
  short_name=excluded.short_name,
  display_name=excluded.display_name,
  description=excluded.description,
  brand_primary=excluded.brand_primary,
  brand_secondary=excluded.brand_secondary,
  application_url=excluded.application_url,
  official_url=excluded.official_url,
  matcher_key=excluded.matcher_key,
  matcher_enabled=excluded.matcher_enabled,
  featured=excluded.featured,
  is_active=excluded.is_active,
  sort_order=excluded.sort_order,
  metadata=public.application_hub_institutions.metadata || excluded.metadata,
  updated_at=now();
