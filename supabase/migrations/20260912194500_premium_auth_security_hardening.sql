begin;

-- ResKonnect Premium Auth Security Hardening
-- Production: mefjzkhobkltlbmhusdh
-- Identity trust is server-owned; browser profile forms receive only explicit
-- user-editable column privileges.

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

create or replace function public.rk_normalize_za_phone(p_phone text)
returns text
language plpgsql
immutable
set search_path = ''
as $rk_phone$
declare
  digits text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
begin
  if digits ~ '^27[6-8][0-9]{8}$' then
    return '+' || digits;
  elsif digits ~ '^0[6-8][0-9]{8}$' then
    return '+27' || substr(digits, 2);
  elsif digits ~ '^[6-8][0-9]{8}$' then
    return '+27' || digits;
  end if;
  return null;
end;
$rk_phone$;

create or replace function public.rk_security_level(
  p_email_verified_at timestamptz,
  p_phone_verified_at timestamptz,
  p_is_privileged boolean default false
)
returns text
language sql
immutable
set search_path = ''
as $rk_security$
  select case
    when coalesce(p_is_privileged, false) then 'privileged'
    when p_phone_verified_at is not null then 'contact_verified'
    when p_email_verified_at is not null then 'email_verified'
    else 'basic'
  end
$rk_security$;

alter table public.user_security_events enable row level security;
alter table public.user_phone_verification_attempts enable row level security;
alter table public.profiles enable row level security;

-- Keep OAuth/provider identity metadata synchronized at account creation.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $handle_user$
declare
  provider text := coalesce(nullif(new.raw_app_meta_data->>'provider',''), 'email');
  provider_sub text := nullif(new.raw_user_meta_data->>'sub','');
  resolved_name text := coalesce(
    nullif(new.raw_user_meta_data->>'full_name',''),
    nullif(new.raw_user_meta_data->>'name',''),
    ''
  );
  resolved_avatar text := coalesce(
    nullif(new.raw_user_meta_data->>'avatar_url',''),
    nullif(new.raw_user_meta_data->>'picture','')
  );
  verified_at timestamptz := new.email_confirmed_at;
begin
  insert into public.profiles(
    id, full_name, email, phone, phone_e164, student_number, identity_number,
    campus, applicant_stage, heard_about_us, recruiter_reference,
    profile_picture_url, auth_provider, auth_provider_subject,
    email_verified_at, identity_synced_at, last_login_at, security_level
  ) values (
    new.id,
    resolved_name,
    new.email,
    nullif(new.raw_user_meta_data->>'phone',''),
    public.rk_normalize_za_phone(new.raw_user_meta_data->>'phone'),
    nullif(new.raw_user_meta_data->>'student_number',''),
    nullif(new.raw_user_meta_data->>'identity_number',''),
    nullif(new.raw_user_meta_data->>'campus',''),
    nullif(new.raw_user_meta_data->>'applicant_stage',''),
    nullif(new.raw_user_meta_data->>'heard_about_us',''),
    nullif(new.raw_user_meta_data->>'recruiter_reference',''),
    resolved_avatar,
    provider,
    provider_sub,
    verified_at,
    now(),
    new.last_sign_in_at,
    public.rk_security_level(verified_at, null, false)
  )
  on conflict(id) do update set
    email = excluded.email,
    full_name = coalesce(nullif(public.profiles.full_name,''), excluded.full_name),
    phone = coalesce(nullif(public.profiles.phone,''), excluded.phone),
    phone_e164 = coalesce(public.profiles.phone_e164, excluded.phone_e164),
    student_number = coalesce(nullif(public.profiles.student_number,''), excluded.student_number),
    identity_number = coalesce(nullif(public.profiles.identity_number,''), excluded.identity_number),
    campus = coalesce(nullif(public.profiles.campus,''), excluded.campus),
    applicant_stage = coalesce(public.profiles.applicant_stage, excluded.applicant_stage),
    heard_about_us = coalesce(public.profiles.heard_about_us, excluded.heard_about_us),
    recruiter_reference = coalesce(public.profiles.recruiter_reference, excluded.recruiter_reference),
    profile_picture_url = coalesce(nullif(public.profiles.profile_picture_url,''), excluded.profile_picture_url),
    auth_provider = excluded.auth_provider,
    auth_provider_subject = coalesce(excluded.auth_provider_subject, public.profiles.auth_provider_subject),
    email_verified_at = coalesce(excluded.email_verified_at, public.profiles.email_verified_at),
    identity_synced_at = now(),
    last_login_at = coalesce(excluded.last_login_at, public.profiles.last_login_at),
    security_level = public.rk_security_level(
      coalesce(excluded.email_verified_at, public.profiles.email_verified_at),
      public.profiles.phone_verified_at,
      false
    ),
    updated_at = now();

  insert into public.user_roles(user_id, role)
  values(new.id, 'student'::public.app_role)
  on conflict(user_id, role) do nothing;

  insert into public.user_security_events(user_id, event_type, risk_level, outcome, metadata)
  values(
    new.id,
    'identity.account_created',
    'low',
    'allowed',
    jsonb_build_object(
      'provider', provider,
      'email_verified', verified_at is not null,
      'auto_admin_granted', false
    )
  );

  return new;
end;
$handle_user$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Twilio Verify is an independent security integration. Credentials remain in
-- Supabase secrets; no provider secret is stored in browser-visible tables.
insert into public.adminos_integration_connections(
  provider, display_name, status, enabled, setup_step, setup_url, docs_url, config, secret_refs
)
values (
  'twilio_verify',
  'Twilio Verify · WhatsApp Security',
  'not_connected',
  true,
  1,
  'https://console.twilio.com/',
  'https://www.twilio.com/docs/verify',
  jsonb_build_object(
    'channel','whatsapp',
    'purpose','phone_ownership_verification',
    'otp_ttl_minutes',10,
    'service_auto_provision',true
  ),
  jsonb_build_object(
    'account_sid_env','TWILIO_ACCOUNT_SID',
    'auth_token_env','TWILIO_AUTH_TOKEN'
  )
)
on conflict(provider) do update set
  display_name = excluded.display_name,
  enabled = true,
  setup_url = excluded.setup_url,
  docs_url = excluded.docs_url,
  config = public.adminos_integration_connections.config || excluded.config,
  secret_refs = excluded.secret_refs,
  updated_at = now();

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

-- Server-owned identity/trust fields cannot be submitted by browser sessions.
-- A material phone change also clears ownership proof atomically.
create or replace function public.guard_profile_security_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $profile_guard$
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

  if request_role = 'authenticated'
     and public.rk_normalize_za_phone(new.phone) is distinct from public.rk_normalize_za_phone(old.phone) then
    new.phone_e164 := public.rk_normalize_za_phone(new.phone);
    new.phone_number := new.phone;
    new.phone_verified_at := null;
    new.phone_verification_method := null;
    new.security_level := public.rk_security_level(old.email_verified_at, null, false);
  end if;

  return new;
end;
$profile_guard$;

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

-- Verification challenges are server-only. The explicit deny policy documents
-- intent and prevents direct browser reads/writes even for authenticated users.
revoke all on table public.user_phone_verification_attempts from anon, authenticated;
drop policy if exists phone_verification_server_only on public.user_phone_verification_attempts;
create policy phone_verification_server_only
on public.user_phone_verification_attempts
for all to authenticated
using (false)
with check (false);

-- Security events are append-only from trusted server paths.
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

-- Trigger-only functions are not public RPC endpoints.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.guard_profile_security_fields() from public, anon, authenticated;

commit;
