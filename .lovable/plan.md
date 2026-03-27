

# Fix: Product Save Error Message + Underlying Insert Issue

## Problem
The catch block in `ProductFormDialog.tsx` line 184 does:
```ts
const msg = error instanceof Error ? error.message : String(error);
```
Supabase `PostgrestError` is NOT an `Error` instance — it's a plain object with `.message`, `.code`, `.details`. So `String(error)` returns `[object Object]`.

## Fix

### 1. Fix error handling in `ProductFormDialog.tsx` (line 182-185)
Change the catch block to properly extract the Supabase error message:
```ts
} catch (error: unknown) {
  console.error("Save error:", error);
  const msg = error && typeof error === 'object' && 'message' in error
    ? (error as { message: string }).message
    : String(error);
  toast.error(`Failed to save product: ${msg}`);
```

This will surface the **actual** database error (e.g. missing column, RLS violation, FK constraint) so we can diagnose the root cause.

### 2. Also check: `verified` column may not exist on external Supabase
The payload includes `verified: true` (line 164). If the external `products` table doesn't have a `verified` column, this causes a silent insert failure. The fix above will reveal this.

**Contingency**: If the revealed error is about `verified` column, remove it from payload OR provide SQL:
```sql
DO $$ BEGIN
  ALTER TABLE public.products ADD COLUMN verified boolean DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
```

### 3. Also check: `updated_at` column in product_categories
The `product_categories` table in the schema shows an `updated_at` column, but the external DB may not have it, which could cause the category fetch to fail silently, leading to a null `store_id`.

## Files Modified
| File | Change |
|------|--------|
| `src/components/admin/ProductFormDialog.tsx` | Fix error extraction in catch block (line 182-185) |

## What happens next
After deploying this fix, the toast will show the **real** error message. Share that message so we can apply the exact SQL fix needed on the external Supabase.

