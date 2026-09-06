-- AdminOS WhatsApp Desk — Phases 3, 4 & 5
-- Human operations, AI assist/takeover, auditability, secure media and realtime polish.

alter table public.adminos_whatsapp_threads
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references auth.users(id) on delete set null,
  add column if not exists takeover_at timestamptz,
  add column if not exists takeover_by uuid references auth.users(id) on delete set null;

create index if not exists idx_adminos_whatsapp_threads_resolved
  on public.adminos_whatsapp_threads(resolved_at desc);

create table if not exists public.adminos_whatsapp_activity (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.adminos_whatsapp_threads(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_adminos_whatsapp_activity_thread_created
  on public.adminos_whatsapp_activity(thread_id,created_at desc);
create index if not exists idx_adminos_whatsapp_activity_event_created
  on public.adminos_whatsapp_activity(event_type,created_at desc);

alter table public.adminos_whatsapp_activity enable row level security;
drop policy if exists "AdminOS WhatsApp activity staff access" on public.adminos_whatsapp_activity;
create policy "AdminOS WhatsApp activity staff access" on public.adminos_whatsapp_activity
  for select to authenticated
  using ((select public.adminos_is_staff()));
revoke all on table public.adminos_whatsapp_activity from anon;
grant select on table public.adminos_whatsapp_activity to authenticated;

create table if not exists public.adminos_whatsapp_drafts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.adminos_whatsapp_threads(id) on delete cascade,
  source_message_id uuid references public.adminos_whatsapp_messages(id) on delete set null,
  body_text text not null check (char_length(btrim(body_text)) between 1 and 4000),
  status text not null default 'ready' check (status in ('ready','sent','dismissed','superseded')),
  risk_level text not null default 'green' check (risk_level in ('green','amber','red')),
  confidence numeric,
  agent_run_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_adminos_whatsapp_drafts_thread_status
  on public.adminos_whatsapp_drafts(thread_id,status,created_at desc);

alter table public.adminos_whatsapp_drafts enable row level security;
drop policy if exists "AdminOS WhatsApp drafts staff access" on public.adminos_whatsapp_drafts;
create policy "AdminOS WhatsApp drafts staff access" on public.adminos_whatsapp_drafts
  for all to authenticated
  using ((select public.adminos_is_staff()))
  with check ((select public.adminos_is_staff()));
revoke all on table public.adminos_whatsapp_drafts from anon;
grant select,insert,update,delete on table public.adminos_whatsapp_drafts to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'adminos-whatsapp-media',
  'adminos-whatsapp-media',
  false,
  20971520,
  array['image/jpeg','image/png','image/webp','application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[]
)
on conflict (id) do update
set public=false,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "AdminOS WhatsApp media staff read" on storage.objects;
create policy "AdminOS WhatsApp media staff read" on storage.objects
  for select to authenticated
  using (bucket_id='adminos-whatsapp-media' and (select public.adminos_is_staff()));

drop policy if exists "AdminOS WhatsApp media staff insert" on storage.objects;
create policy "AdminOS WhatsApp media staff insert" on storage.objects
  for insert to authenticated
  with check (bucket_id='adminos-whatsapp-media' and (select public.adminos_is_staff()));

drop policy if exists "AdminOS WhatsApp media staff delete" on storage.objects;
create policy "AdminOS WhatsApp media staff delete" on storage.objects
  for delete to authenticated
  using (bucket_id='adminos-whatsapp-media' and (select public.adminos_is_staff()));

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='adminos_whatsapp_drafts') then
    alter publication supabase_realtime add table public.adminos_whatsapp_drafts;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='adminos_whatsapp_activity') then
    alter publication supabase_realtime add table public.adminos_whatsapp_activity;
  end if;
end $$;
