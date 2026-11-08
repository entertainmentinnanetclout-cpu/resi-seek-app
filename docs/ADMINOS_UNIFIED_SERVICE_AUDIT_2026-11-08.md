# ResKonnect AdminOS — unified service and case lifecycle audit

Audit date: 2026-11-08. Repository: `entertainmentinnanetclout-cpu/resi-seek-app`. Production Supabase: `mefjzkhobkltlbmhusdh`.

## Executive summary

AdminOS already has application administration, residence portals, manual WhatsApp Business handoff, Gmail send-only messaging, notifications and PDF confirmations. The main operational problem is not lack of screens: it is multiple records and functions making independent assumptions about application eligibility, document readiness and when users need an update.

**Unifying principle:** applications and reservations remain the system of record; documents and outgoing correspondence supply evidence; a shared case-journey classifier derives the staff action. A recorded legal/placement decision is never inferred solely from a document upload or an email. Every external message requires a reviewed send action.

## Live verified baseline

- 632 accommodation applications have `academic_year = 2026`; there are **zero 2027 applications**.
- 367 accommodation reservations have `academic_year = 2027`, and two reservations belong to 2026. Reservations must not be counted as applications.
- 210 residence listings currently advertise 2027 reservations as open.
- Two residence-portal account assignments are present.
- At audit time, the browser `push_subscriptions` table had zero subscriptions, so a working client subscription has not been independently demonstrated.
- The new `residence_application_intake` table has zero open rules: application insertions are default-closed at the database layer and the trigger is enabled.

## System map: sources and operational links

| Source | System of record | Related operational state | Desired action |
|---|---|---|---|
| Student application | `applications` | `application_documents`, `documents`, `application_activity_log` | Verify files, decide, follow up |
| Accommodation reservation | `accommodation_reservations` | Funding, residence assignment and availability | Confirm, hold, or cancel according to recorded decision |
| Landlord assignment | `residence_portal_accounts`, `user_roles`, `auth.users` | Admin access and active residence scope | Edit, suspend, reassign or revoke without destroying student identities |
| Staff email | `reskonnect_outbound_emails`, `landlord_gmail_connections` | Recorded status/documents at send time | Preview, send, audit, compare with subsequent action |
| Manual WhatsApp | `reskonnect_whatsapp_handoffs` | Operator-reported open/sent only | One-click prefilled draft, manual confirmation |
| User notifications | `notifications`, `push_subscriptions` | Browser permission and worker registration | In-app record always; push only after explicit opt-in |
| Intake | `residence_application_intake` | Residence, academic year, date and private funding | Closed by default; admin-only exceptions |

## Findings and corrective work

### P0 — admissions could bypass a hidden Apply button

Multiple submission entry points exist in `ResidenceDetail`, `FindMyRes` and deferred `Auth` auto-submit. **Implemented:** default-closed BEFORE INSERT trigger on `applications`, no changes to historical records, admin-managed per-residence/year private-only date window. Frontend shows closed notice and redirects to existing 2027 reservations where eligible. Future application years are not auto-opened.

### P0 — Inbox hard cap of 100 and no applicant-next-step detection

`reskonnect-email-dock/context.ts` used `.limit(100)`. **Implemented:** count-aware, authorized, year-scoped pagination with offset controls in the dock; explicit Load next 100 / Load all; historical 2026 cases under their year and 2027 applications empty. The queue joins per-record Gmail audit entries and document-upload timestamps to classify missing docs, uploads after outreach, pending review, changed decisions, not contacted and follow-up due.

**Limit:** no Gmail inbox-reading scope is granted. The site cannot claim a reply, read receipt or confirmed delivery from `gmail.send` alone. `student_acted` means there is recorded document upload evidence after email, not a verified response to Gmail.

### P0 — inconsistent approval and external-message context

**Implemented:** the Premium Email Dock now requires a SHA-256 preview fingerprint of case identity, status, contact permission, document readiness, and the exact subject/body when sending or bulk sending. Review is revalidated server-side. Previous quick blind bulk approval buttons in Admin Applications were replaced with a link to verified bulk workflows. Admin single status updates now call the same preview/apply endpoint, preserving in-app notifications and audit events.

