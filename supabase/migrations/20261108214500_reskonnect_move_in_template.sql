-- Allow the guarded residence move-in communication template in the existing
-- owner-scoped template studio. No data changes, grants, or authorization changes.
BEGIN;
ALTER TABLE public.reskonnect_email_templates
  DROP CONSTRAINT IF EXISTS reskonnect_email_templates_template_key_check;
ALTER TABLE public.reskonnect_email_templates
  ADD CONSTRAINT reskonnect_email_templates_template_key_check
  CHECK (template_key = ANY (ARRAY[
    'smart','acknowledgement','documents_needed','documents_received',
    'approved','rejected','conditionally_approved','status_update',
    'feedback','next_steps','enquiry_response','viewing_invite',
    'follow_up','reservation_confirmed','move_in_arrangements'
  ]::text[]));
COMMIT;
