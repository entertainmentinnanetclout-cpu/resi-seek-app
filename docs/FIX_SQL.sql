-- =====================================================
-- RESKONNECT FIX SQL SCRIPT
-- Run this on your Supabase database to fix:
-- 1. Residence Portal functionality
-- 2. Application tracking issues
-- 3. RLS policies for secure access
-- =====================================================

-- =====================================
-- STEP 1: Ensure app_role enum includes residence_portal
-- =====================================
DO $$ BEGIN
  -- Add residence_portal if it doesn't exist
  ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'residence_portal';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================
-- STEP 2: Create/Update residence_portal_accounts table
-- =====================================
CREATE TABLE IF NOT EXISTS public.residence_portal_accounts (
  residence_id UUID PRIMARY KEY REFERENCES public.residences(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.residence_portal_accounts ENABLE ROW LEVEL SECURITY;

-- =====================================
-- STEP 3: Create helper functions
-- =====================================

-- Function to check if user is authorized for a residence
CREATE OR REPLACE FUNCTION public.is_authorized_residence_user(target_residence_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM residence_portal_accounts rpa
    WHERE rpa.user_id = auth.uid()
      AND rpa.is_active = true
      AND rpa.residence_id = target_residence_id
  )
$$;

-- Function to get user's assigned residence
CREATE OR REPLACE FUNCTION public.get_user_residence_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET row_security = off
AS $$
  SELECT residence_id FROM residence_portal_accounts
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1
$$;

-- Function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- =====================================
-- STEP 4: RLS Policies for residence_portal_accounts
-- =====================================
DROP POLICY IF EXISTS "Admins can manage portal accounts" ON public.residence_portal_accounts;
CREATE POLICY "Admins can manage portal accounts" 
ON public.residence_portal_accounts
FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Portal users can view own account" ON public.residence_portal_accounts;
CREATE POLICY "Portal users can view own account" 
ON public.residence_portal_accounts
FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

-- =====================================
-- STEP 5: RLS Policies for applications table (residence portal access)
-- =====================================

-- Allow residence portal users to view applications for their residence
DROP POLICY IF EXISTS "Residence portal can view own applications" ON public.applications;
CREATE POLICY "Residence portal can view own applications"
ON public.applications
FOR SELECT
TO authenticated
USING (
  public.is_authorized_residence_user(residence_id)
  OR user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

-- Allow residence portal users to update applications for their residence
DROP POLICY IF EXISTS "Residence portal can update own applications" ON public.applications;
CREATE POLICY "Residence portal can update own applications"
ON public.applications
FOR UPDATE
TO authenticated
USING (
  public.is_authorized_residence_user(residence_id)
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  public.is_authorized_residence_user(residence_id)
  OR public.has_role(auth.uid(), 'admin')
);

-- Students can insert their own applications
DROP POLICY IF EXISTS "Users can create own applications" ON public.applications;
CREATE POLICY "Users can create own applications"
ON public.applications
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Students can delete their own applications (if not approved)
DROP POLICY IF EXISTS "Users can delete own pending applications" ON public.applications;
CREATE POLICY "Users can delete own pending applications"
ON public.applications
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid() 
  AND status IN ('submitted', 'cancelled')
);

-- =====================================
-- STEP 6: Application documents table and policies
-- =====================================
CREATE TABLE IF NOT EXISTS public.application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  residence_id UUID NOT NULL REFERENCES public.residences(id),
  doc_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  original_filename TEXT,
  status TEXT DEFAULT 'pending',
  rejection_reason TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;

-- Policies for application_documents
DROP POLICY IF EXISTS "View own or authorized documents" ON public.application_documents;
CREATE POLICY "View own or authorized documents"
ON public.application_documents
FOR SELECT
TO authenticated
USING (
  public.is_authorized_residence_user(residence_id)
  OR EXISTS (
    SELECT 1 FROM applications a 
    WHERE a.id = application_id AND a.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Upload documents to own applications" ON public.application_documents;
CREATE POLICY "Upload documents to own applications"
ON public.application_documents
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM applications a 
    WHERE a.id = application_id AND a.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Residence portal can verify documents" ON public.application_documents;
CREATE POLICY "Residence portal can verify documents"
ON public.application_documents
FOR UPDATE
TO authenticated
USING (
  public.is_authorized_residence_user(residence_id)
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  public.is_authorized_residence_user(residence_id)
  OR public.has_role(auth.uid(), 'admin')
);

-- =====================================
-- STEP 7: Application messages table and policies
-- =====================================
CREATE TABLE IF NOT EXISTS public.application_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  residence_id UUID NOT NULL REFERENCES public.residences(id),
  sender_type TEXT NOT NULL CHECK (sender_type IN ('student', 'residence', 'admin')),
  sender_user_id UUID REFERENCES auth.users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.application_messages ENABLE ROW LEVEL SECURITY;

-- Policies for application_messages
DROP POLICY IF EXISTS "View messages for authorized apps" ON public.application_messages;
CREATE POLICY "View messages for authorized apps"
ON public.application_messages
FOR SELECT
TO authenticated
USING (
  public.is_authorized_residence_user(residence_id)
  OR EXISTS (
    SELECT 1 FROM applications a 
    WHERE a.id = application_id AND a.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Send messages to own or authorized apps" ON public.application_messages;
CREATE POLICY "Send messages to own or authorized apps"
ON public.application_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_user_id = auth.uid()
  AND (
    public.is_authorized_residence_user(residence_id)
    OR EXISTS (
      SELECT 1 FROM applications a 
      WHERE a.id = application_id AND a.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  )
);

-- =====================================
-- STEP 8: User roles policies
-- =====================================
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
CREATE POLICY "Users can view own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- =====================================
-- STEP 9: Add section_category to residences for grouping
-- =====================================
ALTER TABLE public.residences 
ADD COLUMN IF NOT EXISTS section_category TEXT DEFAULT NULL;

COMMENT ON COLUMN public.residences.section_category IS 'Manual override for residence grouping on Find My Res page';

-- =====================================
-- STEP 10: Enable realtime for key tables
-- =====================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.applications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.application_documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.application_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.residence_portal_accounts;

-- =====================================
-- STEP 11: Create referral_claims table for NSFAS billing
-- =====================================
CREATE TABLE IF NOT EXISTS public.referral_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL UNIQUE REFERENCES public.applications(id) ON DELETE CASCADE,
  residence_id UUID NOT NULL REFERENCES public.residences(id),
  student_ref TEXT,
  funding_type TEXT NOT NULL,
  claim_status TEXT DEFAULT 'pending',
  claim_amount NUMERIC,
  academic_year INTEGER DEFAULT EXTRACT(YEAR FROM now()),
  created_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ
);

ALTER TABLE public.referral_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage referral claims" ON public.referral_claims;
CREATE POLICY "Admins manage referral claims"
ON public.referral_claims
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Residence portal view own claims" ON public.referral_claims;
CREATE POLICY "Residence portal view own claims"
ON public.referral_claims
FOR SELECT
TO authenticated
USING (public.is_authorized_residence_user(residence_id));

-- =====================================
-- STEP 12: Refresh PostgREST schema cache
-- =====================================
NOTIFY pgrst, 'reload schema';

-- =====================================
-- DONE! Your database is now ready for:
-- - Residence Portal functionality
-- - Application tracking
-- - Document management
-- - Messaging between students and residences
-- =====================================
