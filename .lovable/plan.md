

# Fix: Landlord Applications, Product Listing, Follow-Up Query, Landing Layout

## 4 Issues Identified

### 1. Landlord Accreditation Form — `landlord_applications` table not in Lovable Cloud
The `landlord_applications` table only exists on the external Supabase. The Lovable Cloud types don't include it, so the code uses `as never` casts. The form itself looks correct — the real issue is the table likely hasn't been created on external Supabase yet (user needs to run `docs/LANDLORD_SQL.sql`). However, the code can be improved: remove `as never` and instead use a raw `.rpc()` or keep the cast but add better error logging to surface the actual DB error.

**Fix**: Keep `as never` cast (unavoidable since table is external-only) but improve error handling to show the exact error. Also verify the accreditation tab works — the form logic looks correct, the `handleSubmit` receives `"accreditation"` type. The issue is likely just that the SQL hasn't been run on external Supabase.

**Action**: Add a diagnostic toast showing the exact error message. Provide updated SQL inline for the user to run.

### 2. Admin Product Listing — RLS or missing `products` table columns
The `ProductFormDialog` inserts into `products` with fields like `compare_at_price`, `sku`, `brand`, `is_featured`, `tags`. The `products` table exists in the Lovable Cloud types and has all these columns. The insert uses `store_id` which comes from `ResKonnectStoreManager.ensureStore()`.

**Root cause**: The `products` table on external Supabase likely has RLS enabled but policies weren't applied (the MARKETPLACE_FIX.sql may not have been run fully). The `products` RLS needs an admin ALL policy.

**Fix**: Provide the exact RLS policy SQL to run. Also add `verified: true` to the insert payload since the admin store products should be auto-verified.

### 3. Follow-Up Page Not Loading — FK join syntax
The query uses `residence:residences!fk_applications_residence(name)`. The FK `fk_applications_residence` exists in the types. The issue is that `app.residence?.name` assumes the join returns an object, but PostgREST may return `null` if the residence was deleted or the FK doesn't exist on external Supabase.

**Fix**: Change the query to fetch `residence_id` separately and do a second query for residences, OR use a simpler join without the FK hint (since there's only one FK from applications to residences). Also add null-safe access and better error logging.

### 4. Landing Page — "Why Choose" block above forms
Currently the order is: Hero → Stats → **Why Choose** → Trusted Residences → About → Landlord Portal → Contact.

User wants: Hero → Stats → Trusted Residences → About → Landlord Portal → **Why Choose** → Contact.

**Fix**: Move the "Why Choose" section below the Landlord Application Portal section in `Landing.tsx`.

## Files Modified

| File | Change |
|------|--------|
| `src/components/LandlordApplicationTabs.tsx` | Better error messages showing exact DB error |
| `src/components/admin/ResKonnectStoreManager.tsx` | No changes needed — logic is correct |
| `src/components/admin/ProductFormDialog.tsx` | Add `verified: true` to insert payload |
| `src/pages/admin/AdminFollowUp.tsx` | Simplify residence join — remove FK hint, add null safety |
| `src/pages/Landing.tsx` | Move "Why Choose" section below Landlord Portal |

## SQL for External Supabase

User must run on external Supabase to fix products and landlord applications:

```sql
-- 1. Products RLS (if missing)
DROP POLICY IF EXISTS "admins_manage_products" ON products;
CREATE POLICY "admins_manage_products" ON products FOR ALL
USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "anyone_view_active_products" ON products;
CREATE POLICY "anyone_view_active_products" ON products FOR SELECT
USING (is_active = true);

DROP POLICY IF EXISTS "store_owners_manage_products" ON products;
CREATE POLICY "store_owners_manage_products" ON products FOR ALL
USING (EXISTS (SELECT 1 FROM stores WHERE stores.id = products.store_id AND stores.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM stores WHERE stores.id = products.store_id AND stores.user_id = auth.uid()));

-- 2. Landlord applications table (idempotent)
CREATE TABLE IF NOT EXISTS public.landlord_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_type text NOT NULL DEFAULT 'listing',
  status text NOT NULL DEFAULT 'pending',
  property_name text NOT NULL,
  address text NOT NULL,
  nearest_campus text,
  distance_from_campus numeric,
  room_type text,
  price numeric,
  capacity integer,
  description text,
  amenities text[] DEFAULT '{}',
  province text DEFAULT 'Gauteng',
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  contact_email text NOT NULL,
  company_name text,
  registration_number text,
  nsfas_accredited boolean DEFAULT false,
  years_operating integer,
  total_properties integer DEFAULT 1,
  documents jsonb DEFAULT '[]',
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.landlord_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_insert_landlord_apps" ON landlord_applications;
CREATE POLICY "public_insert_landlord_apps" ON landlord_applications
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "admins_manage_landlord_apps" ON landlord_applications;
CREATE POLICY "admins_manage_landlord_apps" ON landlord_applications
FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_landlord_apps_status ON landlord_applications(status);
CREATE INDEX IF NOT EXISTS idx_landlord_apps_created ON landlord_applications(created_at DESC);
```

## Technical Details

**Follow-up fix**: The join `residences!fk_applications_residence(name)` fails silently when the FK constraint doesn't exist on external Supabase. Change to a simple `residence:residences(name)` without FK hint — PostgREST will use the `residence_id` column automatically since there's only one FK relationship.

**Landing reorder**: Move lines 202-222 (Why Choose section) to after line 271 (after Landlord Portal section).

**Product insert**: Add `verified: true` so admin products don't need separate verification.

