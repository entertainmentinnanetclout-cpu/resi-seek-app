## Goal

Close out the seller program + admin marketplace control gaps and fix the broken admin visibility:

1. Wire the new pages (`SellerOnboarding`, `Referrals`, `MyDiscountCodes`, `AdminSellerApprovals`) into routing and nav.
2. Fix admin not seeing listings (showing 0) and not being able to remove faulty seller products.
3. Add admin "Order on behalf of student" for any product.
4. Make hampers easily addable to the Deals section + make hamper card open a full-detail dialog showing constituent items.
5. Build the missing edge functions: `send-push`, `referral-capture`, `vapid-public-key`.
6. Add the small UX glue (PushPrompt mounted globally, referral code captured from `?ref=` on signup).
7. Idempotent SQL migration for everything new + safety policies.

## 1. Routing & Nav (App.tsx + DashboardLayout)

Add inside `<Routes>`:

```text
/seller-onboarding        StudentRoute -> SellerOnboarding
/referrals                StudentRoute -> Referrals
/my-discount-codes        StudentRoute -> MyDiscountCodes
/admin/seller-approvals   AdminRoute   -> AdminSellerApprovals
```

Add a "Sellers" sub-tab in `AdminCommerceHub` for `AdminSellerApprovals` (currently the "sellers" tab incorrectly mounts `AdminStoresContent`).

Add sidebar links in `DashboardLayout` (student): "Become a Seller", "Referrals", "Discount Codes" (only if user owns a store).

Mount `<PushPrompt />` once in `App.tsx` (next to `<ResBot />`) so every authenticated page can prompt for notifications.

## 2. Fix Admin Listings = 0 and Faulty Product Removal

Root cause check: `AdminStores` counts `marketplace_listings` per `store_id`, but verified seller products live in `products` (per memory: verified stores → `products`, pending → `marketplace_listings`). So admin sees 0 listings even when stores have products.

Changes in `src/pages/admin/AdminStores.tsx`:

- Count BOTH `products` and `marketplace_listings` per store; show as `Products: X · Listings: Y`.
- Add "View Products" action that opens a dialog listing every `products` row for the store with Delete + Toggle Active buttons (admin-only, uses existing `admins_manage_all_products` policy).

Changes in `src/components/admin/StudentListingsModeration.tsx`:

- Add a Delete button (uses existing `Admins can delete marketplace listings` policy).
- Add a "Source" column showing whether the row came from `marketplace_listings` (legacy/unverified) or `products` (verified store).
- Bug: the sellers list uses `.eq("id", listing.user_id)` per row but the parallel fetches don't dedupe — refactor to a single `in()` query for performance, but functionality stays the same.

New `AdminProductsModeration` mini-table inside `AdminMarketplace` "Student Listings" tab so admin can delete `products` rows from any store (currently no UI for that). Reuses `products` table with `admins_manage_all_products`.

## 3. Admin Order-on-Behalf

New component `src/components/admin/AdminPlaceOrderDialog.tsx` opened from the products list. Form: pick student (search profiles by email/full_name), quantity, delivery_address, payment_method (cash/EFT). On submit, insert into `shop_orders` with `user_id = chosen_student_id`, `status = 'pending'`, plus a row in `shop_order_items`. Uses the existing admin RLS `admins_manage_all_*` policies.

