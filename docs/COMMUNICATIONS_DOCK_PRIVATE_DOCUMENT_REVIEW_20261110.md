# ResKonnect Communications Dock — private document review & premium case workflows

## Operator journey

1. **Applications** and **Reservations** appear at the top of the Communications Dock in the case-first layout. The queue now carries an explicit pipeline label and one-click **Files** shortcut for each student.
2. Select a student. The **1 · Documents** tab displays the private student uploads and, for an application, any case-specific uploads. Each file shows the recorded type, upload date and verification state.
3. Open each available file with a private, **90-second** Supabase Storage signed URL (PDF/image preview). For eligible statuses, an authorized reviewer may verify the file or request a correction with a documented rejection reason. Student-level/global documents may be verified **only by an admin**; authorized residence staff can verify application-specific uploads.
4. Review missing documents and pending/rejected statuses, then explicitly acknowledge the current checklist. This stores a **20-minute, actor-bound, case-bound and document-snapshot-bound** review receipt, *not an approval decision*. Even if no documents were uploaded, the operator must acknowledge that readiness before preparing a missing-document request.
5. Preview the relevant official email/PDF or WhatsApp text. The Edge Function **rejects** direct, bulk-email and WhatsApp-handoff requests that lack a valid current review receipt for applications/reservations. Changed documents or case status require a new review.
6. Formal approval or rejection language still follows the **recorded case status** and existing business guardrails. The upload review does not automatically approve accommodation, funding or reservations.

## Security and operational boundaries

- The existing Supabase Edge Function `reskonnect-email-dock` retains `verify_jwt=true` and uses server-verified authenticated staff/residence roles, authorized residence IDs and verified case ownership.
- Documents remain **private**. A request supplies only a document ID and source; the Edge Function reads the owning database row, checks the student ID and server-owned path prefix, and creates a short-lived signed URL for that row. No public bucket or general document read policy is introduced.
- An `reskonnect_document_review_audit` table stores metadata only and has RLS enabled with all privileges revoked for `anon`/`authenticated`. Only service-role access is granted. It does **not** store file contents or personally identifying contact details.
- Admin notes from global documents are not returned to the Dock. A reviewer has to open the file before marking its status verified/rejected, with an explicit confirmation and a rejection reason for failures.
- Not a delivery receipt: Gmail accepted and operator-reported WhatsApp sent statuses retain existing semantics. Private student uploads must not be attached to outgoing email or WhatsApp.
- No changes to payments, application decision rules, account creation, RLS for existing documents, or unrelated Edge Functions.

## Deployment gates

Run the `backend:contracts` suite, full Vite build and CI. Apply `supabase/migrations/20261110210000_reskonnect_document_review_audit.sql` to the canonical project before deploying the new Edge bundle. Deploy the complete 10-file `reskonnect-email-dock` bundle with JWT enabled, then verify file parity and production Vercel readiness. Test unauthorized access, private previews, status updates, missing-file acknowledgement and send guards with approved staff/landlord staging identities before treating the workflow as fully validated.
