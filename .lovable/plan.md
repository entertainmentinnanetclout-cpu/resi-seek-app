# System Stabilization: Payments + Seller Activation + Commission Engine

## Critical Bugs Found

1. **Checkout.tsx line 102** calls `supabase.functions.invoke('quick-service')` — this function does not exist. Must call `yoco-checkout` directly via fetch (edge functions on external Supabase need direct HTTP calls, not `supabase.functions.invoke`).
2. `**shop_orders` table** is missing `yoco_checkout_id` column — the verify function cannot look up checkout status.
3. `**products` table** is missing `payment_type` and `checkout_url` columns — this is the root cause of the persistent "Failed to save product" error (PGRST204).
4. **No commission/earnings tables** exist yet.

## Architecture Decision: No Separate `sellers` Table

The existing `stores` table already has `user_id`, `is_active`, `verified`, and all store metadata. Creating a separate `sellers` table would violate the "no duplication" rule. Instead, the `stores` table IS the seller entity. A user with a store IS a seller.

## Plan

### 1. External SQL — `docs/SELLER_COMMISSION_SQL.sql`

Single idempotent script:

```sql
-- Fix products columns (PGRST204 fix)
ALTER TABLE products ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'standard';
ALTER TABLE products ADD COLUMN IF NOT EXISTS checkout_url text;

-- Fix shop_orders (Yoco tracking)
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS yoco_checkout_id text;

-- Seller earnings (per-order breakdown)
CREATE TABLE IF NOT EXISTS seller_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  order_id uuid NOT NULL UNIQUE,
  gross_amount numeric(10,2) NOT NULL,
  platform_fee numeric(10,2) DEFAULT 0,
  fee_percentage numeric(5,2) DEFAULT 0,
  net_amount numeric(10,2) NOT NULL,
  status text DEFAULT 'available',
  created_at timestamptz DEFAULT now()
);

-- Platform revenue log
CREATE TABLE IF NOT EXISTS platform_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  store_id uuid NOT NULL,
  gross_amount numeric(10,2),
  platform_fee numeric(10,2),
  created_at timestamptz DEFAULT now()
);

-- Payment proofs (fallback for failed verification)
CREATE TABLE IF NOT EXISTS payment_proofs (...);

-- Stores: add custom fee override
ALTER TABLE stores ADD COLUMN IF NOT EXISTS custom_fee_percentage numeric(5,2);

-- RLS policies for all new tables
-- Indexes for performance
```

### 2. Fix Yoco Checkout Call — `Checkout.tsx`

Replace `supabase.functions.invoke('quick-service', ...)` with a direct fetch to the `yoco-checkout` edge function on the **Lovable Cloud** Supabase (where edge functions are deployed):

```typescript
const res = await fetch(
  `https://${projectId}.supabase.co/functions/v1/yoco-checkout`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({
      order_id: order.id,
      success_url: `${window.location.origin}/orders?payment=success&order_id=${order.id}`,
      cancel_url: `${window.location.origin}/checkout?payment=cancelled`,
    }),
  }
);
```

### 3. Fix Edge Functions — Use External Supabase

Both `yoco-checkout` and `yoco-verify-payment` currently use `EXTERNAL_SUPABASE_URL` for DB access, which is correct. But they also need to use the external anon key for user auth verification. Review and ensure both functions:

- Create service-role client with external URL + service role key
- Create user client with external URL + external anon key + auth header
- Include payment polling with retry (max 30s, 3s intervals) in verify function

### 4. Orders.tsx — Add Payment Polling

When returning from Yoco with `?payment=success`, poll the verify endpoint up to 10 times (every 3 seconds) before showing the PoP fallback. Current code only calls once.

### 5. Seller Dashboard Upgrades — `MyStore.tsx`

Add new tabs:

- **Earnings** tab: Show per-order breakdown (gross, fee, net), summary cards (total earnings, fees paid, revenue)
- **Store Settings** tab: Edit store info, see custom fee percentage

### 6. Admin Commerce Hub — New Tabs

**Seller Earnings tab** (in Commerce Hub):

- View all seller earnings
- Set global default fee percentage (in `platform_settings`)
- Override per-store custom fee
- Platform revenue summary cards

**Payment Proofs tab** (in Shop Orders):

- Review pending PoP submissions
- Approve/reject with note

### 7. Commission Engine — In `yoco-verify-payment`

After confirming payment, calculate and insert earnings:

```text
fee% = store.custom_fee_percentage ?? platform_settings.default_fee_percentage ?? 10
platformFee = gross * fee% / 100
net = gross - platformFee
→ INSERT into seller_earnings + platform_revenue
```

### 8. Store Front Fix — `Store.tsx`

Currently shows `marketplace_listings` for a store. Also show `products` linked to the store for the official catalog view.

## Files


| File                                              | Action                                                         |
| ------------------------------------------------- | -------------------------------------------------------------- |
| `docs/SELLER_COMMISSION_SQL.sql`                  | Create: complete SQL for all missing tables/columns            |
| `src/pages/Checkout.tsx`                          | Fix: replace `quick-service` with direct `yoco-checkout` fetch |
| `src/pages/Orders.tsx`                            | Update: add payment polling (retry logic)                      |
| `supabase/functions/yoco-checkout/index.ts`       | Review/fix: ensure correct external DB usage                   |
| `supabase/functions/yoco-verify-payment/index.ts` | Update: add commission calculation after payment confirmation  |
| `src/pages/MyStore.tsx`                           | Update: add Earnings tab with breakdown                        |
| `src/pages/admin/AdminShopOrders.tsx`             | Update: add Payment Proofs review tab                          |
| `src/pages/admin/AdminCommerceHub.tsx`            | Update: add Seller Earnings tab                                |
| `src/pages/admin/AdminSellerEarnings.tsx`         | Create: earnings management + fee controls                     |


## Payment Flow After Fix

```text
Checkout → creates order in shop_orders
  → COD: redirect to /orders (done)
  → Yoco: fetch yoco-checkout → get redirectUrl → redirect to Yoco
    → User pays → Yoco redirects to /orders?payment=success&order_id=X
    → Orders page polls yoco-verify-payment (up to 30s)
      → Verified: order confirmed, earnings calculated, toast
      → Not verified after 30s: show PoP upload form
        → User uploads proof → admin reviews → approves → order confirmed
```

## Seller Activation Flow

```text
Student → /store-setup → creates store (is_active=true, verified=false)
  → Admin sees in Stores tab → toggles verified=true
  → Store appears in marketplace with verified badge
  → Seller manages listings in /my-store
  → Orders come in → earnings tracked with commission split
```

No separate `sellers` table needed — the `stores` table already serves this purpose.

## Technical Notes

- The `quick-service` function does NOT exist — this is why Yoco payments have never worked
- Edge functions are deployed on Lovable Cloud (vmqqkebojldjsyxcewdb) but query external Supabase (mefjzkhobkltlbmhusdh)
- Commission engine runs inside `yoco-verify-payment` to avoid needing additional functions
- Default platform fee: 10%, stored in `platform_settings` table
- Per-store override via `stores.custom_fee_percentage`
- All SQL is idempotent with `IF NOT EXISTS` and `DO $$ EXCEPTION` patterns
- ensure all functions are fixed