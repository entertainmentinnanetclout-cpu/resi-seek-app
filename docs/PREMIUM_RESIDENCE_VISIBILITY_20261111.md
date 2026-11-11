# ResKonnect — Premium residence visibility (Homepage + Find My Res)

## Product outcome

The five strongest **explicitly selected** accommodation placements are brought forward into a shared photographic editorial showcase:
- **Homepage:** directly under the top hero, before the broad ResKonnect platform explanation.
- **Find My Res:** directly below the search hero, before ordinary discovery results. When a student applies any search filter, this editorial block disappears so the filtered results are not overridden by advertising.
- **Layout:** one large lead-photo property (Priority 1) plus four smaller supporting photos (Priority 2–5), responsive on phones/tablets/desktop. Actual listing title, city/campus, evidence-aware private rent, supported NSFAS/TUT flags, reported spaces, and a genuine property-detail link.
- **Other curated listings:** a smaller secondary rail after main search results; property popularity and application count cannot silently assign editorial placement.
- **Paid placements:** existing sponsored rail is retained, separately labeled `Sponsored`. A paid placement is never misrepresented as accreditation.

## Controlling priority from AdminOS

1. Open **AdminOS → Residences**. Turn Spotlight **On** for the intended property in the residence list.
2. At the top of the management tab, the **Control your high-visibility blocks** panel shows selected properties.
3. Use Up/Down to set order. Priority #1 gets the large lead card; #2–5 appear alongside it. The order is stored in the existing `residences.spotlight_rank` field, with existing authenticated admin-only update permissions.
4. A property needs `is_visible=true` and a real linked cover/gallery image to occupy a public placement. Nonqualifying entries are flagged in the admin panel.
5. Removing a property from Spotlight disables it and clears its old rank. The next eligible selected residence can move into the top five.

No new public database mutation, storage access, role grants or independent payment billing is introduced in this release. The existing editorial selection is separate from sponsorship contracts.

## Data fidelity

- Only actual Supabase `residences` rows selected by `is_spotlight`, publicly visible and with an image reference can be shown. The homepage uses a lightweight targeted Supabase query; Find My Res uses the already-loaded live discovery results.
- Priority ranks sort ascending, with null ranks after explicit priorities and deterministic name/ID tie-breakers.
- Display rents use `publicPrivateMonthlyRent`. Unknown prices are **not** shown as zero or budget-friendly. Price verification appears only when `hasVerifiedPrivateRent` supports it.
- `accepts_nsfas` signifies provider-reported acceptance; it is not equivalent to independent accreditation. `is_tut_accredited` is only displayed if the existing explicit flag is true.
- Available spots are labelled **reported**, never a guaranteed bed or real-time confirmed reservation. Each CTA opens its actual residence detail URL.
- Existing property application/reservation flows remain unchanged.

## Verification

Run `npm run backend:contracts`, full Vite build, cross-platform web checks, SEO checks, and the public Vercel preview. The added `scripts/premium-residence-visibility.test.mjs` asserts opt-in curation, disclosure, pricing, ordering, CTA routing and search-filter priority. No production flags or order values are modified as part of the code deployment.
