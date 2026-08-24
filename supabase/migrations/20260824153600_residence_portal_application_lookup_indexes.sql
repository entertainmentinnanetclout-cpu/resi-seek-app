-- Residence portal application lookup performance.
-- Applied to External Supabase production on 2026-08-24.

create index if not exists idx_applications_residence_created_at
  on public.applications (residence_id, created_at desc);

create index if not exists idx_applications_residence_status_created_at
  on public.applications (residence_id, status, created_at desc);

create index if not exists idx_application_messages_application_created_at
  on public.application_messages (application_id, created_at);

create index if not exists idx_application_activity_application_created_at
  on public.application_activity_log (application_id, created_at desc);

create index if not exists idx_application_documents_application_uploaded_at
  on public.application_documents (application_id, uploaded_at desc);
