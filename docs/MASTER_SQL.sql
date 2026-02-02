-- =====================================================
-- RESKONNECT MASTER SQL SCRIPT
-- Version: 2.0 (February 2026)
-- Run this on a fresh or existing Supabase project
-- =====================================================

-- 1. Create app_role enum (if not exists)
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'student', 'residence_portal');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add residence_portal if enum exists but value doesn't
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'residence_portal';
EXCEPTION WHEN others THEN NULL;
END $$;

-- 2. Core Tables

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  student_number TEXT,
  campus TEXT,
  course TEXT,
  year_of_study TEXT,
  profile_picture_url TEXT,
  looking_for_roommate BOOLEAN DEFAULT false,
  lifestyle_preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- User roles table (CRITICAL for security)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, role)
);

-- Residences table
CREATE TABLE IF NOT EXISTS public.residences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  capacity INTEGER DEFAULT 1 NOT NULL,
  available_spots INTEGER DEFAULT 0 NOT NULL,
  campus TEXT,
  province TEXT DEFAULT 'Gauteng',
  room_type TEXT,
  room_types TEXT[] DEFAULT '{}',
  quality_grade TEXT DEFAULT 'standard',
  verification_level VARCHAR DEFAULT 'basic',
  featured BOOLEAN DEFAULT false,
  is_trusted BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  distance_from_campus NUMERIC,
  image_url TEXT,
  images TEXT[] DEFAULT '{}',
  amenities TEXT[] DEFAULT '{}',
  contact_email TEXT,
  contact_phone TEXT,
  virtual_tour_url TEXT,
  virtual_tour_provider TEXT,
  section_category TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Applications table
CREATE TABLE IF NOT EXISTS public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  residence_id UUID NOT NULL REFERENCES public.residences(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'submitted' NOT NULL,
  notes TEXT,
  funding_type TEXT DEFAULT 'unknown' NOT NULL,
  desired_move_in DATE,
  move_in_date DATE,
  move_in_confirmed BOOLEAN DEFAULT false,
  moved_in BOOLEAN DEFAULT false,
  last_contacted_at TIMESTAMPTZ,
  student_profile JSONB DEFAULT '{}'::jsonb,
  application_date TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Documents table
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Residence Portal Accounts
CREATE TABLE IF NOT EXISTS public.residence_portal_accounts (
  residence_id UUID PRIMARY KEY REFERENCES public.residences(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Application Documents (residence-specific)
CREATE TABLE IF NOT EXISTS public.application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  residence_id UUID NOT NULL REFERENCES public.residences(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  original_filename TEXT,
  status TEXT DEFAULT 'submitted' NOT NULL,
  rejection_reason TEXT,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Helper Functions

-- has_role function (CRITICAL for RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- is_authorized_residence_user function
CREATE OR REPLACE FUNCTION public.is_authorized_residence_user(target_residence_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.residence_portal_accounts rpa
    WHERE rpa.user_id = auth.uid()
      AND rpa.is_active = true
      AND rpa.residence_id = target_residence_id
  )
$$;

-- generate_ref_code function
CREATE OR REPLACE FUNCTION public.generate_ref_code(app_id UUID)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT UPPER(SUBSTRING(REPLACE(app_id::text, '-', '') FROM 1 FOR 8))
$$;

-- update_updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 4. Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.residences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.residence_portal_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies (abbreviated - add full policies as needed)

-- Profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Residences policies
DROP POLICY IF EXISTS "Anyone can view residences" ON public.residences;
CREATE POLICY "Anyone can view residences" ON public.residences FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage residences" ON public.residences;
CREATE POLICY "Admins can manage residences" ON public.residences FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Applications policies
DROP POLICY IF EXISTS "Users can view their own applications" ON public.applications;
CREATE POLICY "Users can view their own applications" ON public.applications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own applications" ON public.applications;
CREATE POLICY "Users can create their own applications" ON public.applications FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all applications" ON public.applications;
CREATE POLICY "Admins can view all applications" ON public.applications FOR SELECT USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update applications" ON public.applications;
CREATE POLICY "Admins can update applications" ON public.applications FOR UPDATE USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Residence portal view applications" ON public.applications;
CREATE POLICY "Residence portal view applications" ON public.applications FOR SELECT USING (is_authorized_residence_user(residence_id));

DROP POLICY IF EXISTS "Residence portal update applications" ON public.applications;
CREATE POLICY "Residence portal update applications" ON public.applications FOR UPDATE USING (is_authorized_residence_user(residence_id));

-- User roles policies
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

-- Residence portal accounts policies
DROP POLICY IF EXISTS "Admins manage portal accounts" ON public.residence_portal_accounts;
CREATE POLICY "Admins manage portal accounts" ON public.residence_portal_accounts FOR ALL 
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Portal users see own record" ON public.residence_portal_accounts;
CREATE POLICY "Portal users see own record" ON public.residence_portal_accounts FOR SELECT USING (auth.uid() = user_id);

-- 6. Triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_residences_updated_at ON public.residences;
CREATE TRIGGER update_residences_updated_at BEFORE UPDATE ON public.residences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_applications_updated_at ON public.applications;
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- =====================================================
-- END OF MASTER SQL SCRIPT
-- =====================================================
