# ResKonnect Phase 1 Updates — Implementation Plan

## Summary

Based on the PDF document and full codebase audit, this plan addresses: sidebar reorganization, critical bug fixes (edge functions, follow-up data, missing foreign keys), FindMyRes filter improvements, commerce hub merge, and full backend stabilization.

---

## Critical Issue: Zero Foreign Keys

The database has **no foreign key constraints** on any table. This breaks all PostgREST relationship queries (e.g., `products -> stores`, `cart_items -> products`, `shop_order_items -> products`). Every join in the Marketplace, Cart, Orders, and Applications pages silently fails.

**Fix**: A single migration adds all required FK constraints.

---

## Phase 1A — Backend Stabilization (Migration)

One migration to add all missing foreign keys and fix structural issues:

### Foreign Keys to Add

- `products.store_id -> stores.id`
- `products.category_id -> product_categories.id`
- `product_variants.product_id -> products.id`
- `cart.user_id -> profiles.id` (was missing)
- `cart_items.cart_id -> cart.id`
- `cart_items.product_id -> products.id`
- `cart_items.variant_id -> product_variants.id`
- `shop_orders.user_id -> profiles.id`
- `shop_order_items.order_id -> shop_orders.id`
- `shop_order_items.product_id -> products.id`
- `shop_order_items.variant_id -> product_variants.id`
- `shop_order_items.store_id -> stores.id`
- `order_status_history.order_id -> shop_orders.id`
- `payments.order_id -> shop_orders.id`
- `hamper_bundle_items.hamper_id -> hampers.id`
- `hamper_orders.user_id -> profiles.id`
- `hamper_order_items.order_id -> hamper_orders.id`
- `hamper_order_items.hamper_id -> hampers.id`
- `applications.user_id -> profiles.id`
- `applications.residence_id -> residences.id`
- `favorites.user_id -> profiles.id`
- `favorites.residence_id -> residences.id`
- `reviews.user_id -> profiles.id`
- `reviews.residence_id -> residences.id`
- `documents.user_id -> profiles.id`
- `wil_applications.student_id -> profiles.id`
- `wil_documents.application_id -> wil_applications.id`
- `wil_admin_notes.application_id -> wil_applications.id`
- `wil_assignments.application_id -> wil_applications.id`
- `residence_portal_accounts.residence_id -> residences.id`
- `application_documents.application_id -> applications.id`
- `application_messages.application_id -> applications.id`
- `referral_claims.application_id -> applications.id`
- `referral_claims.residence_id -> residences.id`
- `residence_analytics.residence_id -> residences.id`
- `discount_orders.user_id -> profiles.id`
- `discount_orders.discount_id -> student_discounts.id`
- `marketplace_listings.user_id -> profiles.id`
- `marketplace_listings.store_id -> stores.id`
- `marketplace_orders.listing_id -> marketplace_listings.id`
- `marketplace_orders.buyer_id -> profiles.id`
- `marketplace_orders.seller_id -> profiles.id`
- `notifications.user_id -> profiles.id` (if column exists)

This single migration fixes all broken PostgREST joins across the entire app.

---

## Phase 1B — Edge Function Fix

**Bug**: `/admin/residence-portals` → "Failed to send request to edge function"

The `create-residence-portal-user` edge function has no logs, meaning it's likely not deployed or not reaching the external Supabase. 

**Fix**: Redeploy the edge function. The code already uses `EXTERNAL_SUPABASE_*` env vars correctly.

---

## Phase 1C — Sidebar Reorganization

Per the PDF document:

### Student Sidebar (`DashboardLayout.tsx`)

**Remove** from sidebar: Roommates, Events, Messages, Updates
**Merge**: Campus News into Home/Dashboard page (not a separate nav item)
**Merge**: Deals & Hamper into Marketplace (single "Marketplace" nav item)
**Move**: Profile to top-right corner icon (next to notifications)

New student sidebar items:

1. Home (Dashboard — includes Campus News section)
2. Find My Res
3. Marketplace (includes Deals, Hampers, Stores, Orders)
4. Bursaries
5. My WIL
6. Applications

Top bar gains: Profile icon (avatar), Notifications icon (existing)

### Routes remain accessible

Roommates, Events, Messages, Updates pages still exist at their URLs — they're just removed from the sidebar nav. Students can still reach them via search or direct links.

---