Add an "Order on behalf" button next to each product in the new admin products dialog (#2) and in `ResKonnectStoreManager`.

## 4. Hampers — easier admin flow + clickable detail

`src/pages/admin/AdminHamperBundles.tsx`:

- Already lets admin pick catalog items. Add an "Add to Deals" toggle (`is_landing_featured`) and a quick `Switch` in the table row for one-click promotion.
- Add bulk "Add selected items" dropdown so admin can append items to an existing bundle without reopening the editor.

`src/components/MarketplaceCard.tsx`:

- Already pressable. For `type === 'hamper'`, instead of routing to `/product/...`, open a new shared `<HamperDetailDialog>`.

New `src/components/HamperDetailDialog.tsx`:

- Shows hamper image, description, price, full list of `hamper_bundle_items` (item_name × quantity), "Order Now" button (cash on delivery via `hamper_orders`), and a `<ShareButton type="hamper" />`.

`src/pages/Marketplace.tsx`:

- Replace inline hamper render with `MarketplaceCard` using `onClick={() => setSelectedHamper(h)}` and mount the dialog.

## 5. Edge Functions

```text
supabase/functions/vapid-public-key/index.ts   — GET, returns { publicKey: VAPID_PUBLIC_KEY }
supabase/functions/send-push/index.ts          — POST { user_id|user_ids, title, body, url? }
                                                 service-role: looks up push_subscriptions,
                                                 signs VAPID JWT (web-push deno port),
                                                 fans out, prunes 410/404 rows
supabase/functions/referral-capture/index.ts   — POST { code, referred_user_id }
                                                 increments referral_codes.signup_count,
                                                 inserts referral_earnings(source_type='signup', amount=settings.signup_bonus)
```

Register all three in `supabase/config.toml` with `verify_jwt = false` (referral-capture and vapid-public-key are public; send-push validates an admin/service caller in code).

Secrets needed (request via `add_secret` if missing): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (e.g. `mailto:reskonnect@gmail.com`).

Frontend wiring:

- `src/lib/push.ts`: if `VITE_VAPID_PUBLIC_KEY` env is missing, fall back to fetching `vapid-public-key` edge function.
- `src/pages/Auth.tsx`: read `?ref=CODE` from URL on signup, after successful signup call `referral-capture` edge function.

## 6. SQL Migration — `docs/MARKETPLACE_CONTROL_SQL.sql` (idempotent, additive)

```sql
-- platform_settings: signup bonus + commission %
INSERT INTO public.platform_settings(key, value, description)
VALUES ('referral_signup_bonus', '{"amount": 10}'::jsonb, 'Flat ZAR per referred signup'),
       ('referral_sale_percent', '{"percent": 5}'::jsonb, 'Percent of sale paid to referrer')
ON CONFLICT (key) DO NOTHING;

-- shop_order_items table (if missing) so admin can place orders programmatically
CREATE TABLE IF NOT EXISTS public.shop_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  store_id uuid,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.shop_order_items ENABLE ROW LEVEL SECURITY;
-- admins manage; users view their own via order
DO $$ BEGIN CREATE POLICY admins_manage_shop_order_items ON public.shop_order_items FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY users_view_own_shop_order_items ON public.shop_order_items FOR SELECT USING (EXISTS (SELECT 1 FROM shop_orders so WHERE so.id = shop_order_items.order_id AND so.user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ensure product_categories has a 'hampers' slug used by MarketplaceCard deal grouping
INSERT INTO public.product_categories(name, slug, display_order)
VALUES ('Hampers','hampers',99) ON CONFLICT DO NOTHING;

-- referral capture RPC: atomic signup-bonus award
CREATE OR REPLACE FUNCTION public.capture_referral(_code text, _referred uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _ref uuid; _bonus numeric;
BEGIN
  SELECT user_id INTO _ref FROM referral_codes WHERE code = _code AND is_active = true;
  IF _ref IS NULL OR _ref = _referred THEN RETURN; END IF;
  SELECT (value->>'amount')::numeric INTO _bonus FROM platform_settings WHERE key='referral_signup_bonus';
  UPDATE referral_codes SET signup_count = signup_count + 1, total_earned = total_earned + COALESCE(_bonus,0) WHERE user_id = _ref;
  INSERT INTO referral_earnings(referrer_user_id, referred_user_id, source_type, amount)
  VALUES (_ref, _referred, 'signup', COALESCE(_bonus,0));
END $$;
GRANT EXECUTE ON FUNCTION public.capture_referral(text, uuid) TO anon, authenticated;
```

(File also defensively re-asserts `admins_manage_all_products`, `Admins delete marketplace listings`, and `admins_manage_shop_orders` with `DO $$ ... EXCEPTION WHEN duplicate_object` blocks so re-runs never break existing policies.)

## 7. QA Checklist (post-deploy)

1. `/admin/commerce?tab=stores` shows non-zero counts when a store has products.
2. Admin can delete a faulty seller product; it disappears from `/marketplace`.
3. Admin can place an order for a student; order appears in that student's `/orders` and in `/admin/commerce?tab=shop-orders`.
4. Hamper card on `/marketplace?tab=hampers` opens dialog with item list + Order button.
5. Admin can flip a hamper's "Featured in Deals" switch; it appears under the Deals tab.
6. New routes `/seller-onboarding`, `/referrals`, `/my-discount-codes`, `/admin/seller-approvals` load without 404.
7. Push prompt appears for logged-in users; enabling stores a row in `push_subscriptions`; sending a test from `send-push` triggers a browser notification.
8. Signing up with `/auth?ref=CODE` increments `referral_codes.signup_count` for the code owner.

## 8. Files Touched

**New**

- `src/components/HamperDetailDialog.tsx`
- `src/components/admin/AdminPlaceOrderDialog.tsx`
- `src/components/admin/AdminProductsModeration.tsx`
- `supabase/functions/vapid-public-key/index.ts`
- `supabase/functions/send-push/index.ts`
- `supabase/functions/referral-capture/index.ts`
- `docs/MARKETPLACE_CONTROL_SQL.sql`

**Edited**

- `src/App.tsx` (routes + PushPrompt mount)
- `src/components/DashboardLayout.tsx` (sidebar entries)
- `src/pages/Auth.tsx` (capture `?ref=`)
- `src/pages/Marketplace.tsx` (hamper dialog)
- `src/pages/admin/AdminStores.tsx` (product count, products dialog, delete)
- `src/pages/admin/AdminCommerceHub.tsx` (proper Sellers tab → AdminSellerApprovals)
- `src/pages/admin/AdminMarketplace.tsx` (mount AdminProductsModeration)
- `src/components/admin/StudentListingsModeration.tsx` (delete + source column)
- `src/pages/admin/AdminHamperBundles.tsx` (one-click "Add to Deals" switch)
- `src/lib/push.ts` (fallback fetch for VAPID key)
- `supabase/config.toml` (verify_jwt for new functions)

## 9. Action Required From You

1. Run `docs/MARKETPLACE_CONTROL_SQL.sql` in the external Supabase SQL editor.
2. Add secrets if missing: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (a one-time `npx web-push generate-vapid-keys` produces them).
3. Optional: set `VITE_VAPID_PUBLIC_KEY` in env for fastest client startup (otherwise we fetch it from the edge function on first use). set in env