# Yoco Payment Gateway + Product Checkout Links Integration

## Overview

While keeping the cash on delivery Integrate Yoco as the card payment gateway for the marketplace checkout, add per-product checkout link support (admin-configurable), and implement smart payment routing. This is a hybrid system: embedded Yoco payments for on-platform card checkout, and external checkout URLs for products where the admin has set a link.

## Architecture

```text
User clicks "Buy Now"
       │
       ▼
┌──────────────────┐
│ Product has       │
│ checkout_url?     │
├────┬─────────────┤
│ YES│     NO      │
│    │             │
│ Redirect to      │ Show checkout page
│ external URL     │ with payment options:
│                  │  - COD (existing)
│                  │  - Yoco Card Payment
└────┘             └──────────────┘
                          │
                    ┌─────┴──────┐
                    │ Yoco       │
                    │ selected   │
                    ▼            │
              Edge function      │
              creates Yoco       │
              checkout session   │
                    │            │
              Return checkout    │
              URL → redirect     │
                    │            │
              Yoco webhook       │
              confirms payment   │
              → update order     │
                    └────────────┘
```

## Database Changes (External SQL)

Add two columns to `products` table and create a `webhook_events` table for audit:

```sql
-- products: payment routing fields
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'standard';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS checkout_url text;

-- webhook audit log
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  processed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
-- Admin-only access
CREATE POLICY "admins_manage_webhooks" ON public.webhook_events
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

NOTIFY pgrst, 'reload schema';
```

Full idempotent SQL will be generated as `docs/