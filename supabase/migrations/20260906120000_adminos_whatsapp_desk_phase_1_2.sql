-- AdminOS WhatsApp Desk — Phase 1/5 UI foundation + Phase 2/5 live data wiring
-- Adds premium inbox state, assignment/context fields, internal notes and realtime publication.

alter table public.adminos_whatsapp_threads
  add column if not exists mode text not null default 'ai_auto',
  add column if not exists priority text not null default 'normal',
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists last_inbound_at timestamptz,
  add column if not exists last_outbound_at timestamptz,
  add column if not exists last_summary text,
  add column if not exists tags jsonb not null default '[]'::jsonb,
  add column if not exists is_pinned boolean not null default false;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='adminos_whatsapp_threads_mode_check') then
    alter table public.adminos_whatsapp_threads
      add constraint adminos_whatsapp_threads_mode_check
      check (mode in ('ai_auto','assist','human','escalated','closed'));
  end if;
  if not exists (select 1 from pg_constraint where conname='adminos_whatsapp_threads_priority_check') then
    alter table public.adminos_whatsapp_threads
      add constraint adminos_whatsapp_threads_priority_check
      check (priority in ('low','normal','high','urgent'));
  end if;
end $$;

create index if not exists idx_adminos_whatsapp_threads_mode_last
  on public.adminos_whatsapp_threads(mode,last_message_at desc);
create index if not exists idx_adminos_whatsapp_threads_unread_last
  on public.adminos_whatsapp_threads(unread_count desc,last_message_at desc);
create index if not exists idx_adminos_whatsapp_threads_assigned_last
  on public.adminos_whatsapp_threads(assigned_to,last_message_at desc);
create index if not exists idx_adminos_whatsapp_threads_pinned_last
  on public.adminos_whatsapp_threads(is_pinned desc,last_message_at desc);

update public.adminos_whatsapp_threads
set mode = case
  when status='escalated' then 'escalated'
  when status in ('resolved','archived') then 'closed'
  else coalesce(mode,'ai_auto')
end;

update public.adminos_whatsapp_threads t
set last_inbound_at = s.last_inbound_at
from (
  select thread_id,max(coalesce(received_at,created_at)) as last_inbound_at
  from public.adminos_whatsapp_messages
  where direction='inbound'
  group by thread_id
) s
where s.thread_id=t.id and t.last_inbound_at is null;

update public.adminos_whatsapp_threads t
set last_outbound_at = s.last_outbound_at
from (
  select thread_id,max(coalesce(sent_at,created_at)) as last_outbound_at
  from public.adminos_whatsapp_messages
  where direction='outbound'
  group by thread_id
) s
where s.thread_id=t.id and t.last_outbound_at is null;

create table if not exists public.adminos_whatsapp_notes (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.adminos_whatsapp_threads(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_adminos_whatsapp_notes_thread_created
  on public.adminos_whatsapp_notes(thread_id,created_at desc);

alter table public.adminos_whatsapp_notes enable row level security;
drop policy if exists "AdminOS staff access" on public.adminos_whatsapp_notes;
create policy "AdminOS staff access" on public.adminos_whatsapp_notes
  for all to authenticated
  using ((select public.adminos_is_staff()))
  with check ((select public.adminos_is_staff()));

revoke all on table public.adminos_whatsapp_notes from anon;
grant select,insert,update,delete on table public.adminos_whatsapp_notes to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='adminos_whatsapp_threads') then
    alter publication supabase_realtime add table public.adminos_whatsapp_threads;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='adminos_whatsapp_messages') then
    alter publication supabase_realtime add table public.adminos_whatsapp_messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='adminos_whatsapp_notes') then
    alter publication supabase_realtime add table public.adminos_whatsapp_notes;
  end if;
end $$;
