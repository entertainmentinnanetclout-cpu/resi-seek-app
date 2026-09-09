-- ResKonnect 360 Studio V2 · Release Gates 1-2 · production source parity
create extension if not exists pgcrypto;

create table if not exists public.virtual_tours (
  id uuid primary key default gen_random_uuid(), residence_id uuid not null references public.residences(id) on delete cascade,
  created_by uuid, title text not null, description text, status text not null default 'draft', quality_tier text not null default 'premium',
  public_token uuid not null default gen_random_uuid(), current_version integer not null default 1, cover_scene_id uuid,
  is_current boolean not null default true, published_at timestamptz, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists virtual_tours_public_token_idx on public.virtual_tours(public_token);
create index if not exists virtual_tours_residence_idx on public.virtual_tours(residence_id,updated_at desc);

create table if not exists public.virtual_tour_scenes (
  id uuid primary key default gen_random_uuid(), tour_id uuid not null references public.virtual_tours(id) on delete cascade,
  name text not null, area_type text not null default 'room', floor_label text, room_label text, source_mode text not null default 'guided_mobile',
  status text not null default 'draft', sort_order integer not null default 0, is_start boolean not null default false,
  quality_score numeric not null default 0, panorama_path text, panorama_url text, thumbnail_path text, master_path text,
  width integer, height integer, capture_health jsonb not null default '{}'::jsonb, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists virtual_tour_scenes_tour_idx on public.virtual_tour_scenes(tour_id,sort_order);

create table if not exists public.virtual_tour_scene_assets (
  id uuid primary key default gen_random_uuid(), tour_id uuid references public.virtual_tours(id) on delete cascade,
  scene_id uuid not null references public.virtual_tour_scenes(id) on delete cascade, asset_type text not null,
  bucket text not null, storage_path text not null, width integer, height integer, bytes bigint, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.virtual_tour_capture_sessions (
  id uuid primary key default gen_random_uuid(), scene_id uuid not null references public.virtual_tour_scenes(id) on delete cascade,
  created_by uuid, capture_profile text not null default 'gold_36', target_count integer not null default 36, completed_count integer not null default 0,
  status text not null default 'capturing', offline_mode boolean not null default false, device_info jsonb not null default '{}'::jsonb,
  capture_plan jsonb not null default '[]'::jsonb, metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.virtual_tour_capture_frames (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references public.virtual_tour_capture_sessions(id) on delete cascade,
  sequence_no integer not null, storage_path text, yaw numeric not null default 0, pitch numeric not null default 0, roll numeric not null default 0,
  target_yaw numeric not null default 0, target_pitch numeric not null default 0, width integer, height integer,
  sharpness_score numeric not null default 0, exposure_score numeric not null default 0, stability_score numeric not null default 0,
  overlap_score numeric not null default 0, accepted boolean not null default true, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), unique(session_id,sequence_no)
);

create table if not exists public.virtual_tour_processing_jobs (
  id uuid primary key default gen_random_uuid(), tour_id uuid references public.virtual_tours(id) on delete cascade,
  scene_id uuid references public.virtual_tour_scenes(id) on delete cascade, job_type text not null, status text not null default 'queued',
  progress integer not null default 0, input_payload jsonb not null default '{}'::jsonb, output_payload jsonb not null default '{}'::jsonb,
  error_message text, started_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now()
);

create table if not exists public.virtual_tour_quality_reports (
  id uuid primary key default gen_random_uuid(), scene_id uuid not null references public.virtual_tour_scenes(id) on delete cascade,
  score numeric not null default 0, sharpness numeric not null default 0, lighting numeric not null default 0, coverage numeric not null default 0,
  overlap numeric not null default 0, stability numeric not null default 0, exposure_consistency numeric not null default 0,
  privacy_issues jsonb not null default '[]'::jsonb, passed boolean not null default false, created_at timestamptz not null default now()
);

create table if not exists public.virtual_tour_connections (
  id uuid primary key default gen_random_uuid(), tour_id uuid not null references public.virtual_tours(id) on delete cascade,
  from_scene_id uuid not null references public.virtual_tour_scenes(id) on delete cascade,
  to_scene_id uuid not null references public.virtual_tour_scenes(id) on delete cascade,
  label text not null default 'Continue', yaw numeric not null default 0, pitch numeric not null default 0, icon text not null default 'arrow',
  is_enabled boolean not null default true, sort_order integer not null default 0, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), unique(from_scene_id,to_scene_id,label)
);

create table if not exists public.virtual_tour_hotspots (
  id uuid primary key default gen_random_uuid(), tour_id uuid not null references public.virtual_tours(id) on delete cascade,
  scene_id uuid not null references public.virtual_tour_scenes(id) on delete cascade, hotspot_type text not null default 'info',
  target_scene_id uuid references public.virtual_tour_scenes(id) on delete set null, label text not null, body text, cta_url text,
  yaw numeric not null default 0, pitch numeric not null default 0, is_enabled boolean not null default true, sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create table if not exists public.virtual_tour_versions (
  id uuid primary key default gen_random_uuid(), tour_id uuid not null references public.virtual_tours(id) on delete cascade,
  version_number integer not null, snapshot jsonb not null, status text not null default 'archived', created_by uuid,
  created_at timestamptz not null default now(), unique(tour_id,version_number)
);

create table if not exists public.virtual_tour_publications (
  id uuid primary key default gen_random_uuid(), tour_id uuid not null references public.virtual_tours(id) on delete cascade,
  residence_id uuid not null references public.residences(id) on delete cascade, version_number integer not null,
  public_token uuid not null default gen_random_uuid(), snapshot jsonb not null default '{}'::jsonb, status text not null default 'published',
  published_by uuid, published_at timestamptz not null default now(), valid_until timestamptz, unique(public_token)
);
create index if not exists virtual_tour_publications_residence_idx on public.virtual_tour_publications(residence_id,published_at desc);

create table if not exists public.virtual_tour_analytics (
  id bigint generated always as identity primary key, tour_id uuid not null references public.virtual_tours(id) on delete cascade,
  scene_id uuid references public.virtual_tour_scenes(id) on delete set null, event_type text not null, viewer_session text,
  anonymous_id text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create table if not exists public.virtual_tour_entitlements (
  id uuid primary key default gen_random_uuid(), residence_id uuid not null references public.residences(id) on delete cascade,
  plan text not null default 'standard', entitlements text[] not null default '{}', is_active boolean not null default true,
  source text not null default 'god_mode', granted_by uuid, expires_at timestamptz, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists virtual_tour_entitlements_residence_idx on public.virtual_tour_entitlements(residence_id,is_active,updated_at desc);

alter table public.virtual_tours enable row level security;
alter table public.virtual_tour_scenes enable row level security;
alter table public.virtual_tour_scene_assets enable row level security;
alter table public.virtual_tour_capture_sessions enable row level security;
alter table public.virtual_tour_capture_frames enable row level security;
alter table public.virtual_tour_processing_jobs enable row level security;
alter table public.virtual_tour_quality_reports enable row level security;
alter table public.virtual_tour_connections enable row level security;
alter table public.virtual_tour_hotspots enable row level security;
alter table public.virtual_tour_versions enable row level security;
alter table public.virtual_tour_publications enable row level security;
alter table public.virtual_tour_analytics enable row level security;
alter table public.virtual_tour_entitlements enable row level security;
