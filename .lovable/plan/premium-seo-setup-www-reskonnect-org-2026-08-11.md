# Premium SEO Setup — www.reskonnect.org

Frontend-only SEO build: a reusable metadata/JSON-LD system, unique metadata on every public route, 24 new SEO landing/guide pages, structured data, sitemap/robots, image and internal-link improvements, plus a Search Console checklist. No backend, RLS, Edge Function, secret, or deployment changes.

## 1. SEO foundation

The project already has `src/components/SEO.tsx` (react-helmet-async, canonical + OG + Twitter + robots) used on ~100 pages, and `SEOJsonLd.tsx`. Rather than a parallel system, these are extended and backed by new config files:

- `src/lib/seo/seoConfig.ts` — canonical base `https://www.reskonnect.org`, default OG image, per-route metadata map (title, description, keywords, OG image), and the noindex route list.
- `src/lib/seo/jsonLd.ts` — typed builders: `organizationSchema`, `webSiteSchema`, `breadcrumbSchema`, `faqSchema`, `articleSchema`, `lodgingBusinessSchema`. No rating/review/partner fields exist in any builder, so fake trust signals cannot be emitted.
- `src/components/SEO.tsx` — gains an optional `route` key that pulls defaults from `seoConfig`, plus a `jsonLd` prop so a page can pass metadata and schema in one call. Existing call sites keep working unchanged.

Private routes (`/dashboard`, `/admin/*`, `/media`, `/commerce`, `/profile`, `/auth`, `/messages`, `/favorites`, `/documents`, `/residence/*`, `/recruit/dashboard`, `/setup-profile`, `/wil`, `/tvet-dashboard`, `/cart`, `/checkout`, `/orders`) get `noIndex` applied via the config list.

## 2. Route metadata

The five supplied titles/descriptions are applied verbatim to `/` (Landing), `/living`, `/applications`, `/opportunities`, `/partners`. Remaining public routes (find, res detail, bursaries, events, roommates, campus news, deals, terms, privacy, existing SEO landings) get unique config-driven metadata.

## 3. Landing pages — all 24

New routes added in `src/App.tsx`, lazy-loaded, under new folders `src/pages/seo/accommodation/`, `src/pages/seo/rentals/`, `src/pages/seo/applications/`, `src/pages/seo/opportunities/`, `src/pages/seo/partners/`, `src/pages/seo/guides/`.

Accommodation: `/student-accommodation`, `/student-accommodation/pretoria-west`, `/near-tut`, `/near-tut-pretoria-west`, `/near-tshwane-south-tvet`, `/tvet`, `/university`, `/nsfas-accredited`
Rentals: `/private-rentals`, `/private-rentals/pretoria-west`, `/private-rentals/bachelor-rooms-pretoria`
Applications: `/applications/application-readiness`, `/tvet-application-readiness`, `/university-application-readiness`, `/aps-checker`
Opportunities: `/opportunities/wil-placement-support`
Partners: `/partners/landlords`, `/partners/institutions` (existing pages — upgraded, not duplicated)
Guides: `/guides/how-to-find-safe-student-accommodation`, `/guides/student-accommodation-pretoria-west`, `/guides/tvet-application-checklist`, `/guides/university-application-checklist`, `/guides/what-documents-do-you-need-for-student-accommodation`

Existing `/living/*` and `/applications/*` pillar pages stay live and link across to the new SEO URLs.

Shared building blocks keep the pages substantial without duplicating layout code:
- `SeoLandingHero` (H1, intro, CTA), `SeoBenefitsGrid`, `SeoFaqSection` (renders visible FAQs and emits FAQPage schema only from what is rendered), `SeoInternalLinks`, `SeoBreadcrumbs`.
- Accommodation and rental pages pull real listings from the existing residence query hooks with the relevant audience/area filters, and render the existing residence card. Empty result sets show a genuine "no matches yet" state plus alternative links — never a fabricated listing.

Every page answers: what it is, who it is for, what you can do, what ResKonnect helps with, what ResKonnect does not do (compliance line from `BRAND.compliance`), and the next step. No NSFAS application-service page; NSFAS appears only as funding/accreditation context.

## 4. Structured data

Organization + WebSite (with SearchAction pointing at `/find`) stay in `index.html`, corrected to the new domain and real contact details. BreadcrumbList on all landing, guide, and residence detail pages. FAQPage only where FAQs are visible. Article on the five guides. `LodgingBusiness` + `Offer` on `/res/:id` built strictly from real residence fields, with each property omitted when the data is absent.

## 5. Sitemap and robots

`public/sitemap.xml` rewritten from the actual router: homepage, four pillars, all 24 new pages, existing SEO landings, and public utility pages. Private routes removed (the current file wrongly lists `/dashboard`, `/profile`, `/applications`, `/auth`). All `<loc>` values use `https://www.reskonnect.org`.

`<lastmod>` handling: the current file's dates are uniform placeholders with no page-specific source, so they are dropped rather than refreshed with a build date.

Residence detail URLs are dynamic and DB-backed; a static file cannot track them. They are left out of this pass and noted in the checklist doc as a follow-up (a generator script would be needed).

`public/robots.txt` edited in place: keep the existing user-agent blocks and disallow rules, correct the sitemap line, confirm no asset/CSS/JS blocking, and drop the stale `Allow:` list for paths that no longer exist.

## 6. Images

Residence and category cards get descriptive alt text built from real data (`"{residence name} student accommodation in {area}"`), explicit `width`/`height` where the layout is fixed, `loading="lazy"` + `decoding="async"` below the fold, and eager/high-priority loading only on the hero image. No generic "image"/"card" alt text remains on public pages.

## 7. Internal linking

Homepage, Living, Applications, Opportunities, and Partners each get a contextual link block matching the requested groupings. `SiteFooter.tsx` gains grouped SEO link columns: Living, Applications, Opportunities, Partners, Guides, Contact.

## 8. Performance and semantics

Single H1 per page with ordered headings, semantic `section`/`nav`/`article`, accessible link and button labels, and a mobile overflow pass at 375px. No new dependencies.

## 9. Documentation

`docs/SEO_SETUP_CHECKLIST.md` with the new domain, Search Console verification, sitemap submission, URL inspection list, robots/canonical checks, mobile usability, rich-results testing, weekly query monitoring, and the dynamic-residence-sitemap follow-up.

## Verification

Typecheck/build, a repo scan for stale domain references, and a browser pass over the homepage plus several new landing pages at 375px and desktop to confirm rendered content, single H1, and no horizontal overflow.

## Out of scope (confirmed)

No migrations, no RLS changes, no Edge Function changes, no secret/env changes, no deployment, no fabricated partners/reviews/ratings/institution relationships, no NSFAS application service pages.
