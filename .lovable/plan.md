

# Hampers Visibility, Image Uploads, Social Sharing & EFT Polish

## Overview

Five connected fixes:

1. **Hampers don't show because of two-table confusion** — `hamper_items` (admin manages) feeds the preference/swipe system, while the marketplace reads from `hampers` (buyable bundles). Items added in Admin → Hamper Items never reach the marketplace. We unify the admin flow so a hamper item can also be published as a buyable hamper.
2. **Hamper image uploads** — replace URL-only field with native file upload to existing `hamper-images` bucket (and same upgrade for `bursaries`, `campus_news`, `events` admin forms which all suffer the same problem).
3. **Marketplace UI redesign** — promote Hampers and Deals to equal billing with Products via a new "Discover" hero strip + tab redesign with iconography, counts, and a featured carousel per tab.
4. **Universal Social Share Cards** — every product, hamper, deal, residence and bursary becomes shareable with a rich WhatsApp/Facebook preview using a server-rendered OG card edge function.
5. **EFT end-to-end polish** — verify POP upload writes to both `eft_payments.pop_image_url` AND `shop_orders.pop_url`, ensure admin sees POP inline with one-click approve/reject in a dedicated "EFT Payments" sub-tab.

## 1. Hamper System Unification

**Root cause**: Admin "Hamper Items" writes to `hamper_items` (used for the student preference picker). Marketplace reads `hampers` (curated bundles). Anything added in admin appears nowhere on the storefront.

**Fix**:
- Rename admin tab `Hamper Items` → `Hamper Catalog`. Keep existing CRUD for preference items.
- Add a new tab `Hamper Bundles` in the Commerce Hub that performs CRUD on the `hampers` table (name, description, price, stock, image, category, is_active).
- Each bundle can attach `hamper_bundle_items` (existing link table) — multi-select from `hamper_items`.
- Marketplace hampers tab gets **Add to Cart** button (creates a `hamper_orders` row directly) and **Share** button.

## 2. Image Uploads (no more URL-only)

Replace the URL `<Input>` with a dual-mode component `<ImageInput>`:
- Drop-zone uploader → uploads to the right Supabase bucket → autofills the URL.
- Manual URL paste still supported as fallback.
- Shows live preview thumbnail.

Apply to:
- `AdminHamperItems` and the new `AdminHamperBundles` form → bucket `hamper-images`
- `AdminBursaries` → bucket `admin-images`
- `AdminNews` → bucket `admin-images`
- `AdminEvents` → bucket `admin-images`
- `AdminSlides` → bucket `admin-images` (already partly there, harmonise)

## 3. Marketplace UI Redesign

Replace the small tab bar with:

```text
┌─────────────────────────────────────────────────────────┐
│  MARKETPLACE  — Shop. Save. Care.                       │
│  [Search bar] [Cart] [My Store] [My Orders]             │
├─────────────────────────────────────────────────────────┤
│  ┌──Products──┐ ┌──Deals──┐ ┌──Hampers──┐ ┌──New──┐    │
│  │   3,200    │ │   42    │ │    18     │ │  120  │    │
│  │  items     │ │  active │ │  bundles  │ │  this │    │
│  │            │ │         │ │           │ │  week │    │
│  └────────────┘ └─────────┘ └───────────┘ └───────┘    │
├─────────────────────────────────────────────────────────┤
│  Featured carousel (rotates Products/Deals/Hampers)     │
├─────────────────────────────────────────────────────────┤
│  Tabs: [Products] [Deals] [Hampers]  ← equal weight     │
│  Per-tab: category chips, sort, grid, share/cart        │
└─────────────────────────────────────────────────────────┘
```

Every card (product, deal, hamper) gets a unified `MarketplaceCard` component with: image, title, price, badge, **Cart** button, **Share** button (icon variant).

## 4. Universal Social Share Cards

**Goal**: When a student copies a product link to WhatsApp, the recipient sees a rich preview card with the product image, name, price and ResKonnect branding.

**Implementation**:
- New edge function `og-image` (`supabase/functions/og-image/index.ts`) that takes `?type=product&id=…` and returns a 1200×630 PNG via SVG-to-PNG (`@vercel/og`-equivalent, using `Deno` + `resvg`). Pulls live data from DB.
- `SEO.tsx` already accepts `imageUrl` — pass `https://<project>.supabase.co/functions/v1/og-image?type=product&id=…` from each detail page.
- New helper `getShareUrl(type, id)` returns canonical URL with UTM params.
- `ShareButton` already supports WhatsApp/Facebook/Copy — extend with **Instagram Stories** (downloads card image) and **TikTok** (copies link + opens app).
- Add `<ShareButton variant="icon">` to every `MarketplaceCard`, `ProductDetail`, `Hampers` card, `BursaryCard`, `ResidenceCard`.

`og-image` edge function deploys with `verify_jwt = false` so social crawlers can fetch it.

## 5. EFT End-to-End Polish

Status today (verified):
- ✅ Checkout creates `eft_payments` row with reference, amount, expiry, fingerprint
- ✅ User uploads POP → writes `eft_payments.pop_image_url` + `pop_file_hash` + sets order to `awaiting_verification`
- ❌ **Bug**: POP not also mirrored to `shop_orders.pop_url` (column exists from previous migration but is unused)
- ❌ Admin "EFT Payments" tab missing in `AdminShopOrders` — only legacy "Payment Proofs" tab present
- ❌ No way for admin to approve EFT and auto-flip order status from "awaiting_verification" → "confirmed"

