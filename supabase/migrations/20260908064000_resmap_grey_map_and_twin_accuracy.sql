-- ResMap production repair: remove a key-required CARTO raster default and stop
-- conceptual procedural massing from being published as a residence digital twin.

update public.resmap_map_config
set raster_primary_url = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    raster_fallback_url = 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    updated_at = now()
where id = 1;

update public.resmap_digital_twins
set is_published = false,
    updated_at = now()
where source = 'procedural'
   or model_url is null
   or btrim(model_url) = ''
   or is_verified is not true;

alter table public.resmap_digital_twins
  alter column is_published set default false;

alter table public.resmap_digital_twins
  drop constraint if exists resmap_digital_twins_publish_requires_verified_model;

alter table public.resmap_digital_twins
  add constraint resmap_digital_twins_publish_requires_verified_model
  check (
    is_published = false
    or (
      is_verified = true
      and model_url is not null
      and btrim(model_url) <> ''
    )
  );
