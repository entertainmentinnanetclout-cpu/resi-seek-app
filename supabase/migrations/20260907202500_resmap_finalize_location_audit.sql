-- Finalize the ResMap location audit after Release 1-4.
-- Campus anchors below use published TUT physical addresses/GPS references.
-- Residence records keep their original address and explicit verification status;
-- approximate-area pins remain labelled approximate and must not be presented as exact street entrances.

update public.resmap_campuses set
  address='Staatsartillerie Road, Pretoria West, Pretoria, Gauteng, South Africa',
  latitude=-25.73154167, longitude=28.16121667,
  geocode_status='manual', geocode_source='tut_official_gps', geocode_confidence=0.99, geocoded_at=now()
where campus_key='tut-pretoria';

update public.resmap_campuses set
  address='175 Nelson Mandela Drive, Pretoria, Gauteng, South Africa',
  latitude=-25.74495278, longitude=28.20005278,
  geocode_status='manual', geocode_source='tut_official_gps', geocode_confidence=0.99, geocoded_at=now()
where campus_key='tut-arcadia';

update public.resmap_campuses set
  address='24 Du Toit Street, Pretoria, Gauteng, South Africa',
  latitude=-25.74060000, longitude=28.19610833,
  geocode_status='manual', geocode_source='tut_official_gps', geocode_confidence=0.99, geocoded_at=now()
where campus_key='tut-arts';

update public.resmap_campuses set
  address='Aubrey Matlala Road, Block H, Soshanguve, Gauteng, South Africa',
  latitude=-25.52030000, longitude=28.11290000,
  geocode_status='manual', geocode_source='tut_published_gps', geocode_confidence=0.98, geocoded_at=now()
where campus_key='tut-sosh-north';

update public.resmap_campuses set
  address='2 Aubrey Matlala Road, Block L, Soshanguve, Gauteng, South Africa',
  latitude=-25.54376944, longitude=28.09643333,
  geocode_status='manual', geocode_source='tut_published_gps', geocode_confidence=0.98, geocoded_at=now()
where campus_key='tut-sosh-south';

update public.resmap_campuses set
  address='2827 Zone 2, Botsi Street, Ga-Rankuwa, Gauteng, South Africa',
  latitude=-25.61831111, longitude=28.00230833,
  geocode_status='manual', geocode_source='tut_official_gps', geocode_confidence=0.99, geocoded_at=now()
where campus_key='tut-ga-rankuwa';

update public.resmap_campuses set
  address='Corner Market and Excelsior Streets, Polokwane, Limpopo, South Africa',
  latitude=-23.91411389, longitude=29.44970556,
  geocode_status='manual', geocode_source='tut_official_gps', geocode_confidence=0.99, geocoded_at=now()
where campus_key='tut-polokwane';

update public.resmap_campuses set
  address='Madiba Drive, Mbombela, Mpumalanga, South Africa',
  latitude=-25.50030833, longitude=30.95473056,
  geocode_status='manual', geocode_source='tut_official_gps', geocode_confidence=0.99, geocoded_at=now()
where campus_key='tut-mbombela';

update public.resmap_campuses set
  address='19 OR Tambo Street, eMalahleni, Mpumalanga, South Africa',
  latitude=-25.87900000, longitude=29.23608056,
  geocode_status='manual', geocode_source='tut_official_gps', geocode_confidence=0.99, geocoded_at=now()
where campus_key='tut-emalahleni';

-- Every current residence and campus now has a publishable geo point. Close the release queue.
-- Exact residence quality remains visible through location_verification_status so approximate pins
-- can be upgraded later without keeping the release queue permanently open.
update public.resmap_geocode_queue q
set status='mapped', processed_at=coalesce(processed_at,now()), last_error=null, updated_at=now()
where (q.entity_type='residence' and exists(select 1 from public.residences r where r.id=q.entity_id and r.geo is not null))
   or (q.entity_type='campus' and exists(select 1 from public.resmap_campuses c where c.id=q.entity_id and c.geo is not null));
