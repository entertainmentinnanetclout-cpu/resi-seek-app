# ResKonnect Premium UI Polish Phase

Frontend-only. No migrations, no RLS/Edge Function/secret changes, no deploy.

## 1. One shared public header + footer
- Extract the header from `PublicLayout` into a single `SiteHeader` component (desktop + mobile sheet) and reuse it on every public page that renders its own header today.
- Replace the inline header in `Landing.tsx` (which still shows "Find Accommodation / Apply (TUT / NSFAS) / Bursaries / Campus News") with `SiteHeader`.
- Nav becomes: Living, Applications, Opportunities, Partners + Sign In + Get Started (gold CTA), with an optional contextual search slot for accommodation pages.
- Legacy routes stay alive: `/find` under Living, `/apply` relabelled "Application Readiness", `/bursaries` and `/campus-news` surfaced under Opportunities, list-property under Partners.
- Logo anchored far-left, official full logo at a larger readable height, icon-only on narrow mobile, `object-contain` always.
- Footer upgraded: four link columns matching the nav, contact block (063 732 3192, reskonnect@gmail.com, www.reskonnect.co.za), compliance notes, dark navy command strip. No fake socials.

## 2. Brand colour unification
- Audit `index.css` and `tailwind.config.ts` tokens against the palette (navy #071326, command navy #0B1220, blue #2563EB / #2F6EDB, gold #F5B32F, green #12A870, red #EF4444, surfaces #F8FAFC / #E5E7EB).
- Enforce roles: navy for hero/footer/command sections, gold for primary CTAs, blue for secondary/links/selected, green for verified, red only for alerts.
- Sweep the earlier multi-accent tokens (coral/pink/violet/mint) out of public-facing components so the site reads unified, not rainbow.

## 3. Premium preloader
- Rebuild `Preloader.tsx` as a full-screen navy loader: centred icon-only mark, soft blue/gold glow, 0.96 to 1 scale, fade-in, thin animated progress line or orbit dots, copy "Connecting your journey...", smooth fade-out. Pure CSS, with a static fallback under `prefers-reduced-motion`.

## 4. Full-screen first-time guide
- Turn `GuidedOnboardingModal` / `GuidedOnboardingFlow` into an immersive overlay: gradient plus soft animated shapes, blurred dim backdrop, single centred card, progress dots, one question per step, Skip for now / Continue, subtle logo mark. Full-screen on mobile.
- Steps: Who are you, What do you need, Where, Budget/funding, Recommended next path.
- Trigger only when there is no stored intent profile and the user is signed out; skipping sets `skipped_guide = true`.

## 5. Card and animation system
- Shared card treatment: rounded, soft border, subtle shadow, hover lift on desktop, tap scale 0.98 on mobile, gold/blue selected outline, consistent status chips and badge hierarchy.
- Reusable utilities in `index.css`: `fade-in-up`, `card-hover-lift`, `tap-press`, shimmer skeleton, loader pulse, accordion and chip transitions, all wrapped in a `prefers-reduced-motion` guard.

## 6. Homepage redesign
- Full-width navy-gradient hero using existing approved imagery, headline "Your stay. Your studies. Your future. Connected.", the given subcopy, central search block ("Search by campus, area, residence, institution, or service..."), CTAs Get Started (gold), Find Accommodation, Partner With ResKonnect, smooth slide indicators.
- Keep the existing 500+/30+/7/9 stat strip; no new invented figures or ratings.
- Upgrade "Start with one question" into animated persona cards (stay, help my child, private rental, study applications, WIL, list property, partner, not sure) with selected states.
- Trusted/verified residence grid, journey timeline, FAQ accordion, premium footer.

## 7. Find My Res / Living
- Intent-aware pre-filters with visible removable chips and a one-line reason.
- Rules: NSFAS student sees student residences with accreditation context and no private rentals; private-funded student sees residences accepting private-paying students; private tenant sees private rental listings or the request flow (never `accepts_private` residences); skipped guide applies no forced filters.
- Card content: image, title, area, nearest campus, rent from, spots, Verified/Trusted, NSFAS-accredited, accepts private-paying, room type, Apply/Enquire, Save, Compare, Request Viewing.
- Fix horizontal overflow on the rails and spotlight slider; add an empty state with closest matches, one-tap filter relaxation and private-request fallback.

## 8. Private rental flow
- Wire the private tenant path to `private_rental_requests` and `private_rental_listings` (area, budget, rental type, move-in date, occupants, contact), with a status placeholder in the dashboard. Student residences are never presented as private rentals.

## 9. Application readiness wording
- Remove "Apply (TUT / NSFAS)" and similar. Use Applications / Application Readiness / APS & Documents / Official Portal Guidance.
- Show the admissions and NSFAS disclaimers on every applications surface. Flow stays marks, APS, documents, info summary, official portal, accommodation. No OCR, no auto-fill.

## 10. PWA and mobile
- Verify viewport meta (already `viewport-fit=cover`), manifest and favicons pointing at the official icon derivatives, theme colour #071326.
- Global horizontal-overflow guard, safe-area padding, touch-friendly targets, sticky bottom CTAs where useful, header and search that never break at 375px.

## 11. Dashboard and admin polish
- Extend existing dashboards with blocks: my next action, accommodation status timeline, missing documents, saved residences, compare, viewing requests, application readiness, private rental request status, WIL readiness, WhatsApp support, reading `saved_residences`, `viewing_requests`, `document_checks`, `application_status_history`, `space_reservations`, `private_rental_requests` where the shape is safe.
- Admin: logo and sidebar polish, Onboarding Hub styling, attention buckets, staff task cards, notification queue, partner leads, using `v_onboarding_command_center` and `v_daily_operations_summary` where available. No God Mode rebuild.

## Technical notes
- New files: `src/components/SiteHeader.tsx`, `src/components/SiteFooter.tsx`, upgraded `Preloader.tsx`, an overlay shell for the guide, shared card/animation utilities in `index.css`.
- Any missing backend field gets a TODO comment and a docs entry rather than a migration.
- Docs updated at the end: `docs/JULES_FRONTEND_HANDOFF.md`, `docs/FRONTEND_PROGRESS_CHECKLIST.md`.

## Sequencing
1. Header, footer, logo and colour tokens (fixes the visible inconsistency first)
2. Preloader and animation utilities
3. Homepage hero and sections
4. Full-screen guide overlay
5. Find My Res cards, chips, overflow, empty state
6. Private rental flow and application wording
7. Mobile and PWA sweep
8. Dashboard and admin polish, docs, final report