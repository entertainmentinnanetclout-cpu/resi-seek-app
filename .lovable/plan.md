# Bulletproof Yoco Payment System + Admin Gateway Controls

## Current State

The system already has:

- `yoco-checkout` edge function (creates Yoco session, saves `yoco_checkout_id`)
- `yoco-verify-payment` edge function (polls Yoco API on redirect)
- Orders page with payment verification on `?payment=success`
- Checkout page with COD + Yoco card options
- Admin shop orders management with status updates
- Product form with payment_type + checkout_url fields

The core architecture is **correct**. The main gaps are:

1. **No fallback when Yoco verification fails** — user has no way to prove payment
2. **Product save still failing** — the `payment_type` and `checkout_url` columns may not exist on external Supabase (PGRST204 error = column not found)
3. **No admin payment gateway controls** — admin can't switch between gateways or manage payment settings
4. **No proof-of-payment upload** for edge cases

## Plan

### 1. External SQL — `docs/PAYMENT_SYSTEM_SQL.sql`

Single idempotent script covering everything:

```sql
-- Ensure payment columns on products
ALTER TABLE products ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'standard';
ALTER TABLE products ADD COLUMN IF NOT EXISTS checkout_url text;

-- Ensure Yoco tracking on shop_orders
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS yoco_checkout_id text;

-- Payment proofs table (fallback for failed verification)
CREATE TABLE IF NOT EXISTS payment_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  user_id uuid NOT NULL,
  image_url text,
  reference_number text,
  status text DEFAULT 'pending',
  admin_note text,
  reviewed_by uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE payment_proofs ENABLE ROW LEVEL SECURITY;
-- RLS: users manage own, admins manage all

-- Webhook events (if not exists)
CREATE TABLE IF NOT EXISTS webhook_events (...);

-- All indexes
```

This fixes the product save error (PGRST204) by ensuring `payment_type` and `checkout_url` columns exist.

### 2. Proof of Payment Fallback — Orders Page

When payment verification returns `verified: false` or errors:

- Show a "Payment not confirmed?" card with:
  - Upload proof of payment image (to `product-images` bucket)
  - Enter transaction reference number
  - Submit for admin review
- Insert into `payment_proofs` table
- Order stays `awaiting_verification` until admin approves

### 3. Admin Payment Management

**AdminShopOrders.tsx** updates:

- Add "Verify Payment" button for orders with `payment_status = 'awaiting_payment'`
- Show proof-of-payment submissions with approve/reject
- On approve: update order to `confirmed` + `payment_status = 'paid'`

**Admin Settings** — new "Payment Gateway" section:

- Toggle Yoco on/off (stored in `platform_settings`)
- Display configured gateway status
- Future-ready: placeholder for PayFast/Stripe when needed

### 4. Product Form Fix

The product save error is caused by `payment_type` and `checkout_url` columns not existing on external DB. The SQL in step 1 fixes this. No code changes needed — the form already sends these fields correctly.

## Files


| File                                  | Action                                                |
| ------------------------------------- | ----------------------------------------------------- |
| `docs/PAYMENT_SYSTEM_SQL.sql`         | Create: complete idempotent SQL for external Supabase |
| `src/pages/Orders.tsx`                | Update: add proof-of-payment upload fallback UI       |
| `src/pages/admin/AdminShopOrders.tsx` | Update: add payment proof review + manual verify      |
| `src/pages/admin/AdminSettings.tsx`   | Update: add payment gateway configuration section     |


## Flow After Fix

```text
User pays via Yoco → redirected back → verify-payment called
  ├─ Verified ✓ → order confirmed, toast shown
  └─ Not verified → show "Upload Proof" card
       → User uploads screenshot + reference
       → Admin reviews in Shop Orders tab
       → Admin approves → order confirmed
```

## Technical Notes

- The `payment_type`/`checkout_url` columns ARE the root cause of the ongoing product save error (PGRST204 = unknown column)
- Proof-of-payment images use the existing `product-images` bucket (already public)
- Platform settings for gateway config use existing `platform_settings` table
- No new edge functions needed — existing verify flow + admin manual update covers all cases

&nbsp;

&nbsp;

ensure the card payment and link payment fully work after this fix if anything still missing fix,always do a ode review after fiximg to validate your hanges and fix whatever you missed or did wrong.