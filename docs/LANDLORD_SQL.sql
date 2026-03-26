-- =============================================
-- LANDLORD APPLICATIONS SYSTEM
-- Re-runnable / Idempotent SQL
-- Run in External Supabase SQL Editor
-- =============================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.landlord_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_type text NOT NULL DEFAULT 'listing',
  status text NOT NULL DEFAULT 'pending',
  -- Property details
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
  -- Landlord contact
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  contact_email text NOT NULL,
  company_name text,
  -- Accreditation fields
  registration_number text,
  nsfas_accredited boolean DEFAULT false,
  years_operating integer,
  total_properties integer DEFAULT 1,
  -- Documents
  documents jsonb DEFAULT '[]',
  -- Admin
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.landlord_applications ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies (idempotent)
DROP POLICY IF EXISTS "Anyone can submit landlord application" ON public.landlord_applications;
CREATE POLICY "Anyone can submit landlord application"
ON public.landlord_applications FOR INSERT
TO public
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view all landlord applications" ON public.landlord_applications;
CREATE POLICY "Admins can view all landlord applications"
ON public.landlord_applications FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update landlord applications" ON public.landlord_applications;
CREATE POLICY "Admins can update landlord applications"
ON public.landlord_applications FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete landlord applications" ON public.landlord_applications;
CREATE POLICY "Admins can delete landlord applications"
ON public.landlord_applications FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_landlord_apps_status ON public.landlord_applications(status);
CREATE INDEX IF NOT EXISTS idx_landlord_apps_type ON public.landlord_applications(application_type);
CREATE INDEX IF NOT EXISTS idx_landlord_apps_created ON public.landlord_applications(created_at DESC);

-- 5. Updated_at trigger
DROP TRIGGER IF EXISTS trg_landlord_apps_updated ON public.landlord_applications;
CREATE TRIGGER trg_landlord_apps_updated
  BEFORE UPDATE ON public.landlord_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Done!
SELECT 'landlord_applications table ready' AS result;
