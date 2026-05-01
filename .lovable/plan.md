# Marketplace Polish + Phase 1 Rebuild

## Phase A — Finish In-Flight Work (4 items)

### 1. AdminShopOrders.tsx — EFT Payments tab + dialog

The handlers `handleApproveEft` / `handleRejectEft` and the `<TabsTrigger value="eft">` are already wired. Missing pieces:

- Add `<TabsContent value="eft">` between the "proofs" TabsContent and the closing `</Tabs>` (around line 537), rendering:
  - Loading skeletons when `eftLoading`
  - Empty state card when `eftPayments.length === 0`
  - Table: Reference · Amount · Risk · POP · Status · Age · Action (Eye icon → opens dialog when status is `pending`/`uploaded`)
  - Status badges: `pending` (secondary) · `uploaded` (default "Awaiting Verification") · `confirmed` (default green) · `rejected` (destructive)
- Add the EFT detail `<Dialog open={eftDetailOpen}>` after the existing Proof Detail Dialog with:
  - POP image preview (full-size, click opens new tab)
  - Reference, expected amount, risk_score, fingerprint, expires_at, device_info JSON snippet
  - Admin note textarea (`eftNote`)
  - Approve / Reject buttons calling `handleApproveEft` / `handleRejectEft`

### 2. ProductDetail.tsx — Share button + dynamic OG image

- Import `ShareButton` from `@/components/ShareButton`
- Pass `imageUrl={getOgImageUrl("product", product.id)}` to `<SEO>` (import from `@/lib/share`)
- Place `<ShareButton variant="icon" type="product" id={product.id} title={product.name} text={product.description || ""} />` next to the price/title section so users can share on WhatsApp/Instagram/etc

### 3. Orders.tsx — Clearer EFT status badges + reference inline

- Extend `statusConfig` payment-state derivation: when `order.payment_method === "eft"`, derive a sub-badge from `payment_status`:
  - `awaiting_payment` → "Awaiting Payment" (amber)
  - `awaiting_verification` → "Awaiting Verification" (amber, with spinner-style dot)
  - `paid` → "Payment Confirmed" (green)
  - `rejected` → "Payment Rejected" (destructive)
- Display the EFT reference inline beside the order header (fetched from `eft_payments` joined by `order_id`). Add a small `fetchEftRefs()` call in `fetchOrders` to map `order_id → payment_reference`.
- &nbsp;
  4. Per-category banners/hero carousel admin
    create per ategory banner and carousel on marketplace ui.
    create admin controls.  add on external sql to ensure its connected to backend

---

## Phase B — Marketplace + Seller + Admin Upgrade (Phase 1 of larger rebuild)

The full Parts 1–9 prompt is a multi-week rebuild. To keep each run shippable, this plan covers the **highest-leverage subset** that fixes the critical bugs and lays groundwork. Subsequent phases (campaigns, runners, AI Studio, advanced moderation) will follow in named follow-up plans.

### B1. Fix product routing & ProductCard reuse

- Marketplace.tsx still has an inline `ProductCard` component using `/product/${id}`. Route exists (`/product/:id`) so it should already work — verify by replacing inline `ProductCard` with `<MarketplaceCard type="product" .../>` for full consistency (also fixes the share button missing on landing/marketplace).
- ProductDetail.tsx already calls `navigate("/marketplace")` on missing — keep, but make the loading→not-found flow show a "Product not found" Card with back button instead of redirecting silently.
- Confirm Landing.tsx product cards link to `/product/:id` (read & patch if not).

### B2. Compact responsive grid (5–6 cols on desktop)

Update Marketplace.tsx product grid:

```text
grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3
```

Tighten `MarketplaceCard` padding (`p-2.5`), make image area `aspect-square`, font sizes shrink one step.

### B3. Store branding on every card

Extend `MarketplaceCard` props with `storeName?: string` and `storeLogoUrl?: string`. Render a small logo + name row above the title. Update Marketplace.tsx + Landing.tsx + Store.tsx + ProductDetail "related" section to pass them.

### B4. ProductDetail premium upgrade (light pass)

- Add main image with `object-contain` + zoom-on-click (use a Dialog or simple CSS scale)
- Trust badges row: "Verified Seller", "Student Marketplace", "Campus Delivery", "No Counterfeit"
- Already has thumbnails, store row, variants — keep.

### B5. Vendor store re-edit (`/my-store/edit`)

New page `src/pages/StoreEdit.tsx` mirroring StoreSetup but pre-loading the existing store. Lets vendors:

- Re-upload logo & banner (existing `store-assets` bucket)
- Update name, description, WhatsApp, email, campus
- New optional fields once SQL runs: accent_color, return_policy, delivery_notes, social links, is_open
Add "Edit Store" button to MyStore.tsx header.

### B6. Seller dashboard (MyStore.tsx) upgrade — pass 1

- Add stat cards: Today's Sales, Pending Orders, Low Stock (already partly there)
- Add Branding tab (logo/banner re-upload inline)
- Add Promotions tab (toggle `is_featured` and `is_landing_featured` per product — already in DB)
- Keep existing Products / Orders / Earnings / Reviews tabs

