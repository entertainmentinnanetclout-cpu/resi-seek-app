

# Admin Hub Restructure + Order System Fix + POP Integration

## What's Changing

1. **Rename "Operations Hub" → "Accommodation Hub"** across sidebar, route, page title, and redirect hooks
2. **Add "Residence Sections" tab** to the Accommodation Hub (already exists inside AdminResidences — will be promoted to its own hub tab)
3. **Add "Orders" tab to student sidebar nav** ("My Orders" button alongside My Store)
4. **Add POP column to shop_orders** (`pop_url`, `pop_uploaded_at`) via migration — extending existing table, no new tables
5. **Fix Orders page** to show EFT POP inline and display all order statuses (not just approved)
6. **Add EFT Payments tab** to Commerce Hub Shop Orders (already partially there with "Payment Proofs" tab — will unify with `eft_payments` table)

## What Already Exists (NO duplication)

- `shop_orders` table — extend with `pop_url`/`pop_uploaded_at` columns
- `eft_payments` table — already created in previous migration
- `payment_proofs` queried in AdminShopOrders — keep as-is
- `AdminResidencesContent` already has Sections tab internally — promote to hub level
- `AdminCommerceHub` already has Shop Orders tab
- `AdminOperationsHub` already has all accommodation tabs
- Role system (`user_roles` + `get_user_staff_role`) — already complete, no changes needed

## Detailed Changes

### 1. Database Migration

```sql
-- Extend shop_orders (no new tables)
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS pop_url text;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS pop_uploaded_at timestamptz;

-- Indexes for order queries
CREATE INDEX IF NOT EXISTS idx_shop_orders_user_status ON shop_orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_shop_orders_status ON shop_orders(status);
```

### 2. AdminLayout.tsx — Rename sidebar item

- Change `"Operations Hub"` → `"Accommodation Hub"` (label only)
- Change icon from `Boxes` to `Building2`
- Keep route `/admin/operations` (no URL break)
- Add new roles to mapping: keep existing roles, just rename label

### 3. AdminOperationsHub.tsx → Rename to Accommodation Hub

- Update title: "Accommodation Hub"
- Update subtitle
- Add "Sections" tab (embed `SectionsManager` directly)
- Keep all existing tabs

### 4. AdminCommerceHub.tsx — Add EFT Payments tab

The existing Shop Orders already has a "Payment Proofs" sub-tab. Add an "EFT Payments" sub-tab that queries the `eft_payments` table with approve/reject flow + POP image viewer.

### 5. DashboardLayout.tsx — Add "My Orders" to sidebar

Add `{ icon: Package, label: "My Orders", path: "/orders" }` to `authNavItems` for all logged-in students (not just store owners).

### 6. Orders.tsx — Show all statuses

Currently shows all orders. Ensure:
- POP upload section works with `shop_orders.pop_url` column
- Status badges show full lifecycle (pending → confirmed → processing → in_transit → delivered)
- No filter to "approved only" — students see all their orders

### 7. AdminShopOrders.tsx — Show POP in order detail

In the order detail dialog, if `pop_url` exists, show the POP image preview. Admin can view it alongside the existing approve/reject flow.

### 8. Role-Based Access

The existing role system already handles this:
- `admin` → all hubs
- `operations_lead` → Accommodation Hub
- `commerce_lead` → Commerce Hub
- `growth_lead` → Media Hub
- `system_operator` → System Hub
- `support_agent` → Accommodation + Commerce

No new roles needed. The prompt's `super_admin`, `accommodation_manager`, etc. map to the existing roles.

## Files Modified

| File | Change |
|------|--------|
| Migration SQL | Add `pop_url`, `pop_uploaded_at` to `shop_orders` + indexes |
| `src/components/admin/AdminLayout.tsx` | Rename "Operations Hub" → "Accommodation Hub", change icon |
| `src/pages/admin/AdminOperationsHub.tsx` | Rename title, add Sections tab |
| `src/components/DashboardLayout.tsx` | Add "My Orders" to student sidebar |
| `src/pages/admin/AdminShopOrders.tsx` | Show POP image in order detail dialog |
| `src/hooks/useAdminRedirect.ts` | Update redirect label comment (route stays same) |

## NOT Changing (already works)

- Commerce Hub structure — already has all tabs
- Media Hub — already has Slides, News, Events, Bursaries
- Role-based sidebar filtering — already implemented
- EFT payment flow — already built in previous iteration
- Order status lifecycle — already in AdminShopOrders
- `payment_proofs` table/tab — already functional

