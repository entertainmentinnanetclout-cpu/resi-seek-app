-- Focus the WhatsApp Desk on real inbound enquiries and route human escalations
-- to configured executive WhatsApp recipients without using AI.

-- Staff should see customer conversations only after an inbound WhatsApp exists.
-- Proactive-only/site-event threads remain available to service-role automation and analytics,
-- while CRM contacts stay accessible through the separate Contact Directory.
drop policy if exists "AdminOS staff access" on public.adminos_whatsapp_threads;
drop policy if exists "AdminOS staff select inbound threads" on public.adminos_whatsapp_threads;
drop policy if exists "AdminOS staff insert threads" on public.adminos_whatsapp_threads;
drop policy if exists "AdminOS staff update threads" on public.adminos_whatsapp_threads;
drop policy if exists "AdminOS staff delete threads" on public.adminos_whatsapp_threads;

create policy "AdminOS staff select inbound threads"
  on public.adminos_whatsapp_threads for select to authenticated
  using (
    (select public.adminos_is_staff())
    and (
      last_inbound_at is not null
      or coalesce(metadata->>'source','') <> 'site_event'
    )
  );

create policy "AdminOS staff insert threads"
  on public.adminos_whatsapp_threads for insert to authenticated
  with check ((select public.adminos_is_staff()));

create policy "AdminOS staff update threads"
  on public.adminos_whatsapp_threads for update to authenticated
  using ((select public.adminos_is_staff()))
  with check ((select public.adminos_is_staff()));

create policy "AdminOS staff delete threads"
  on public.adminos_whatsapp_threads for delete to authenticated
  using ((select public.adminos_is_staff()));

create table if not exists public.adminos_escalation_recipients (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  phone_e164 text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.adminos_escalation_alerts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.adminos_whatsapp_threads(id) on delete cascade,
  contact_id uuid references public.adminos_contacts(id) on delete set null,
  recipient_number text not null,
  customer_label text,
  reason text not null default 'Human assistance requested on WhatsApp',
  escalation_key text not null unique,
  status text not null default 'pending' check (status in ('pending','waiting_template','processing','sent','failed','blocked')),
  attempts integer not null default 0,
  twilio_message_sid text,
  last_error text,
  available_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_adminos_escalation_alerts_due
  on public.adminos_escalation_alerts(status, available_at, created_at);

alter table public.adminos_escalation_recipients enable row level security;
alter table public.adminos_escalation_alerts enable row level security;

revoke all on public.adminos_escalation_recipients, public.adminos_escalation_alerts from anon;
grant select on public.adminos_escalation_recipients, public.adminos_escalation_alerts to authenticated;

drop policy if exists "AdminOS staff read escalation recipients" on public.adminos_escalation_recipients;
create policy "AdminOS staff read escalation recipients"
  on public.adminos_escalation_recipients for select to authenticated
  using ((select public.adminos_is_staff()));

drop policy if exists "AdminOS staff read escalation alerts" on public.adminos_escalation_alerts;
create policy "AdminOS staff read escalation alerts"
  on public.adminos_escalation_alerts for select to authenticated
  using ((select public.adminos_is_staff()));

insert into public.adminos_escalation_recipients(label, phone_e164, enabled)
values
  ('Executive escalation 1', '+27715995752', true),
  ('Executive escalation 2', '+27677371872', true)
on conflict (phone_e164) do update set enabled=true, updated_at=now();

insert into public.adminos_whatsapp_rich_content(
  content_key, display_name, content_type, approval_required, status, purpose, config, metadata
)
values (
  'rk_internal_escalation_alert_v1',
  'ResKonnect internal human escalation alert',
  'twilio/text',
  true,
  'not_created',
  'internal_alert',
  jsonb_build_object(
    'body', 'ResKonnect escalation alert. Customer {{1}} needs human attention for: {{2}}. Open AdminOS: https://www.reskonnect.org/admin/system?tab=communications'
  ),
  jsonb_build_object('persona','Dimpho','audience','internal_executive','release','service_intelligence')
)
on conflict (content_key) do update set
  display_name=excluded.display_name,
  content_type=excluded.content_type,
  approval_required=excluded.approval_required,
  purpose=excluded.purpose,
  config=excluded.config,
  metadata=public.adminos_whatsapp_rich_content.metadata || excluded.metadata,
  status=case
    when public.adminos_whatsapp_rich_content.status in ('approved','pending_approval','created') then public.adminos_whatsapp_rich_content.status
    else 'not_created'
  end,
  updated_at=now();

create or replace function public.adminos_enqueue_human_escalation_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient record;
  customer_label_value text;
  event_reason text := 'Human assistance requested on WhatsApp';
begin
  if not (
    (new.mode = 'escalated' and old.mode is distinct from 'escalated')
    or (new.status = 'escalated' and old.status is distinct from 'escalated')
  ) then
    return new;
  end if;

  select coalesce(c.full_name, c.student_number, c.phone, new.channel_address, 'WhatsApp customer')
    into customer_label_value
  from (select 1) x
  left join public.adminos_contacts c on c.id = new.contact_id;

  if new.metadata ? 'escalation_reason' then
    event_reason := coalesce(nullif(new.metadata->>'escalation_reason',''), event_reason);
  end if;

  for recipient in
    select phone_e164 from public.adminos_escalation_recipients where enabled=true
  loop
    insert into public.adminos_escalation_alerts(
      thread_id, contact_id, recipient_number, customer_label, reason, escalation_key
    ) values (
      new.id,
      new.contact_id,
      recipient.phone_e164,
      customer_label_value,
      event_reason,
      encode(digest(new.id::text || ':' || recipient.phone_e164 || ':' || coalesce(new.updated_at::text, now()::text), 'sha256'),'hex')
    )
    on conflict (escalation_key) do nothing;
  end loop;

  return new;
end;
$$;

revoke all on function public.adminos_enqueue_human_escalation_alert() from public, anon, authenticated;

drop trigger if exists trg_adminos_human_escalation_alert on public.adminos_whatsapp_threads;
create trigger trg_adminos_human_escalation_alert
after update of mode, status on public.adminos_whatsapp_threads
for each row execute function public.adminos_enqueue_human_escalation_alert();

insert into public.adminos_scheduler_secrets(secret_key, secret_value)
select 'escalation_alert_worker', encode(gen_random_bytes(32),'hex')
where not exists (
  select 1 from public.adminos_scheduler_secrets where secret_key='escalation_alert_worker'
);

select cron.unschedule(jobid)
from cron.job
where jobname='adminos-escalation-alert-worker';

select cron.schedule(
  'adminos-escalation-alert-worker',
  '* * * * *',
  $cron$
  select net.http_post(
    url:='https://mefjzkhobkltlbmhusdh.supabase.co/functions/v1/adminos-escalation-worker',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'x-adminos-cron-token',(select secret_value from public.adminos_scheduler_secrets where secret_key='escalation_alert_worker')
    ),
    body:='{"action":"tick"}'::jsonb,
    timeout_milliseconds:=30000
  );
  $cron$
);