### B7. Admin marketplace control upgrade — pass 1

In AdminCommerceHub:

- Add "Sellers" tab (uses `AdminStores` content, but adds Approve/Reject/Suspend/Verify actions and Founding Seller badge toggle)
- Add "Product Moderation" tab listing all products with `approval_status = pending` and a "Require image reupload" action
- Marketplace Overview stat cards on Commerce Hub landing (GMV, orders, sellers, buyers, pending approvals, flagged products)

### B8. SQL migration (idempotent, additive only)

New file `docs/MARKETPLACE_REBUILD_SQL.sql`:

```sql
-- STORES: branding + status fields
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS accent_color text DEFAULT '#3b82f6';
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS return_policy text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS delivery_notes text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS is_open boolean DEFAULT true;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS is_suspended boolean DEFAULT false;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS founding_seller boolean DEFAULT false;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS stores_slug_unique ON public.stores(slug) WHERE slug IS NOT NULL;

-- PRODUCTS: moderation + AI fields
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'approved';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_quality_status text DEFAULT 'pending';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ai_enhanced boolean DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS moderation_notes text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS discount_percent numeric;

-- SHOP_ORDERS: commission + delivery
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS delivery_fee numeric DEFAULT 0;
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS commission_rate numeric DEFAULT 0.03;
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS commission_amount numeric DEFAULT 0;
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS payout_status text DEFAULT 'pending';
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS assigned_runner_id uuid;

-- CAMPAIGNS table
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  status text DEFAULT 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY admins_manage_campaigns ON public.campaigns FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY anyone_view_active_campaigns ON public.campaigns FOR SELECT USING (status = 'active');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SELLER PAYOUTS
CREATE TABLE IF NOT EXISTS public.seller_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  amount numeric NOT NULL,
  status text DEFAULT 'pending',
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.seller_payouts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY admins_manage_payouts ON public.seller_payouts FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY sellers_view_own_payouts ON public.seller_payouts FOR SELECT USING (seller_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- MARKETPLACE SETTINGS
CREATE TABLE IF NOT EXISTS public.marketplace_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.marketplace_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY admins_manage_marketplace_settings ON public.marketplace_settings FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY anyone_view_marketplace_settings ON public.marketplace_settings FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Storage buckets (additive)
INSERT INTO storage.buckets (id, name, public) VALUES ('store-banners','store-banners',true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('campaign-assets','campaign-assets',true) ON CONFLICT (id) DO UPDATE SET public = true;

DO $$ BEGIN CREATE POLICY anyone_view_store_banners ON storage.objects FOR SELECT USING (bucket_id = 'store-banners');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY users_upload_own_store_banners ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'store-banners' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

NOTIFY pgrst, 'reload schema';
```

User runs this manually in external Supabase SQL editor (mefjzkhobkltlbmhusdh) — does not break existing data, all `IF NOT EXISTS`/`ON CONFLICT`/`DO $$` blocks.

## What's NOT in this plan (saved for future requests)

These items from the Master Prompt are real but too large for one execution loop:

- Image zoom lightbox (basic zoom only this pass)
- Buy & Win campaign UI
- First 100 Sellers program UI
- Runner assignment/dispatch system
- AI Studio image enhancement pipeline
- Counterfeit reporting flow
  &nbsp;
- Store theme color preview/publish flow

After Phase A+B ships and you confirm it works, ask for "Phase 2" and I'll build them.

## Files Modified / Created


| File                                   | Action                                            |
| -------------------------------------- | ------------------------------------------------- |
| `src/pages/admin/AdminShopOrders.tsx`  | Add EFT TabsContent + dialog                      |
| `src/pages/ProductDetail.tsx`          | ShareButton + dynamic OG image                    |
| `src/pages/Orders.tsx`                 | EFT status badges + reference inline              |
| `src/pages/Marketplace.tsx`            | Replace inline ProductCard, tighter grid          |
| `src/components/MarketplaceCard.tsx`   | storeName + storeLogoUrl props, compact mode      |
| `src/pages/StoreEdit.tsx`              | **Create** — vendor re-edit page                  |
| `src/pages/MyStore.tsx`                | "Edit Store" button + Branding tab                |
| `src/App.tsx`                          | Add `/my-store/edit` route                        |
| `src/pages/admin/AdminCommerceHub.tsx` | Add "Sellers" + "Product Moderation" tabs         |
| `src/pages/admin/AdminStores.tsx`      | Add Approve/Suspend/Verify/Founding-badge actions |
| `docs/MARKETPLACE_REBUILD_SQL.sql`     | **Create** — idempotent SQL above                 |


## Action Required From You

1. Approve this plan to start implementation.
2. After deploy, run `docs/MARKETPLACE_REBUILD_SQL.sql` in your external Supabase SQL editor.
3. Test: list a hamper bundle, share a product to WhatsApp, approve an EFT payment, edit your store logo.