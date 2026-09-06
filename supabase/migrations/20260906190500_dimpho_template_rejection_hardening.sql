-- Replace two rejected WhatsApp utility templates with corrected versioned templates.
-- Meta rejected the previous bodies because variables were interpreted at template boundaries.
-- Versioned keys force a fresh Twilio Content SID and preserve an auditable history.

insert into public.adminos_whatsapp_rich_content(
  content_key, display_name, content_type, approval_required, status, purpose, config, metadata
)
values
(
  'rk_status_update_v2',
  'Dimpho status update v2',
  'twilio/quick-reply',
  true,
  'not_created',
  'transactional',
  jsonb_build_object(
    'body','Hello {{1}}. There is an update on your ResKonnect {{2}}. The current status is {{3}}. Open ResKonnect or reply here if you need help.',
    'actions',jsonb_build_array(
      jsonb_build_object('id','app:status','type','QUICK_REPLY','title','View status'),
      jsonb_build_object('id','app:help','type','QUICK_REPLY','title','Need help')
    )
  ),
  jsonb_build_object('persona','Dimpho','release','service_intelligence','supersedes','rk_status_update','template_fix','variable_boundary_hardening')
),
(
  'rk_next_step_reminder_v2',
  'Dimpho next-step reminder v2',
  'twilio/quick-reply',
  true,
  'not_created',
  'transactional',
  jsonb_build_object(
    'body','Hello {{1}}. Dimpho from ResKonnect has a next step for you: {{2}}. Use this secure link to continue: {{3}}. Reply MENU anytime for more options.',
    'actions',jsonb_build_array(
      jsonb_build_object('id','menu:main','type','QUICK_REPLY','title','Continue'),
      jsonb_build_object('id','human:wait','type','QUICK_REPLY','title','Human help')
    )
  ),
  jsonb_build_object('persona','Dimpho','release','service_intelligence','supersedes','rk_next_step_reminder','template_fix','variable_boundary_hardening')
)
on conflict (content_key) do update set
  display_name=excluded.display_name,
  content_type=excluded.content_type,
  approval_required=excluded.approval_required,
  purpose=excluded.purpose,
  config=excluded.config,
  metadata=public.adminos_whatsapp_rich_content.metadata || excluded.metadata,
  content_sid=case when public.adminos_whatsapp_rich_content.status in ('rejected','provider_error') then null else public.adminos_whatsapp_rich_content.content_sid end,
  status=case when public.adminos_whatsapp_rich_content.status in ('rejected','provider_error') then 'not_created' else public.adminos_whatsapp_rich_content.status end,
  updated_at=now();

update public.adminos_whatsapp_rich_content
set status='disabled',
    metadata=metadata || jsonb_build_object(
      'superseded_at',now(),
      'superseded_by',case content_key
        when 'rk_status_update' then 'rk_status_update_v2'
        else 'rk_next_step_reminder_v2'
      end
    ),
    updated_at=now()
where content_key in ('rk_status_update','rk_next_step_reminder');

-- Requeue any events that were waiting on the rejected templates. The event worker
-- will resolve them to the versioned templates and keep them waiting until Meta approval is green.
update public.adminos_whatsapp_site_events
set status='pending', available_at=now(), last_error=null, updated_at=now()
where status='waiting_template'
  and (
    event_type like 'proactive_%'
    or event_type in ('application_status_changed','reservation_status_changed','wil_status_changed')
  );
