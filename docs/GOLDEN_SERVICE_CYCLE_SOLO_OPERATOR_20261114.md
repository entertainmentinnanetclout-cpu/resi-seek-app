# ResKonnect Golden Service Cycle — Solo Operator Runbook
**Target:** Every service request has a recorded intake, next action, operator deadline, and aftercare. The system helps one person deliver fast service; it cannot guarantee that a human has replied until a reply is actually confirmed.

## 1. Golden customer cycle
1. **Discover and decide:** Public homepage, Find My Res, Living, Opportunities, WIL, applications and partner onboarding all retain their real entry points; the homepage and Find My Res link directly to the existing customer Service Centre.
2. **Capture once:** Eleven existing intake records feed `rk_golden_service_cases` without re-keying customer details: accommodation applications, reservations, viewings, housing enquiries, onboarding, application support, private rental, student support, WIL, landlord applications and partner leads.
3. **Acknowledge:** A new account-linked request creates one in-app receipt. Historic records are backfilled silently. A submitted enquiry without a signed-in owner is queued for operator follow-up, **not falsely marked as acknowledged externally**. If notification delivery fails the intake must still succeed, and the internal failure is recorded.
4. **Triage:** God Mode `/admin/golden-cycle` ranks overdue, unanswered and urgent cases. Cases receive a next action; one-to-many follow-up and factual receipt communications use `/admin/cases` and `/admin/communications?tab=email`, subject to existing batch limits, verification and opt-out controls.
5. **Verify evidence:** Existing document-review tools must verify identity, academic and funding documents. A missing/unverified file never becomes "approved" by opening or acknowledging it. WIL remains under its separate placement workflow.
6. **Delegate appropriately:** Housing eligibility can be assigned to authenticated residence portals through `/admin/cases`. The service cycle watches the **real** delegated task and returns a follow-up to ResKonnect when a recommendation is submitted. For partner coordination, the service case may be placed in an internal "awaiting partner" stage; this does **not** disclose student profiles or authorise a partner portal.
7. **Decide and hand over:** Final approval, room confirmation, and handover use existing protected workflows, verified evidence, real room holds and ResKonnect sign-off. The Golden Service Cycle can record coordination but **never changes legal business status**.
8. **Deliver and confirm:** Move-in, accommodation suitability, WIL placement start, applicant readiness, successful property onboarding and partner fulfilment require the real service to be checked. An `approved` status triggers aftercare instead of silently closing every record.
9. **Ask for satisfaction:** Students can privately rate their service (1–5) in `/dashboard/services` after an outcome or closed stage. This is NOT a residence/property review.
10. **Recover and learn:** A one- or two-star result reopens a two-hour operator recovery task without changing eligibility, housing allocation or a public rating. Positive feedback is captured for service-quality metrics.

## 2. Service targets
All numbers are **internal operating goals, not guaranteed customer-facing promises**. Adjust in God Mode's Service Targets panel; edits are audited and apply only to new cases.

| Service line | Initial response | Follow-up |
| --- | ---: | ---: |
| Reservations, viewings, residence enquiries, student support | 2 hours | 12 hours |
| Housing applications, WIL, application assistance, private rentals, onboarding, landlord and partner leads | 4 hours | 24 hours |

The database checks every 15 minutes for overdue human-response or next-action deadlines. A daily, deduplicated internal notification alerts God Mode administrators. It never sends automatic WhatsApps, changes final status, or marks a draft as delivered.

## 3. One-person workday
- **Opening sprint:** Open Golden Service Cycle → Needs Attention. Triage first-response breaches by service type; use a five-message communication batch only after validating recipients and template. Process urgent reservations and room availability before ordinary marketing.
- **Verification sprint:** Open Case Command Center to check documents and queue residence eligibility work. Keep unverified applications in under-review/document-required stages, and let residence teams return scoped recommendations.
- **Handover sprint:** Check real residence task completion, finalise only verified handovers, follow up with WIL/partners through their normal portals, and review post-service checks and low satisfaction.
- **Closing sprint:** Review unanswered, overdue, delegated and aftercare cards. Add a concrete next action with a deadline for unresolved cases. Review missed customer messages through Gmail/WhatsApp and Service Recovery. Never click "Contact confirmed" until contact genuinely occurred.
- **Weekly quality sprint:** Evaluate feedback average, recovery closures, new service volume and service capacity. Adjust targets only where operationally sustainable.

