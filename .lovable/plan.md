# Domain migration: reskonnect.co.za -> www.reskonnect.org

Replace every public-facing reference to the old domain with `https://www.reskonnect.org`. No backend, migration, Supabase config, or deploy changes.

## What changes

**Brand constants** (`src/constants/brand.ts`)
- `website: "www.reskonnect.org"`, `websiteUrl: "https://www.reskonnect.org"`. The footer reads from here, so the visible footer line updates automatically.

**Static head metadata** (`index.html`)
- canonical, `og:url`, `og:image`, `twitter:image`, Organization `url`/`logo`, WebSite `url` and search `urlTemplate`.

**Per-route SEO** (`src/components/SEO.tsx`)
- `siteUrl` constant, which drives canonical, og:url, og:image and twitter tags on every page using the component.

**JSON-LD in pages**
- `src/pages/Landing.tsx`, `src/pages/ResidenceDetail.tsx`, `src/pages/seo/NationalLanding.tsx`, `CampusLanding.tsx`, `ProvinceLanding.tsx`, `NsfAsLanding.tsx` — all hardcoded `https://reskonnect.co.za/...` URLs.

**Share links** (`src/lib/share.ts`)
- `SITE_URL`, used to build shareable product/residence/bursary URLs.

**Crawler files**
- `public/sitemap.xml` — all 19 `<loc>` entries.
- `public/robots.txt` — header comment and the `Sitemap:` line.

**Manifest** (`public/manifest.json`)
- `start_url` is relative (`/`) and there is no `scope`, so nothing domain-specific to change — left as is.

**Email addresses shown to users**
- `src/pages/Terms.tsx` (`support@reskonnect.co.za`) and `src/pages/Privacy.tsx` (`privacy@reskonnect.co.za`) point at mailboxes on the old domain. These become `reskonnect@gmail.com`, matching the rest of the site.

**Edge function templates** (visible text only, no logic change)
- `supabase/functions/og-image/index.ts` — footer text "reskonnect.co.za" -> "www.reskonnect.org".
- `supabase/functions/generate-booking-slip/index.ts` and `download-handover-pack/index.ts` — support address -> `reskonnect@gmail.com`.
These are text edits inside existing functions; nothing is deployed as part of this change.

## Not touched
Supabase client config, migrations, RLS, the WhatsApp number (063 732 3192), and everything under `docs/` (historical SQL packs).

## Verification
Run the typecheck/build, re-scan the repo for any remaining `reskonnect.co.za` occurrence outside `docs/`, and report the full list of files changed.