**Fixes**:
- On POP upload: also `update shop_orders set pop_url = …, pop_uploaded_at = now()`
- Add new sub-tab **"EFT Payments"** in `AdminShopOrders.tsx` listing all `eft_payments` joined with order data. Columns: reference, amount, status, risk score, POP preview, age. Actions:
  - **Approve** → updates `eft_payments.status='confirmed'`, `shop_orders.status='confirmed'`, `shop_orders.payment_status='paid'`, inserts `payment_action_logs` + `order_status_history` + `notifications` row for student
  - **Reject** → sets `eft_payments.status='rejected'`, `shop_orders.status='rejected'`, with admin note
  - **View POP** → fullscreen image dialog
- Status badge in student `Orders.tsx` shows `Awaiting Verification`, `Payment Confirmed`, `Payment Rejected` clearly with the EFT reference inline.

## 6. Required External Supabase SQL

New file `docs/HAMPER_AND_EFT_SQL.sql` (idempotent, run in external Supabase SQL editor):

```sql
-- 1. Hampers: ensure all needed columns exist
ALTER TABLE public.hampers ADD COLUMN IF NOT EXISTS short_description text;
ALTER TABLE public.hampers ADD COLUMN IF NOT EXISTS is_landing_featured boolean DEFAULT false;

-- 2. hamper_bundle_items: link to hamper_items catalog (optional FK)
ALTER TABLE public.hamper_bundle_items
  ADD COLUMN IF NOT EXISTS hamper_item_id uuid REFERENCES public.hamper_items(id) ON DELETE SET NULL;

-- 3. shop_orders: confirm pop columns exist (re-runnable)
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS pop_url text;
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS pop_uploaded_at timestamptz;

-- 4. eft_payments: add seller-friendly indexes + FK
ALTER TABLE public.eft_payments
  ADD CONSTRAINT eft_payments_order_fkey
  FOREIGN KEY (order_id) REFERENCES public.shop_orders(id) ON DELETE CASCADE
  NOT VALID;
-- (NOT VALID skips re-checking existing rows — safe re-run)

CREATE INDEX IF NOT EXISTS idx_eft_payments_status_created ON public.eft_payments(status, created_at DESC);

-- 5. Storage bucket policy: ensure hamper-images is fully readable
INSERT INTO storage.buckets (id, name, public) VALUES ('hamper-images','hamper-images',true)
  ON CONFLICT (id) DO UPDATE SET public = true;

DO $$ BEGIN
  CREATE POLICY "admin_upload_hamper_images" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'hamper-images' AND has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anyone_view_hamper_images" ON storage.objects FOR SELECT
    USING (bucket_id = 'hamper-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. hamper_orders: ensure cart-style flow works
ALTER TABLE public.hamper_orders ADD COLUMN IF NOT EXISTS pop_url text;
ALTER TABLE public.hamper_orders ADD COLUMN IF NOT EXISTS pop_uploaded_at timestamptz;

NOTIFY pgrst, 'reload schema';
```

## 7. Files Modified / Created

| File | Action |
|---|---|
| `docs/HAMPER_AND_EFT_SQL.sql` | **Create** — idempotent SQL above |
| `supabase/functions/og-image/index.ts` | **Create** — dynamic OG card generator |
| `supabase/config.toml` | Add `[functions.og-image] verify_jwt = false` |
| `src/components/ImageInput.tsx` | **Create** — drop-zone + URL fallback |
| `src/components/MarketplaceCard.tsx` | **Create** — unified card w/ share + cart |
| `src/components/ShareButton.tsx` | Extend with Instagram + TikTok + dynamic OG image |
| `src/lib/share.ts` | **Create** — `getShareUrl(type, id)` helper |
| `src/pages/Marketplace.tsx` | Redesign hero, stat cards, unified MarketplaceCard, hamper Add-to-Cart + Share |
| `src/pages/admin/AdminHamperItems.tsx` | Rename to "Hamper Catalog", swap URL field for `<ImageInput>` |
| `src/pages/admin/AdminHamperBundles.tsx` | **Create** — CRUD on `hampers` + bundle items |
| `src/pages/admin/AdminCommerceHub.tsx` | Add "Hamper Bundles" tab |
| `src/pages/admin/AdminBursaries.tsx` | Use `<ImageInput>` |
| `src/pages/admin/AdminNews.tsx` | Use `<ImageInput>` |
| `src/pages/admin/AdminEvents.tsx` | Use `<ImageInput>` |
| `src/pages/admin/AdminShopOrders.tsx` | **Add "EFT Payments" tab** with approve/reject + POP viewer |
| `src/pages/Checkout.tsx` | Mirror POP to `shop_orders.pop_url` on upload |
| `src/pages/Orders.tsx` | Show EFT reference + clearer status badges |
| `src/pages/ProductDetail.tsx` | Add `<ShareButton>` + dynamic `og:image` |

## 8. Action Required From You

1. Run `docs/HAMPER_AND_EFT_SQL.sql` in the **external Supabase** SQL editor (mefjzkhobkltlbmhusdh).
2. Confirm bank details are filled in **Admin → Settings → EFT Banking Details** (already built).
3. After deploy, list one test bundle in **Admin → Commerce Hub → Hamper Bundles** to verify it now appears in the marketplace Hampers tab.

