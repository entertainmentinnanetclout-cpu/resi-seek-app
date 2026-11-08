# ResKonnect Premium Email Dock

## What changed

Replaces the former two-column email composer in the admin Communications & Service tab and the landlord Email & Gmail page with a unified three-pane case-aware dock.

### Inbox, smart cases and templates

- Inbox groups applications, reservations, accommodation leads, and (admin only) support enquiries.
- Each record is resolved server-side: existing application/reservation status, assigned residence, applicant name, global student documents, and application-specific uploads.
- The deterministic Smart template selects a receipt and missing-document request when required documents are absent. Documents uploaded but pending verification result in a documents-received-under-review letter. Formal approval, rejection, conditional approval and confirmed reservation templates require the corresponding recorded status.
- The document checklist uses ID, proof of registration/latest results, and funding evidence for funded applications. It never assumes that an uploaded document is proof of an approved decision.
- Staff can select a different **factual** template, add a case-specific note and preview the rendered text/HTML and branded PDF before sending.
- Template Studio stores per-sender template overrides using safe placeholders, not arbitrary HTML. ResKonnect owns the HTML layout, footer and PDF branding.

### Email and official PDF letters

- Every premium-dock outgoing email includes a branded HTML body, ResKonnect navy/blue/gold styling, official contact/footer, and a generated A4 PDF letter as a Gmail MIME attachment.
- PDF includes the case reference, recorded status, issued date, letter body, brand logo/wordmark and page footer. Documents are generated on demand, not publicly stored. The logo has a vector-wordmark fallback if the static icon is temporarily unavailable.
- Google scope remains `gmail.send` only, with user-specific OAuth refresh tokens stored in Supabase Vault. The existing login provider remains unchanged.
- A live PDF preview can be downloaded from an authorized dashboard; the send endpoint regenerates it from the validated case.
- Gmail accepting a message does not establish delivery, an open/read receipt or applicant acceptance.

### Bulk sending and bulk statuses

- A user can select up to **25** records to review. The frontend sends at most **5** explicitly approved, case-specific messages per Edge Function call, in sequential batches.
- Each message resolves its own documents, template, recipient and PDF. Send failures are reported individually. No arbitrary addresses, imported email lists or marketing mass blasts are accepted.
- Existing rolling safety limit is **80 email attempts per account per 24 hours** with a per-case 60-second duplicate guard and idempotent request IDs. Network-uncertain deliveries must be checked in Gmail Sent before retrying.
- Bulk application/reservation statuses are validated against the current recorded status, owner permissions and mandatory-document checks. Up to 25 are processed after an explicit preview and confirmation.
- Formal approvals, rejections, confirmations and cancellations require a written reason; premature approval without required documents is blocked.
- Status updates create per-record audit history and in-app student notifications. **They do not automatically send Gmail emails**; a separate preview and send is required.
- Email send requests recheck the recorded status and document stage after preview to reject stale acceptance letters.

### Access and security

- All Edge Functions use authenticated ResKonnect JWTs; authorized administrators or active residence-portal landlords only.
- Every case is checked against the landlord's assigned residence, including bulk operations.
- Applicant email addresses are never disclosed to landlord dashboard APIs; recipient addresses are resolved server-side.
- Support enquiry replies are restricted to administrators and records with `consent_to_be_contacted=true`.
- Email audit logs, customization templates and bulk-status audits are private, RLS-enabled and service-role-only.

## Files and live Supabase

- `src/components/communications/PremiumEmailDock.tsx`: frontend dock.
- `src/components/communications/CommunicationEmailWorkspace.tsx`: stable re-export retaining dashboard routes.
- `supabase/functions/reskonnect-email-dock`: new standalone premium endpoint plus case engine, PDF generator and Gmail MIME attachment helper.
- `supabase/migrations/20261108142000_reskonnect_premium_email_dock.sql`: private templates, bulk status audit, PDF and snapshot metadata.
- Live Supabase project `mefjzkhobkltlbmhusdh` has received the migration and the new JWT-protected Edge Function. The legacy `reskonnect-email` endpoint is unchanged.

## Operational QA

1. As a consenting test landlord, connect Gmail and confirm the dashboard shows the correct sender.
2. Create or select a controlled test application with no documents: Smart preview must confirm receipt and list only missing required documents.
3. Upload relevant documents: Smart preview must switch to received-under-review; do not infer acceptance.
4. Change the test application to approved/rejected via authorized status action and verify Smart letter matches the *recorded* decision. Try sending an approval template against an unapproved record and verify it is blocked.
5. Download the PDF preview; inspect visually across two pages if content is long. Verify ResKonnect logo/wordmark, reference, status, header and footer.
6. Send a controlled test email; inspect Gmail Sent for multipart HTML + PDF, reply address and readable Unicode. Never test with a real applicant without explicit permission.
7. Select test cases with mixed document readiness; preview and send a batch. Verify per-recipient PDF, audit log and error reporting.
8. Bulk-preview status change with missing docs; verify approval is ineligible. Update a valid group and confirm audited database statuses and in-app notifications.
9. Check cross-residence denial, unconsented support enquiries, disconnected Gmail, expired Google OAuth, stale preview and 80-attempt rate cap.
10. Run GitHub TypeScript, build, mobile/PWA and dependency-security gates before merge; verify OAuth sensitive scope and Google test-user/public verification status.

## Deliberate exclusions

Premium messaging is manually approved. No autonomous mass campaign, Gmail inbox-reading permission, arbitrary address sending, automatic acceptance of uploaded documents or unverified delivery guarantees is introduced.