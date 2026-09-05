-- Release Gate 3 defence-in-depth: no anonymous direct table access.
revoke all on table public.adminos_whatsapp_threads from anon;
revoke all on table public.adminos_whatsapp_messages from anon;
revoke all on table public.adminos_whatsapp_outbox from anon;
revoke all on table public.adminos_whatsapp_templates from anon;
revoke all on table public.adminos_followup_sequences from anon;
revoke all on table public.adminos_followup_steps from anon;
revoke all on table public.adminos_followup_enrollments from anon;
revoke all on table public.adminos_followup_attempts from anon;
revoke all on table public.adminos_followup_message_templates from anon;
revoke all on table public.adminos_document_templates from anon;
revoke all on table public.adminos_company_documents from anon;
revoke all on table public.adminos_company_document_versions from anon;
revoke all on table public.adminos_company_document_events from anon;
revoke all on table public.adminos_scheduler_secrets from anon, authenticated;