## 4. Historical backlog
The first read-only count after deployment indicated 1,119 tracked records, of which 1,078 were open. Only four had proven human-contact timestamps in the available linked records. This is an **evidence gap**, not evidence that all other customers were ignored. Do not send old customers an indiscriminate approval or bulk-mail blast. Filter and handle them in batches, checking identity, latest status, consent, duplication, and whether the customer already received support through a channel the system does not know about.

## 5. Access and data boundaries
- All new service cases, feedback, events, SLA settings and digests have RLS and no direct `anon` or `authenticated` table grants.
- Admin actions and queue/history require existing God Mode role + MFA/AAL2.
- Student journeys and feedback are scoped to their own authenticated user ID.
- No private documents or identity fields are copied into the service tracking projection.
- Provider-confirmed sent Gmail and operator-verified WhatsApp receipts update response clocks. In-app automated receipts are stored separately. A service action cannot grant funding, place WIL, approve accommodation or override confirmed room-hold gates.
- No external bulk messages are dispatched by applying migrations, rendering dashboards or running the service watchdog.
- A failed notification creates an internal exception; the original student or partner intake should remain valid.

## 6. Operator acceptance
Sign in with God Mode MFA and open `/admin/golden-cycle`. Verify overdue and unanswered queues, source-specific links, case history, private note, follow-up scheduling, documented human contact, target edits and their audit. Separately use an authorised student account to confirm `/dashboard/services` shows only that student's cases. Submit service feedback only on a completed/outcome case. Confirm that low-rated cases reappear under the operator's recovery queue. Test a genuine delegate task in a residence portal and the corresponding ResKonnect sign-off path.

**Limits:** A queued record or an automated receipt does not guarantee a human response, automatic approval or a successful placement. Full authenticated multi-role UAT is required after release; CI and schema checks are not a substitute for an operator acceptance run.

## 7. Safe bulk triage (next iteration)
From **/admin/golden-cycle**, filter to an actual service category or deadline, then select up to 20 **open** rows from the currently loaded page. An operator can:
- **Begin review** of multiple cases without signalling that any document has been verified.
- **Schedule follow-up** deadlines without claiming anyone received an external message.
- **Add a factual private note** to each chosen record.

The server function `rk_golden_bulk_triage` requires the same God Mode MFA authorization as single-case actions, rejects changed/closed or duplicated records, records a separate existing audit event for every case and executes as one all-or-nothing transaction. It has no ability to send a WhatsApp or email, attest human delivery, approve funding, approve reservations, confirm a room, close a case or approve WIL placement.

**Recommended first batch:** Start with a specific recent, uncontacted category; reconcile actual customer contact before using Mail Dock. Do not indiscriminately select historical records for external messaging. Use Case Command Center for documents and delegated residence eligibility, Communications for individual audited sends, and Golden Service Cycle for ongoing task prioritisation. The blue-grey queue is coordination only, not a replacement for those workflows.

**Acceptance:** Test an admin with AAL2, an admin without MFA, a student, and an anonymous session; reject unauthorised requests. Test 21 cases, duplicate cases, one stale business status, one stale service step, one closed record, and a valid 2-case batch. Verify every accepted case gets one audit event, rejected batches produce no partial writes, and no external communication status changes. Full authenticated end-to-end acceptance is still required before production UI rollout.

## 8. Do not let fresh requests drown in the historical queue
The operator's default **New requests · last 72 hours** filter is ordered newest-first. Use this view multiple times each day for fresh accommodation, WIL, application support and partner intake. A separate Needs Attention view still holds all older or overdue records, and the first-response counts remain evidence-based. Switching to the new filter does not archive, resolve, silently contact or delete a historical customer. The quality pulse reports new open cases and those without confirmed human replies in the same 72-hour window. Use Mail Dock to send or reconcile actual messages and keep this service desk's acknowledgement distinct from real correspondence.

