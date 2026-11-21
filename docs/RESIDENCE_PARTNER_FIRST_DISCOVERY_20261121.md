# ResKonnect • Photo-first discovery, search-only directory and partner classification

## Root cause verified 21 November 2026

Production ResKonnect project `mefjzkhobkltlbmhusdh` contains 362 residence records, 361 published (`is_visible=true`). Only **16 published residences have a linked photo reference** in `image_url`, `cover_image_url` or `images`; **345 have none**. Existing Find My Res ordinary browse displayed all published records, regardless of complete presentation, so students encountered extensive photo-poor listings before properties with active media. This is a discovery/presentation concern; existing student cases must not be deleted or moved.

Example `TUT Varsity Lodge` has public slug `tut-varsity-lodge` and linked photos. Published, indexable property URLs have long been generated through `api/sitemaps/residences.xml.js` → `api/sitemap.js`. Search-engine indexing is not guaranteed simply because a URL exists in a sitemap. The new crawlable A-Z directory improves internal linking while keeping non-featured listings out of the main gallery.

## Exactly two independent admin controls on every residence

| Field | Values | Meaning |
|---|---|---|
| `listing_relationship` | `unclassified`, `free`, `partner`, `paying` | Internal commercial classification. A trusted badge, photo, free listing and billed sponsorship are **not** proofs of an active paid account; existing residences remain unclassified until admin reviews. |
| `discovery_placement` | `automatic`, `promote`, `directory_only` | Controls normal browsing only. Does not update publication, search indexing, map access, existing customer records or booking eligibility. |

Business policy:
- **Automatic**: published residences with a usable photo reference appear in ordinary Find My Res browsing.
- **Promote**: admin may override and show a published property prominently even without photos (warn about placeholder). Listing relationship adds ordering preference: paying, partner, free/unclassified. Spotlight/Trusted and their proven editorial rankings remain separate controls in existing Visual Studio.
- **Directory only**: published listing is absent from broad photo grids, suggestions, Top 3, Spotlight, homepage trusted rail, sponsored rail and normal category rails. It remains fully findable by typing its name, opening its direct `/find-my-res/:slug` URL, accessing the low-profile full A-Z directory, or opening the existing ResMap/3D map.
- **Payment disclosure**: marking a listing `paying` is an internal classification; it **does not** create a Sponsored badge or certify an invoice. The Sponsored rail still requires actual approved `reskonnect_public_sponsored_residences` results, with explicit disclosure.

## Student UX and demand routing

The primary card grid shows the photo-ready or admin-promoted properties first, with partner/paying classifications providing higher ordinary discovery priority (not manipulating exact name matches). This directs *casual* demand toward more fully presented residences.

A secondary, quiet expandable *Looking for a specific residence?* panel lists unpromoted residence names as compact links, in batches. It includes a link to `/directory/residences` with searchable A-Z names. A named Find My Res search continues searching **all** published residences, including incomplete and free listings, without requiring a dropdown. Map/3D overlays continue loading the broad published residence dataset independently.

Every listing keeps its original page, current students, applications, reservations, CRM, booking/contact controls, old slug redirects, and sitemap eligibility. The new fields are not status/contract/academic verification gates.

## Admin maintenance

Open **AdminOS → Accommodation → Residences**. The new **Discoverability & partner relationships** panel shows published/normal-browse/search-only/paid-classification counts, links to the existing Visual Studio for Spotlight/Trusted/Top 3 and the existing accommodation commercial editor.

Use per-row selectors to classify a residence or switch `automatic`, `promote` and `directory_only`. To process the large free directory, filter **Search & map only**, select the desired rows and use the confirmed, 50-per-batch **Mark selected as Free directory** action. Other bulk actions set search-only or restore automatic discovery. If an update fails, refresh the records and report the error rather than assuming all succeeded.

Commercial agreement verification and paying-client classifications must be handled by an authorized operator; the migration deliberately does not backfill paid/partner status from badges, photos, historical invoices or lead counts.

## SEO and non-guarantees

Published slugs continue in the dynamic public `/sitemaps/residences.xml` and per-residence canonical detail pages. The indexable `/directory/residences` page is added to the sitemap and SEO prerender list and contains real, crawlable `<a href>` property links once loaded. Google and other search engines decide whether and when to index individual pages. For a specific listing, submit the canonical URL through Google Search Console URL Inspection where needed; sitemap submission can help discovery but does not force indexing.

An image URL is only a **reference**; the admin should still test that the link loads and property details are legitimate. A partner relationship never establishes official accreditation, real-time room availability or guaranteed placement.

## Release safeguards

- Additive constrained schema migration; no mass update, deletion or role grant.
- Existing `residences` RLS/admin and departmental permission model remains unchanged.
- `scripts/residence-directory-curation.test.mjs` checks photo-first default, exact-name search, full directory link, map, all curated rails, sitemap and safety of existing records.
- Include in `npm run backend:contracts` and await complete web/SEO/Android/security CI before merging.
