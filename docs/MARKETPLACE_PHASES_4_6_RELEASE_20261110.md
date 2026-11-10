# ResKonnect Phases 4–6: Marketplace operational release — 2026-11-10

## Scope and engineering changes
**Phase 4 — Landlord operations**
- Landlord portal evidence board connects existing six-stage listing studio, 2027 room types and published listing readiness.
- Room edits and creation validate nonnegative fees, nonzero quoted rates, reasonable year, physical capacity and available-beds bounds before transmitting.
- Year-specific inventory counters prevent combining 2026 and 2027 spaces.
- Real reservations and allocation remain governed by existing RLS/server-side hold flows. No fake rooms inserted.

**Phase 5 — Local SEO, partner conversion**
- Public `reskonnect_city_coverage_v` aggregates visible listings by city, with security-invoker and underlying RLS. An anonymous-role verification confirmed 361 listings across 5 cities.
- Genuine counts (published records, reported prices, photo references, verified prices) appear on established accommodation city pages and link to landlord acquisition.
- Budget filters exclude missing rent, expired promotions no longer undercut prices, public SEO cards distinguish reported spaces from confirmed allocations.
- Live SQL failures display an honest retry rather than fake zero inventory.
- Misleading verified-accommodation claims were corrected in primary and generated locality content.

**Phase 6 — Explainable housing intelligence**
- Deterministic Res DNA scoring with evidence confidence, funding acceptance distinctions, valid year room offers, transparent quote requirements and no fabricated walking distance or official accreditation.
- Unpriced residences no longer count as affordable group matches; reported spaces remain non-guaranteed. Unpublished tours do not display misleading 3D promises.
- Device shortlist functionality is explicitly local. Preferences report whether cloud sync genuinely succeeded instead of claiming successful saves after database errors.
- AdminOS Intelligence gains an evidence-quality scorecard based on live aggregated records; it is not presented as an AI precision or verified booking conversion rate.
- Tests for room integrity, public SEO data, funding/rent logic, group matching and permissions are included in the production build gate.

## Live baseline and acceptance boundaries
At implementation the Supabase project had 361 visible residences, 5 cities, and 0 independently verified prices/locations. Operational verification requires real landlords, photographs, room quotes, official funding/accreditation evidence and staff moderation. No code can invent or certify these. External partnership agreements, sales and SEO rankings are also outside a code deployment's guarantees.

## Production authentication reliability
This release does not modify auth.users, passwords, sessions, grants or database connection pools. All nonessential panel requests run after access is granted and may fail independently. Earlier remediation of five cron jobs and the auth trigger remains in force; additional global cron staggering was staged after timeout failures and requires separate verified application. A production database returning 500/504 can still prevent login; there is no sound promise of zero future timeouts. Keep incident #191 open pending independent provider/database review and successful real-device authentication tests.

## Verification
- Run `npm run p4-p6:check`, TypeScript, existing platform gates, web/PWA smoke, Android build, Supabase security advisors and read-only SQL verification.
- Merge only after GitHub CI passes and verify the exact Vercel deployment commit.
- Test authorized landlord listing submission and admin moderation manually with independent evidence, no fake listings or user password collection.
