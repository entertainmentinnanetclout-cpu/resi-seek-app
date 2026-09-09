create or replace function public.adminos_enqueue_escalation_event_alert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  recipient record;
  thread_row record;
  customer_label_value text;
  event_reason text;
begin
  if new.event_type <> 'whatsapp.escalated'
     or new.entity_type <> 'whatsapp_thread'
     or new.entity_id is null then
    return new;
  end if;

  select t.id,t.contact_id,t.channel_address,c.full_name,c.student_number,c.phone
  into thread_row
  from public.adminos_whatsapp_threads t
  left join public.adminos_contacts c on c.id=t.contact_id
  where t.id=new.entity_id;

  if thread_row.id is null then return new; end if;

  customer_label_value := coalesce(
    thread_row.full_name,
    thread_row.student_number,
    thread_row.phone,
    thread_row.channel_address,
    'WhatsApp customer'
  );
  event_reason := coalesce(nullif(new.payload->>'reason',''),'Human assistance requested on WhatsApp');

  for recipient in
    select phone_e164 from public.adminos_escalation_recipients where enabled=true
  loop
    if not exists (
      select 1
      from public.adminos_escalation_alerts a
      where a.thread_id=new.entity_id
        and a.recipient_number=recipient.phone_e164
        and a.created_at >= new.created_at - interval '90 seconds'
    ) then
      insert into public.adminos_escalation_alerts(
        thread_id,contact_id,recipient_number,customer_label,reason,escalation_key,status,available_at
      ) values (
        new.entity_id,
        coalesce(new.contact_id,thread_row.contact_id),
        recipient.phone_e164,
        customer_label_value,
        event_reason,
        encode(extensions.digest(new.entity_id::text || ':' || recipient.phone_e164 || ':event:' || new.id::text,'sha256'),'hex'),
        'pending',
        now()
      ) on conflict (escalation_key) do nothing;
    end if;
  end loop;
  return new;
end;
$$;

revoke all on function public.adminos_enqueue_escalation_event_alert() from public, anon, authenticated;

drop trigger if exists trg_adminos_escalation_event_alert on public.adminos_automation_events;
create trigger trg_adminos_escalation_event_alert
after insert on public.adminos_automation_events
for each row
when (new.event_type='whatsapp.escalated' and new.entity_type='whatsapp_thread')
execute function public.adminos_enqueue_escalation_event_alert();
