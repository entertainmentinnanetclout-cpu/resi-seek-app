# ResKonnect Student 360 · One Connected Brain
**Date:** 14 November 2026. **Implementation status:** First verified Student 360 integration and UI shipped to branch; later automation phases remain explicit work, not completed functionality.

## Core operating principle
A student is a lifelong person, not an application row. The immutable canonical account key for an already signed-in person is `profiles.id` (Supabase Auth user ID). Every service retains its own source table, legal business status, controls and evidence. Student 360 joins them as a private live read model. **Never make another independent student database or silently merge people on names, phone, or partial student numbers.**

A person may simultaneously be an applicant for funding, accommodation resident, second-year student, WIL candidate, employer-connected graduate and alumni mentor. Lifetime progress is a **set of independently verified milestones**, not one mutually exclusive status. Year-specific academic episodes belong under that person.

## The journey (each milestone independently verified)
`school_exit` → `admissions` → `funding` → `housing` → `studying` → `wil` → `graduation` → `employment` → `alumni`. Some milestones repeat each year or overlap. Every milestone can be not started, preparing, in progress, blocked or verified complete. A grade or WIL application may be only a **signal**—never proof of admission, verified NSFAS award, placement or employment.

## Delivered first release
- `/admin` resolves to **One Brain** for God Mode. Other authorized department staff retain Executive Office without requiring the new God Mode API.
- `/admin/brain` has **six large outcome-oriented command surfaces** instead of separate departments: People & Journeys, Needs My Decision, Applications & Housing, Communication, Evidence & Approvals, Education-to-Employment. Advanced departmental tools are collapsed in navigation—not deleted.
- Search a person with the MFA-only `rk_student_360_search` and open `/admin/students/:userId`.
- `rk_student_360_snapshot` joins the actual profile, accommodation applications and reservations, admission assistance, document verification statuses, WIL, all linked Golden Service cases, conversion automation counts, provider-recorded email and separately operator-attested WhatsApp actions and factual timeline.
- `rk_student_journey_milestones` stores manually reviewed, evidence-referenced milestones; `rk_student_journey_audit` is append-only. MFA role enforcement, 12-character explanation, required evidence reference for verified completion, and optimistic concurrency. **These milestones do not change official institution, funding, housing, room allocation, WIL or employment decisions.**
- Existing Users, Applications, WIL and Case Command Center now open this same Student 360 profile. Applications and Student 360 link to exact application records, not just an unrelated directory.
- Application page runs bounded **1–25 case** selection → protected `rk_case_bulk_preview` → explicit confirmation → existing audited `rk_case_bulk_apply`. Handles intake/review, request evidence, follow-up and private case notes; final approval remains a separately verified decision. Never sends an external WhatsApp/email through this batch.
- Admin-only `rk_case_queue` includes `student_user_id` for actual person navigation; residence-scoped response returns null.

## Founder-only operating loop
1. **Open the brain:** Check fresh intake, overdue actions and unresolved replies (distinguishing "no verified response" from actual neglect).
2. **Search the person:** Open a canonical Student 360 page; identify academic stage, applications, documents, recent contact and WIL.
3. **Take one safe bulk action:** Group bounded similar administrative steps, preflight status and eligibility, explicitly confirm and audit.
4. **Human approval exceptions:** Verify sensitive documents, genuine eligibility, room holds and external institution/work placement outcomes. Send consented, reviewed messages with real provider evidence; a WhatsApp draft is not sent.
5. **Return to the journey:** Record factual milestone and next action; aftercare follows actual service fulfillment and customer feedback.
6. **Close with exceptions:** Run watchdog and reconcile failures, delivery receipts, unmatched contacts and cases without a next action.

## Automation target, not a current claim
**Aim:** automate at least 95% of safe and repeatable *coordination events* (capture, classification, routing, duplicate detection, reminders, form prefill, document requests, progress updates, deadline checks, follow-up suggestions, year-rollover prompts and aftercare invitations). Do not represent this as 95% of legal/academic/housing decisions or 95% successful placements.

