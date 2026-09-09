-- Seed the governed learning queue with recent real conversations so Dimpho does
-- not begin learning only from the day Intelligence R1-R4 ships.
-- Raw message text is deliberately NOT copied; only identifiers are queued.

insert into public.dimpho_conversation_events(channel,thread_id,message_id,direction,occurred_at,available_at,metadata)
select
  'whatsapp',m.thread_id,m.id,m.direction,
  coalesce(m.received_at,m.sent_at,m.created_at,now()),now(),
  jsonb_build_object('contact_id',m.contact_id,'backfill',true,'source','r1_r4_180_day_backfill')
from public.adminos_whatsapp_messages m
where m.thread_id is not null
  and m.created_at >= now() - interval '180 days'
on conflict(channel,message_id) do nothing;

insert into public.dimpho_conversation_events(channel,thread_id,message_id,direction,occurred_at,available_at,metadata)
select
  'in_app',m.thread_id,m.id,coalesce(m.direction,m.sender_type),m.created_at,now(),
  jsonb_build_object('sender_type',m.sender_type,'backfill',true,'source','r1_r4_180_day_backfill')
from public.adminos_enquiry_messages m
where m.thread_id is not null
  and m.created_at >= now() - interval '180 days'
on conflict(channel,message_id) do nothing;

insert into public.dimpho_conversation_events(channel,thread_id,message_id,direction,occurred_at,available_at,metadata)
select
  'email',m.thread_id,m.id,m.direction,
  coalesce(m.received_at,m.sent_at,m.created_at,now()),now(),
  jsonb_build_object('contact_id',m.contact_id,'backfill',true,'source','r1_r4_180_day_backfill')
from public.adminos_email_messages m
where m.thread_id is not null
  and m.created_at >= now() - interval '180 days'
on conflict(channel,message_id) do nothing;
