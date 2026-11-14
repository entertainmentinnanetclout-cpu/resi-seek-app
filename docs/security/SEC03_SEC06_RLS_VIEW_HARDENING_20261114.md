# SEC-03–SEC-06 — Privileged View and Student/Residence Access Hardening
**ResKonnect, 14 November 2026.** This is a scoped production security change. It does not claim that all functions or all business logic are secure.

## Implementation and evidence

| Control | Baseline | Applied change | Live verification |
| --- | --- | --- | --- |
| **SEC-03** security-definer views | 4 Supabase advisor ERRORs | All four flagged views changed to `security_invoker=true` while preserving the same view names/columns and UI routes; private source tables are not exposed | **0** remaining security-definer-view advisor errors |
| **SEC-03** roommate privacy | A privileged public view read opted-in profile rows | An opt-in-only RLS projection is synced on all profile writes and deletes; lifestyle JSON whitelisted to five intended fields; direct profiles SELECT remains denied to `anon` | 4 selected profile cards before / 4 after; anonymous view returns 4, base profiles remain private |
| **SEC-03** recruiter privacy | A signed-in nonrecruiter could see the enabled residence commission view through owner privilege | Invoker view and active-recruiter/RLS policy on offers; approved recruiter can read approved offers, unrelated users cannot | Approved recruiter sees 1 enabled offer; unrelated authenticated student sees 0 |
| **SEC-03** residence application inbox | Owner-privileged view joined protected profile fields | RLS-filtered application-card projection mirrors exactly the previous 16 fields; profile academic-name updates auto-sync, never copies identity numbers/emails/phones | 632 application cards = 632 source applications |
| **SEC-03** residence lead CRM | Owner-privileged view bypassed `residence_leads` RLS | Residence-scoped lead projection includes only the former 15 permitted CRM fields, no direct email/phone; same view contract for UI | 1,114 lead cards = 1,114 source leads |
| **SEC-04** anonymous owner oracle | `is_application_owner(_application_id,_user_id)` trusted caller-supplied user ID, callable by `anon` | Guard checks real `auth.uid()` or service role; anonymous EXECUTE grant revoked | Real owner: true; another logged-in user passing the correct owner ID: false; anonymous grant: false |
| **SEC-06** landlord field tampering | Landlord application UPDATE policy permits broad column updates subject to residence predicate | New BEFORE UPDATE trigger only allows landlord changes to `status` (`under_review` / `documents_required`), `notes` and timestamps; final decisions/identity/residence assignments protected | Trigger exists, static CI guard in place; production business writes not simulated |
| **SEC-06** cross-tenant isolation | Multiple portals use the same frontend views | Actual authenticated-role RLS tests with live read-only data; unrelated student and another residence see no records | Valid residence account: 57 applications and 121 leads in its scope; unrelated student: 0/0; different residence: 0/0 |
| **SEC-06** handover export privacy | Two invoker-based admin handover views had unnecessary `anon` SELECT grants | Revoked anonymous grants without changing protected authenticated access | Anonymous `has_table_privilege` SELECT: false for both |

## Versioned database changes already applied
- `20261114222000_sec03_roommate_recruiter_invoker_views.sql`
- `20261114222500_sec04_sec06_owner_oracle_landlord_update_guard.sql`
- `20261114223500_sec03_scoped_landlord_invoker_views.sql`

**Migration-history note:** The connected Supabase migration tool assigns its own applied version metadata; reconcile with checked-in SQL migration filenames before any future Supabase CLI deploy. Do not blindly replay same schema changes.

## Compatibility and privacy engineering
The original view names, select-column order and selected types remain stable, so `RoommateFinder`, `RecruiterDashboard`, `PartnerIdentityPanel`, `ResidenceInbox`, `ResidenceApplicationDetail` and `ResidenceCRM` do not need frontend changes. View RLS is now evaluated as the actual signed-in user, not as the view owner.

The permitted applicant and lead projections contain names, academic identifiers, funding interest and internal landlord CRM notes under the previous business access rules. They **never** publish direct phone/email, national ID, private documents or lifetime Student 360 profiles. Landlords may still provide review feedback; final approval is gated independently.

All new projection tables have RLS and no direct browser mutation grants. Trigger functions run in `reskonnect_internal` with an empty search path; they are not directly exposed as public API endpoints. The triggers synchronize legitimate changes in the source records and remove opted-out/deleted roommate entries. Direct SELECT on base `profiles` is still forbidden to anonymous users.

## Remaining SEC-04 / SEC-05 / SEC-06 work (not closed)
Supabase still reports **24** anonymous-executable and **218** authenticated-executable `SECURITY DEFINER` functions. Not every function is unsafe; several are intentionally public catalogue feeds, authorisation predicates and attribution events. A read-only review inventory classified the browser-callable functions for individual code review, but the detailed inventory has **not** been included in this public repository because it could expose sensitive attack-surface metadata. Remaining functions require per-function ownership/auth checks, input bounds and dependency investigation before any grants are revoked.

The Supabase security advisor also reports the `pg_net` public-schema extension warning, leaked-password protection disabled, and RLS-enabled/no-policy informational entries. Those are separate work items; a no-policy table may be intentionally deny-all.

**Next controlled tests:** End-to-end signed-in actual resident/staff account UAT; forbidden status changes and field tampering in a sandbox or isolated fixture; residence account removal and revoked-role tests; concurrent profile/lead sync; retention/delete requests and monitoring of projection drift. The read-only role tests above never modified student or financial records and did not send messages.

## Release test
`node scripts/sec03-sec06-rls-scope.test.mjs` checks the four invoker views, opt-in and source-table data minimization, sync triggers, landlord field write constraints, owner function guard, preserved application view contracts and no anonymous handover grants. It is run with the full `backend:contracts` workflow before merge.

**Reference:** Supabase RLS guidance: https://supabase.com/docs/guides/database/postgres/row-level-security

**Security assertion:** 0 flagged privileged views is a verified specific improvement, not proof that the complete application has no authorization vulnerabilities.
