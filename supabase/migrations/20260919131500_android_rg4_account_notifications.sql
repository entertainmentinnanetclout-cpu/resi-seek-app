-- Android RG4: one canonical notification inbox across app and website.
-- No outbound SMS/WhatsApp is sent by this migration.
alter table public.notifications add column if not exists event_key text;
create unique index if not exists notifications_event_key_unique on public.notifications(event_key) where event_key is not null;
create index if not exists notifications_user_created_idx on public.notifications(user_id,created_at desc);

create or replace function public.rk_application_account_notification()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_status text;
begin
  if new.user_id is null then return new; end if;
  if tg_op = 'INSERT' then
    insert into public.notifications(user_id,type,title,message,metadata,event_key,is_read,created_at)
    values(new.user_id,'application','Accommodation application submitted','Your accommodation application has been received. Open My Applications to follow its progress.',
      jsonb_build_object('application_id',new.id,'kind','application','status',coalesce(new.status,'submitted')),
      'application:created:'||new.id::text,false,now())
    on conflict(event_key) do nothing;
  elsif new.status is distinct from old.status then
    v_status := coalesce(nullif(trim(new.status),''),'updated');
    insert into public.notifications(user_id,type,title,message,metadata,event_key,is_read,created_at)
    values(new.user_id,'application_status','Your accommodation application was updated',
      'Your application status is now '||left(replace(v_status,'_',' '),80)||'. Open My Applications to review the latest information.',
      jsonb_build_object('application_id',new.id,'kind','application','status',v_status),
      'application:status:'||new.id::text||':'||coalesce(new.updated_at::text,clock_timestamp()::text)||':'||md5(v_status),false,now())
    on conflict(event_key) do nothing;
  end if;
  return new;
end; $$;
drop trigger if exists trg_rk_application_account_notification on public.applications;
create trigger trg_rk_application_account_notification after insert or update of status on public.applications
for each row execute function public.rk_application_account_notification();

-- Status-history notes are a distinct, private, action-required update; avoid
-- duplicating the status transition notification above.
create or replace function public.rk_application_feedback_notification()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.user_id is null or new.actor_user_id is null or new.actor_user_id = new.user_id
    or new.application_id is null or nullif(trim(coalesce(new.note,'')),'') is null
    or new.old_status is distinct from new.new_status then return new; end if;
  insert into public.notifications(user_id,type,title,message,metadata,event_key,is_read,created_at)
  values(new.user_id,'application','New feedback on your accommodation application',
    'Your accommodation application has new feedback. Open My Applications to read the details.',
    jsonb_build_object('application_id',new.application_id,'kind','application'),
    'application:feedback:'||new.id::text,false,now()) on conflict(event_key) do nothing;
  return new;
end; $$;
drop trigger if exists trg_rk_application_feedback_notification on public.application_status_history;
create trigger trg_rk_application_feedback_notification after insert on public.application_status_history
for each row execute function public.rk_application_feedback_notification();

-- FCM token is a device transport identifier, not the account notification record.
-- A new signed-in owner reclaims a device token atomically; do not allow one
-- device token to keep subscriptions for a previous signed-out account.
create table if not exists public.rk_native_device_tokens (
  token text primary key check(length(token) between 20 and 4096),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check(platform in ('android','ios')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz
);
create index if not exists rk_native_tokens_user_idx on public.rk_native_device_tokens(user_id);
alter table public.rk_native_device_tokens enable row level security;
revoke all on public.rk_native_device_tokens from anon, authenticated;
grant select on public.rk_native_device_tokens to authenticated;
create policy rk_native_tokens_own_select on public.rk_native_device_tokens for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.rk_register_native_push_token(p_token text,p_platform text default 'android')
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_token is null or length(p_token) not between 20 and 4096 or p_platform not in ('android','ios') then return false; end if;
  insert into public.rk_native_device_tokens(token,user_id,platform)
  values(p_token,v_uid,p_platform)
  on conflict(token) do update set user_id=excluded.user_id,platform=excluded.platform,updated_at=now();
  return true;
end; $$;
create or replace function public.rk_unregister_native_push_token(p_token text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from public.rk_native_device_tokens where token=p_token and user_id=auth.uid();
  return found;
end; $$;
revoke all on function public.rk_register_native_push_token(text,text) from public,anon;
revoke all on function public.rk_unregister_native_push_token(text) from public,anon;
grant execute on function public.rk_register_native_push_token(text,text) to authenticated;
grant execute on function public.rk_unregister_native_push_token(text) to authenticated;
