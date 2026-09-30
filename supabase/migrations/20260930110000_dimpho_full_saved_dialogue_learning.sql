insert into public.dimpho_conversation_events(channel,thread_id,message_id,direction,occurred_at,available_at,metadata)
select
  'whatsapp',m.thread_id,m.id,m.direction,
  coalesce(m.received_at,m.sent_at,m.created_at,now()),now(),
  jsonb_build_object('backfill',true,'source','saved_dialogue_learning_2026_09_30')
from public.adminos_whatsapp_messages m
where m.thread_id is not null
on conflict(channel,message_id) do nothing;

update public.dimpho_intelligence_settings
set learning_enabled=true,
    pii_redaction_enabled=true,
    auto_promote_style_examples=true,
    auto_promote_fact_updates=false,
    updated_at=now()
where id=1;
