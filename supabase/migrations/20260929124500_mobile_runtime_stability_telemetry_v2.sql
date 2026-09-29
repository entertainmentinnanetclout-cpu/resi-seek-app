-- Privacy-minimised runtime stability telemetry for Android/PWA release hardening.
-- The table pre-existed as a private technical-event table; extend it without
-- exposing direct client CRUD. Clients can only write through the validated RPC.

alter table public.mobile_runtime_events
  drop constraint if exists mobile_runtime_events_event_type_check;

alter table public.mobile_runtime_events
  add constraint mobile_runtime_events_event_type_check
  check (event_type in (
    'post_login_stable','ui_error','renderer_recovery','boot',
    'renderer_gone','js_error','unhandled_rejection','ui_render_error',
    'webgl_context_lost','memory_pressure','request_timeout','offline','reconnected'
  ));

create index if not exists mobile_runtime_events_created_idx
  on public.mobile_runtime_events (created_at desc);
create index if not exists mobile_runtime_events_type_created_idx
  on public.mobile_runtime_events (event_type, created_at desc);

alter table public.mobile_runtime_events enable row level security;
revoke all on public.mobile_runtime_events from public, anon, authenticated;

create or replace function public.record_mobile_runtime_event(
  p_event_type text,
  p_platform text default 'android',
  p_release text default 'unknown',
  p_version_code integer default null,
  p_stage text default null,
  p_message text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_event text := lower(trim(coalesce(p_event_type,'')));
  v_platform text := left(lower(trim(coalesce(p_platform,'android'))),32);
  v_release text := left(trim(coalesce(p_release,'unknown')),64);
  v_stage text := nullif(left(trim(coalesce(p_stage,'')),240),'');
  v_message text := nullif(left(trim(coalesce(p_message,'')),500),'');
  v_meta jsonb := coalesce(p_metadata,'{}'::jsonb);
begin
  if v_event not in (
    'post_login_stable','ui_error','renderer_recovery','boot',
    'renderer_gone','js_error','unhandled_rejection','ui_render_error',
    'webgl_context_lost','memory_pressure','request_timeout','offline','reconnected'
  ) then
    raise exception 'Unsupported runtime event';
  end if;
  if octet_length(v_meta::text) > 4096 then
    raise exception 'Runtime metadata too large';
  end if;

  insert into public.mobile_runtime_events(
    user_id,platform,release,version_code,event_type,stage,message,metadata
  )
  values(
    auth.uid(),coalesce(nullif(v_platform,''),'android'),
    coalesce(nullif(v_release,''),'unknown'),p_version_code,
    v_event,v_stage,v_message,v_meta
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.record_mobile_runtime_event(text,text,text,integer,text,text,jsonb) from public;
grant execute on function public.record_mobile_runtime_event(text,text,text,integer,text,text,jsonb) to anon, authenticated;

comment on table public.mobile_runtime_events is
'Privacy-minimised ResKonnect runtime stability events only. Do not store customer messages, documents, search text, passwords or tokens.';
