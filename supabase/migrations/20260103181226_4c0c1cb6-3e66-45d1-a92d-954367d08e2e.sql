-- Fix bursaries RLS: change to PERMISSIVE policy
DROP POLICY IF EXISTS "Anyone can view active bursaries" ON bursaries;

CREATE POLICY "Anyone can view active bursaries"
ON bursaries
FOR SELECT
TO public
USING (is_active = true);