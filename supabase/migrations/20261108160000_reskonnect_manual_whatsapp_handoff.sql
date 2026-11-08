-- Manual WhatsApp Business App handoff: a click-to-chat attempt is not a sent receipt.
create table if not exists public.reskonnect_whatsapp_handoffs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  target_kind text not null check (target_kind in ('application','reservation','housing_lead','support_enquiry')),
  target_id uuid not null,
  template_key text not null,
  request_id uuid not null,
  phone_last4 text not null check(phone_last4 ~ '^[0-9]{4}$'),
  recorded_case_status text not null,
  recorded_document_stage text not null,
  message_sha256 text not null check(message_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'opened' check(status in ('opened','operator_marked_sent')),
  created_at timestamptz not null default now(),
  marked_sent_at timestamptz,
  unique(actor_user_id,request_id)
);
create index if not exists reskonnect_whatsapp_handoffs_actor_idx
  on public.reskonnect_whatsapp_handoffs(actor_user_id,created_at desc);
create index if not exists reskonnect_whatsapp_handoffs_case_idx
  on public.reskonnect_whatsapp_handoffs(target_kind,target_id,created_at desc);
alter table public.reskonnect_whatsapp_handoffs enable row level security;
revoke all on public.reskonnect_whatsapp_handoffs from public,anon,authenticated;
grant all on public.reskonnect_whatsapp_handoffs to service_role;
comment on table public.reskonnect_whatsapp_handoffs is
'Manual click-to-chat operator handoffs; never implies WhatsApp delivery, and never stores full phone numbers or message bodies.';
