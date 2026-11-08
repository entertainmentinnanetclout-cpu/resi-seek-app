-- Premium transactional email templates, PDF attachment audit and controlled bulk status operations.
-- A migration should be applied once to the external ResKonnect Supabase project.
alter table public.reskonnect_outbound_emails
  drop constraint if exists reskonnect_outbound_emails_template_key_check;
alter table public.reskonnect_outbound_emails
  add constraint reskonnect_outbound_emails_template_key_check
  check (template_key in (
    'status_update','feedback','documents_needed','next_steps',
    'enquiry_response','viewing_invite','follow_up','reservation_confirmation',
    'application_acknowledgement','resolution_summary','reminder'
  ));
alter table public.reskonnect_outbound_emails
  add column if not exists pdf_attached boolean not null default false;
alter table public.reskonnect_outbound_emails
  add column if not exists batch_id uuid;
create index if not exists reskonnect_outbound_emails_batch_idx
  on public.reskonnect_outbound_emails(batch_id) where batch_id is not null;

create table if not exists public.reskonnect_bulk_status_events (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  target_kind text not null check(target_kind in ('application','reservation')),
  target_id uuid not null,
  residence_id uuid,
  old_status text,
  new_status text not null,
  reason text not null,
  result text not null default 'processing' check(result in ('processing','success','skipped','failed')),
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(actor_user_id,batch_id,target_kind,target_id)
);
create index if not exists reskonnect_bulk_status_events_actor_idx
  on public.reskonnect_bulk_status_events(actor_user_id,created_at desc);
create index if not exists reskonnect_bulk_status_events_target_idx
  on public.reskonnect_bulk_status_events(target_kind,target_id,created_at desc);
alter table public.reskonnect_bulk_status_events enable row level security;
revoke all on public.reskonnect_bulk_status_events from public,anon,authenticated;
grant all on public.reskonnect_bulk_status_events to service_role;
