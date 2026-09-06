-- Expand AdminOS WhatsApp template lifecycle states to match Twilio Content API / Meta approval workflow.
alter table public.adminos_whatsapp_templates
  drop constraint if exists adminos_whatsapp_templates_status_check;

alter table public.adminos_whatsapp_templates
  add constraint adminos_whatsapp_templates_status_check
  check (status = any (array[
    'needs_provider_approval'::text,
    'created'::text,
    'pending_approval'::text,
    'approved'::text,
    'rejected'::text,
    'provider_error'::text,
    'disabled'::text
  ]));
