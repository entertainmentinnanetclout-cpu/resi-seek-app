-- ResKonnect Email Dock: consented Gmail reply intelligence and audited case evidence.
-- No direct client access: Edge Function enforces sender/role and case scoping.
alter table public.landlord_gmail_connections
  add column if not exists reply_read_enabled boolean not null default false;
alter table public.reskonnect_outbound_emails
  add column if not exists provider_thread_id text,
  add column if not exists last_reply_checked_at timestamptz;

create table if not exists public.reskonnect_email_replies (
 id uuid primary key default gen_random_uuid(),
 outbound_email_id uuid not null references public.reskonnect_outbound_emails(id) on delete cascade,
 actor_user_id uuid not null references auth.users(id) on delete cascade,
 gmail_message_id text not null,
 gmail_thread_id text not null,
 from_email text not null,
 received_at timestamptz not null,
 subject text not null default '',
 snippet text not null default '',
 classification text not null default 'other' check (classification in (
  'confirmation_intent','documents_provided','documents_question',
  'viewing_request','more_time','declined','payment_question',
  'general_question','acknowledgement','other')),
 suggested_stage text not null default 'response_review',
 review_status text not null default 'pending' check (review_status in ('pending','reviewed','final_confirmation_pending','verified_final')),
 reviewed_category text,
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 review_note text,
 created_at timestamptz not null default now(),
 unique(actor_user_id,gmail_message_id),
 constraint reskonnect_email_replies_snippet_limit check (length(snippet)<=900)
);
create index if not exists rk_reply_email_at_idx on public.reskonnect_email_replies(outbound_email_id,received_at desc);
create index if not exists rk_reply_actor_status_idx on public.reskonnect_email_replies(actor_user_id,review_status,received_at desc);

create table if not exists public.reskonnect_email_response_cases (
 id uuid primary key default gen_random_uuid(),
 reply_id uuid not null unique references public.reskonnect_email_replies(id) on delete cascade,
 actor_user_id uuid not null references auth.users(id) on delete cascade,
 target_kind text not null check (target_kind in ('application','reservation','housing_lead','support_enquiry')),
 target_id uuid not null,
 student_user_id uuid references auth.users(id) on delete set null,
 recommended_stage text not null,
 case_stage text not null default 'response_review' check (case_stage in ('response_review','follow_up','documents_review','viewing_review','final_confirmation_review','final_confirmation_verified','closed')),
 status text not null default 'open' check (status in ('open','reviewed','verified')),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 review_note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists rk_email_response_case_idx on public.reskonnect_email_response_cases(target_kind,target_id,created_at desc);
create index if not exists rk_email_response_student_idx on public.reskonnect_email_response_cases(student_user_id,created_at desc);

alter table public.reskonnect_email_replies enable row level security;
alter table public.reskonnect_email_response_cases enable row level security;
revoke all on public.reskonnect_email_replies from public, anon, authenticated;
revoke all on public.reskonnect_email_response_cases from public, anon, authenticated;
grant select,insert,update,delete on public.reskonnect_email_replies to service_role;
grant select,insert,update,delete on public.reskonnect_email_response_cases to service_role;
comment on table public.reskonnect_email_replies is 'Private minimal Gmail reply evidence. Incoming mail is read only after explicit OAuth permission. Never grants placement approval.';
comment on table public.reskonnect_email_response_cases is 'Per-reply student case lifecycle evidence, with separate recorded and verified stages. Accessible only through authorized Edge Function.';
