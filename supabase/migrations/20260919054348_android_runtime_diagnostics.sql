create table if not exists public.mobile_runtime_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  platform text not null default 'android',
  release text not null,
  version_code integer,
  event_type text not null check (event_type in ('post_login_stable','ui_error','renderer_recovery','boot')),
  stage text,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mobile_runtime_events_user_created_idx
  on public.mobile_runtime_events(user_id, created_at desc);

alter table public.mobile_runtime_events enable row level security;
revoke all on public.mobile_runtime_events from anon, authenticated;

comment on table public.mobile_runtime_events is
  'Minimal authenticated Android runtime diagnostics. No passwords, tokens, IDs, message bodies or sensitive customer content.';
