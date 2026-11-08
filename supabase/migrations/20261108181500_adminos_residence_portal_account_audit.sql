-- Audited AdminOS residence portal identity and access changes.
create table if not exists public.reskonnect_portal_account_audit(
 id uuid primary key default gen_random_uuid(),
 admin_user_id uuid not null references auth.users(id) on delete cascade,
 portal_user_id uuid references auth.users(id) on delete set null,
 action text not null check(action in ('updated','deactivated','reactivated','removed')),
 original_residence_id uuid,
 new_residence_id uuid,
 email_changed boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists portal_account_audit_by_admin
 on public.reskonnect_portal_account_audit(admin_user_id,created_at desc);
alter table public.reskonnect_portal_account_audit enable row level security;
revoke all on public.reskonnect_portal_account_audit from public,anon,authenticated;
grant all on public.reskonnect_portal_account_audit to service_role;
