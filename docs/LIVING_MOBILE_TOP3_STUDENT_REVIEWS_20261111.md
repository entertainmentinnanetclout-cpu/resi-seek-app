# ResKonnect Living — mobile-first accommodation marketplace & reviews (2026-11-11)

## Changes and navigation

- **Home:** Search rooms by area/campus/residence; AI-assisted finder routes to the existing ResDiscoveryEngine (preference matching, map and supported visual AI); warm ivory/coral Spotlight, then independently ranked **Top 3 of the Month**, followed by the curated/trusted landlord gallery. The editorial Spotlight is not sponsored accreditation.
- **Find My Res:** the same search/finder flow, responsive photo cards, compact horizontal cards and detailed cards toggled in place. User filters take precedence over editorial sections.
- **Landlord / Property OS:** segmented nav and bottom thumb navigation on mobile; new overview hero and direct links to applications, reservations, listing studio, communications; the advanced editor previews **photo**, **list** and **marketing poster** designs in one place. The saved public profile and private reservation pipeline remain connected.
- **AdminOS → Residences → Student ratings:** independent moderation of public written feedback. Editing a published landlord listing cannot change student votes or accreditation; the existing Spotlight priority controls remain separately available.

## Organic monthly performance

`reskonnect_public_top3_monthly()` publishes exactly three or fewer eligible, public, photo-backed residences using the current calendar month in UTC/Postgres server time (display calendar month is localised in the UI). One point per **distinct submitting applicant account**, two points per **distinct reservation-interest account**. A reservation is not a confirmed booking or moved-in tenant, and no visitor volume, paid sponsorship, landlord-authored score or editorial Spotlight setting contributes. The displayed numbers are labelled *applications / reservation interests*. The leaderboard automatically changes when activity changes. Scores can tie; reservation count, application count, then ID break ties deterministically.

## Student vote model

`reskonnect_student_residence_reviews` has RLS, a unique pair (`user_id`, `residence_id`), stars 1–5, and admin-moderated written feedback. Eligibility requires a **recorded approved application** for the same residence, not simply any signed-in user. This is an *approved applicant rating*, not proof of completed residence stay; public wording is “student rating” rather than “verified stay”. Upsert lets a voter edit a previous star vote without adding a duplicate. The public summary uses `round(avg(rating),1)` and `count(distinct user_id)`. Before the first eligible vote, the public RPC returns no rating and the card says “No student ratings yet”. The old unverified `reviews` rows are not imported or used in the aggregate. Names/user IDs and unpublished feedback never leave safe public RPCs. AdminOS can hide or release comment text; landlord portal cannot moderate votes.

## NSFAS evidence

A listing's `accepts_nsfas` flag means funding is accepted; it **does not establish accreditation**. The shared public accreditation RPC checks `official_verified_at`, active official determination, unexpired validity and authority. “NSFAS accredited” is shown only when the verified authority specifically references NSFAS; otherwise it can show “Accredited” if valid evidence supports general accreditation. There are currently **zero qualifying active verified accreditation cases**, so no public listing should carry the official NSFAS-accredited badge yet. No NSFAS logo asset or trademark is bundled in this PR; an authorized official logo could later be added after accreditation/document and brand-use checks. Do not substitute a drawn/fake official badge.

## Limits and operational checks

- All new database functions and migration applied to ResKonnect project; 2026-11 monthly Top 3 RPC and zero initial student vote ratings verified.
- Private student review rows remain inaccessible to anonymous clients; RLS and public RPCs must be checked when testing.
- Browser canary: load home/Find My Res on a narrow phone, search and open AI Finder, switch card views; confirm all routes, pricing, monthly badges and landlord quick navigation; test admin comments moderation and an eligible student's vote with consent.
- Ranking is based on interest, not paid marketing. Public placement is not a vacancy guarantee. Official accreditation status and student review scores come from separate evidence.
