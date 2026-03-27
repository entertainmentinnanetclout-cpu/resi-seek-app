

# Fix Profile Picture Upload + Order Tracking System

## Issues

1. **Profile picture upload fails** — the `profile-pictures` storage bucket and RLS policies likely don't exist on the external Supabase. The code is correct but the bucket/policies need to be created.

2. **No order tracking for students** — the Orders page shows orders but has no delivery tracking timeline. The `order_status_history` table exists but isn't queried or displayed.

3. **No admin shop order management** — admin Commerce Hub has no tab for managing shop orders (only discount orders). Admin needs to view all shop orders and update statuses.

## Plan

### 1. External SQL — Storage + Order Tracking

Generate `docs/ORDER_TRACKING_SQL.sql` with:
- `profile-pictures` bucket creation + storage RLS policies (INSERT, UPDATE, DELETE for owners, SELECT for public)
- `order_status_history` table (already exists in Lovable Cloud, ensure external has it)
- `shop_orders` and `shop_order_items` tables with all columns
- Admin RLS policies for shop orders
- Add `tracking_number` and `estimated_delivery` columns to `shop_orders`

### 2. Student Order Tracking — `src/pages/Orders.tsx`

- Fetch `order_status_history` for each order
- Add an expandable tracking timeline showing each status change with timestamp
- Show estimated delivery date and tracking number if available
- Visual step indicator (Pending → Confirmed → Processing → In Transit → Delivered)

### 3. Admin Shop Orders Management — New `src/pages/admin/AdminShopOrders.tsx`

- Table view of all shop orders with search, status filter
- Order detail dialog showing items, buyer info, delivery address
- Status update dropdown (pending → confirmed → processing → in_transit → delivered → completed)
- On status change: update `shop_orders.status` + insert into `order_status_history`
- Add tracking number and estimated delivery fields
- Add to Commerce Hub as new "Shop Orders" tab

### 4. Profile Picture Fix

- No code changes needed — the `ProfilePictureUpload.tsx` component is correct
- The fix is purely SQL: create the bucket + storage policies on external Supabase

## Files

| File | Action |
|------|--------|
| `docs/ORDER_TRACKING_SQL.sql` | Create: full idempotent SQL for external Supabase |
| `src/pages/Orders.tsx` | Update: add tracking timeline, fetch status history |
| `src/pages/admin/AdminShopOrders.tsx` | Create: admin order management page |
| `src/pages/admin/AdminCommerceHub.tsx` | Update: add "Shop Orders" tab |

## SQL Summary

```sql
-- Profile pictures bucket + policies
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-pictures', 'profile-pictures', true) ON CONFLICT DO NOTHING;
-- Storage RLS for upload/delete/view

-- shop_orders: add tracking columns
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS tracking_number text;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS estimated_delivery date;

-- order_status_history: ensure exists with correct schema
-- All admin RLS policies for shop_orders management
```

