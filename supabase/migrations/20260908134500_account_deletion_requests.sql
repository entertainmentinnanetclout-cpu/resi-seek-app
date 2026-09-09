create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text,
  reason text,
  status text not null default 'requested' check (status in ('requested','processing','cancelled','completed')),
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists account_deletion_requests_active_user_idx
on public.account_deletion_requests(user_id)
where status in ('requested','processing');

alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from anon;
grant select on public.account_deletion_requests to authenticated;

drop policy if exists account_deletion_requests_own_select on public.account_deletion_requests;
create policy account_deletion_requests_own_select
on public.account_deletion_requests
for select
to authenticated
using (user_id = auth.uid());

create or replace function public.request_account_deletion(p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  current_email text;
  request_row public.account_deletion_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select email into current_email from auth.users where id = auth.uid();

  select * into request_row
  from public.account_deletion_requests
  where user_id = auth.uid()
    and status in ('requested','processing')
  order by requested_at desc
  limit 1;

  if request_row.id is null then
    insert into public.account_deletion_requests (user_id, email, reason, status, metadata)
    values (auth.uid(), current_email, nullif(btrim(coalesce(p_reason,'')), ''), 'requested', jsonb_build_object('source','self_service'))
    returning * into request_row;
  elsif request_row.status = 'requested' then
    update public.account_deletion_requests
    set reason = coalesce(nullif(btrim(coalesce(p_reason,'')), ''), reason), updated_at = now()
    where id = request_row.id
    returning * into request_row;
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', request_row.id,
    'status', request_row.status,
    'requested_at', request_row.requested_at,
    'email', request_row.email
  );
end;
$$;

create or replace function public.cancel_account_deletion_request()
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  request_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.account_deletion_requests
  set status = 'cancelled', updated_at = now()
  where user_id = auth.uid() and status = 'requested'
  returning id into request_id;

  return jsonb_build_object('ok', true, 'cancelled', request_id is not null, 'id', request_id);
end;
$$;

revoke all on function public.request_account_deletion(text) from public, anon;
revoke all on function public.cancel_account_deletion_request() from public, anon;
grant execute on function public.request_account_deletion(text) to authenticated;
grant execute on function public.cancel_account_deletion_request() to authenticated;
