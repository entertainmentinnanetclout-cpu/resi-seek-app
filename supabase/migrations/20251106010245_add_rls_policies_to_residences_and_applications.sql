-- MIGRATION: ADD RLS POLICIES TO RESIDENCES AND APPLICATIONS

-- ==== RESIDENCES ====

-- 1. Create a view for public residences data that excludes contact details
CREATE OR REPLACE VIEW public.residences_public AS
SELECT
    id,
    name,
    address,
    description,
    price,
    capacity,
    amenities,
    image_url,
    available_spots,
    campus,
    created_at,
    updated_at,
    featured,
    display_order,
    distance_from_campus,
    room_type
FROM
    public.residences;

-- 2. Enable RLS on the residences table
ALTER TABLE public.residences ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow admin full access to residences" ON public.residences;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.residences;


-- 4. Create a policy to allow admins to access everything in the original table.
-- This assumes an admin user has a role of 'admin' in the public.profiles table.
CREATE POLICY "Allow admin full access to residences"
ON public.residences
FOR ALL
USING ( (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'admin' )
WITH CHECK ( (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'admin' );

-- 5. Grant SELECT on the new view to authenticated users.
-- 5. Grant SELECT on the new view to authenticated and anonymous users for verification purposes.
-- 5. Grant SELECT on the new view to authenticated users.
GRANT SELECT ON public.residences_public TO authenticated;

-- ==== APPLICATIONS ====

-- 1. Enable RLS on the applications table
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies
DROP POLICY IF EXISTS "Users can create their own applications" ON public.applications;
DROP POLICY IF EXISTS "Users can view their own applications" ON public.applications;
DROP POLICY IF EXISTS "Admins can manage all applications" ON public.applications;

-- 3. Create INSERT policy for authenticated users
CREATE POLICY "Users can create their own applications"
ON public.applications
FOR INSERT
TO authenticated
WITH CHECK ( auth.uid() = user_id );

-- 4. Create SELECT policy for authenticated users
CREATE POLICY "Users can view their own applications"
ON public.applications
FOR SELECT
TO authenticated
USING ( auth.uid() = user_id );

-- 5. Create policy for admins
CREATE POLICY "Admins can manage all applications"
ON public.applications
FOR ALL
USING ( (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'admin' )
WITH CHECK ( (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'admin' );
