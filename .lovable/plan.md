

# Full Rerunnable Marketplace SQL for External Supabase

## Problem
The MASTER_SQL_v5.sql script failed partway through (on `product_categories` column issues), so the commerce tables on the external Supabase may have incomplete schemas, missing foreign keys, or missing RLS policies. This causes "Failed to save product" errors.

## Solution
Generate a standalone, focused SQL script (`docs/MARKETPLACE_FIX.sql`) covering ONLY the marketplace/commerce tables. Fully idempotent, safe to rerun.

## Tables Covered (13 tables)
1. `product_categories` — with all columns ensured
2. `products` — with FK to stores and product_categories
3. `product_variants` — with FK to products
4. `stores` — ensure exists with all columns
5. `cart` + `cart_items` — shopping cart
6. `shop_orders` + `shop_order_items` — order management
7. `order_status_history` — order tracking
8. `payments` — payment records
9. `hampers` + `hamper_bundle_items` — hamper bundles
10. `hamper_orders` + `hamper_order_items` — hamper orders

## What the Script Does
For each table:
1. `CREATE TABLE IF NOT EXISTS` with all columns
2. `DO $$ ALTER TABLE ADD COLUMN IF NOT EXISTS` for every column (catches pre-existing tables missing new columns)
3. `ALTER TABLE ENABLE ROW LEVEL SECURITY`
4. `DROP POLICY IF EXISTS` + `CREATE POLICY` for all RLS policies
5. FK constraints via `DO $$ ... EXCEPTION WHEN duplicate_object`
6. Storage buckets: `product-images`, `hamper-images`
7. Seed data for `product_categories`

## Key RLS Policies per Table
- **products**: admin full access, store owners manage own, public view active
- **stores**: admin full access, owners manage own, public view active
- **product_categories**: admin manage, public view
- **cart/cart_items**: users manage own
- **shop_orders**: admin manage all, users manage own
- **hampers**: admin manage, public view active

## Storage Policies
- `product-images` bucket: public read, authenticated upload, owners delete
- `hamper-images` bucket: public read, admin upload

## Output
Single file: `docs/MARKETPLACE_FIX.sql` (~400 lines) — run in external Supabase SQL Editor once, or repeatedly if needed.

## Files
| File | Action |
|------|--------|
| `docs/MARKETPLACE_FIX.sql` | Create: full idempotent marketplace SQL |

