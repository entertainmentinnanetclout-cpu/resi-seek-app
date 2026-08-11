# ResKonnect SEO Setup Checklist

Primary domain: **https://www.reskonnect.org**

## 1. Google Search Console
- [ ] Add the property `https://www.reskonnect.org` (prefer the Domain property so www/non-www and http/https are all covered).
- [ ] Verify via DNS TXT record on the registrar, or via the HTML tag / analytics method.
- [ ] Confirm the preferred canonical host is `www.reskonnect.org` and that the apex redirects to it.

## 2. Sitemap
- [ ] Submit `https://www.reskonnect.org/sitemap.xml` under Sitemaps.
- [ ] Confirm "Success" status and the discovered URL count.
- [ ] Re-submit whenever new landing or guide pages are added.

## 3. URL inspection
Inspect and request indexing for:
- [ ] `/`
- [ ] `/student-accommodation`
- [ ] `/student-accommodation/pretoria-west`
- [ ] `/student-accommodation/near-tut`
- [ ] `/student-accommodation/nsfas-accredited`
- [ ] `/private-rentals/pretoria-west`
- [ ] `/applications/aps-checker`
- [ ] `/applications/tvet-application-readiness`
- [ ] `/opportunities/wil-placement-support`
- [ ] `/partners/landlords`

## 4. robots.txt
- [ ] Load `https://www.reskonnect.org/robots.txt` and confirm it renders.
- [ ] Confirm public pages, images, CSS and JS are not blocked.
- [ ] Confirm `/admin`, `/dashboard`, `/auth` and other private areas are disallowed.

## 5. Canonical URLs
- [ ] Spot-check that each public page emits a self-referencing canonical on the `www.reskonnect.org` domain.
- [ ] Confirm private routes emit `noindex, nofollow`.

## 6. Mobile usability
- [ ] Test key pages at 375px width — no horizontal overflow, tappable targets.
- [ ] Run PageSpeed Insights on the homepage and one landing page.

## 7. Rich results
- [ ] Run the Rich Results Test on the homepage (Organization / WebSite).
- [ ] Test a landing page (BreadcrumbList + FAQPage).
- [ ] Test a guide page (Article).
- [ ] Test a residence detail page (LodgingBusiness / Offer).
- [ ] Confirm no AggregateRating or Review markup is present anywhere (we never publish unverified ratings).

## 8. Ongoing monitoring
- [ ] Weekly: review Performance > Queries and Pages for new high-intent terms.
- [ ] Weekly: check Indexing > Pages for "Discovered – currently not indexed" and "Crawled – currently not indexed".
- [ ] Monthly: refresh landing page copy and add new guides based on real queries.
- [ ] Monthly: confirm the sitemap still reflects live routes and visible residences.

## Compliance reminders
- ResKonnect does not replace official institution application systems.
- ResKonnect does not provide NSFAS application services; NSFAS appears only as funding or accommodation accreditation context.
- No fake partners, reviews, ratings or institution relationships in any page copy or structured data.
