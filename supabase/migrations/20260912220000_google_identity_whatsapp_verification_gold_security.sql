-- ResKonnect Gold Security Mode — identity, verified contact and privileged-access hardening.
-- Google proves identity basics; ResKonnect owns institutional profile data;
-- Twilio Verify proves control of the user's WhatsApp number.

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

alter table public.profiles drop constraint if exists profiles_security_level_check;
alter table public.profiles add constraint profiles_security_level_check
check (security_level in ('basic','email_verified','contact_verified','privileged'));

alter table public.profiles drop constraint if exists profiles_phone_verification_method_check;
alter table public.profiles add constraint profiles_phone_verification_method_check
check (phone_verification_method is null or phone_verification_method in ('whatsapp_twilio_verify','admin_verified'));

create index if not exists idx_profiles_auth_provider on public.profiles(auth_provider);
create index if not exists idx_profiles_phone_verified on public.profiles(phone_verified_at) where phone_verified_at is not null;

create or replace function public.rk_normalize_za_phone(p_value text)
returns text
language plpgsql
immutable
set search_path=''
as $$
declare d text:=regexp_replace(coalesce(p_value,''),'[^0-9]','','g');
begin
  if d='' then return null; end if;
  if left(d,2)='27' and length(d)=11 then return '+'||d; end if;
  if left(d,1)='0' and length(d)=10 then return '+27'||substr(d,2); end if;
  if length(d)=9 and left(d,1) in ('6','7','8') then return '+27'||d; end if;
  return null;
end;
$$;

create or replace function public.rk_security_level(
  p_email_verified_at timestamptz,
  p_phone_verified_at timestamptz,
  p_is_privileged boolean default false
)
returns text
language sql
immutable
set search_path=''
as $$
  select case
    when coalesce(p_is_privileged,false) then 'privileged'
    when p_phone_verified_at is not null then 'contact_verified'
    when p_email_verified_at is not null then 'email_verified'
    else 'basic'
  end
$$;

create table if not exists public.user_security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  event_type text not null,
  risk_level text not null default 'low' check(risk_level in ('low','medium','high','critical')),
  outcome text not null default 'observed' check(outcome in ('observed','allowed','blocked','failed','verified','revoked')),
  ip_hash text,
  user_agent_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_user_security_events_user_time on public.user_security_events(user_id,created_at desc);
create index if not exists idx_user_security_events_risk_time on public.user_security_events(risk_level,created_at desc);

alter table public.user_security_events enable row level security;
drop policy if exists user_security_events_owner_read on public.user_security_events;
create policy user_security_events_owner_read
on public.user_security_events for select to authenticated
using(user_id=auth.uid());
drop policy if exists user_security_events_admin_aal2_read on public.user_security_events;
create policy user_security_events_admin_aal2_read
on public.user_security_events for select to authenticated
using(
  public.has_role(auth.uid(),'admin'::public.app_role)
  and coalesce(auth.jwt()->>'aal','aal1')='aal2'
);
revoke insert,update,delete on public.user_security_events from anon,authenticated;
grant select on public.user_security_events to authenticated;

create table if not exists public.user_phone_verification_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone_e164 text not null,
  provider text not null default 'twilio_verify',
  channel text not null default 'whatsapp',
  verification_sid text,
  status text not null default 'requested'
    check(status in ('requested','pending','approved','expired','cancelled','failed','locked')),
  send_count integer not null default 1,
  check_attempts integer not null default 0,
  requested_at timestamptz not null default now(),
  last_sent_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '10 minutes',
  verified_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists idx_phone_verification_user_time
  on public.user_phone_verification_attempts(user_id,requested_at desc);
create index if not exists idx_phone_verification_phone_time
  on public.user_phone_verification_attempts(phone_e164,requested_at desc);
create unique index if not exists uq_phone_verification_active_user
  on public.user_phone_verification_attempts(user_id)
  where status in ('requested','pending');

alter table public.user_phone_verification_attempts enable row level security;
-- No client-side table access. The authenticated Edge Function is the only mutation/read path.
revoke all on public.user_phone_verification_attempts from anon,authenticated;

