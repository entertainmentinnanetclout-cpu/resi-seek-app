# ResKonnect God Mode — Case Command & Delegated Eligibility
November 2026 · production workflow

## Operating principle

**A receipt is not an approval.** The academic reservation status stays `reserved` while the private case-workflow stage progresses through receipt, under review, evidence required, delegated review, handover readiness and ResKonnect-approved handover. This separation avoids sending students a false promise of a confirmed room.

## Recommended daily workflow

1. Sign in to **ResKonnect Admin → God Mode → Case Command Center**, complete MFA, choose **Reservations**, **Applications** or **WIL** and filter the case queue.
2. Select up to **75** cases from the displayed page; choose **Mark received** or **Start review** and run **Preview**. Blocked/changed cases show reasons before saving. Click **Apply** explicitly. Status audit and in-app student notifications are written per successful case; nothing external is sent automatically. Completed cases remain selected for the next communication step.
3. For a receipt or under-review update, open **Batch communications**, preview up to **five** fixed, personalised Gmail emails with branded PDF attachments, then explicitly send through the existing, connected ResKonnect Gmail. No previous document-review acknowledgement is required for these two factual templates; any personalised approval, detailed evidence request, or formal decision continues through the document-reviewed Email Dock.
4. To send WhatsApp updates, preview **up to five** separate drafts in one preparation batch. Create each operator-audited link, open WhatsApp Business, manually press **Send**, then report the manual send in ResKonnect. A prepared link **is not** a delivered message. WhatsApp delivery cannot be claimed until provider evidence exists.
5. Select candidates needing residence expertise, choose **Assign to landlord**, preview and apply. The system generates a scoped task on **Property OS → Eligibility Tasks** and notifies active residence portal operators without placing personal applicant data in notification text. A residence without an active portal cannot be assigned.
6. The authorised residence checks the **student eligibility packet**: name, student number, campus/course, academic context, funding route, and document verification summary. They can open already authorised private application files, add an internal discussion message, and submit **Eligible / Further evidence needed / Ineligible** with a reason. This is only a **recommendation**; they cannot press a final handover button.
7. ResKonnect sees completed reviews and handover-signoff tasks, checks profile, real document evidence, and operational inventory. **Mark eligible** creates a preliminary assessment. **Approve handover** is available only after a positive assessment, no outstanding delegated review task, and verified identity/registration/funding evidence. The operator explicitly previews and confirms.
8. **Final application approval** requires the approved handover and verified evidence. **Final reservation confirmation** additionally requires a real verified, published and reservable physical room with an active student-matched hold, enforced by the original ResMap inventory gate. Both are blocked by database triggers even if another client tries to skip the new UI. Negative application decisions require an ineligible assessment and documented reason; reservation cancellations require a reason and release existing room-hold controls.

## Permission boundaries

| Capability | ResKonnect God Mode (admin + MFA) | Assigned residence portal | Student |
| --- | --- | --- | --- |
| Browse all case queues and statuses | Yes | No | Own portal only |
| View assigned eligibility packet | Yes | Yes, scoped and delegated | Own account |
| View raw ID number/file-path through this packet | No | No | No |
| Review application files through existing authorised document tools | Yes | Existing residence-scoped permissions | Own files |
| Mark received/under review in bulk | Yes | No | No |
| Send fixed pre-review email/PDF/WhatsApp notices | MFA-verified admin only | No | No |
| Submit residence eligibility recommendation | No (uses admin mark-eligible workflow) | Yes, on assigned task | No |
| Approve final handover and approve accommodation application | Yes, after verified checks | No | No |
| Confirm physical reservation without prior approved handover | Never | Never | Never |
| Start internal private/shared case discussion | Yes | Shared threads for assigned cases | No |
| Use WIL final placement/assignment workflows | Existing specialised WIL Office | No | Own student journey |

## Safeguards

- **Backend ownership:** Four new private RLS tables are service-role-only and never exposed to signed-in clients by direct table access. Typed RPCs perform the role/scope checks. Admin bulk operations require **AAL2** (MFA).
- **Document integrity:** Uploaded status is never automatically verified. Signed-in students cannot create verified documents or forge `verified_at` / `verified_by` on upload. Authorised decisions must record reviewer and timestamp; the final gate independently rechecks them.
- **Dry-run before writing:** Unique bounded IDs, page-scoped selection, optimistic status/review-stage snapshot, operation UUID, row locking, per-case rollback on errors, audit log and explicit typed confirmation for risky operations.
- **Multi-channel transparency:** In-app notifications occur on successful triage updates; external Gmail is sent only after batch preview + user confirmation. WhatsApp uses operator-performed sends with distinguishable `opened` and `operator_marked_sent` states.
- **Consent and POPIA:** Existing residence-only contact restrictions continue. The new eligibility packet does not return identity numbers, verification document storage paths or student email/phone until handover is approved. Formal email communication remains subject to existing contact-consent checks.
- **Academic-cycle safety:** The existing reservation/app record retains year, annual/semester/trimester, student stage and study level. New triage does not fabricate bed allocation or alter old academic cohorts.
- **WIL distinction:** The command center covers WIL receipt, review stage, notes and follow-up tasks; WIL placement decisions, employment-sensitive records and assignment checks remain in the dedicated `/admin/wil` workflow.
- **Manual acceptance:** A real MFA-verified admin and residence portal operator should test receipt→review→delegation→recommendation→ResKonnect handover on a safe test student, verify sample document handling and confirm the Gmail OAuth connection before broad production outreach. Do not perform actual student bulk sends as a test.

## Technical ownership

- Public admin page `/admin/cases`: `src/pages/admin/AdminCaseCommandCenter.tsx`.
- Residence page `/residence/eligibility`: `src/pages/residence/ResidenceEligibilityDesk.tsx`.
- SQL: `20261113191500_rk_case_operations_foundation.sql`, `20261113192500_rk_case_command_and_delegation_rpcs.sql`, `20261113193500_rk_safe_triage_correspondence.sql`, `20261113195000_rk_final_case_actions_and_landlord_alerts.sql`, `20261113195700_rk_document_verification_intake_guard.sql`.
- Edge: `supabase/functions/reskonnect-email-dock`; fixed `triage_received` and `triage_under_review` templates require validated admin JWT with **aal2**. All other final/decision messages retain the prior document-review requirement.
- Automated tests: `scripts/godmode-case-operations.test.mjs`, the complete backend contract audit and existing web, security, SEO and Android release gates.

**Important:** There is no unconditional "approve everyone" operation. Admin may batch-preflight high-impact actions, but only individually eligible records proceed. No unverified placement or fabricated communication delivery state is allowed.
