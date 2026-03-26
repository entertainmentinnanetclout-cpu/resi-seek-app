

# Generate Full Rerunnable SQL for External Supabase

## What this does
Produces a single, idempotent SQL file (`docs/MASTER_SQL_v5.sql`) that you can run on your external Supabase instance. It consolidates everything from MASTER_SQL v4.0 plus all new features added since:

1. **Commerce system** — `products`, `product_categories`, `product_variants`, `cart`, `cart_items`, `shop_orders`, `shop_order_items`, `order_status_history`, `payments`, `hampers`, `hamper_bundle_items`, `hamper_orders`, `hamper_order_items` (13 tables)
2. **Residence sections** — `residence_sections` table with seed data (Flats, Communes, Rentals, Private Accommodations)
3. **Hero slides location** — `slide_location` column on `hero_slides` + dashboard seed slides
4. **`get_user_staff_role()` function** — for admin hub role-based access
5. **All FK constraints** — explicit foreign keys for PostgREST joins across all tables
6. **Storage buckets + policies** — `product-images`, `hamper-images` buckets added
7. **`section_category` column** on `residences` table

## Approach
- Merge MASTER_SQL v4.0 with all migrations from March 2025 onwards into one file
- All statements are idempotent (`CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `DO $$ ... EXCEPTION ...`)
- Safe to rerun unlimited times
- Output as a downloadable `.sql` file to `/mnt/documents/`

## File produced
`MASTER_SQL_v5.sql` — single file, ~1800 lines covering all 47+ tables, 8 functions, 9 storage buckets, all RLS policies, triggers, indexes, FK constraints, and realtime config.

## Technical details
- Uses `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` pattern via DO blocks for adding `slide_location` and `section_category`
- Seeds residence sections with `ON CONFLICT DO NOTHING` on slug unique constraint
- Seeds dashboard hero slides only if no dashboard slides exist
- All commerce RLS policies use `DROP POLICY IF EXISTS` before `CREATE POLICY`
- FK constraints wrapped in exception handlers for idempotency

