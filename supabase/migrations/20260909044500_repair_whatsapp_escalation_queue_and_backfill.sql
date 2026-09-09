create or replace function public.adminos_enqueue_human_escalation_alert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  recipient record;
  customer_label_value text;
  event_reason text := 'Human assistance requested on WhatsApp';
  event_marker text;
begin
  if not (
    (new.mode in ('human','escalated') and coalesce(old.mode,'') not in ('human','escalated'))
    or (new.status='escalated' and old.status is distinct from 'escalated')
  ) then
    return new;
  end if;

  select coalesce(c.full_name,c.student_number,c.phone,new.channel_address,'WhatsApp customer')
  into customer_label_value
  from (select 1) x
  left join public.adminos_contacts c on c.id=new.contact_id;

  if coalesce(new.metadata->>'escalation_reason','') <> '' then
    event_reason := new.metadata->>'escalation_reason';
  end if;

  event_marker := coalesce(
    new.metadata->>'escalated_at',
    new.updated_at::text,
    clock_timestamp()::text
  );

  for recipient in
    select phone_e164
    from public.adminos_escalation_recipients
    where enabled=true
  loop
    insert into public.adminos_escalation_alerts(
      thread_id,contact_id,recipient_number,customer_label,reason,escalation_key
    ) values (
      new.id,
      new.contact_id,
      recipient.phone_e164,
      customer_label_value,
      event_reason,
      encode(extensions.digest(new.id::text || ':' || recipient.phone_e164 || ':' || event_marker,'sha256'),'hex')
    )
    on conflict (escalation_key) do nothing;
  end loop;

  return new;
end;
$$;

revoke all on function public.adminos_enqueue_human_escalation_alert() from public, anon, authenticated;

drop trigger if exists trg_adminos_human_escalation_alert on public.adminos_whatsapp_threads;
create trigger trg_adminos_human_escalation_alert
after update of mode,status on public.adminos_whatsapp_threads
for each row execute function public.adminos_enqueue_human_escalation_alert();

-- Recover unresolved handoffs that were missed while the trigger was failing.
with unresolved as (
  select
    t.id as thread_id,
    t.contact_id,
    t.channel_address,
    t.updated_at,
    coalesce(c.full_name,c.student_number,c.phone,t.channel_address,'WhatsApp customer') as customer_label,
    coalesce(
      (
        select nullif(e.payload->>'reason','')
        from public.adminos_automation_events e
        where e.event_type='whatsapp.escalated'
          and e.entity_type='whatsapp_thread'
          and e.entity_id=t.id
        order by e.created_at desc
        limit 1
      ),
      nullif(t.metadata->>'escalation_reason',''),
      'Human assistance requested on WhatsApp'
    ) as reason
  from public.adminos_whatsapp_threads t
  left join public.adminos_contacts c on c.id=t.contact_id
  where t.mode in ('human','escalated')
    and coalesce(t.status,'') not in ('closed','resolved')
), enabled_recipients as (
  select phone_e164 from public.adminos_escalation_recipients where enabled=true
)
insert into public.adminos_escalation_alerts(
  thread_id,contact_id,recipient_number,customer_label,reason,escalation_key,status,available_at
)
select
  u.thread_id,
  u.contact_id,
  r.phone_e164,
  u.customer_label,
  u.reason,
  encode(extensions.digest(u.thread_id::text || ':' || r.phone_e164 || ':recovery-20260909','sha256'),'hex'),
  'pending',
  now()
from unresolved u
cross join enabled_recipients r
on conflict (escalation_key) do nothing;
