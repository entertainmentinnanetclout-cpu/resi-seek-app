-- Private, time-bound evidence that an authorized operator reviewed the current
-- document inventory before contacting a student. This is NOT a document approval.
create table if not exists public.reskonnect_document_review_audit (
 id uuid primary key default gen_random_uuid(),
 actor_user_id uuid not null,
 target_kind text not null check (target_kind in ('application','reservation')),
 target_id uuid not null,
 document_snapshot_sha256 text not null check (document_snapshot_sha256 ~ '^[a-f0-9]{64}$'),
 document_count integer not null check (document_count >= 0),
 created_at timestamptz not null default now()
);
create index if not exists idx_rk_document_review_actor_target
 on public.reskonnect_document_review_audit (actor_user_id,target_kind,target_id,created_at desc);
alter table public.reskonnect_document_review_audit enable row level security;
revoke all on public.reskonnect_document_review_audit from public,anon,authenticated;
grant select,insert on public.reskonnect_document_review_audit to service_role;
comment on table public.reskonnect_document_review_audit is
 'Private operator document-readiness acknowledgement, not a verdict or delivery receipt. Access is Edge Function service-role only.';