## 9. Repaired daily watchdog (14 November 2026)
Live cron inspection found `rk-golden-service-watch` failing every 15 minutes with `notifications_event_key_unique` because the same date-only event key was used for **two** admin recipients. The fix appends the admin user ID to the daily internal notification event key and retains the existing `rk_golden_digest_receipts(admin_user_id, digest_day)` uniqueness. The notification write is also conflict-tolerant.

Verified against the live Supabase project after migration: the first repair run marked 1,078 overdue cases, created two distinct admin notifications and two digest receipts, and an immediate second execution created no new notifications or receipts. No emails, WhatsApps, eligibility decisions or accommodation placement statuses were changed by these runs. Continue checking `cron.job_run_details` for successful scheduled ticks; a manual invocation does not by itself prove future scheduler reliability.

## 10. Daily mission control (five operator sprints)
God Mode `/admin/golden-cycle` now shows a **read-only cross-service workload pulse**, refreshed with the existing operator queue. It supplements—not replaces—these protected workspaces:

| Sprint | Customer-facing obligation | Golden cockpit signal | Authorised action | Exit check |
| --- | --- | --- | --- | --- |
| 01 · Intake and reply | Acknowledge new requests truthfully and respond when appropriate | New cases in last 72h without proven human reply | Check latest identity/status/consent; use Mail Dock and its audited delivery process | Provider-confirmed send or properly attested conversation; only a system receipt remains labelled automatic |
| 02 · Verify documents | Compulsory evidence review | Pending general and application file **records**, including older-than-48h backlog | Open Document Review; verify or reject actual evidence using the existing approved tools | Verification recorded by authorised reviewer with timestamp; an upload is not enough |
| 03 · Residence eligibility | Hand over only an eligible student profile to an authorised residence | Open delegated eligibility tasks and returned recommendations without final sign-off | Case Command Center; landlord sees only delegated/scoped profile | ResKonnect checks evidence, approves handover, checks real room hold and makes final decision |
| 04 · WIL and partners | Coordinate external services without exposing documents to arbitrary partners | Open WIL and partner Golden Service cases | Official WIL workflow, partner workspace, approved communication | Confirm actual outcome; do not confuse a sent request with a WIL placement |
| 05 · Aftercare and recovery | Check completion, move-in satisfaction, and unresolved low ratings | Post-service cases and low-rated recovery cases | Golden Service Cycle case history and aftercare actions | True resolution recorded, satisfaction privately collected and poor experience followed up |

### Evidence and scope notes
- Workload counts are **non-identifying** and available only through the existing God Mode + MFA queue RPC. The normal student portal remains user-scoped.
- General pending documents are **all** documents in `public.documents` marked `pending` without a verification timestamp, not necessarily documents belonging to live accommodation cases. Application-specific files are counted separately and labelled clearly.
- Delegated reviews are tasks in the existing scoped case command workflow. A completed recommendation with no ResKonnect sign-off remains work to do, **not a confirmed booking**.
- Empty queues do not prove customer success. Service feedback, genuine contact history, actual placement and completed documents must be checked separately.
- No migration in this sprint sends external messages, changes legal eligibility, verifies evidence, allocates rooms, or commits a partner to delivery.

### Suggested operator routine
**Start:** Open New requests; identify urgent reservations, viewings and fresh unanswered service requests. **Then:** Open the document backlog and review submitted evidence, using the authorisation and audit path. **Next:** Complete eligible residence delegation and returned recommendation sign-offs; check WIL and partner responses. **Close:** Clear overdue follow-ups and customer recovery cases. Each unresolved customer gets a specific next operator action and a realistic deadline. Recheck the queue and the communications receipt logs before ending your shift.

### Live verification on 14 November 2026
The verified database aggregation found 147 pending general document records, 145 older than 48 hours, 0 pending application-specific document records, 0 currently open delegated residence eligibility tasks, 1 open WIL service case, and 0 open partner service cases. These are an operational snapshot, not immutable fixture values and not a claim that pending documents are linked to an unserved request. A real MFA-protected browser run is still needed for final user acceptance.
