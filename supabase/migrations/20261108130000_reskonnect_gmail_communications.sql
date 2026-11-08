-- Email connection and transactional correspondence. Safe to reapply when live tables already exist.
-- Requires Supabase Vault for Google refresh-token encryption.
create schema if not exists vault;
create extension if not exists supabase_vault with schema vault;

create table if not exists public.landlord_gmail_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_subject text not null,
  gmail_address text not null,
  refresh_token_vault_id uuid not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  enabled boolean not null default true
);
create table if not exists public.landlord_gmail_oauth_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  state_hash text not null unique,
  code_verifier text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists landlord_gmail_oauth_states_expiry_idx
  on public.landlord_gmail_oauth_states(expires_at);
create table if not exists public.landlord_gmail_email_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reservation_id uuid not null references public.accommodation_reservations(id) on delete cascade,
  recipient_address text not null,
  gmail_message_id text,
  status text not null check(status in ('sending','sent','failed','unknown')),
  failure_code text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id,reservation_id)
);
create index if not exists landlord_gmail_email_logs_user_idx on public.landlord_gmail_email_logs(user_id,created_at desc);
create table if not exists public.reskonnect_outbound_emails (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  target_kind text not null check (target_kind in ('application','reservation','housing_lead','support_enquiry')),
  target_id uuid not null,
  template_key text not null check (template_key in ('status_update','feedback','documents_needed','next_steps','enquiry_response','viewing_invite')),
  idempotency_key uuid not null,
  recipient_email text not null,
  recipient_user_id uuid,
  subject text not null,
  delivery_status text not null default 'sending' check (delivery_status in ('sending','sent','failed','unknown')),
  provider_message_id text,
  failure_code text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique(actor_user_id,idempotency_key)
);
create index if not exists reskonnect_outbound_emails_actor_recent_idx on public.reskonnect_outbound_emails(actor_user_id,created_at desc);
create index if not exists reskonnect_outbound_emails_target_idx on public.reskonnect_outbound_emails(target_kind,target_id,created_at desc);

alter table public.landlord_gmail_connections enable row level security;
alter table public.landlord_gmail_oauth_states enable row level security;
alter table public.landlord_gmail_email_logs enable row level security;
alter table public.reskonnect_outbound_emails enable row level security;
revoke all on public.landlord_gmail_connections from public,anon,authenticated;
revoke all on public.landlord_gmail_oauth_states from public,anon,authenticated;
revoke all on public.landlord_gmail_email_logs from public,anon,authenticated;
revoke all on public.reskonnect_outbound_emails from public,anon,authenticated;
grant all on public.landlord_gmail_connections to service_role;
grant all on public.landlord_gmail_oauth_states to service_role;
grant all on public.landlord_gmail_email_logs to service_role;
grant all on public.reskonnect_outbound_emails to service_role;

CREATE OR REPLACE FUNCTION public.gmail_store_connection(p_user_id uuid, p_google_subject text, p_gmail_address text, p_refresh_token text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_secret_id uuid;
begin
  if p_user_id is null or nullif(p_google_subject,'') is null or
     nullif(p_gmail_address,'') is null or nullif(p_refresh_token,'') is null then
    raise exception 'Invalid Gmail connection';
  end if;
  select refresh_token_vault_id into v_secret_id
  from public.landlord_gmail_connections where user_id=p_user_id for update;
  if v_secret_id is null then
    v_secret_id := vault.create_secret(p_refresh_token);
  else
    perform vault.update_secret(v_secret_id, p_refresh_token);
  end if;
  insert into public.landlord_gmail_connections
    (user_id,google_subject,gmail_address,refresh_token_vault_id,updated_at,enabled)
  values(p_user_id,p_google_subject,p_gmail_address,v_secret_id,now(),true)
  on conflict(user_id) do update set
    google_subject=excluded.google_subject,
    gmail_address=excluded.gmail_address,
    refresh_token_vault_id=excluded.refresh_token_vault_id,
    updated_at=now(),
    enabled=true;
end $function$;

CREATE OR REPLACE FUNCTION public.gmail_get_connection_secret(p_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select s.decrypted_secret
  from public.landlord_gmail_connections c
  join vault.decrypted_secrets s on s.id=c.refresh_token_vault_id
  where c.user_id=p_user_id and c.enabled=true
  limit 1
$function$;

CREATE OR REPLACE FUNCTION public.gmail_delete_connection(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_secret_id uuid;
begin
  delete from public.landlord_gmail_connections where user_id=p_user_id
  returning refresh_token_vault_id into v_secret_id;
  if v_secret_id is not null then
    delete from vault.secrets where id=v_secret_id;
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.gmail_consume_oauth_state(p_state_hash text)
 RETURNS TABLE(user_id uuid, code_verifier text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 update public.landlord_gmail_oauth_states s
 set consumed_at=now()
 where s.state_hash=p_state_hash and s.consumed_at is null and s.expires_at>now()
 returning s.user_id,s.code_verifier
$function$;

revoke all on function public.gmail_store_connection(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.gmail_get_connection_secret(uuid) from public,anon,authenticated;
revoke all on function public.gmail_delete_connection(uuid) from public,anon,authenticated;
revoke all on function public.gmail_consume_oauth_state(text) from public,anon,authenticated;
grant execute on function public.gmail_store_connection(uuid,text,text,text) to service_role;
grant execute on function public.gmail_get_connection_secret(uuid) to service_role;
grant execute on function public.gmail_delete_connection(uuid) to service_role;
grant execute on function public.gmail_consume_oauth_state(text) to service_role;
