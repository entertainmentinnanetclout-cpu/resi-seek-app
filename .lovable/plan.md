# ResKonnect Referral V2, Recruitment Programme & Audience Bulk Admin

## 1. Audit summary (what already exists, will be reused)

Referral base (reuse, do not duplicate):

- Table `referral_codes` (user_id, code, is_active, signup_count, sale_count, total_earned)
- Table `referral_earnings` (referrer, referred, source_type, amount)
- Table `referral_claims`
- RPCs `get_or_create_referral_code`, `capture_referral`, `capture_referral_sale`, `validate_referral_code`
- Edge function `supabase/functions/referral-capture/index.ts`
- Frontend `src/pages/Referrals.tsx`, `src/pages/Affiliates.tsx`
- Platform settings key `referral_signup_bonus`, `referral_sale_percent`

Audience base (reuse, do not duplicate):

- `residences.accepts_university`, `accepts_tvet`, `accepts_private`, `accepts_nsfas`, `institution_tags`, `is_spotlight`, `spotlight_rank` (from `docs/DIVERSIFICATION_ADMIN_SQL.sql`)
- `applications.institution_type` (+ validation trigger)
- `AudienceSelector.tsx`, filter tabs in `AdminResidences.tsx`, filter in `AdminApplications.tsx`, `useResidenceFilters.ts`

Missing (must add):

- Public `/r/:code` link handler + banner/modal on Find My Res
- Referral session persistence table + pending-intent flow through login
- `application_referrals` link between applications and referral_codes
- Recruiter application table + admin approval workflow
- `referral_agent` role + recruiter dashboard
- Bulk audience RPC + selection UI on Admin Residences
- Footer link to `/referrals`

## 2. Reuse plan

- Referral code = existing `referral_codes` (rename UI label to "Recruiter code"; internal role name `referral_agent`, UI label "Recruiter")
- Signup + sale capture stays via existing RPCs; new `capture_application_referral` RPC only links application→referral_code
- Extend `docs/DIVERSIFICATION_ADMIN_SQL.sql` pattern with a new SQL pack, do not touch existing columns
- Extend `AdminResidences.tsx` with bulk selection + audience actions, do not create a second admin page
- Extend `AudienceSelector.tsx` (already vibrant) with an "All" option; do not create a rival component
- Reuse `Referrals.tsx` page as the Recruitment Programme landing (add Apply-to-Recruit form section)

## 3. SQL migration pack (new file `docs/REFERRAL_V2_SQL.sql`, idempotent, RLS + grants + verification)

Tables (all `IF NOT EXISTS`):

- `referral_agents` (user_id PK, status enum pending/approved/rejected/suspended, badge_level, approved_at, approved_by, area, motivation, phone, whatsapp, institution, campus, city, province, socials)
- `recruiter_applications` (id, user_id, full_name, email, phone, whatsapp_number, institution, campus, city, province, recruitment_area, experience, motivation, social_media_link, status, admin_notes, decided_at, decided_by)
- `referral_sessions` (id, code, referral_agent_user_id, anonymous_visitor_id, attached_user_id nullable, landing_url, user_agent, ip_hash, expires_at, created_at)
- `referral_events` (id, session_id, code, event_type click|signup|application|verified|paid, application_id, amount, created_at)
- `application_referrals` (application_id PK, referral_code, referral_agent_user_id, session_id, commission_amount default 200, status submitted/verified/approved/rejected/paid/cancelled, verified_at, approved_at, paid_at, created_at)

Enum extension:

- `ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'referral_agent'` (guarded)

Columns:

- `residences.accepts_university_students`, `accepts_tvet_college_students`, `accepts_private_tenants` as GENERATED-alias views OR simple boolean sync — chosen: keep the existing 3 booleans (`accepts_university/tvet/private`), and add `audience_tags text[]` if missing plus a `sync_audience_tags()` trigger to mirror booleans↔tags. UI labels map to existing columns.

Views:

- `admin_referral_applications_v` — join applications × application_referrals × referral_agents × profiles
- `recruiter_dashboard_v` — totals per recruiter (clicks, signups, applications, verified, approved, paid, pending/approved/paid commission)
- `recruiter_applicants_v` — per-recruiter applicant table with masked PII for recruiter role

RPCs (SECURITY DEFINER, `search_path = public`):

- `normalize_referral_code(text)`
- `get_referral_public(_code)` → agent display name, active flag
- `capture_referral_click(_code, _visitor_id, _landing_url)` → session id
- `attach_referral_to_user(_session_id)` (uses `auth.uid()`)
- `capture_application_referral(_application_id)` (called after insert; safe no-op if none)
- `submit_recruiter_application(payload jsonb)`
- `admin_approve_recruiter_application(_app_id)` — inserts `user_roles(referral_agent)`, upserts `referral_agents`, ensures `referral_codes` row via `get_or_create_referral_code` pattern, sets status
- `admin_reject_recruiter_application(_app_id, _reason)`
- `admin_mark_referral_status(_application_id, _status)` — updates `application_referrals`, mirrors into `referral_earnings` when approved/paid
- `admin_bulk_update_residence_audience(_residence_ids uuid[], _mode text, _audiences text[])` — modes add/remove/set, audiences in (university,tvet_college,private); admin-gated by `has_role(auth.uid(),'admin')`; updates booleans + audience_tags; returns affected row count

RLS + GRANTs:

- Enable RLS on every new table
- `referral_agents`, `recruiter_applications`: owner-select + admin-all; insert via RPC only
- `referral_sessions`, `referral_events`: insert via RPC only; select owner (agent) or admin
- `application_referrals`: select by application owner, referral agent (own), admin; write via RPCs only
- `GRANT SELECT` on views to `authenticated`; `GRANT ALL … TO service_role`
- Public reads only via `get_referral_public` and `capture_referral_click` (SECURITY DEFINER)

