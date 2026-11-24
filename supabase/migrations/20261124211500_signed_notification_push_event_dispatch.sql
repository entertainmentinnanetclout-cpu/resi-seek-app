-- Web push delivery for privacy-scoped, newly inserted account notifications.
-- A Vault-backed HMAC signs only the notification UUID; no tokens or student data
-- are placed in the database webhook request.
do $do$ begin
 if not exists (select 1 from vault.secrets where name='rk_notification_webhook_hmac_v1') then
  perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),
    'rk_notification_webhook_hmac_v1','ResKonnect signed notification webhook authentication');
 end if;
end $do$;

create or replace function public.rk_notification_dispatch_hmac_secret()
returns text language sql stable security definer set search_path='' as $$
 select s.decrypted_secret from vault.decrypted_secrets s
 where s.name='rk_notification_webhook_hmac_v1' limit 1
$$;
revoke all on function public.rk_notification_dispatch_hmac_secret() from public,anon,authenticated;
grant execute on function public.rk_notification_dispatch_hmac_secret() to service_role;

create table if not exists public.rk_notification_push_dispatches(
 notification_id uuid primary key references public.notifications(id) on delete cascade,
 state text not null default 'processing' check (state in ('processing','dispatched','no_device','failed')),
 web_delivered integer not null default 0,
 native_delivered integer not null default 0,
 last_error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.rk_notification_push_dispatches enable row level security;
revoke all on public.rk_notification_push_dispatches from anon,authenticated;
grant select,insert,update on public.rk_notification_push_dispatches to service_role;

create or replace function reskonnect_internal.queue_notification_webpush()
returns trigger language plpgsql security definer set search_path='' as $$
declare secret text; signature text; request_id bigint;
begin
 if new.user_id is null then return new; end if;
 select s.decrypted_secret into secret from vault.decrypted_secrets s
 where s.name='rk_notification_webhook_hmac_v1' limit 1;
 if secret is null then return new; end if;
 signature=encode(extensions.hmac(new.id::text,secret,'sha256'),'hex');
 select net.http_post(
  url:='https://mefjzkhobkltlbmhusdh.supabase.co/functions/v1/notification-event',
  body:=jsonb_build_object('notification_id',new.id),
  headers:=jsonb_build_object('Content-Type','application/json','X-ResKonnect-Event-Signature',signature),
  timeout_milliseconds:=6000
 ) into request_id;
 return new;
exception when others then
 -- Never fail an application, enquiry or in-app notification because push
 -- delivery is unavailable. Only a generic SQLSTATE enters database logs.
 raise warning 'Notification push queue failed, SQLSTATE %',sqlstate;
 return new;
end;$$;
revoke all on function reskonnect_internal.queue_notification_webpush() from public,anon,authenticated;
drop trigger if exists rk_dispatch_notification_insert on public.notifications;
create trigger rk_dispatch_notification_insert after insert on public.notifications
for each row when (new.user_id is not null)
execute function reskonnect_internal.queue_notification_webpush();