create table if not exists public.platform_security_policy (
  policy_key text primary key,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.platform_security_policy(policy_key,enabled,config)
values
 ('gold_security_mode',true,jsonb_build_object(
   'version',1,
   'attack_challenge_mode_default',false,
   'student_whatsapp_verification_required',true,
   'staff_aal2_required',true,
   'admin_aal2_required',true,
   'phone_otp_channel','whatsapp',
   'phone_otp_ttl_minutes',10,
   'phone_otp_resend_seconds',60,
   'phone_otp_max_per_15m',3,
   'phone_otp_max_per_day',6,
   'phone_otp_max_checks',5,
   'google_minimal_identity_scopes',jsonb_build_array('openid','email','profile'),
   'google_tokens_persisted_in_profile',false,
   'auto_admin_from_email',false,
   'privileged_role_changes','aal2_only',
   'service_role_browser_exposure',false
 )),
 ('progressive_trust',true,jsonb_build_object(
   'browse','authenticated_identity',
   'student_services','verified_contact',
   'staff_portals','aal2',
   'god_mode','aal2'
 ))
on conflict(policy_key) do update set enabled=excluded.enabled,config=excluded.config,updated_at=now();

alter table public.platform_security_policy enable row level security;
drop policy if exists platform_security_policy_authenticated_read on public.platform_security_policy;
create policy platform_security_policy_authenticated_read on public.platform_security_policy
for select to authenticated using(true);
revoke insert,update,delete on public.platform_security_policy from anon,authenticated;
grant select on public.platform_security_policy to authenticated;

-- Protected profile identity/security fields cannot be self-asserted by a normal client.
create or replace function public.rk_guard_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare self_edit boolean:=auth.uid() is not null and auth.uid()=old.id and auth.role()<>'service_role';
begin
  if self_edit then
    new.email:=old.email;
    new.role:=old.role;
    new.auth_provider:=old.auth_provider;
    new.auth_provider_subject:=old.auth_provider_subject;
    new.email_verified_at:=old.email_verified_at;
    new.phone_verified_at:=old.phone_verified_at;
    new.phone_verification_method:=old.phone_verification_method;
    new.identity_synced_at:=old.identity_synced_at;
    new.last_login_at:=old.last_login_at;
    new.security_level:=old.security_level;
  end if;

  new.phone_e164:=public.rk_normalize_za_phone(coalesce(new.phone,new.phone_number));

  if (new.phone is distinct from old.phone or new.phone_number is distinct from old.phone_number or new.phone_e164 is distinct from old.phone_e164) then
    new.phone_verified_at:=null;
    new.phone_verification_method:=null;
    new.security_level:=public.rk_security_level(new.email_verified_at,null,false);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_rk_guard_profile_security_fields on public.profiles;
create trigger trg_rk_guard_profile_security_fields
before update on public.profiles
for each row execute function public.rk_guard_profile_security_fields();

-- New-user identity bootstrap. Removes the legacy email-based admin grant.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  provider text:=coalesce(nullif(new.raw_app_meta_data->>'provider',''),'email');
  provider_sub text:=nullif(new.raw_user_meta_data->>'sub','');
  resolved_name text:=coalesce(nullif(new.raw_user_meta_data->>'full_name',''),nullif(new.raw_user_meta_data->>'name',''),'');
  resolved_avatar text:=coalesce(nullif(new.raw_user_meta_data->>'avatar_url',''),nullif(new.raw_user_meta_data->>'picture',''));
  verified_at timestamptz:=new.email_confirmed_at;
begin
  insert into public.profiles(
    id,full_name,email,phone,phone_e164,student_number,identity_number,campus,applicant_stage,
    heard_about_us,recruiter_reference,profile_picture_url,auth_provider,auth_provider_subject,
    email_verified_at,identity_synced_at,last_login_at,security_level
  ) values(
    new.id,resolved_name,new.email,
    nullif(new.raw_user_meta_data->>'phone',''),
    public.rk_normalize_za_phone(new.raw_user_meta_data->>'phone'),
    nullif(new.raw_user_meta_data->>'student_number',''),
    nullif(new.raw_user_meta_data->>'identity_number',''),
    nullif(new.raw_user_meta_data->>'campus',''),
    nullif(new.raw_user_meta_data->>'applicant_stage',''),
    nullif(new.raw_user_meta_data->>'heard_about_us',''),
    nullif(new.raw_user_meta_data->>'recruiter_reference',''),
    resolved_avatar,provider,provider_sub,verified_at,now(),new.last_sign_in_at,
    public.rk_security_level(verified_at,null,false)
  )
  on conflict(id) do update set
    email=excluded.email,
    full_name=coalesce(nullif(public.profiles.full_name,''),excluded.full_name),
    phone=coalesce(nullif(public.profiles.phone,''),excluded.phone),
    phone_e164=coalesce(public.profiles.phone_e164,excluded.phone_e164),
    student_number=coalesce(nullif(public.profiles.student_number,''),excluded.student_number),
    identity_number=coalesce(nullif(public.profiles.identity_number,''),excluded.identity_number),
    campus=coalesce(nullif(public.profiles.campus,''),excluded.campus),
    applicant_stage=coalesce(public.profiles.applicant_stage,excluded.applicant_stage),
    heard_about_us=coalesce(public.profiles.heard_about_us,excluded.heard_about_us),
    recruiter_reference=coalesce(public.profiles.recruiter_reference,excluded.recruiter_reference),
    profile_picture_url=coalesce(nullif(public.profiles.profile_picture_url,''),excluded.profile_picture_url),
    auth_provider=excluded.auth_provider,
    auth_provider_subject=coalesce(excluded.auth_provider_subject,public.profiles.auth_provider_subject),
    email_verified_at=coalesce(excluded.email_verified_at,public.profiles.email_verified_at),
    identity_synced_at=now(),
    last_login_at=coalesce(excluded.last_login_at,public.profiles.last_login_at),
    security_level=public.rk_security_level(coalesce(excluded.email_verified_at,public.profiles.email_verified_at),public.profiles.phone_verified_at,false),
    updated_at=now();

  insert into public.user_roles(user_id,role)
  values(new.id,'student'::public.app_role)
  on conflict(user_id,role) do nothing;

  insert into public.user_security_events(user_id,event_type,risk_level,outcome,metadata)
  values(new.id,'identity.account_created','low','allowed',
    jsonb_build_object('provider',provider,'email_verified',verified_at is not null,'auto_admin_granted',false));

  return new;
end;
$$;

-- Keep Google/Auth identity metadata synchronized on later sign-ins/updates without storing OAuth tokens.
create or replace function public.rk_sync_auth_identity_profile()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  provider text:=coalesce(nullif(new.raw_app_meta_data->>'provider',''),'email');
  provider_sub text:=nullif(new.raw_user_meta_data->>'sub','');
  resolved_name text:=coalesce(nullif(new.raw_user_meta_data->>'full_name',''),nullif(new.raw_user_meta_data->>'name',''));
  resolved_avatar text:=coalesce(nullif(new.raw_user_meta_data->>'avatar_url',''),nullif(new.raw_user_meta_data->>'picture',''));
begin
  update public.profiles p
  set
    email=coalesce(new.email,p.email),
    full_name=coalesce(nullif(p.full_name,''),resolved_name,p.full_name),
    profile_picture_url=coalesce(nullif(p.profile_picture_url,''),resolved_avatar,p.profile_picture_url),
    auth_provider=provider,
    auth_provider_subject=coalesce(provider_sub,p.auth_provider_subject),
    email_verified_at=coalesce(new.email_confirmed_at,p.email_verified_at),
    identity_synced_at=now(),
    last_login_at=coalesce(new.last_sign_in_at,p.last_login_at),
    security_level=public.rk_security_level(coalesce(new.email_confirmed_at,p.email_verified_at),p.phone_verified_at,
      exists(select 1 from public.user_roles ur where ur.user_id=p.id and ur.role::text in ('admin','super_admin','owner','developer')))
  where p.id=new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_identity_synced on auth.users;
create trigger on_auth_user_identity_synced
after update of email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data,last_sign_in_at on auth.users
for each row execute function public.rk_sync_auth_identity_profile();

-- Backfill current users with only minimal identity-provider data.
update public.profiles p
set
  auth_provider=coalesce(nullif(u.raw_app_meta_data->>'provider',''),'email'),
  auth_provider_subject=coalesce(nullif(u.raw_user_meta_data->>'sub',''),p.auth_provider_subject),
  email_verified_at=coalesce(u.email_confirmed_at,p.email_verified_at),
  profile_picture_url=coalesce(nullif(p.profile_picture_url,''),nullif(u.raw_user_meta_data->>'avatar_url',''),nullif(u.raw_user_meta_data->>'picture','')),
  phone_e164=public.rk_normalize_za_phone(coalesce(p.phone,p.phone_number)),
  identity_synced_at=now(),
  last_login_at=coalesce(u.last_sign_in_at,p.last_login_at),
  security_level=public.rk_security_level(coalesce(u.email_confirmed_at,p.email_verified_at),p.phone_verified_at,
    exists(select 1 from public.user_roles ur where ur.user_id=p.id and ur.role::text in ('admin','super_admin','owner','developer')))
from auth.users u
where u.id=p.id;

-- Privileged backend access requires AAL2 for both God Mode and departmental staff.
create or replace function public.has_admin_department_access(p_department_key text)
returns boolean
language sql
stable
security definer
set search_path=''
set row_security='off'
as $$
  select auth.role()='service_role'
    or (
      auth.uid() is not null
      and coalesce(auth.jwt()->>'aal','aal1')='aal2'
      and lower(btrim(coalesce(p_department_key,'')))=any(public.admin_effective_departments(auth.uid()))
    );
$$;

create or replace function public.adminos_is_staff()
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select auth.role()='service_role'
    or (
      auth.uid() is not null
      and coalesce(auth.jwt()->>'aal','aal1')='aal2'
      and public.get_user_staff_role(auth.uid()) is not null
    );
$$;

-- Tighten the generic contacts policy: customer PII is available only to an AAL2 staff session.
drop policy if exists "AdminOS staff access" on public.adminos_contacts;
create policy "AdminOS staff access"
on public.adminos_contacts for all to authenticated
using(public.adminos_is_staff())
with check(public.adminos_is_staff());

-- Remove duplicate broad admin profile policies; replace with one AAL2 admin policy.
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Admins view all profiles" on public.profiles;
drop policy if exists "admin_override_all_profiles" on public.profiles;
create policy profiles_admin_aal2_all
on public.profiles for all to authenticated
using(
  public.has_role(auth.uid(),'admin'::public.app_role)
  and coalesce(auth.jwt()->>'aal','aal1')='aal2'
)
with check(
  public.has_role(auth.uid(),'admin'::public.app_role)
  and coalesce(auth.jwt()->>'aal','aal1')='aal2'
);

-- Self-service status RPC exposes no OTP/provider secret material.
create or replace function public.rk_my_security_status()
returns jsonb
language plpgsql
security definer
set search_path=public
set row_security=off
as $$
declare uid uuid:=auth.uid();p public.profiles%rowtype;recent record;
begin
  if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into p from public.profiles where id=uid;
  select status,requested_at,last_sent_at,expires_at,verified_at,channel
  into recent
  from public.user_phone_verification_attempts
  where user_id=uid order by requested_at desc limit 1;

  return jsonb_build_object(
    'auth_provider',p.auth_provider,
    'email_verified',p.email_verified_at is not null,
    'phone',p.phone_e164,
    'phone_verified',p.phone_verified_at is not null,
    'phone_verified_at',p.phone_verified_at,
    'phone_verification_method',p.phone_verification_method,
    'security_level',p.security_level,
    'latest_phone_verification',case when recent.status is null then null else jsonb_build_object(
      'status',recent.status,'requested_at',recent.requested_at,'last_sent_at',recent.last_sent_at,
      'expires_at',recent.expires_at,'verified_at',recent.verified_at,'channel',recent.channel
    ) end
  );
end;
$$;
revoke all on function public.rk_my_security_status() from public,anon;
grant execute on function public.rk_my_security_status() to authenticated;

insert into public.adminos_integration_connections(provider,display_name,status,enabled,setup_step,external_account_label,config,secret_refs,setup_url,docs_url)
values(
  'twilio_verify','Twilio Verify · WhatsApp','not_connected',true,1,'ResKonnect Security',
  jsonb_build_object('channel','whatsapp','purpose','phone_ownership_verification','service_auto_provision',true,'otp_ttl_minutes',10),
  jsonb_build_object('account_sid_env','TWILIO_ACCOUNT_SID','auth_token_env','TWILIO_AUTH_TOKEN','whatsapp_from_env','TWILIO_WHATSAPP_FROM'),
  'https://console.twilio.com/us1/develop/verify/services','https://www.twilio.com/docs/verify'
)
on conflict(provider) do update set display_name=excluded.display_name,enabled=true,config=adminos_integration_connections.config||excluded.config,
  secret_refs=adminos_integration_connections.secret_refs||excluded.secret_refs,setup_url=excluded.setup_url,docs_url=excluded.docs_url,updated_at=now();
