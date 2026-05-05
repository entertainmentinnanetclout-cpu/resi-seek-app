# Unified Commerce + Affiliate Program Plan

## 1. VAPID Secrets (Web Push)

Add three secrets to backend so `send-push` can sign notifications:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (e.g. `mailto:reskonnect@gmail.com`)

Will request via `add_secret` once plan approved. Generate with `npx web-push generate-vapid-keys`. Also expose `VAPID_PUBLIC_KEY` to client via existing `vapid-public-key` edge function so no rebuild is needed when keys rotate.

## 2. Unified Purchase Flow (Products + Hampers + Hamper Items + Deals)

Currently products go through `Cart → Checkout → EFT/Yoco`. Hampers use a one-shot order. Deals reuse products. The 14 standalone hamper-catalog items (`hamper_items` table) have no order path at all.

Make every saleable thing flow through the same pipeline:

```text
Card click → Detail Dialog → "Add to Cart" → /cart → /checkout → Payment screen w/ countdown → /orders/:id
```

### 2a. Cart model extension

Extend `cart_items` to support multiple sources via a discriminator:

```sql
ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'product',
  ADD COLUMN IF NOT EXISTS hamper_id uuid,
  ADD COLUMN IF NOT EXISTS hamper_item_id uuid,
  ADD COLUMN IF NOT EXISTS unit_price numeric,
  ADD COLUMN IF NOT EXISTS title_snapshot text,
  ADD COLUMN IF NOT EXISTS image_snapshot text;
ALTER TABLE cart_items ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE cart_items ADD CONSTRAINT cart_item_source_chk CHECK (
  (item_type='product' AND product_id IS NOT NULL) OR
  (item_type='hamper'  AND hamper_id  IS NOT NULL) OR
  (item_type='hamper_item' AND hamper_item_id IS NOT NULL)
);
```

`useCart` hook gets `addHamper(hamper)` and `addHamperItem(item)` helpers in addition to current `addProduct`.

### 2b. Hamper item ordering

`hamper_items` (the 14 catalog items) become single-orderable. Add `is_orderable boolean DEFAULT true` and `price` is already there. Build a new `/marketplace?tab=hamper-items` grid using `MarketplaceCard` with type `hamper_item`. Each card opens a detail dialog with quantity + Add to Cart.

### 2c. Hamper detail dialog

Replace current "Order Now" cash-only button with "Add to Cart" routing through the unified flow. Keep the items list display.

### 2d. Persistent payment screen with countdown

Existing EFT system already has `expires_at`. Move payment UI into a dedicated route `/orders/:id/pay` that:

- Reads order + EFT row from DB on mount (so closing/reopening works).
- Shows live countdown to `expires_at`.
- Lets user upload PoP, switch to Yoco, or cancel.
- If expired, shows "Generate new payment reference" action.

Link from `/orders` row: any order with `payment_status in ('pending','awaiting_payment')` shows a "Resume payment" button → `/orders/:id/pay`.

## 3. Delivery Configuration

### 3a. Admin delivery rules

New table:

```sql
CREATE TABLE delivery_zones (
  id uuid PK,
  name text,                -- "TUT Soshanguve", "Pretoria CBD", "National courier"
  base_fee numeric,
  per_km_fee numeric DEFAULT 0,
  free_threshold numeric,   -- order total above which delivery is free
  conditions text,          -- free-text shown to student
  is_active boolean DEFAULT true,
  display_order int
);
```

Admin UI: new tab in Commerce Hub → "Delivery Zones" with CRUD. Populate with TUT campus drop-offs and listed residences seed.

### 3b. Checkout delivery step

Insert a "Delivery" step between Cart and Payment in `Checkout.tsx`:

- Radio list of active `delivery_zones` with fee, free-threshold note, and conditions text.
- Selected zone fee added to order total; persisted on `shop_orders` as `delivery_zone_id`, `delivery_fee`.

Same step appears for hamper / hamper-item orders since they share the flow. and upgrade cart button/icon to hover on when users are adding things to cart so they can easily access art without having to close the page and go to cart.

all items and products Added must have product display cards when tapping them

## 4. Admin Product Ordering

Add `display_order int DEFAULT 0` to `products`, `hampers`, `hamper_items`. Admin pages get drag-handle reorder (using `@dnd-kit` already in project) + numeric input fallback. Public listings sort by `display_order ASC, created_at DESC`. Affects:

- `Marketplace.tsx` product grid
- Hampers tab
- Landing "Featured" rows

## 5. Affiliate / Referral Program

### 5a. Public affiliate landing page