Measurement:
`automatic_routine_actions / all_eligible_routine_actions * 100`, excluding document authenticity checks, official admission/funding decisions, room confirmation, high-impact application decisions, WIL/employment placement attestations, consent exceptions, fraud, appeals and disputes.

Each automated event needs `source`, `user_id` or a safely linked provisional contact, `actor_type`, `idempotency_key`, `rule_version`, `confidence`, `consent_basis`, `delivered_receipt` when actually sent, `next_action_due_at` and a failure/retry record. No claim of send without provider evidence.

## Critical next phases, prioritized

### Phase A — Identity, episode and relationship graph
Handle the 11 open Golden cases without an account owner through **provisional person profiles**, not blind name matching. Use `adminos_contacts.profile_user_id` as existing linking evidence and require verified email/phone or authenticated account ownership for merges. Model guardian/dependent consent and age appropriately; never expose minors to arbitrary residence/partner users. Build student-year episodes (2026, 2027, semesters), academic programmes and education milestones beneath the permanent person. Student self-service and parent permissions must be scoped separately.

### Phase B — One inbox, one event ledger
Reconcile Gmail and WhatsApp message threads to the *person plus particular case*. Distinguish generated draft, queued provider send, accepted, delivered, failed, read, operator-attested and actual human response. Route replies to the student's current next action and queue a failed-delivery exception. Use the existing Mail Dock, not a second messaging product.

### Phase C — Complete next-best-action engine
Materialize one deduplicated exception per `(student_id, journey_episode_id, decision_type, source_id)` instead of thousands of overlapping staff tasks. A deterministic policy engine produces safe `next_best_action` with evidence and priority; AI may summarize and draft, but an AI recommendation never alters eligibility or claims a placement. Use source-version concurrency, queues, retry/dead-letter logic and audit.

### Phase D — Orchestrate 95% routine work
Form autosave and reuse, signed-in post-auth return to step, consent-scoped acknowledgements, document-checklist generation, student self-serve requests, residence delegation, genuine completion receipts, automatic deadline updates, silent background enrichment, official bursary/admission status reconciliation where authorized, year-round renewal prompts, WIL employer routing with consent, move-in check-ins, satisfaction and graduate/alumni offers.

### Phase E — Founder metrics and exception management
Only six major action buttons. Measure time from intake to first genuine response, verified-document turnaround, real handover success, room placement rate, WIL placement **verified** rate, contact delivery failure, retention through academic years, student support satisfaction, and automated coordination coverage. Drill to the same Student 360 page from every metric. No vanity scoring or guessed achievement.

## Privacy and reliability
- POPIA data minimization, retention and subject deletion; no identity numbers, document storage paths or financial secrets copied into Student 360 snapshots.
- RLS enabled on the new milestone/audit tables; zero direct browser grants; only God Mode + MFA RPCs may read or change them.
- Residence portals get assigned and scoped eligibility information, not a lifetime profile. Student sees own details, guardian only with lawful authorization and role constraints.
- New account and provisional visitor match must avoid false merges; a real verified link is safer than convenience.
- All changes auditable; no historic mass contacting and no automatic final placement or rejection.
- Acceptance after deploy: test God Mode with AAL2, no-MFA admin, student, landlord portal, a fake/unmatched lead, verified/no-doc user, invalid/outdated milestone update, 26-case batch, stale-source conflict, and actual provider receipts.
- This release has not established 95% automation, a full communication reconciliation, backend identity graph, customer mobile UAT, or a verified production deployment. They remain planned phases.

## Release reconciliation
Supabase connected migrations were applied live via the linked migration tool and versioned SQL files exist in GitHub. Before a later Supabase CLI migration run, compare migration history/version identifiers and reconcile rather than blindly replaying a differently named migration.
