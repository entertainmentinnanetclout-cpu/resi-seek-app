

# Diagnosis: Residences ARE Fetching Correctly

## What I Found

The network request to `mefjzkhobkltlbmhusdh.supabase.co/rest/v1/residences` returns **200 OK with 5 residences**. The data is there and accessible.

## Possible Issue: Dual Backend Confusion

Your app has TWO backends:
- **External** (`mefjzkhobkltlbmhusdh`) — where all your real data lives
- **Lovable Cloud** (`vmqqkebojldjsyxcewdb`) — connected but likely empty

The `supabase/client.ts` is hardcoded to the external backend, so frontend queries work. But if something changed or the client got regenerated, it could point to the empty Lovable Cloud instance.

## Diagnostic SQL (run on EXTERNAL backend `mefjzkhobkltlbmhusdh`)

```sql
-- 1. Check total residences
SELECT COUNT(*) AS total_residences FROM public.residences;

-- 2. Check trusted residences (landing page)
SELECT COUNT(*) AS trusted_count FROM public.residences WHERE is_trusted = true;

-- 3. Check RLS allows anonymous reads
SELECT id, name, is_trusted, display_order, section_category
FROM public.residences
ORDER BY display_order ASC
LIMIT 10;

-- 4. Verify the public SELECT policy exists
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'residences' AND cmd = 'SELECT';
```

## Fix SQL (if RLS is blocking — run on EXTERNAL backend)

```sql
-- Ensure public read policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'residences'
      AND policyname = 'Anyone can view residences'
  ) THEN
    EXECUTE 'CREATE POLICY "Anyone can view residences" ON public.residences FOR SELECT USING (true)';
  END IF;
END $$;

-- Ensure RLS is enabled
ALTER TABLE public.residences ENABLE ROW LEVEL SECURITY;
```

## Fix SQL (if Lovable Cloud backend needs the same data)

If the client.ts was auto-regenerated and now points to Lovable Cloud (`vmqqkebojldjsyxcewdb`), the fix is to **restore the hardcoded external URL** in `src/integrations/supabase/client.ts`. This is the most likely root cause if residences suddenly stopped appearing.

## Code Fix (if client.ts was overwritten)

Restore `src/integrations/supabase/client.ts` to use the external backend URL `https://mefjzkhobkltlbmhusdh.supabase.co` with the correct anon key, since all production data lives there.

## Recommended Action

1. Run the diagnostic SQL on the external backend to confirm data is intact
2. Check if `client.ts` was auto-regenerated (compare current file with the hardcoded external URL)
3. If client.ts points to Lovable Cloud, restore the external URL

