# Branded SEO + Icon Fix for ResKonnect

## What I verified first

- Icons (`favicon.ico`, `favicon-16/32`, `favicon.png`, `apple-touch-icon`, `icon-192/512/1024`, `maskable-*`) all render on a dark navy `#030812` background — not white.
- `public/og-image.png` is a broken 48x48 placeholder, not 1200x630.
- No wrong brand spellings exist anywhere (ResConnect, RasConnect, House Connect, etc. return zero matches) — nothing to fix there.
- There is no `/search` route; `/find` exists. The current WebSite schema already points SearchAction at `/find?query=`.
- The homepage (`src/pages/Landing.tsx`) has **no `<h1>` at all** — headings start at `<h2>`.
- Sitemap already lives at `public/sitemap.xml` with 40+ www.reskonnect.org URLs; robots.txt already references it.

## 1. Icons and app icon

Regenerate the full icon set from the official ResKonnect mark on a **solid white** background, centred with correct padding:

- `favicon-16x16.png`, `favicon-32x32.png`, `favicon.ico`, `favicon.png`
- `apple-touch-icon.png` (180x180, white, ~10% safe padding)
- `icon-192.png`, `icon-512.png`, `icon-1024.png`
- `maskable-icon-192.png`, `maskable-icon-512.png` (white, ~20% safe-zone padding so Android's circular mask doesn't clip the logo)

Update `public/manifest.json`: `background_color` to `#FFFFFF` (theme_color stays navy `#071326`).

## 2. Open Graph image

Replace the broken 48x48 `og-image.png` with a real 1200x630 branded card: white background, official ResKonnect logo, wordmark, and "LIVING • AI • OPPORTUNITY". No AI accommodation photos, no fake imagery.

## 3. Homepage brand SEO

- Add a real `<h1>` in the hero: **"ResKonnect: Your stay. Your studies. Your future. Connected."** The existing hero slogan stays; the change is semantic plus the visible brand name.
- Update homepage metadata in `src/lib/seo/seoConfig.ts` and `index.html` to the exact title, description, OG and Twitter strings supplied.

## 4. Brand-first route titles

Update `ROUTE_META` in `src/lib/seo/seoConfig.ts` so each public pillar title leads with the brand:

| Route | Title |
|---|---|
| `/living` | ResKonnect Living \| Student Accommodation & Private Rental Support |
| `/applications` | ResKonnect Applications \| APS Checker & Application Readiness |
| `/opportunities` | ResKonnect Opportunities \| WIL Placement & Student Support |
| `/partners` | ResKonnect Partners \| Landlords, Institutions & Businesses |
| `/student-accommodation` | ResKonnect Student Accommodation \| Verified Residences Near Campus |
| `/applications/aps-checker` | ResKonnect APS Checker \| Application Readiness Guidance |
| `/private-rentals` | ResKonnect Private Rentals \| Bachelor Rooms & Private Rental Support |

SEO landing pages that define their own titles in `src/lib/seo/landingContent.ts` get the same brand-first treatment.

## 5. Structured data

In `src/lib/seo/jsonLd.ts` and the static `index.html` block, align Organization with the supplied shape: add `alternateName: "RESKONNECT"` and the platform `description`, keep the real email/phone, logo pointing at the public icon. No invented social profiles.

WebSite schema keeps `name`/`url`; SearchAction stays pointed at the real `/find?query=` route rather than the non-existent `/search`, noted as a TODO in the checklist doc.

## 6. Canonicals, robots, sitemap, noindex

- Sweep for lingering canonical/OG URLs on `.lovable.app`, `.vercel.app` or localhost and repoint to `https://www.reskonnect.org`.
- Confirm robots.txt keeps `Allow: /`, the private disallows, and the sitemap directive.
- Verify the sitemap contains all nine required URLs (`/`, `/living`, `/applications`, `/opportunities`, `/partners`, `/get-started`, `/student-accommodation`, `/private-rentals`, `/applications/aps-checker`) plus the other public SEO pages, and no admin/dashboard/auth routes.
- Re-verify `NOINDEX_PREFIXES` covers `/auth`, `/dashboard`, `/admin`, `/god-mode` and internal account pages (it already does) against rendered output.

## 7. Footer brand links

Add a brand-named link group to `src/components/SiteFooter.tsx`: ResKonnect Living, Applications, Opportunities, Partners, Student Accommodation, APS Checker, Private Rentals, Partner with ResKonnect — merged into the existing columns, not stacked on as keyword spam.

## 8. Docs

Create `docs/BRANDED_SEO_CHECKLIST.md` with the 10 Search Console / domain steps, plus TODOs for the `/search` route and manual Vercel redirect work.

## Constraints honoured

No deployment, no backend migrations, no RLS changes, no Edge Function changes, no secret changes, no fake reviews/ratings/partners.

## Note on social previews

This stack renders metadata client-side, so link-preview crawlers (WhatsApp, LinkedIn, Facebook) only see the static `index.html` head — the homepage/brand tags there will be correct, but true per-page previews would need SSR via [Lovable's latest template](https://lovable.dev/blog/building-apps-using-tanstack-start).