Verification block at the end (counts + a sample bulk-update dry run).

## 4. Frontend implementation plan

New files:

- `src/hooks/useReferralSession.ts` — hydrate from URL/localStorage/cookie/db
- `src/lib/referrals/referralStorage.ts` — keys per spec (`rk_ref_*`, `rk_pending_application_intent`, `rk_pending_recruiter_application`)
- `src/lib/referrals/referralApi.ts` — RPC wrappers
- `src/components/referrals/ReferralBanner.tsx`, `ReferralAppliedModal.tsx`, `RecruiterBadge.tsx`, `ReferralStatsCards.tsx`
- `src/pages/ReferralRedirect.tsx` for `/r/:code` (captures + redirect to `/find-my-res?ref=CODE`)
- `src/pages/RecruiterDashboard.tsx` (route `/recruiter-dashboard`)
- `src/pages/admin/AdminRecruitmentProgramme.tsx` mounted as tab inside existing Operations Hub (no new sidebar item)
- `src/components/admin/residences/BulkAudienceActions.tsx` + `AudienceBadges.tsx`

Extended files:

- `src/App.tsx` — add `/r/:code`, `/recruiter-dashboard` routes; keep `/referrals`
- `src/pages/Referrals.tsx` — becomes public Recruitment Programme page with "Apply to Become a Recruiter" section (saves `rk_pending_recruiter_application` if logged out)
- `src/pages/FindMyRes.tsx` — mount `ReferralBanner`+`ReferralAppliedModal`; audience selector already present, add "All" option
- `src/pages/ResidenceDetail.tsx` — on Apply, if logged out save `rk_pending_application_intent`; after successful application insert call `capture_application_referral`
- `src/pages/Auth.tsx` — post-login: call `attach_referral_to_user`, honor `rk_pending_application_intent` and `rk_pending_recruiter_application`
- `src/contexts/AuthContext.tsx` + `useAdminRedirect` — add `referral_agent` to role priority; recruiter-only → `/recruiter-dashboard`, student+recruiter → student dashboard with new tab
- `src/pages/Dashboard.tsx` — conditional "Recruitments" tab when user has `referral_agent`
- `src/pages/admin/AdminResidences.tsx` — row checkboxes, select-all, bulk toolbar wired to `admin_bulk_update_residence_audience`; add audience badges to rows
- `src/pages/admin/AdminApplications.tsx` — show referral column + filter, referral panel in detail
- `src/pages/admin/AdminOperationsHub.tsx` — add "Recruitment Programme" tab loading `AdminRecruitmentProgramme`
- `PublicLayout.tsx` footer — add "Become a Recruiter" → `/referrals`

## 5. Routing & role logic

Post-login order (in `AuthContext`/`useAdminRedirect`):

1. staff role (existing) → their hub
2. residence portal → `/portal`
3. `rk_pending_application_intent` → return to saved residence apply flow (any role)
4. `rk_pending_recruiter_application` → `/referrals#apply`
5. `referral_agent` only → `/recruiter-dashboard`
6. `student` + `referral_agent` → `/dashboard` (Recruitments tab visible)
7. `student` only → `/dashboard`

Referral attach hooks fire before routing decision so the intent survives.

## 6. Testing report (deliverables to run and paste into `docs/REFERRAL_V2_TEST_REPORT.md`)

Run all 10 test scenarios from the spec (click, anonymous apply, existing user, recruiter apply, admin approve, dual-role dashboard, recruiter-only dashboard, recruiter applicant visibility, admin mark verified/approved/paid, audience bulk action) + regression list. Screenshots or Playwright transcripts under `/tmp/browser/referral-v2/`.

## 7. Production verification checklist (in `docs/REFERRAL_V2_DEPLOY.md`)

1. Run `docs/REFERRAL_V2_SQL.sql` on External Supabase
2. Regenerate types
3. Confirm `/r/TESTCODE` on live domain sets banner + session
4. Confirm anonymous apply → login → resumes flow → application referral row created
5. Admin approves recruiter → role assigned → dashboard unlocks
6. Bulk audience update reflected in Find My Res filters
7. RLS: signed-out visitor can only reach `get_referral_public` + `capture_referral_click`

## Technical notes

- Backend calls go through existing pinned External Supabase client; no edits to `client.ts` or `types.ts` beyond regen
- All new tokens/styles reuse the vibrant palette already added in `index.css`; zero hardcoded colors
- SQL pack idempotent (`IF NOT EXISTS`, `ON CONFLICT`, guarded enum add via `DO $$`)
- No marketplace changes
- No changes to `auth`, `storage`, `realtime`, `supabase_functions`, `vault` schemas
- Bulk audience RPC gated by `has_role(auth.uid(),'admin')`; frontend still shows optimistic UI + confirm modal        

## Out of scope

- Automatic payouts (admin marks paid manually; commission rows created but not settled)
- Downloadable PDF recruiter badge (on-screen + QR only)
- Consolidating `Affiliates.tsx` (kept as-is; `Referrals.tsx` is the canonical recruitment page)
- Marketplace / Commerce changes

## Deliverables

1. `docs/REFERRAL_V2_SQL.sql` (idempotent pack, all tables/RPCs/views/RLS/grants)
2. `docs/REFERRAL_V2_AUDIT.md` (what was reused vs added)
3. `docs/REFERRAL_V2_TEST_REPORT.md` + `docs/REFERRAL_V2_DEPLOY.md`
4. Frontend hooks, components, pages, and route wiring listed above
5. Admin bulk audience toolbar in `AdminResidences.tsx`
6. Footer link in `PublicLayout.tsx`