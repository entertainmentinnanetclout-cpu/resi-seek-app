# EFT Payment System + Marketplace Upgrades

## Overview

Replace Yoco with a secure manual EFT payment system, add admin banking setup, product category management, delivery location dropdowns (TUT campuses + residences), and admin-controlled featured products on landing page.

## 1. External SQL — `docs/EFT_PAYMENT_SQL.sql`

```sql
-- Admin banking details (stored in platform_settings)
-- key: 'eft_bank_details', value: { bank_name, account_number, branch_code, account_holder, account_type }

-- EFT payments table (unique refs, expiry, fingerprints)
CREATE TABLE IF NOT EXISTS eft_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  user_id uuid NOT NULL,
  payment_reference text UNIQUE NOT NULL,
  expected_amount numeric(10,2) NOT NULL,
  unique_cents integer NOT NULL DEFAULT 0,
  fingerprint text NOT NULL,  -- SHA256(user_id + amount + ref + timestamp)
  status text DEFAULT 'pending',  -- pending, uploaded, verified, confirmed, rejected, expired
  expires_at timestamptz NOT NULL,
  pop_image_url text,
  pop_file_hash text,
  pop_uploaded_at timestamptz,
  risk_score integer DEFAULT 0,
  device_info jsonb DEFAULT '{}',
  honeypot_triggered boolean DEFAULT false,
  admin_note text,
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
-- RLS: users see own, admins see all
-- Indexes on payment_reference, user_id, status, fingerprint, pop_file_hash

-- Payment action logs (immutable)
CREATE TABLE IF NOT EXISTS payment_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eft_payment_id uuid,
  order_id uuid,
  actor_id uuid,
  actor_type text NOT NULL, -- 'user', 'admin', 'system'
  action text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
-- RLS: admins only SELECT, system INSERT

-- Rate limits table
CREATE TABLE IF NOT EXISTS payment_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action_type text NOT NULL, -- 'create_payment', 'upload_pop'
  attempt_count integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Products: add is_landing_featured flag
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_landing_featured boolean DEFAULT false;
```

## 2. Checkout.tsx — EFT Payment Flow

- Replace Yoco option with **"EFT / Bank Transfer"** option
- Mark Yoco as **"Coming Soon"** (disabled radio, greyed out with badge)
- When EFT selected and order placed:
  - Generate unique reference: `RK-EFT-{timestamp_base36}-{random4}`
  - Calculate unique amount: `total + (user_id_hash % 99) cents` (deterministic per user)
  - Generate SHA256 fingerprint
  - Insert into `eft_payments` with 15min expiry
  - Show **EFT Payment Instructions screen** with:
    - Bank details (fetched from `platform_settings.eft_bank_details`)
    - Payment reference (copyable)
    - Exact amount (copyable)
    - 15-minute countdown timer
    - "Upload Proof of Payment" button
    - Hidden honeypot field

## 3. EFT Payment Instructions Component

New component shown after order creation when EFT selected:

- Bank name, account holder, account number, branch code
- Unique reference + unique amount prominently displayed
- Countdown timer (expires_at - now)
- Upload POP: image file + optional reference input
- On upload: hash file client-side (SHA256), check for duplicate hash, submit
- After upload: show "Payment Under Review" status

## 4. Orders.tsx — EFT Status Integration

- Show EFT payment status per order (pending → uploaded → confirmed)
- If expired and no POP: show "Payment Expired" with option to contact admin
- If POP uploaded: show "Under Review" badge
- Remove Yoco polling logic (keep code but skip execution when payment_method !== 'yoco')

## 5. Admin Settings — Banking Details Management

Add "Banking Details" card to AdminSettings:

- Bank Name, Account Holder, Account Number, Branch Code, Account Type
- Save to `platform_settings` with key `eft_bank_details`
- Load existing on mount

## 6. Admin Shop Orders — EFT Review Tab

Add "EFT Payments" tab:

- List all `eft_payments` with status filter
- Show: order number, reference, amount, status, risk score, POP image
- Approve: updates `eft_payments.status = 'confirmed'`, `shop_orders.status = 'confirmed'`, `shop_orders.payment_status = 'paid'`
- Reject: updates status + adds admin_note
- View POP image in dialog
- Flag high risk scores (>3) in red
- All actions logged to `payment_action_logs`

## 7. Delivery Location Dropdown — Checkout.tsx

Replace free-text delivery address with structured dropdown:

- **Delivery Type**: "TUT Campus Drop-off" or "Residence Delivery"
- If campus: dropdown of all TUT campuses (from `campuses.ts`)
- If residence: fetch `residences` table, show as dropdown
- Add info banner: "We deliver nationwide but only to TUT Campus Drop-offs and Listed Residences"

## 8. Product Category Management — Admin

Add "Categories" tab to Commerce Hub:

- CRUD for `product_categories` table (name, slug, image_url, display_order, parent_id)
- Drag/reorder via display_order
- Delete with confirmation (only if no products linked)
- Upgrade marketplace to have Categories filters, blocks like Best deals etc 

## 9. Landing Page Featured Products — Admin Control

- Add `is_landing_featured` column to products
- Admin toggle in product form or a dedicated "Landing Featured" selector
- Landing page `FeaturedMarketplace` component queries `products` where `is_landing_featured = true` instead of just `is_active`
- If none featured, fall back to newest 8

## 10. Marketplace — Category Filter Chips

Already partially implemented. Ensure:

- Categories show as horizontal scrollable chips
- Selected category filters products
- "All" chip resets filter

## Files


| File                                         | Action                                              |
| -------------------------------------------- | --------------------------------------------------- |
| `docs/EFT_PAYMENT_SQL.sql`                   | Create: full idempotent SQL                         |
| `src/pages/Checkout.tsx`                     | Rewrite: EFT flow, Yoco disabled, delivery dropdown |
| `src/pages/Orders.tsx`                       | Update: EFT status display                          |
| `src/pages/admin/AdminSettings.tsx`          | Update: banking details card                        |
| `src/pages/admin/AdminShopOrders.tsx`        | Update: EFT review tab                              |
| `src/pages/admin/AdminCommerceHub.tsx`       | Update: add Categories tab                          |
| `src/pages/Landing.tsx`                      | Update: FeaturedMarketplace query                   |
| `src/components/admin/ProductFormDialog.tsx` | Update: add is_landing_featured toggle              |
| `src/lib/campuses.ts`                        | Already exists, reuse for dropdowns                 |


## EFT Payment Flow

```text
Student checkout → selects EFT → order created
  → unique ref + unique amount generated
  → EFT instructions shown with countdown (15min)
  → Student pays via banking app
  → Uploads POP screenshot + reference
  → System hashes file, checks duplicates, logs action
  → Order shows "Under Review"
  → Admin sees in EFT Payments tab
  → Admin views POP, checks ref/amount match
  → Approves → order confirmed, student notified
  → Rejects → student sees rejection reason
```

## Security Measures

- SHA256 fingerprint per payment (tamper detection)
- Unique cents per user (prevents reference reuse across users)
- POP file hashing (duplicate upload detection)
- 15-minute expiry (prevents stale references)
- Rate limiting (max 5 payments/hour, max 10 uploads/hour)
- Hidden honeypot field (bot detection)
- Immutable action logs (full audit trail)
- RLS on all tables (users see own data only)