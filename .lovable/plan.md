

# Fix: "Failed to save product" on Admin Marketplace

## Root Cause

The `products` table on your **external Supabase** (`mefjzkhobkltlbmhusdh`) likely doesn't have the RLS policies applied yet. You ran MASTER_SQL_v5.sql but hit errors on `product_categories` (missing `slug`, `display_order` columns) which may have stopped execution before the RLS policies section was reached.

Without the `admins_manage_all_products` policy, RLS blocks all inserts.

## Fix

Run this targeted SQL on your **external Supabase SQL Editor**:

```sql
-- Ensure RLS is enabled
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Admin full access
DROP POLICY IF EXISTS "admins_manage_all_products" ON public.products;
CREATE POLICY "admins_manage_all_products" ON public.products FOR ALL
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Store owners manage their own products
DROP POLICY IF EXISTS "sellers_manage_own_products" ON public.products;
CREATE POLICY "sellers_manage_own_products" ON public.products FOR ALL
  USING (EXISTS (SELECT 1 FROM stores WHERE stores.id = products.store_id AND stores.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM stores WHERE stores.id = products.store_id AND stores.user_id = auth.uid()));

-- Public view active products
DROP POLICY IF EXISTS "anyone_view_active_products" ON public.products;
CREATE POLICY "anyone_view_active_products" ON public.products FOR SELECT USING (is_active = true);

-- Also ensure product_categories and stores have proper policies
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins_manage_categories" ON public.product_categories;
CREATE POLICY "admins_manage_categories" ON public.product_categories FOR ALL
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "anyone_view_categories" ON public.product_categories;
CREATE POLICY "anyone_view_categories" ON public.product_categories FOR SELECT USING (true);

-- Ensure product-images storage bucket exists and is public
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true) ON CONFLICT DO NOTHING;
```

## No code changes needed

The frontend code is correct. This is purely a database configuration issue on the external backend.

## Also: Better error logging

As a code improvement, update `ProductFormDialog.tsx` to log the actual Supabase error message in the toast so you can see the exact reason if it fails again. Change:
```tsx
toast.error("Failed to save product");
```
to:
```tsx
const msg = error instanceof Error ? error.message : String(error);
toast.error(`Failed to save product: ${msg}`);
```

## Files Modified
| File | Change |
|------|--------|
| External Supabase SQL Editor | Run RLS policies for `products` and `product_categories` |
| `src/components/admin/ProductFormDialog.tsx` | Show actual error message in toast (optional improvement) |