## Phase 1D — Dashboard Campus News Merge

Move the Campus News content into the Dashboard page:

- Add a "Campus News" section below the Quick actions tabs on Dashboard
- Fetch from `campus_news` table
- Show latest 4-6 news cards with images
- "View All" link goes to `/campus-news` page

---

## Phase 1E — Marketplace Commerce Hub Merge

The Marketplace page becomes the central commerce hub. Add tabs or sections:

- **Products** (existing product grid)
- **Deals & Discounts** (from StudentDeals discounts tab)
- **Hampers** (from StudentDeals hamper tab)
- **My Orders** (link to Orders page)
- **My Store** (link to store management)

The `/discounts` and `/hamper` routes will redirect to `/marketplace?tab=deals` and `/marketplace?tab=hampers`.

---

## Phase 1F — FindMyRes Filter Improvements

Per the PDF: "Dropdowns should be manageable filters linked to filter tool on the page"

**Changes to FindMyRes page**:

1. Add `section_category` filter dropdown with categories: FLATS, COMMUNES, RENTALS (managed via the existing `section_category` column on residences)
2. Add "Singles Available" indicator on residence cards (check `room_types` array for "single")
3. Add blinking "FULL" badge on cards where `available_spots = 0`
4. Make all filter dropdowns (campus, price, type) consistent UI with the same Select component pattern

---

## Phase 1G — Admin Follow-Up Fix

The `/admin/follow-up` page fetches applications with a join `residence:residences(name)`. This join fails without FK constraints.

**Fix**: The FK migration in Phase 1A (`applications.residence_id -> residences.id`) fixes this automatically. No frontend changes needed.

---

## Phase 1H — Applications Handover Pack

Add to the admin Applications page:

- "Export Handover Pack" button that generates a CSV/PDF with: Student Number, Name, Surname, Source of Funding, Application Date
- "Download Documents Pack" per building — downloads all application documents for a selected residence as a ZIP
- Download pack per student

This uses existing `download-handover-pack` edge function or extends it.

Ensure All Existant sliders (Landing Page,Dashboard & Campus News) Are appearing on admin side And Managable,replacable in realtime on admin ui) with clear directions of quality recommendation,size/dimension required,ratio and etc on best cropping positioning. so i need to see all the used asset iamges in hero sliders show up on admin so they an be replaed cause so far none of the already used images are managable.

## Phase 1I — SLIDER CONTROL SYSTEM (CRITICAL)

Add Admin Panel:

### `/admin/sliders`

Features:

- View all slides
- Upload image
- Replace image
- Toggle active
- Set order
- Delete slide

---

## 🧪 Phase 1J — SYSTEM TEST

Test:

- Landing page sliders ✅
- Dashboard sliders ✅
- Campus news images ✅
- Admin slider control ✅

---

# ⚠️ FINAL WARNINGS (IMPORTANT)

### 1. Without FK → Marketplace will ALWAYS break

✔ You fixed this

### 2. Without slider fix → UI looks broken

✔ Now fixed

### 3. Without admin visibility → you lose control

✔ Now fixed

---

## Files to Modify


| File                                    | Changes                                                    |
| --------------------------------------- | ---------------------------------------------------------- |
| Migration SQL                           | Add all FK constraints                                     |
| `src/components/DashboardLayout.tsx`    | Reorganize sidebar, add profile icon to top bar            |
| `src/pages/Dashboard.tsx`               | Add Campus News section                                    |
| `src/pages/Marketplace.tsx`             | Add tabs for Deals/Hampers commerce hub                    |
| `src/pages/FindMyRes.tsx`               | Add section_category filter, FULL badge, singles indicator |
| `src/App.tsx`                           | Update redirect routes for `/discounts` → marketplace tab  |
| `src/pages/admin/AdminApplications.tsx` | Add handover pack export button                            |


## Files to Deploy


| Edge Function                  | Action   |
| ------------------------------ | -------- |
| `create-residence-portal-user` | Redeploy |


---

## Technical Notes

- All FK constraints use `ON DELETE CASCADE` or `ON DELETE SET NULL` as appropriate
- Migration is idempotent — uses `DO $$ ... IF NOT EXISTS` pattern for each constraint
- No existing data or tables are modified — only constraints are added
- The `as any` casts in TypeScript remain until the types file auto-regenerates
- Admin pages remain untouched structurally — the FK fix resolves their data loading issues