

# Yoco Payment Verification (No Webhooks) + Landing Marketplace Block

## Problem
1. **Yoco webhooks unavailable** — sole proprietor accounts don't have access to the webhook configuration page. The current system relies on `yoco-webhook` to confirm payments, so card payments never get confirmed.
2. **No marketplace presence on landing page** — no featured products block to drive traffic.
3. **Payment flow incomplete** — the success redirect just shows a toast but never actually verifies or confirms the payment.

## Solution

### 1. New Edge Function: `yoco-verify-payment`

Replace webhook dependency with **server-side payment verification on redirect**. When the user returns to `/orders?payment=success&order_id=xxx`:

- Frontend calls `yoco-verify-payment` with the `order_id`
- Edge function fetches the checkout from Yoco API (`GET https://payments.yoco.com/api/checkouts/{checkoutId}`) to check status
- If payment is complete, updates `shop_orders` status to `confirmed`, inserts payment record, and inserts status history — same logic the webhook did
- Store the Yoco `checkoutId` on `shop_orders` during checkout creation so we can look it up later

### 2. Update `yoco-checkout` Edge Function

Save the Yoco `checkoutId` to `shop_orders` so the verify function can use it:
```sql
-- Need this column on external DB
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS yoco_checkout_id text;
```

### 3. Update `Orders.tsx` — Call Verify on Return

Replace the simple toast with an actual verification call:
- On `?payment=success&order_id=xxx`, call `yoco-verify-payment`
- Show loading state during verification
- Show confirmed toast on success, error toast on failure

### 4. Landing Page — Featured Marketplace Block

Add a "Student Marketplace" section between Trusted Residences and About sections:
- Fetch up to 8 featured/latest products from `products` table
- Display in a responsive grid with image, name, price
- "Shop Now" CTA linking to `/marketplace`
- "View All" link

### 5. External SQL

```sql
-- Add checkout ID tracking
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS yoco_checkout_id text;
NOTIFY pgrst, 'reload schema';
```

## Files

| File | Action |
|------|--------|
| `docs/YOCO_VERIFY_SQL.sql` | Create: add `yoco_checkout_id` column |
| `supabase/functions/yoco-verify-payment/index.ts` | Create: verify payment via Yoco API |
| `supabase/functions/yoco-checkout/index.ts` | Update: save `checkoutId` to order |
| `src/pages/Orders.tsx` | Update: call verify on success redirect |
| `src/pages/Landing.tsx` | Update: add featured marketplace block |
| `supabase/config.toml` | Update: add verify function config |

## Flow

```text
User → Checkout (Yoco) → yoco-checkout creates session, saves checkoutId
     → Redirect to Yoco hosted page
     → User pays → Yoco redirects to /orders?payment=success&order_id=xxx
     → Orders page calls yoco-verify-payment
     → Edge function checks Yoco API for checkout status
     → If paid → updates order to confirmed
     → User sees confirmed order
```

## Technical Notes
- Yoco Checkout API returns `status: "completed"` when payment succeeds
- The `yoco-webhook` function remains as a fallback if the user upgrades their Yoco account later
- Yoco API endpoint: `GET https://payments.yoco.com/api/checkouts/{checkoutId}` with Bearer auth
- Featured products query: `products` table, `is_active = true`, ordered by `created_at DESC`, limit 8

