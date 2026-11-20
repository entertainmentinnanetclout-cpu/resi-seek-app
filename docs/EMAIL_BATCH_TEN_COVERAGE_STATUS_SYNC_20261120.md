# ResKonnect Email Dock — 10-send batching, exact delivery coverage, safe status sync

**Release target:** the canonical Communications → Email & Gmail Dock. Official emails and residence emails keep their verified sender identities.

## What Berlin's 67-versus-56 actually means

The verified production audit on 20 November 2026 found 67 Berlin 2027 reservations (all unique account holders), 60 cases with at least one confirmed sent email, 7 never attempted, 68 total Gmail-accepted messages, and 56 successful emails using the **triage_received** template. One email attempt was uncertain, but its case already had a different confirmed sent email. Do not retry this unknown attempt without checking Gmail Sent. The seven untouched records have user profiles with email addresses; they have not been contacted merely because they are in the reservation list.

## Exact arithmetic

Use the server-only PostgreSQL function `rk_email_delivery_coverage`, never a cached badge, number of selected checkboxes, one template's messages, or the first 100 emails. It counts cases, distinct contacted cases, lifetime message sends, extra/repeated sends, never-attempted cases, uncertain-only cases, failed-only cases, and the precise safe selection IDs. The edge endpoint rejects impossible mathematics:

- `total_cases = emailed_cases + unemailed_cases`
- `unemailed_cases = never_attempted + uncertain_only + failed_only`
- `sent_messages >= emailed_cases`

The ten-recipient client processes **one PDF and one Gmail message per separate Edge invocation**, sequentially, with unique idempotency keys. Delivery uncertainty stays uncertainty. A preview/confirmation is compulsory, and the operator must press Send. The 25-record batch selection is retained for the separate status management tool, not for a 25-email send.

## Email-driven case status updates

The service-only `rk_email_sync_after_send` runs only after a sent audit, provider message ID, and verified official ResKonnect issuer. It checks the original case snapshot and uses a row lock and an idempotent audit record. It may record only:

- Reservation `reserved → contacted` after a real service or triage email.
- Application `submitted → under_review` after an **under-review** notice when the internal review stage is already `under_review`.
- Application `submitted/under_review → documents_required` after a reviewed **documents needed** notice with missing/incomplete evidence.

No email can itself approve an application, confirm an accommodation placement, cancel a reservation, record a room hold, or infer delivery from an unconfirmed Gmail request. These remain under their existing authorization, evidence, final handover, and MFA gates. New sends record a separate status-sync audit; historical emails are not silently replayed or status-rewritten.

## Deployment and validation

Migration: `20261120183000_email_coverage_status_sync.sql`.
Front end: `src/components/communications/PremiumEmailDock.tsx`.
Edge: `supabase/functions/reskonnect-email-dock/`.
Regression test: `scripts/email-math-reconciliation.test.mjs`.

Operational check: choose **Reservations → 2027 → Berlin Private & Student Living** in Email Dock coverage; the live numbers should reconcile. Use **Select up to 10 never attempted**, inspect individual drafts, and click Send yourself. New status updates are recorded separately and do not constitute housing approval.
