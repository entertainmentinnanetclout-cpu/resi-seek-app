# Referral Flow Fixes + TVET Recruitment Portal

## 1. Fix the referral → apply → auth flow

**Problem:** Unauthed users clicking Apply lose the referral, banner never renders, session doesn't survive login, application isn't attributed on the other side.

**Fixes:**

- `ResidenceDetail` Apply handler: if no user, call `savePendingApplication({ residence_id, residence_name, current_route, referral_code, referral_session_id })` then `navigate('/auth?returnTo=<current>&intent=apply')`.
- `Auth.tsx` post-login effect: read `readPendingApplication()`, if present POST the application to Cloud, then `captureApplicationReferral(app.id, code, sessionId, 'student_recruitment')`, clear the intent, redirect to `/applications/:id` (or the residence with a success toast).
- `ReferralBanner` visibility: currently only mounted on `FindMyRes`. Mount it on `ResidenceDetail`, `Auth`, and the top of the application form so the student always sees "Referred by X — code ABC1234".
- `readReferral()` never expires the 30-day session on sign-in — verify `attachReferralToUser(sessionId)` is called after `onAuthStateChange` fires SIGNED_IN, regardless of intent.
- Add a small "Applying with referral CODE" chip inside the apply CTA button so it's obvious pre-click.

## 2. Institution type on the student application

- Add a required `institution_type` field to the application form: TUT / TVET College / Private / Other (single dropdown, no conditional college field per your answer).
- New column `applications.institution_type text` with CHECK-via-trigger validation.
- Surface `institution_type` as a filter chip + column on `AdminApplications`, `RecruiterDashboard`, and the new TVET portal.
- Backfill existing rows to `'TUT'` (safe default given current audience).

## 3. TVET Recruitment Portal — dual access

**New staff role:** `tvet_lead` added to `app_role` enum and `get_user_staff_role` priority list.

**Two surfaces, one data model:**


| Surface                                     | Who                   | Sees                                                                                                                               |
| ------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `/recruiter-dashboard` (existing, extended) | approved recruiters   | Only THEIR referred students, filtered to `institution_type = 'TVET College'` by default with a toggle to show all their referrals |
| `/admin/tvet` (new)                         | `tvet_lead` + `admin` | ALL applications where `institution_type = 'TVET College'`, grouped by recruiter, with per-recruiter drill-down                    |


**Admin panel changes:**

- New sidebar item "TVET Hub" visible when `staffRole ∈ {admin, tvet_lead}`.
- `AdminRoute` unchanged (any staff role passes); route-level guard on `/admin/tvet` restricts to admin + tvet_lead.
- Super admin still sees everything via existing hubs; TVET Hub is additive.

## 4. SQL pack (extends `docs/REFERRAL_V2_SQL.sql`)

- `ALTER TYPE app_role ADD VALUE 'tvet_lead'`
- `ALTER TABLE applications ADD COLUMN institution_type text`
- Update `get_user_staff_role` priority to include `tvet_lead` between `growth_lead` and `support_agent`.
- New view `tvet_applications_v` joining applications + referrals + agents, filtered to TVET.
- RLS: recruiters see rows where `agent_user_id = auth.uid()`; tvet_lead + admin see all TVET rows.

## 5. Files touched

- `src/pages/ResidenceDetail.tsx` — apply gate + pending intent
- `src/pages/Auth.tsx` — resume-application handler
- `src/components/referrals/ReferralBanner.tsx` — reused, mounted in more places
- `src/pages/RecruiterDashboard.tsx` — TVET-first filter
- `src/pages/admin/AdminTvetHub.tsx` — NEW
- `src/pages/admin/AdminApplications.tsx` — institution_type column + filter
- Application form (residence apply modal) — institution dropdown
- `src/contexts/AuthContext.tsx` — add `tvet_lead` to `StaffRole` union
- `src/hooks/useAdminRedirect.ts` — hub map entry
- `src/App.tsx` — new route
- `docs/REFERRAL_V2_SQL.sql` — additions above

Make sure lovable preview is matching external Deployment.

## Out of scope (call out, don't build)

- Guest applications without account creation — rejected per your answer.
- Changing the 30-day session length or moving off localStorage.
- Redesigning existing dashboards beyond adding the institution column/filter.