New route `/affiliates` (PUBLIC) — explains program, signup bonus, sale %, FAQ, CTA "Join & get your link". Footer of `PublicLayout` gets an "Affiliates" link.

### 5b. Per-product affiliate links

`Referrals.tsx` gets a "Product links" tab that lets a referrer paste/select any product, generating `https://reskonnect.lovable.app/product/<id>?ref=<CODE>`. `ProductDetail.tsx` reads `?ref=` and stores it in `localStorage('pending_ref')`. On checkout completion, server-side `capture_referral_sale` RPC awards the configured percent to the referrer.

```sql
CREATE OR REPLACE FUNCTION capture_referral_sale(_order_id uuid)
RETURNS void ... -- looks up order.user_id's pending referral; reads referral_sale_percent from platform_settings; inserts referral_earnings(source_type='sale', amount=...)
```

Trigger: call this RPC from `Checkout` success handler / Yoco webhook / EFT confirmation.

### 5c. Earnings dashboard upgrades

`Referrals.tsx` already shows code + earnings. Add:

- Signup bonus credits card (count × bonus).
- Ledger table with columns: date, type (signup/sale), referred user (masked), order ref, amount, status.
- Per-product link generator as above.
- "Copy" + native share for each link.

## 6. Student Orders Page

`Orders.tsx` already exists for shop orders. Expand to a unified view:

- Tabs: All / Products / Hampers / Hamper Items / Deals.
- Each row shows: order_number, items summary, status badge, total, created_at, "Resume payment" if pending, "View details" → `/orders/:id`.
- New `/orders/:id` detail page: items, delivery zone, status timeline (from `order_status_history`), payment info, support button.
- Realtime subscription to `shop_orders` + `order_status_history` so status updates push live.

## 7. Files Touched

**New**

- `src/pages/Affiliates.tsx` (public marketing page)
- `src/pages/OrderPayment.tsx` (`/orders/:id/pay`)
- `src/pages/OrderDetail.tsx` (`/orders/:id`)
- `src/components/CheckoutDeliveryStep.tsx`
- `src/components/admin/AdminDeliveryZones.tsx`
- `src/components/admin/ProductReorderTable.tsx`
- `docs/UNIFIED_COMMERCE_SQL.sql` (idempotent migration)

**Edited**

- `src/App.tsx` (new routes)
- `src/components/PublicLayout.tsx` (footer Affiliates link)
- `src/hooks/useCart.ts` (hamper + hamper_item support)
- `src/pages/Marketplace.tsx` (hamper-items tab, reorder-aware)
- `src/components/HamperDetailDialog.tsx` (Add to Cart)
- `src/components/MarketplaceCard.tsx` (display_order, hamper_item type)
- `src/pages/Cart.tsx` + `src/pages/Checkout.tsx` (delivery step, multi-source)
- `src/pages/Orders.tsx` (unified tabs, resume-payment)
- `src/pages/ProductDetail.tsx` (capture `?ref=`)
- `src/pages/Referrals.tsx` (ledger, product links, signup credits)
- `src/pages/admin/AdminCommerceHub.tsx` (Delivery Zones tab)
- `src/pages/admin/AdminMarketplace.tsx`, `AdminHamperBundles.tsx`, `AdminHamperItems.tsx` (drag reorder)

## 8. SQL Migration (idempotent — `docs/UNIFIED_COMMERCE_SQL.sql`)

- `cart_items` source-discriminator columns + check constraint
- `delivery_zones` table + RLS (admins manage, anyone views active) + seed rows
- `shop_orders` add `delivery_zone_id`, `delivery_fee`
- `products`/`hampers`/`hamper_items` add `display_order`
- `hamper_items` add `is_orderable`, ensure `price` not null with default
- `capture_referral_sale(order_id)` RPC
- Indexes on `display_order`, `cart_items.item_type`

## 9. Action Required

1. Approve this plan.
2. Provide three VAPID values when prompted (or let me generate).
3. After deploy: run the SQL file, then admins set delivery zones + product order in `/admin/commerce`.

## 10. QA Checklist

- Add a hamper, a hamper-item, and a product to cart together → single checkout works.
- Close the payment tab → reopen via `/orders` → "Resume payment" loads countdown intact.
- Admin reorders products → public Marketplace reflects new order.
- `/affiliates` loads without auth; "Join" CTA goes to `/auth?returnTo=/referrals`.
- Visit a product with `?ref=CODE`, complete purchase → ledger row appears for referrer with `source_type=sale`.
- Push notification fires after VAPID secrets are added.