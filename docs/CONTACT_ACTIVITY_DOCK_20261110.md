# Premium Communications Dock — Student Contact Tracker

Implemented 10 November 2026 on top of the authenticated `reskonnect-email-dock` Edge Function (production project `mefjzkhobkltlbmhusdh`).

## Operator experience
- Full-width **Live contact tracker** above the existing dock. Search and filter by student, channel, latest recorded status, next action or unlinked contact. Opens the actual application / reservation / lead or support case in the existing composer.
- One student group aggregates audited Gmail, manual WhatsApp handoffs, AdminOS WhatsApp provider events, AdminOS outbound emails, documented status changes and latest current case status.
- Timeline distinguishes `Gmail accepted` from delivery/read; WhatsApp **chat opened** from **operator marked sent**, and actual provider `sent` / `delivered` / `read` / `undelivered` reports. Do not infer a student reply or approval from an outbound action.
- Admin can view all operators' history; landlords see only cases at their assigned residences. Unlinked AdminOS contacts are visible to admin only, and never silently identified as student accounts.
- Live via Supabase Realtime change subscriptions for already-published application/WhatsApp tables, with a 15-second visible-tab fallback for private email/WhatsApp audit records. Last sync is visible. After sends, bulk status updates or manual handoffs, the tracker refreshes immediately.
- Historical activity is paginated by source (up to 120 records per source and page, 40-page cap); dashboard totals represent **loaded activity**, not a complete all-time count until older pages are loaded. Sensitive email, phone number, message body, private documents and unrelated cases are not returned.

## Verification and release boundary
- Code-level security and evidence semantics are covered by `scripts/contact-activity-ledger.test.mjs` in the `backend:contracts` gate.
- This release adds **no schema changes** and no new public Data API permissions. Edge action requires existing staff or active residence-portal login and rechecks each case against authorized residence IDs.
- The production Edge Function **must be redeployed with ALL its local dependency files**, including new `contact-activity.ts`, with `verify_jwt=true`. A frontend-only deployment will show a retryable tracker error.
- Real authenticated operator and landlord canaries remain necessary for permission, case matching and actual notification timing. Realtime publication need not be broadened; private audit writes are picked up by foreground polling.
- Payment and cron remediation remain separately tracked in issues #198 and #204; this release does not loosen webhook security.