**Limit:** do not claim an infallible AI semantic understanding of arbitrary custom notes. Formal decision templates require matching recorded statuses. Future template publishing should include approval policy reviews.

### P0 — residence portal accounts lacked a complete and safe editor

**Implemented:** protected `admin-residence-portal-accounts` Edge Function with role verification, residence reassignment checks, email update with rollback attempt, activate/deactivate, and access revocation. Edits are audited in `reskonnect_portal_account_audit`. Shared student/admin logins cannot have their email silently changed by a residence admin. Portal removal preserves unrelated user identity and data.

### P0 — browser push opt-in fails after async operations

`subscribePush()` awaited authentication and VAPID retrieval before `Notification.requestPermission()`, potentially losing user activation. **Implemented:** request permission directly from the Enable click, then register the worker, key and authenticated subscription; show actionable errors and allow retry, including landing-page eligibility for authenticated users.

**Limit:** browsers require secure origins and permission gestures; iOS web push requires an installed home-screen web app on supported versions; Android native notification permission follows its separate native settings. A consenting real-device validation is required. This change does not prove live push delivery.

## User service journey and recommended SLA defaults

1. New reservation/application: recorded immediately; initial review target within **24 business hours** (operational target, not measured historical performance).
2. Required files missing: send a receipt and exact checklist with a secure upload instruction; check after 48 hours if still outstanding.
3. Files uploaded after contact: mark *student acted*, update the document-readiness queue and route to staff verification. Never auto-approve.
4. Documents complete/verified: route into the review/decision queue. Staff records acceptance, rejection or conditional approval explicitly.
5. Decision changed: mark previous email as stale and recommend new case-aware correspondence; staff reviews the final wording before send.
6. Reservation confirmed: share recorded confirmation, residence image/PDF when available, and next steps; no implied lease without separate confirmation.

## Architecture convergence — next independent workstreams

- One transactional application/reservation status service (all remaining landlord and legacy AdminOS update screens should call it). Use conditional updates, idempotent operation IDs, and a durable audit/outbox record.
- One read model of case workflow state for AdminOS, landlord portal and communications. The present classifier is a first step; production scale may warrant a materialized projection refreshed by status/document/email events.
- Single event outbox and delivery worker for in-app notifications and optional push, with failure retries and explicit opt-in. Event delivery should not duplicate client-side notifications.
- Replace uncapped browser-wide loading with server-filtered, keyset-paginated queues, group counts and virtualized rows as data volume grows beyond the current hundreds of cases.
- Cohort archival controls: 2026 read-only cohort views after the admissions season, a 2027 zero-state until admin opens intake, and an explicit, separately approved future cycle policy.
- Operational telemetry: time from submission to first review, median time to document verification, decisions awaiting messages, SMS/WhatsApp manual handoffs, and push opt-in failure reasons, with privacy-safe aggregated dashboards.

## Release and QA controls

1. Validate SQL trigger is active; all residence/year combinations are closed absent approved rules.
2. With a consenting controlled test user, test closed application submission and 2027 reservation redirect. Use admin window override only on a test residence/time window and close after testing.
3. Open old 2026 applications beyond row 100; verify total count, Load all pagination and 2027 empty applications.
4. Simulate a documented email for test records and an uploaded file timestamp after outreach. Verify journey state and suggestion. Test changed status rejection of stale previews.
5. Test portal email changes, residence reassignment collision, suspension and revocation with dedicated test accounts. Confirm shared student identities retain their unrelated roles.
6. On browsers and installed iOS/Android PWA devices, tap Enable and verify browser permission, push subscription storage, and actual test notification delivered. The repo cannot validate user gesture or device OS permissions through CI alone.
7. Run TypeScript, case-journey tests, PWA web readiness, Android readiness, security scan and Vercel deployment gates; do not treat rate-limited Vercel failures as a successful public deployment.

**No live student messages or destructive application/reservation record updates were executed during engineering changes.**