## Plan: Restore production UI parity and finish inclusivity rollout

### 1) Force the public UI away from Marketplace
- Remove Marketplace links/cards from public navigation, footer, command palette, dashboard quick actions, and landing sections.
- Keep admin commerce controls available internally, but public shop/product/store routes remain paused.
- Update any Marketplace CTA to accommodation/applications/deals-waitlist language instead of active shopping language.

### 2) Make TVET, University, and Private visible everywhere it matters
- Ensure the big open/close audience buttons appear on Landing and Find My Res.
- Wire the selected audience into residence filtering:
  - University → residences with `accepts_university` or institution tags.
  - TVET / College → residences with `accepts_tvet` or TVET institution tags.
  - Private → residences with `accepts_private`.
  - Press again closes and resets to “all”.
- Add active filter chips so users clearly see and clear TVET/University/Private selections.

### 3) Upgrade Applications Hub for all pathways
- Expand `/apply` into a proper applications gateway for:
  - TUT applications
  - Other universities
  - TVET / college applications
  - NSFAS university funding
  - NSFAS TVET funding
  - Private/general accommodation readiness
- Use database-driven `application_prep` content for deadlines, checklists, CTA links, and required documents so admins can update later without code changes.

### 4) Fix External database content causing the “old UI” effect
- Patch `MASTER_GOD_SQL.sql` so rerunning it:
  - Deactivates old active Marketplace hero slides like “SHOP HAMPER” and “SHOP ESSENTIALS”.
  - Seeds inclusive, non-placeholder slides for TUT, TVET, NSFAS, private accommodation, and document readiness.
  - Keeps `hero_slides` compatible with the existing External schema (`description`, `cta_text`, `cta_link`, `display_order`, `image_url`, `slide_location`).
  - Ensures `residences` has all audience columns and safe defaults.
  - Ensures `application_prep` has rows for all application pathways.
- Add a focused validation query section confirming the External backend has the right active slides, audience columns, and application prep rows.

### 5) Improve slide design level without breaking the database-driven rule
- Adjust `HeroCarousel` rendering so database slides with real existing images look premium: stronger typography, darker readable overlay, better CTA placement, and responsive cropping.
- Remove reliance on low-quality `placehold.co` slide URLs by updating the SQL seed data to use approved/public image assets already available in storage or a neutral premium fallback strategy.

### 6) Verify parity
- Check the preview after changes for:
  - Marketplace no longer visible in public navigation/landing/dashboard.
  - TVET/College and Private buttons visible and toggleable.
  - `/apply` shows all application pathways.
  - Landing slides no longer show active Marketplace campaigns or placeholder-quality application slides.
- Run a code scan for remaining public Marketplace labels and fix only public-facing leftovers.

## Files likely to change
- `src/components/PublicLayout.tsx`
- `src/components/CommandPalette.tsx`
- `src/pages/Landing.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/ApplicationsHub.tsx`
- `src/pages/FindMyRes.tsx`
- `src/components/findmyres/ActiveFilterChips.tsx`
- `src/components/HeroCarousel.tsx`
- `docs/MASTER_GOD_SQL.sql`

## Deliverable
A corrected UI that matches the External backend content, hides Marketplace publicly, visibly supports University/TVET/Private users, and ships one rerunnable SQL pack section for final External validation.