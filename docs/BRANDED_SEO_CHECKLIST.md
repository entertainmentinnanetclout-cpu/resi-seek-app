# ResKonnect Branded SEO Checklist

Primary domain: **https://www.reskonnect.org**
Brand spelling: **ResKonnect** (alternate: RESKONNECT). Never ResConnect, Res Connect, RasConnect, SaaS Connect, House Connect, or "reskonnect placement hub".

## Manual steps (outside the codebase)

1. Connect `www.reskonnect.org` in Vercel as the production domain.
2. Add a permanent redirect from `reskonnect.org` to `https://www.reskonnect.org`.
3. Add a Google Search Console **domain property** for `reskonnect.org`.
4. Verify DNS (TXT record supplied by Search Console).
5. Submit `https://www.reskonnect.org/sitemap.xml`.
6. URL-inspect `https://www.reskonnect.org/`.
7. Request indexing for the homepage and the five pillar pages.
8. Search `site:reskonnect.org` to confirm coverage.
9. Search `ResKonnect` once indexed and confirm the official site ranks first.
10. Monitor branded queries weekly in the Performance report.

## What is already in the codebase

- Homepage title, description, OG and Twitter metadata set in `index.html` and `src/lib/seo/seoConfig.ts`.
- Single `<h1>` on the homepage containing the brand name.
- Brand-first titles for every public route (`ROUTE_META`) and every SEO landing page (`landingContent.ts`).
- Organization JSON-LD with `alternateName: "RESKONNECT"`, real email and phone, logo at `/icon-512.png`.
- WebSite JSON-LD with SearchAction.
- Self-referencing canonicals for every public route via `src/components/SEO.tsx`.
- `noindex, nofollow` for `/auth`, `/dashboard`, `/admin`, `/god-mode` and other private prefixes (`NOINDEX_PREFIXES`).
- `public/robots.txt` allows all public routes, disallows private areas, and points at the sitemap.
- `public/sitemap.xml` lists all public canonical URLs and no private routes.
- Branded 1200x630 `public/og-image.png` (white background, official logo).
- Full icon set regenerated on a white background, including maskable variants.

## TODOs

- **No `/search` route exists.** The WebSite SearchAction currently targets the real search surface, `https://www.reskonnect.org/find?query={search_term_string}`. If a dedicated `/search` route is ever added, update the target in `src/lib/seo/jsonLd.ts` and `index.html`.
- Social-preview crawlers (WhatsApp, LinkedIn, Facebook) do not execute JavaScript, so they only read the static `index.html` head. Per-page social previews would require SSR.
- Once shared, cached link previews will not refresh until each platform re-scrapes; force a refresh with their link-preview debuggers.