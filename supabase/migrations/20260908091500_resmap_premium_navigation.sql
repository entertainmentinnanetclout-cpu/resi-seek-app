-- ResMap premium navigation: turn-by-turn route steps and private resumable sessions.

alter table public.resmap_route_cache
  add column if not exists steps jsonb not null default '[]'::jsonb;

create table if not exists public.resmap_navigation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  residence_id uuid not null references public.residences(id) on delete cascade,
  profile text not null check (profile in ('walk','bike','drive','transport')),
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  origin_lat double precision not null,
  origin_lng double precision not null,
  destination_lat double precision not null,
  destination_lng double precision not null,
  distance_m integer not null default 0 check (distance_m >= 0),
  duration_s integer not null default 0 check (duration_s >= 0),
  route_geometry jsonb,
  steps jsonb not null default '[]'::jsonb,
  provider text,
  progress_m integer not null default 0 check (progress_m >= 0),
  remaining_m integer not null default 0 check (remaining_m >= 0),
  current_step_index integer not null default 0 check (current_step_index >= 0),
  last_lat double precision,
  last_lng double precision,
  last_accuracy_m integer,
  last_heading integer,
  last_speed_mps numeric,
  last_seen_at timestamptz not null default now(),
  eta_at timestamptz,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists resmap_navigation_sessions_user_active_idx
  on public.resmap_navigation_sessions(user_id, status, started_at desc);
create index if not exists resmap_navigation_sessions_residence_idx
  on public.resmap_navigation_sessions(residence_id, started_at desc);

create table if not exists public.resmap_navigation_events (
  id bigserial primary key,
  session_id uuid not null references public.resmap_navigation_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  latitude double precision,
  longitude double precision,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists resmap_navigation_events_session_idx
  on public.resmap_navigation_events(session_id, created_at);
create index if not exists resmap_navigation_events_user_idx
  on public.resmap_navigation_events(user_id, created_at desc);

alter table public.resmap_navigation_sessions enable row level security;
alter table public.resmap_navigation_events enable row level security;

drop policy if exists "resmap nav sessions own read" on public.resmap_navigation_sessions;
create policy "resmap nav sessions own read"
  on public.resmap_navigation_sessions for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "resmap nav sessions own insert" on public.resmap_navigation_sessions;
create policy "resmap nav sessions own insert"
  on public.resmap_navigation_sessions for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "resmap nav sessions own update" on public.resmap_navigation_sessions;
create policy "resmap nav sessions own update"
  on public.resmap_navigation_sessions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "resmap nav sessions own delete" on public.resmap_navigation_sessions;
create policy "resmap nav sessions own delete"
  on public.resmap_navigation_sessions for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "resmap nav events own read" on public.resmap_navigation_events;
create policy "resmap nav events own read"
  on public.resmap_navigation_events for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "resmap nav events own insert" on public.resmap_navigation_events;
create policy "resmap nav events own insert"
  on public.resmap_navigation_events for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.resmap_navigation_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.resmap_navigation_sessions to authenticated;
grant select, insert on public.resmap_navigation_events to authenticated;
grant usage, select on sequence public.resmap_navigation_events_id_seq to authenticated;

comment on table public.resmap_navigation_sessions is 'Private, user-owned ResMap navigation state used to resume live routes across reloads and sync significant progress.';
comment on table public.resmap_navigation_events is 'Private, user-owned significant navigation events. Continuous raw GPS history is intentionally not stored here.';
