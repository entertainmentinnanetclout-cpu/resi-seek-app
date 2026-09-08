-- ResMap resilient provider configuration.
-- Public configuration contains browser-safe map configuration only. Google Maps browser keys
-- must be HTTP-referrer restricted in Google Cloud because browser keys are necessarily public.

create table if not exists public.resmap_map_config (
  id smallint primary key default 1 check (id = 1),
  primary_provider text not null default 'reskonnect' check (primary_provider in ('reskonnect','google3d')),
  google_maps_enabled boolean not null default false,
  google_maps_browser_key text,
  google_maps_map_id text,
  google_maps_mode text not null default 'HYBRID' check (google_maps_mode in ('ROADMAP','SATELLITE','HYBRID')),
  raster_primary_url text not null default 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
  raster_fallback_url text not null default 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  updated_at timestamptz not null default now()
);

alter table public.resmap_map_config enable row level security;

drop policy if exists "Public can read ResMap map config" on public.resmap_map_config;
create policy "Public can read ResMap map config"
on public.resmap_map_config
for select
to anon, authenticated
using (id = 1);

drop policy if exists "AdminOS staff can manage ResMap map config" on public.resmap_map_config;
create policy "AdminOS staff can manage ResMap map config"
on public.resmap_map_config
for all
to authenticated
using (public.get_user_staff_role(auth.uid()) is not null)
with check (public.get_user_staff_role(auth.uid()) is not null);

grant select on public.resmap_map_config to anon, authenticated;
grant insert, update, delete on public.resmap_map_config to authenticated;

insert into public.resmap_map_config (id)
values (1)
on conflict (id) do nothing;

insert into public.adminos_integration_connections (
  provider, display_name, status, enabled, setup_step, config, setup_url, docs_url
)
values (
  'google_maps',
  'Google Maps Platform · 3D Maps',
  'not_connected',
  false,
  1,
  jsonb_build_object(
    'api', 'Maps JavaScript API',
    'library', 'maps3d',
    'mode', 'HYBRID',
    'fallback', 'ResKonnect raster + custom 3D spatial beacons',
    'browser_key_restriction', 'HTTP referrers only'
  ),
  'https://console.cloud.google.com/google/maps-apis/overview',
  'https://developers.google.com/maps/documentation/javascript/3d/overview'
)
on conflict (provider) do update set
  display_name = excluded.display_name,
  config = coalesce(public.adminos_integration_connections.config, '{}'::jsonb) || excluded.config,
  setup_url = excluded.setup_url,
  docs_url = excluded.docs_url,
  updated_at = now();
