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
