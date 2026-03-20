# ResKonnect Phase 1 — Master Fix + UX + Admin Control

## Summary

This plan addresses 5 areas: FK migration for broken joins, FindMyRes UX matching the reference image, Marketplace commerce hub polish, Admin handover pack export, and Admin slider visibility fix. The sidebar and routing are already correctly updated from prior work.

---

## Current State Assessment

**Already Done (no changes needed):**

- Sidebar is already slimmed to 6 items (Home, Find My Res, Marketplace, Bursaries, My WIL, Applications)
- Profile avatar already in top-right header
- Marketplace already has Products/Deals/Hampers tabs
- Admin Slides page exists with CRUD, image guidelines, and live preview
- Dashboard already has Campus News section
- FindMyRes already has section_category filter, FULL badge (animate-pulse), and Singles Available badge
- Routes for /cart, /checkout, /product/:id already exist

**Still Broken / Missing:**

1. Zero FK constraints in database — all PostgREST joins fail silently
2. FindMyRes sections don't match reference image (FLATS/COMMUNES/RENTALS headers with collapsible groups)
3. No "Export Handover Pack" button in AdminApplications
4. Admin Slides doesn't show Dashboard slides separately (only hero_slides table)
5. No first-visit CTA modal or floating action bar on FindMyRes

---

## Phase 1: Database FK Migration

Single idempotent migration adding ~40 foreign key constraints. Each wrapped in `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`

Key constraints:

- `products.store_id -> stores.id`
- `applications.user_id -> profiles.id`
- `applications.residence_id -> residences.id`
- `cart.user_id -> profiles.id`
- `cart_items.cart_id -> cart.id`, `cart_items.product_id -> products.id`
- `shop_orders.user_id -> profiles.id`
- `shop_order_items.order_id -> shop_orders.id`
- `wil_applications.student_id -> profiles.id`
- `wil_documents.application_id -> wil_applications.id`
- `favorites.user_id -> profiles.id`, `favorites.residence_id -> residences.id`
- `reviews.user_id -> profiles.id`, `reviews.residence_id -> residences.id`
- `hamper_bundle_items.hamper_id -> hampers.id`
- `hamper_orders.user_id -> profiles.id`
- `discount_orders.user_id -> profiles.id`, `discount_orders.discount_id -> student_discounts.id`
- All remaining from the plan document

This fixes: Admin Follow-Up, Marketplace product->store joins, Orders, Applications with residence names.

---

## Phase 2: FindMyRes UX Overhaul

Redesign the `TrustedResidencesGrid` and section display to match the reference image:

### Section Headers

Group trusted residences into collapsible sections with colored header bars:

- **FLATS - PRETORIA WEST, CBD, ETC** (blue header, red collapse arrow)
- **COMMUNES - PRETORIA WEST, ETC** (blue header)
- **RENTALS - SUNNYSIDE, SOSHA, E1** (blue header)

Each section shows a horizontal scrollable row of residence cards (matching the image layout).

### Card Updates

- Show campus badge (e.g., "Pretoria (Main Campus)")
- Show spots left badge (e.g., "100 spots left" in orange)
- Show "Trusted Partner" or "Premium" or "Verified" badge overlay
- Show ranking number (#1, #2, #3) on top cards
- Blinking red FULL badge when `available_spots === 0`
- Green "Singles Available" badge when `room_types` includes "single"

### First-Visit CTA Modal

- Check `localStorage` for `reskonnect_visited` flag
- If not set, show a modal: "Start Your Journey" with CTA to create account
- Set flag after dismissal

### Floating Action Bar

- Sticky bottom bar on mobile with "Apply Now" and "WhatsApp Us" buttons
- Only shows when scrolled past the hero section

### Filter Synchronization

All dropdowns (Category FLATS/COMMUNES/RENTALS, Campus, Price, Distance, Room Type) use the same shared filter state — already implemented, just ensure section headers also respond to the category filter.

---

## Phase 3: Admin Handover Pack Export

Add to `AdminApplications.tsx`:

### "Export Handover Pack" Button

- Positioned next to the search bar in the header
- Generates CSV with columns: Student Number, Full Name, Surname, Email, Phone, Funding Type, Residence Applied, Application Date, Status
- Uses the existing `downloadEnhancedCSV` pattern from `exportHelpers.ts`
- Filters by current status filter selection

### "Download Documents" per Student

- In the application detail dialog, add a "Download All Documents" button
- Creates signed URLs for each document in the `documents` table for that user
- Opens each in a new tab (ZIP not feasible client-side without library)

---

## Phase 4: Admin Slides — Show All Existing Images

The current AdminSlides page only manages `hero_slides` table entries. The issue is that images hardcoded in components (Dashboard hero, Campus News) don't appear in admin.

### Fix

- The Dashboard `HeroCarousel` already reads from `hero_slides` table — these ARE manageable, ensure the ones appearing on student side also appear on admin
- Add info text in AdminSlides clarifying: "These slides appear on the Landing Page and Student Dashboard"
- No structural change needed — the slides ARE already database-driven and editable

### Campus News Images

- Campus News images are managed via `/admin/news` page (existing)
- Add a note in AdminSlides linking to the News management page for Campus News images

---

## Files to Modify


| File                                       | Changes                                                                            |
| ------------------------------------------ | ---------------------------------------------------------------------------------- |
| Migration SQL                              | Add ~40 FK constraints                                                             |
| `src/components/TrustedResidencesGrid.tsx` | Redesign with FLATS/COMMUNES/RENTALS collapsible sections matching reference image |
| `src/pages/FindMyRes.tsx`                  | Add first-visit modal, floating action bar, enhanced card badges                   |
| `src/pages/admin/AdminApplications.tsx`    | Add "Export Handover Pack" button using exportHelpers                              |
| `src/pages/admin/AdminSlides.tsx`          | Add clarifying notes about where slides appear + link to News admin                |


## Files Unchanged

- `DashboardLayout.tsx` — already correct
- `Marketplace.tsx` — already has tabs
- `App.tsx` — routes already set up
- `Dashboard.tsx` — already has campus news

---

## Technical Notes

- FK constraints use `ON DELETE CASCADE` for user-owned data, `ON DELETE SET NULL` for optional references
- Migration is fully idempotent with exception handling
- No table structure changes — only adding constraints
- FindMyRes section grouping uses existing `section_category` column on residences table
- Export uses client-side CSV generation (no edge function needed)