# ResKonnect Communications Dock — private document preview and verification hotfix

## Confirmed cause

The student-level `public.documents` table has an `admin_notes` column, **not** `rejection_reason`. The existing `setDocumentDecision` implementation added `rejection_reason: null` to the payload on global-document **verification**, causing PostgREST to reject the update even when the document was unchanged. The error was previously masked as "Document status changed or permission was denied".

The change branches the payload by source: student-level documents use only `admin_notes` for rejected files; application-specific documents use only `rejection_reason`. Verification supplies no non-existent field. Failure messages now distinguish stale records, missing reviewer profiles and schema errors without revealing student data.

## Viewer repair

PDF previews previously used `iframe sandbox=""`, which blocks browser PDF viewer behaviour on Chromium and WebKit. The new component uses a standard PDF viewer iframe, with the existing 90-second private Supabase signed URL, a prominently visible new-tab fallback, and a dedicated inline preview beside the document list on desktop (stacked on mobile). Only trusted PDF, PNG, JPEG and WebP formats are allowed by the existing private Storage buckets; no student content is treated as HTML.

Selecting **Preview file** loads a new URL from the existing case-authorized `document_preview` Edge action. The UI navigates to the preview automatically. Closing the preview never changes document verification status.

## Security boundaries

- The review action still requires the existing server-verified admin/residence-portal login and case ownership/assignment check.
- Student/global document verification remains admin-only; authorized residence staff may review application-specific records subject to the existing rules.
- No storage bucket becomes public, no direct student record permissions are widened, no files are sent to email or WhatsApp, and the 20-minute review acknowledgment remains required before those communications.
- Existing indexed student-document records (150) all have matching private Storage objects and user-prefixed paths at time of audit. This is metadata verification, not an assertion that every PDF/image has been rendered in an authenticated browser.
- Maintain `verify_jwt=true` for `reskonnect-email-dock`; deploy only after all release checks succeed, then compare all Edge source files to GitHub.

## Validation

The existing premium document-review regression tests now assert the inline viewer, browser fallback, absence of the empty iframe sandbox, and source-specific database update payload. Full Vercel and backend checks plus authorized browser canaries are still required for end-to-end operational acceptance.
