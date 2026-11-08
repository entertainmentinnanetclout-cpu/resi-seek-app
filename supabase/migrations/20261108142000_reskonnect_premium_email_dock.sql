-- Premium correspondence: private templates, PDF send metadata, bulk status audit.
alter table public.reskonnect_outbound_emails
  add column if not exists pdf_attached boolean not null default false,
  add column if not exists batch_id uuid,
  add column if not exists context_snapshot jsonb not null default '{}'::jsonb;
alter table public.reskonnect_outbound_emails
  drop constraint if exists reskonnect_outbound_emails_template_key_check;
alter table public.reskonnect_outbound_emails
  add constraint reskonnect_outbound_emails_template_key_check check (
    template_key in ('status_update','feedback','documents_needed','next_steps','enquiry_response','viewing_invite',
    'smart','acknowledgement','documents_received','approved','rejected','conditionally_approved','follow_up','reservation_confirmed')
  );
create index if not exists reskonnect_outbound_emails_batch_idx
  on public.reskonnect_outbound_emails(actor_user_id,batch_id,created_at desc)
  where batch_id is not null;

create table if not exists public.reskonnect_email_templates (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  target_kind text not null check(target_kind in ('application','reservation','housing_lead','support_enquiry')),
  template_key text not null check(template_key in ('smart','acknowledgement','documents_needed','documents_received',
    'approved','rejected','conditionally_approved','status_update','feedback','next_steps','enquiry_response',
    'viewing_invite','follow_up','reservation_confirmed')),
  subject_template text not null check(length(subject_template) between 5 and 180),
  body_template text not null check(length(body_template) between 20 and 4000),
  updated_at timestamptz not null default now(),
  unique(owner_user_id,target_kind,template_key)
);
create index if not exists reskonnect_email_templates_owner_idx
 on public.reskonnect_email_templates(owner_user_id,target_kind);

create table if not exists public.reskonnect_bulk_status_audit (
 id uuid primary key default gen_random_uuid(),
 actor_user_id uuid not null references auth.users(id) on delete cascade,
 operation_id uuid not null,
 target_kind text not null check(target_kind in ('application','reservation')),
 target_id uuid not null,
 old_status text not null,
 new_status text not null,
 document_signal text,
 created_at timestamptz not null default now(),
 unique(actor_user_id,operation_id,target_id)
);
create index if not exists reskonnect_bulk_status_audit_actor_idx
 on public.reskonnect_bulk_status_audit(actor_user_id,created_at desc);
 
alter table public.reskonnect_email_templates enable row level security;
alter table public.reskonnect_bulk_status_audit enable row level security;
revoke all on public.reskonnect_email_templates from public, anon, authenticated;
revoke all on public.reskonnect_bulk_status_audit from public, anon, authenticated;
grant all on public.reskonnect_email_templates to service_role;
grant all on public.reskonnect_bulk_status_audit to service_role;

comment on table public.reskonnect_email_templates is 'Per-sender manual transactional email templates; only service-role Edge Functions can read or change';
comment on table public.reskonnect_bulk_status_audit is 'Audited, authenticated server-side application/reservation status changes; email sending is separate';
