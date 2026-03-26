

# Fix: Add Missing `display_order` Column to `product_categories`

Same root cause as the `slug` issue — the table existed before `MASTER_SQL_v5.sql` added `display_order`. `CREATE TABLE IF NOT EXISTS` skips existing tables.

## Fix

Add this block in `docs/MASTER_SQL_v5.sql` right after the `product_categories` CREATE TABLE (and after the slug fix you already added):

```sql
DO $$ BEGIN
  ALTER TABLE public.product_categories ADD COLUMN display_order INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
```

Also add `image_url` while we're at it (same risk):

```sql
DO $$ BEGIN
  ALTER TABLE public.product_categories ADD COLUMN image_url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
```

One-line additions. Place them between the CREATE TABLE and the INSERT seed statements.

## File Modified
| File | Change |
|------|--------|
| `docs/MASTER_SQL_v5.sql` | Add idempotent `ADD COLUMN` for `display_order` and `image_url` after CREATE TABLE block |

