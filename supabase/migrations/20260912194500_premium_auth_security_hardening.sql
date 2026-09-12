begin;

-- ResKonnect Premium Auth Security Hardening
-- Production: mefjzkhobkltlbmhusdh
-- Goal: make identity/contact trust server-owned while keeping profile UX simple.

alter table public.profiles
  add column if not exists auth_provider text not null default 'email',
  add column if not exists auth_provider_subject text,
  add column if not exists email_verified_at timestamptz,
  add column if not exists phone_e164 text,
  add column if not exists phone_verified_at timestamptz,
  add column if not exists phone_verification_method text,
  add column if not exists identity_synced_at timestamptz,
  add column if not exists last_login_at timestamptz,
  add column if not exists security_level text not null default 'basic';

create table if not exists public.user_security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  event_type text not null,
  risk_level text not null default 'low',
  outcome text not null default 'observed',
  ip_hash text,
  user_agent_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_security_events_user_created
  on public.user_security_events(user_id, created_at desc);

create table if not exists public.user_phone_verification_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone_e164 text not null,
  provider text not null default 'twilio_verify',
  channel text not null default 'whatsapp',
  verification_sid text,
  status text not null default 'requested',
  send_count integer not null default 1,
  check_attempts integer not null default 0,
  requested_at timestamptz not null default now(),
  last_sent_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  verified_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_phone_verification_user_requested
  on public.user_phone_verification_attempts(user_id, requested_at desc);
create index if not exists idx_phone_verification_phone_requested
  on public.user_phone_verification_attempts(phone_e164, requested_at desc);

alter table public.user_security_events enable row level security;
alter table public.user_phone_verification_attempts enable row level security;
alter table public.profiles enable row level security;

-- Remove duplicate permissive profile owner policies left by historical migrations.
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists profiles_owner_select on public.profiles;
drop policy if exists profiles_owner_update on public.profiles;

create policy profiles_owner_select
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy profiles_owner_update
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Security-owned identity fields are immutable from browser sessions even if
-- a future privilege mistake accidentally broadens column grants.
create or replace function public.guard_profile_security_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  request_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
begin
  if request_role in ('anon','authenticated') and (
    new.email is distinct from old.email or
    new.role is distinct from old.role or
    new.auth_provider is distinct from old.auth_provider or
    new.auth_provider_subject is distinct from old.auth_provider_subject or
    new.email_verified_at is distinct from old.email_verified_at or
    new.phone_e164 is distinct from old.phone_e164 or
    new.phone_verified_at is distinct from old.phone_verified_at or
    new.phone_verification_method is distinct from old.phone_verification_method or
    new.identity_synced_at is distinct from old.identity_synced_at or
    new.last_login_at is distinct from old.last_login_at or
    new.security_level is distinct from old.security_level
  ) then
    raise exception using
      errcode = '42501',
      message = 'Security-managed profile fields cannot be changed directly';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_security_fields on public.profiles;
create trigger trg_guard_profile_security_fields
before update on public.profiles
for each row execute function public.guard_profile_security_fields();

revoke all on table public.profiles from anon;
revoke insert, delete, truncate, trigger, references on table public.profiles from authenticated;
revoke update on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
grant update (
  full_name,
  campus,
  course,
  year_of_study,
  phone,
  student_number,
  profile_picture_url,
  phone_number,
  lifestyle_preferences,
  looking_for_roommate,
  identity_number,
  applicant_stage,
  surname,
  heard_about_us,
  recruiter_reference,
  academic_year,
  academic_cycle,
  academic_period,
  study_level,
  student_stage,
  updated_at
) on table public.profiles to authenticated;

-- Verification challenges are server-only. A deny policy is deliberately
-- present so RLS remains explicit and the database linter can verify intent.
revoke all on table public.user_phone_verification_attempts from anon, authenticated;
drop policy if exists phone_verification_server_only on public.user_phone_verification_attempts;
create policy phone_verification_server_only
on public.user_phone_verification_attempts
for all to authenticated
using (false)
with check (false);

-- Security events are append-only from trusted server paths. Users may read
-- only their own event history; privileged AAL2 admins retain audit visibility.
revoke all on table public.user_security_events from anon;
revoke insert, update, delete, truncate, trigger, references on table public.user_security_events from authenticated;
grant select on table public.user_security_events to authenticated;

drop policy if exists user_security_events_owner_read on public.user_security_events;
create policy user_security_events_owner_read
on public.user_security_events for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists user_security_events_admin_aal2_read on public.user_security_events;
create policy user_security_events_admin_aal2_read
on public.user_security_events for select
to authenticated
using (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  and coalesce((select auth.jwt()->>'aal'), 'aal1') = 'aal2'
);

-- Trigger-only functions must never be exposed as public RPC endpoints.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.guard_profile_security_fields() from public, anon, authenticated;

commit;
