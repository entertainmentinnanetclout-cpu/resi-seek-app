# ResKonnect Premium Upgrade — Intent-Aware Platform

Frontend-only upgrade. No backend migrations, no RLS/Edge Function/secret changes, no deploy.

## What exists today (verified)
- Official assets are already in `src/assets` (full logo `RESKONNECT LOGO OFFICIAL VERSION 2.png`, icon-only 128–2048, maskable, apple-touch, favicons).
- `public/manifest.json` and `index.html` still point at older `/icon-*.png` and `/favicon.png`, theme colour `#141414`.
- `src/hooks/useResidenceFilters.ts` already supports `audience` (university/tvet/private), `nsfasOnly`, price, room types, availability, sort.
- Residences carry `accepts_university`, `accepts_tvet`, `accepts_private`, `accepts_nsfas` / `nsfas_accredited`.
- Onboarding foundation exists: personas, needs, adapter (localStorage), `/get-started`, pillar pages, Admin Onboarding Hub.

Important data note: `accepts_private` currently means "accepts private-paying students", not "non-student private rental". There is no confirmed separate private-rental listing type in the data. The private-tenant experience will run through an adapter with a documented backend TODO rather than inventing a field.

## Stage 1 — Branding
- New `src/constants/brand.ts`: name, descriptor (LIVING • AI • OPPORTUNITY), tagline, hero copy, logo/icon imports, contacts (063 732 3192, reskonnect@gmail.com, www.reskonnect.co.za).
- Swap logos in header, footer, auth, admin sidebar, preloader/loading, using `object-contain`.
- Update `index.html` icons + theme colour and `public/manifest.json` icon set (copy needed icon files into `public/`), Apple touch icon.

## Stage 2 — Brand colour system
- Extend `src/index.css` tokens + `tailwind.config.ts` with the navy/blue/gold/green/red palette as semantic tokens (`--brand-navy`, `--cta`, `--success`, etc.). Retire the rainbow accents from primary surfaces; keep them only where already used in secondary decoration.

## Stage 3 — Homepage
Upgrade `src/pages/Landing.tsx` in place: premium navy hero with headline "Your stay. Your studies. Your future. Connected.", central search block, carousel, Get Started CTA (gold) + Find Accommodation / Partner With ResKonnect, Living/Applications/Opportunities/Partners cards, discovery rails, 8-step journey timeline, parent/private-tenant trust block, landlord CTA, FAQ (incl. required NSFAS answer), premium footer. Reuse existing images in `src/assets`.

## Stage 4 — Intent engine
- `src/lib/intent/userIntentTypes.ts`, `userIntentAdapter.ts` (localStorage now, TODO sync to `onboarding_requests.metadata`), `src/contexts/UserIntentContext.tsx` + `useUserIntent`.
- Fields as specified: persona, primary_need, student_status, institution_type/name, campus, funding_type, nsfas_funded, looking_for_* flags, area, budget, room_type, move_in_date, programme, wil_needed, parent_mode, child profile, skipped_guide.
- Rework `GuidedOnboardingFlow` into a card wizard: Who → What → Where → Budget/Funding → What next, one decision per card, skip and resume supported; still submits via the existing onboarding adapter.

## Stage 5 — Personalised routing
`OnboardingResultRouter` and post-guide recommendation card branch by persona/need per the rules: student → student accommodation; NSFAS student → NSFAS-accredited + campus prioritised; private-funded → accepts-private student accommodation; private tenant → private rentals only; applicant → Applications/APS; WIL → WIL readiness; parent → child-led routing; landlord/institution → Partners. Skipped guide = no forced filters.

## Stage 6 — Find My Res intent awareness
- Map intent → initial `ResidenceFilters` on mount (audience, nsfasOnly, campus, budget, room type), all removable.
- Explanation banner ("Showing NSFAS-accredited…" etc.) and visible chips via existing `ActiveFilterChips`.
- Add missing filter controls: user type (student vs private tenant), institution, area, funding type, verified only, available now, sort by price/distance/recent.
- Card upgrade: listing-type badge, verified, NSFAS badge, accepts-private badge, area, nearest campus, room type, price, availability, distance, Apply/Enquire/Save/Compare.
- Empty state: closest matches + one-tap filter relaxation.

## Stage 7 — Readiness, status, WhatsApp
- Applications readiness flow around the existing APS checker: marks → APS → document checklist → official portal links → optional accommodation, with the frontend status set. Copy-my-details card; ZIP noted as backend TODO `application_pack_zip_generation`.
- Accommodation application status timeline component with the 12 statuses, missing-document alerts and next-action CTAs (frontend rendering over existing application data; unmapped statuses documented).
- Shared `whatsappLinks.ts` helper for prefilled `wa.me/27637323192` CTAs (support, residence enquiry, viewing request, missing documents). No API, no webhooks.

## Stage 8 — Dashboards
Extend the existing student dashboard with next-action, readiness and saved-residence blocks; add persona-aware dashboard variants (private tenant, applicant, parent, landlord) as frontend views driven by intent, with TODOs where data is absent.

## Stage 9 — Admin polish
Extend the existing Onboarding Hub with intent-profile columns and attention buckets (needs documents, ready for reservation, skipped guide, incomplete profile, parent/landlord/WIL leads). No God Mode rebuild.

## Stage 10 — SEO + docs
Titles/meta/canonical/FAQ on new and upgraded pages, journey language, internal links. Update `docs/JULES_FRONTEND_HANDOFF.md` and `docs/FRONTEND_PROGRESS_CHECKLIST.md` with UI/flow/filter/dashboard changes, backend TODOs, build result, and confirmation of no backend changes and no deployment.

## Guardrails
No NSFAS application service, no invented partners/reviews/ratings/socials, existing routes and auth untouched, TypeScript clean, build run after each major stage.
