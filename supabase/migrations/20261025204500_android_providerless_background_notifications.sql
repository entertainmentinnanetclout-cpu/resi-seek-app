-- Provider-independent Android notification transport.
-- FCM remains the instant path; this gives Android a Supabase-backed periodic fallback.

create table if not exists public.native_background_notification_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null,
  token_hash text not null,
  enabled boolean not null default true,
  issued_at timestamptz not null default now(),
  last_polled_at timestamptz,
  last_notification_created_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint native_background_notification_devices_user_device_key unique (user_id, device_id),
  constraint native_background_notification_devices_token_hash_key unique (token_hash),
  constraint native_background_notification_devices_token_hash_format check (token_hash ~ '^[0-9a-f]{64}$')
);

alter table public.native_background_notification_devices enable row level security;
revoke all on table public.native_background_notification_devices from anon, authenticated;

create or replace function public.rk_issue_background_notification_token(p_device_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_token text;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_device_id is null then raise exception 'device id required' using errcode = '22023'; end if;
  v_token := encode(gen_random_bytes(32), 'hex');
  insert into public.native_background_notification_devices (user_id, device_id, token_hash, enabled, issued_at, last_polled_at, last_notification_created_at, updated_at)
  values (v_user_id, p_device_id, encode(digest(v_token, 'sha256'), 'hex'), true, now(), null, now(), now())
  on conflict (user_id, device_id) do update
  set token_hash = excluded.token_hash, enabled = true, issued_at = now(), last_polled_at = null, last_notification_created_at = now(), updated_at = now();
  return v_token;
end;
$$;
revoke all on function public.rk_issue_background_notification_token(uuid) from public, anon;
grant execute on function public.rk_issue_background_notification_token(uuid) to authenticated;

create or replace function public.rk_revoke_background_notification_token(p_device_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_changed integer;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  update public.native_background_notification_devices
  set enabled = false,
      token_hash = encode(digest(gen_random_uuid()::text || clock_timestamp()::text, 'sha256'), 'hex'),
      updated_at = now()
  where user_id = v_user_id and device_id = p_device_id;
  get diagnostics v_changed = row_count;
  return v_changed > 0;
end;
$$;
revoke all on function public.rk_revoke_background_notification_token(uuid) from public, anon;
grant execute on function public.rk_revoke_background_notification_token(uuid) to authenticated;

create or replace function public.rk_poll_background_notifications(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_device public.native_background_notification_devices%rowtype;
  v_count integer := 0;
  v_latest timestamptz;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return jsonb_build_object('ok', false, 'count', 0); end if;
  select * into v_device from public.native_background_notification_devices
  where token_hash = encode(digest(p_token, 'sha256'), 'hex') and enabled = true for update;
  if not found then return jsonb_build_object('ok', false, 'count', 0); end if;
  if v_device.last_polled_at is not null and v_device.last_polled_at > now() - interval '90 seconds' then
    return jsonb_build_object('ok', true, 'count', 0, 'throttled', true);
  end if;
  select count(*)::integer, max(n.created_at at time zone 'UTC') into v_count, v_latest
  from public.notifications n
  where n.user_id = v_device.user_id
    and coalesce(n.is_read, false) = false
    and (n.created_at at time zone 'UTC') > v_device.last_notification_created_at;
  update public.native_background_notification_devices
  set last_polled_at = now(),
      last_notification_created_at = greatest(last_notification_created_at, coalesce(v_latest, last_notification_created_at)),
      updated_at = now()
  where id = v_device.id;
  return jsonb_build_object('ok', true, 'count', v_count, 'has_updates', v_count > 0);
end;
$$;
revoke all on function public.rk_poll_background_notifications(text) from public, anon, authenticated;
grant execute on function public.rk_poll_background_notifications(text) to service_role;

comment on table public.native_background_notification_devices is
  'Opaque per-installation credentials for provider-independent Android notification polling.';
