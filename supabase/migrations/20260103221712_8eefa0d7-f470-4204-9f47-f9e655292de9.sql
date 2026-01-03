-- =============================================
-- FIX RLS POLICIES ON PROFILES TABLE
-- =============================================

-- Drop problematic policies causing recursion
DROP POLICY IF EXISTS "Users can view basic seller info for verified listings" ON profiles;
DROP POLICY IF EXISTS "Users can view roommate seekers" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Recreate policies without recursion
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Public can view roommate seekers" ON profiles
  FOR SELECT USING (looking_for_roommate = true);

-- Simplified seller view policy - no recursive subquery
CREATE POLICY "View verified marketplace sellers" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM marketplace_listings 
      WHERE marketplace_listings.user_id = profiles.id 
      AND marketplace_listings.verified = true 
      AND marketplace_listings.status = 'active'
    )
  );