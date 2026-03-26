-- =====================================================
-- RESKONNECT MASTER SQL SCRIPT
-- Version: 5.0 (March 2026)
-- Run this on your EXTERNAL Supabase project
-- Covers ALL tables, functions, triggers, RLS, storage
-- Safe to rerun (idempotent)
-- =====================================================

-- ─────────────────────────────────────────────────────
-- 1. ENUMS
-- ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'student', 'residence_portal');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'residence_portal';
EXCEPTION WHEN others THEN NULL;
END $$;

-- Add staff roles to enum
DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operations_lead'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'commerce_lead'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'growth_lead'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'system_operator'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support_agent'; EXCEPTION WHEN others THEN NULL; END $$;

-- ─────────────────────────────────────────────────────
-- 2. CORE TABLES
-- ─────────────────────────────────────────────────────

-- Profiles
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

-- User Roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, role)
);

-- Residences
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

-- Applications
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

-- Documents
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Notifications
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

-- Favorites
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  residence_id UUID NOT NULL REFERENCES public.residences(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, residence_id)
);

-- Reviews
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  residence_id UUID NOT NULL REFERENCES public.residences(id) ON DELETE CASCADE,
  title VARCHAR NOT NULL,
  content TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  pros TEXT[] DEFAULT '{}',
  cons TEXT[] DEFAULT '{}',
  verified_stay BOOLEAN DEFAULT false,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
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

-- Application Documents
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

-- Application Messages
CREATE TABLE IF NOT EXISTS public.application_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  residence_id UUID NOT NULL REFERENCES public.residences(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL,
  sender_user_id UUID,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Application Activity Log
CREATE TABLE IF NOT EXISTS public.application_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  residence_id UUID NOT NULL REFERENCES public.residences(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL,
  actor_user_id UUID,
  action_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Referral Claims
CREATE TABLE IF NOT EXISTS public.referral_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  residence_id UUID NOT NULL REFERENCES public.residences(id) ON DELETE CASCADE,
  funding_type TEXT NOT NULL,
  claim_status TEXT DEFAULT 'pending_nsfas' NOT NULL,
  claim_amount NUMERIC,
  student_ref TEXT,
  academic_year INTEGER DEFAULT 2026 NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(application_id)
);

-- Residence Analytics
CREATE TABLE IF NOT EXISTS public.residence_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  residence_id UUID NOT NULL REFERENCES public.residences(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type VARCHAR NOT NULL,
  session_id VARCHAR,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Residence Sections (NEW in v5)
CREATE TABLE IF NOT EXISTS public.residence_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  subtitle TEXT,
  color TEXT DEFAULT 'bg-blue-500',
  applies_to TEXT DEFAULT 'both',
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────────────
-- 3. CONTENT TABLES
-- ─────────────────────────────────────────────────────

-- Hero Slides
CREATE TABLE IF NOT EXISTS public.hero_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  cta_text TEXT,
  cta_link TEXT,
  display_order INTEGER DEFAULT 0 NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Add slide_location column (NEW in v5)
DO $$ BEGIN
  ALTER TABLE public.hero_slides ADD COLUMN slide_location TEXT NOT NULL DEFAULT 'landing';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Campus News
CREATE TABLE IF NOT EXISTS public.campus_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  image_url TEXT,
  category TEXT DEFAULT 'general' NOT NULL,
  author TEXT,
  is_published BOOLEAN DEFAULT false NOT NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Events
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  campus TEXT,
  location TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  image_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  interested_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Bursaries
CREATE TABLE IF NOT EXISTS public.bursaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  type TEXT DEFAULT 'general' NOT NULL,
  description TEXT,
  amount TEXT,
  deadline DATE,
  link TEXT,
  image_url TEXT,
  slug TEXT,
  fields_of_study TEXT[],
  requirements TEXT[],
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ─────────────────────────────────────────────────────
-- 4. COMMERCE TABLES
-- ─────────────────────────────────────────────────────

-- Student Discounts
CREATE TABLE IF NOT EXISTS public.student_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  discount TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  how_to_claim TEXT,
  link TEXT,
  image_url TEXT,
  delivery_info TEXT,
  valid_until DATE,
  price NUMERIC,
  original_price NUMERIC,
  is_orderable BOOLEAN DEFAULT false,
  stock_quantity INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Discount Orders
CREATE TABLE IF NOT EXISTS public.discount_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  discount_id UUID NOT NULL REFERENCES public.student_discounts(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1 NOT NULL,
  total_price NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL,
  delivery_address TEXT,
  phone TEXT,
  notes TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Hamper Items
CREATE TABLE IF NOT EXISTS public.hamper_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  estimated_price NUMERIC,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Student Hamper Preferences
CREATE TABLE IF NOT EXISTS public.student_hamper_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.hamper_items(id) ON DELETE CASCADE,
  preference TEXT DEFAULT 'want' NOT NULL,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, item_id)
);

-- Stores
CREATE TABLE IF NOT EXISTS public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  store_description TEXT,
  store_logo_url TEXT,
  store_banner_url TEXT,
  contact_whatsapp TEXT,
  contact_email TEXT,
  campus TEXT,
  is_active BOOLEAN DEFAULT true,
  verified BOOLEAN DEFAULT false,
  total_sales INTEGER DEFAULT 0,
  rating NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Marketplace Listings
CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC NOT NULL,
  category TEXT NOT NULL,
  condition TEXT NOT NULL,
  images TEXT[] DEFAULT '{}' NOT NULL,
  status TEXT DEFAULT 'active' NOT NULL,
  verified BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Marketplace Orders
CREATE TABLE IF NOT EXISTS public.marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  total_price NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL,
  buyer_notes TEXT,
  buyer_phone TEXT,
  delivery_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Store Reviews
CREATE TABLE IF NOT EXISTS public.store_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Product Categories (NEW in v5)
CREATE TABLE IF NOT EXISTS public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  image_url TEXT,
  parent_id UUID REFERENCES public.product_categories(id),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Products (NEW in v5)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  compare_at_price NUMERIC,
  sku TEXT,
  brand TEXT,
  category_id UUID REFERENCES public.product_categories(id),
  images TEXT[],
  tags TEXT[],
  stock_quantity INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Product Variants (NEW in v5)
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  sku TEXT,
  stock_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cart (NEW in v5)
CREATE TABLE IF NOT EXISTS public.cart (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cart Items (NEW in v5)
CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES public.cart(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Shop Orders (NEW in v5)
CREATE TABLE IF NOT EXISTS public.shop_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL,
  total_amount NUMERIC NOT NULL,
  payment_method TEXT DEFAULT 'cod',
  payment_status TEXT DEFAULT 'pending',
  delivery_address TEXT,
  delivery_phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Shop Order Items (NEW in v5)
CREATE TABLE IF NOT EXISTS public.shop_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  quantity INTEGER DEFAULT 1 NOT NULL,
  price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Order Status History (NEW in v5)
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Payments (NEW in v5)
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  payment_gateway TEXT,
  payment_status TEXT DEFAULT 'pending',
  transaction_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Hampers (NEW in v5)
CREATE TABLE IF NOT EXISTS public.hampers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  image_url TEXT,
  category TEXT,
  stock_quantity INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Hamper Bundle Items (NEW in v5)
CREATE TABLE IF NOT EXISTS public.hamper_bundle_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hamper_id UUID NOT NULL REFERENCES public.hampers(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Hamper Orders (NEW in v5)
CREATE TABLE IF NOT EXISTS public.hamper_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  total_amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',
  payment_method TEXT DEFAULT 'cod',
  payment_status TEXT DEFAULT 'pending',
  delivery_address TEXT,
  delivery_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Hamper Order Items (NEW in v5)
CREATE TABLE IF NOT EXISTS public.hamper_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.hamper_orders(id) ON DELETE CASCADE,
  hamper_id UUID NOT NULL REFERENCES public.hampers(id) ON DELETE RESTRICT,
  quantity INTEGER DEFAULT 1,
  price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────────────
-- 5. WIL (WORK INTEGRATED LEARNING) TABLES
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.wil_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  student_number TEXT NOT NULL,
  course TEXT NOT NULL,
  year_level INTEGER NOT NULL,
  wil_duration TEXT NOT NULL,
  funding_status TEXT NOT NULL,
  campus TEXT NOT NULL,
  preferred_area TEXT,
  notes TEXT,
  status TEXT DEFAULT 'submitted' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.wil_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.wil_applications(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER DEFAULT 0 NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.wil_admin_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.wil_applications(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.wil_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.wil_applications(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ─────────────────────────────────────────────────────
-- 6. ADMIN/SYSTEM TABLES
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL,
  template_name TEXT NOT NULL,
  template_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  call_type TEXT DEFAULT 'phone' NOT NULL,
  outcome TEXT,
  notes TEXT,
  follow_up_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB DEFAULT '{}'::jsonb NOT NULL,
  description TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ─────────────────────────────────────────────────────
-- 7. VIEWS
-- ─────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.marketplace_seller_profiles AS
SELECT id, full_name, profile_picture_url
FROM public.profiles;

-- ─────────────────────────────────────────────────────
-- 8. FUNCTIONS
-- ─────────────────────────────────────────────────────

-- has_role (CRITICAL for RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- is_authorized_residence_user
CREATE OR REPLACE FUNCTION public.is_authorized_residence_user(target_residence_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
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

-- get_user_residence_id
CREATE OR REPLACE FUNCTION public.get_user_residence_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT residence_id FROM public.residence_portal_accounts
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1
$$;

-- generate_ref_code
CREATE OR REPLACE FUNCTION public.generate_ref_code(app_id UUID)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT UPPER(SUBSTRING(REPLACE(app_id::text, '-', '') FROM 1 FOR 8))
$$;

-- update_updated_at_column
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

-- handle_new_user (auto-create profile + student role on signup)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');
  RETURN NEW;
END;
$$;

-- prevent_last_admin_deletion
CREATE OR REPLACE FUNCTION public.prevent_last_admin_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.role = 'admin' THEN
    IF (SELECT COUNT(*) FROM user_roles WHERE role = 'admin') <= 1 THEN
      RAISE EXCEPTION 'Cannot delete the last admin role';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

-- get_user_staff_role (NEW in v5 — for admin hub routing)
CREATE OR REPLACE FUNCTION public.get_user_staff_role(_user_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT role::text
  FROM public.user_roles
  WHERE user_id = _user_id
    AND role::text IN ('admin', 'operations_lead', 'commerce_lead', 'growth_lead', 'system_operator', 'support_agent')
  ORDER BY
    CASE role::text
      WHEN 'admin' THEN 1
      WHEN 'system_operator' THEN 2
      WHEN 'operations_lead' THEN 3
      WHEN 'commerce_lead' THEN 4
      WHEN 'growth_lead' THEN 5
      WHEN 'support_agent' THEN 6
    END
  LIMIT 1
$$;

-- ─────────────────────────────────────────────────────
-- 9. ENABLE RLS ON ALL TABLES
-- ─────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.residences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.residence_portal_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.residence_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.residence_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hero_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bursaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hamper_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_hamper_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wil_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wil_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wil_admin_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wil_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hampers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hamper_bundle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hamper_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hamper_order_items ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────
-- 10. RLS POLICIES
-- ─────────────────────────────────────────────────────

-- ── PROFILES ──
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Public can view roommate seekers" ON public.profiles;
CREATE POLICY "Public can view roommate seekers" ON public.profiles FOR SELECT USING (looking_for_roommate = true);

-- ── USER ROLES ──
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Only admins can delete roles" ON public.user_roles;
CREATE POLICY "Only admins can delete roles" ON public.user_roles FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- ── RESIDENCES ──
DROP POLICY IF EXISTS "Anyone can view residences" ON public.residences;
CREATE POLICY "Anyone can view residences" ON public.residences FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage residences" ON public.residences;
CREATE POLICY "Admins can manage residences" ON public.residences FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ── APPLICATIONS ──
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

-- ── DOCUMENTS ──
DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;
CREATE POLICY "Users can view their own documents" ON public.documents FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own documents" ON public.documents;
CREATE POLICY "Users can insert their own documents" ON public.documents FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;
CREATE POLICY "Users can delete their own documents" ON public.documents FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all documents" ON public.documents;
CREATE POLICY "Admins can view all documents" ON public.documents FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- ── NOTIFICATIONS ──
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);

-- ── FAVORITES ──
DROP POLICY IF EXISTS "Users can view their own favorites" ON public.favorites;
CREATE POLICY "Users can view their own favorites" ON public.favorites FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can add to favorites" ON public.favorites;
CREATE POLICY "Users can add to favorites" ON public.favorites FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove from favorites" ON public.favorites;
CREATE POLICY "Users can remove from favorites" ON public.favorites FOR DELETE USING (auth.uid() = user_id);

-- ── REVIEWS ──
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;
CREATE POLICY "Anyone can view reviews" ON public.reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create reviews" ON public.reviews;
CREATE POLICY "Authenticated users can create reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own reviews" ON public.reviews;
CREATE POLICY "Users can update their own reviews" ON public.reviews FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own reviews" ON public.reviews;
CREATE POLICY "Users can delete their own reviews" ON public.reviews FOR DELETE USING (auth.uid() = user_id);

-- ── RESIDENCE PORTAL ACCOUNTS ──
DROP POLICY IF EXISTS "Admins manage portal accounts" ON public.residence_portal_accounts;
CREATE POLICY "Admins manage portal accounts" ON public.residence_portal_accounts FOR ALL
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Portal users see own record" ON public.residence_portal_accounts;
CREATE POLICY "Portal users see own record" ON public.residence_portal_accounts FOR SELECT USING (auth.uid() = user_id);

-- ── APPLICATION DOCUMENTS ──
DROP POLICY IF EXISTS "Students view own app docs" ON public.application_documents;
CREATE POLICY "Students view own app docs" ON public.application_documents FOR SELECT
  USING (EXISTS (SELECT 1 FROM applications a WHERE a.id = application_documents.application_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS "Students upload docs" ON public.application_documents;
CREATE POLICY "Students upload docs" ON public.application_documents FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM applications a WHERE a.id = application_documents.application_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins manage all docs" ON public.application_documents;
CREATE POLICY "Admins manage all docs" ON public.application_documents FOR ALL
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Residence portal view docs" ON public.application_documents;
CREATE POLICY "Residence portal view docs" ON public.application_documents FOR SELECT
  USING (is_authorized_residence_user(residence_id));

DROP POLICY IF EXISTS "Residence portal update doc status" ON public.application_documents;
CREATE POLICY "Residence portal update doc status" ON public.application_documents FOR UPDATE
  USING (is_authorized_residence_user(residence_id));

-- ── APPLICATION MESSAGES ──
DROP POLICY IF EXISTS "Students view own messages" ON public.application_messages;
CREATE POLICY "Students view own messages" ON public.application_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM applications a WHERE a.id = application_messages.application_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS "Students send messages" ON public.application_messages;
CREATE POLICY "Students send messages" ON public.application_messages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM applications a WHERE a.id = application_messages.application_id AND a.user_id = auth.uid())
    AND sender_type = 'student' AND sender_user_id = auth.uid());

DROP POLICY IF EXISTS "Residence portal view messages" ON public.application_messages;
CREATE POLICY "Residence portal view messages" ON public.application_messages FOR SELECT
  USING (is_authorized_residence_user(residence_id));

DROP POLICY IF EXISTS "Residence portal send messages" ON public.application_messages;
CREATE POLICY "Residence portal send messages" ON public.application_messages FOR INSERT
  WITH CHECK (is_authorized_residence_user(residence_id) AND sender_type = 'residence' AND sender_user_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage all messages" ON public.application_messages;
CREATE POLICY "Admins manage all messages" ON public.application_messages FOR ALL
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- ── APPLICATION ACTIVITY LOG ──
DROP POLICY IF EXISTS "System insert activity" ON public.application_activity_log;
CREATE POLICY "System insert activity" ON public.application_activity_log FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins view all activity" ON public.application_activity_log;
CREATE POLICY "Admins view all activity" ON public.application_activity_log FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Residence portal view activity" ON public.application_activity_log;
CREATE POLICY "Residence portal view activity" ON public.application_activity_log FOR SELECT
  USING (is_authorized_residence_user(residence_id));

DROP POLICY IF EXISTS "Residence portal log activity" ON public.application_activity_log;
CREATE POLICY "Residence portal log activity" ON public.application_activity_log FOR INSERT
  WITH CHECK (is_authorized_residence_user(residence_id) AND actor_type = 'residence' AND actor_user_id = auth.uid());

-- ── REFERRAL CLAIMS ──
DROP POLICY IF EXISTS "System insert claims" ON public.referral_claims;
CREATE POLICY "System insert claims" ON public.referral_claims FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins manage all claims" ON public.referral_claims;
CREATE POLICY "Admins manage all claims" ON public.referral_claims FOR ALL
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Residence portal view claims" ON public.referral_claims;
CREATE POLICY "Residence portal view claims" ON public.referral_claims FOR SELECT
  USING (is_authorized_residence_user(residence_id));

-- ── RESIDENCE ANALYTICS ──
DROP POLICY IF EXISTS "Anyone can track analytics" ON public.residence_analytics;
CREATE POLICY "Anyone can track analytics" ON public.residence_analytics FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view analytics" ON public.residence_analytics;
CREATE POLICY "Admins can view analytics" ON public.residence_analytics FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- ── RESIDENCE SECTIONS (NEW in v5) ──
DROP POLICY IF EXISTS "Anyone can view active sections" ON public.residence_sections;
CREATE POLICY "Anyone can view active sections" ON public.residence_sections FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins manage sections" ON public.residence_sections;
CREATE POLICY "Admins manage sections" ON public.residence_sections FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- ── HERO SLIDES ──
DROP POLICY IF EXISTS "Anyone can view active hero slides" ON public.hero_slides;
CREATE POLICY "Anyone can view active hero slides" ON public.hero_slides FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage hero slides" ON public.hero_slides;
CREATE POLICY "Admins can manage hero slides" ON public.hero_slides FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ── CAMPUS NEWS ──
DROP POLICY IF EXISTS "Anyone can view published news" ON public.campus_news;
CREATE POLICY "Anyone can view published news" ON public.campus_news FOR SELECT USING (is_published = true);

DROP POLICY IF EXISTS "Admins can manage news" ON public.campus_news;
CREATE POLICY "Admins can manage news" ON public.campus_news FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ── EVENTS ──
DROP POLICY IF EXISTS "Anyone can view events" ON public.events;
CREATE POLICY "Anyone can view events" ON public.events FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create events" ON public.events;
CREATE POLICY "Authenticated users can create events" ON public.events FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can update their own events" ON public.events;
CREATE POLICY "Users can update their own events" ON public.events FOR UPDATE USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can delete their own events" ON public.events;
CREATE POLICY "Users can delete their own events" ON public.events FOR DELETE USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Admins can manage events" ON public.events;
CREATE POLICY "Admins can manage events" ON public.events FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ── BURSARIES ──
DROP POLICY IF EXISTS "Anyone can view active bursaries" ON public.bursaries;
CREATE POLICY "Anyone can view active bursaries" ON public.bursaries FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage bursaries" ON public.bursaries;
CREATE POLICY "Admins can manage bursaries" ON public.bursaries FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ── STUDENT DISCOUNTS ──
DROP POLICY IF EXISTS "Anyone can view active discounts" ON public.student_discounts;
CREATE POLICY "Anyone can view active discounts" ON public.student_discounts FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage discounts" ON public.student_discounts;
CREATE POLICY "Admins can manage discounts" ON public.student_discounts FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ── DISCOUNT ORDERS ──
DROP POLICY IF EXISTS "Users can view their own orders" ON public.discount_orders;
CREATE POLICY "Users can view their own orders" ON public.discount_orders FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create orders" ON public.discount_orders;
CREATE POLICY "Users can create orders" ON public.discount_orders FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all orders" ON public.discount_orders;
CREATE POLICY "Admins can manage all orders" ON public.discount_orders FOR ALL
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- ── HAMPER ITEMS ──
DROP POLICY IF EXISTS "Anyone can view active hamper items" ON public.hamper_items;
CREATE POLICY "Anyone can view active hamper items" ON public.hamper_items FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage hamper items" ON public.hamper_items;
CREATE POLICY "Admins can manage hamper items" ON public.hamper_items FOR ALL
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- ── STUDENT HAMPER PREFERENCES ──
DROP POLICY IF EXISTS "Users can manage own preferences" ON public.student_hamper_preferences;
CREATE POLICY "Users can manage own preferences" ON public.student_hamper_preferences FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all preferences" ON public.student_hamper_preferences;
CREATE POLICY "Admins can view all preferences" ON public.student_hamper_preferences FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- ── STORES ──
DROP POLICY IF EXISTS "Anyone can view active stores" ON public.stores;
CREATE POLICY "Anyone can view active stores" ON public.stores FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Users can view their own store" ON public.stores;
CREATE POLICY "Users can view their own store" ON public.stores FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own store" ON public.stores;
CREATE POLICY "Users can create their own store" ON public.stores FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own store" ON public.stores;
CREATE POLICY "Users can update their own store" ON public.stores FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own store" ON public.stores;
CREATE POLICY "Users can delete their own store" ON public.stores FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all stores" ON public.stores;
CREATE POLICY "Admins can view all stores" ON public.stores FOR SELECT USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update all stores" ON public.stores;
CREATE POLICY "Admins can update all stores" ON public.stores FOR UPDATE USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete stores" ON public.stores;
CREATE POLICY "Admins can delete stores" ON public.stores FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- ── MARKETPLACE LISTINGS ──
DROP POLICY IF EXISTS "Everyone can view verified active listings" ON public.marketplace_listings;
CREATE POLICY "Everyone can view verified active listings" ON public.marketplace_listings FOR SELECT
  USING ((status = 'active' AND verified = true) OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Students can create listings" ON public.marketplace_listings;
CREATE POLICY "Students can create listings" ON public.marketplace_listings FOR INSERT
  WITH CHECK (auth.uid() = user_id AND has_role(auth.uid(), 'student'));

DROP POLICY IF EXISTS "Users can update their own listings" ON public.marketplace_listings;
CREATE POLICY "Users can update their own listings" ON public.marketplace_listings FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own listings" ON public.marketplace_listings;
CREATE POLICY "Users can delete their own listings" ON public.marketplace_listings FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all marketplace listings" ON public.marketplace_listings;
CREATE POLICY "Admins can view all marketplace listings" ON public.marketplace_listings FOR SELECT USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update all marketplace listings" ON public.marketplace_listings;
CREATE POLICY "Admins can update all marketplace listings" ON public.marketplace_listings FOR UPDATE USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete marketplace listings" ON public.marketplace_listings;
CREATE POLICY "Admins can delete marketplace listings" ON public.marketplace_listings FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- ── MARKETPLACE ORDERS ──
DROP POLICY IF EXISTS "Buyers can view their orders" ON public.marketplace_orders;
CREATE POLICY "Buyers can view their orders" ON public.marketplace_orders FOR SELECT USING (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Sellers can view their orders" ON public.marketplace_orders;
CREATE POLICY "Sellers can view their orders" ON public.marketplace_orders FOR SELECT USING (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Buyers can create orders" ON public.marketplace_orders;
CREATE POLICY "Buyers can create orders" ON public.marketplace_orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Sellers can update order status" ON public.marketplace_orders;
CREATE POLICY "Sellers can update order status" ON public.marketplace_orders FOR UPDATE USING (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Admins can view all orders" ON public.marketplace_orders;
CREATE POLICY "Admins can view all orders" ON public.marketplace_orders FOR SELECT USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update all orders" ON public.marketplace_orders;
CREATE POLICY "Admins can update all orders" ON public.marketplace_orders FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- ── STORE REVIEWS ──
DROP POLICY IF EXISTS "Anyone can view store reviews" ON public.store_reviews;
CREATE POLICY "Anyone can view store reviews" ON public.store_reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create reviews" ON public.store_reviews;
CREATE POLICY "Authenticated users can create reviews" ON public.store_reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

DROP POLICY IF EXISTS "Users can update their own reviews" ON public.store_reviews;
CREATE POLICY "Users can update their own reviews" ON public.store_reviews FOR UPDATE USING (auth.uid() = reviewer_id);

DROP POLICY IF EXISTS "Users can delete their own reviews" ON public.store_reviews;
CREATE POLICY "Users can delete their own reviews" ON public.store_reviews FOR DELETE USING (auth.uid() = reviewer_id);

-- ── PRODUCT CATEGORIES (NEW in v5) ──
DROP POLICY IF EXISTS "anyone_view_categories" ON public.product_categories;
CREATE POLICY "anyone_view_categories" ON public.product_categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "admins_manage_categories" ON public.product_categories;
CREATE POLICY "admins_manage_categories" ON public.product_categories FOR ALL
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- ── PRODUCTS (NEW in v5) ──
DROP POLICY IF EXISTS "anyone_view_active_products" ON public.products;
CREATE POLICY "anyone_view_active_products" ON public.products FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "sellers_manage_own_products" ON public.products;
CREATE POLICY "sellers_manage_own_products" ON public.products FOR ALL
  USING (EXISTS (SELECT 1 FROM stores WHERE stores.id = products.store_id AND stores.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM stores WHERE stores.id = products.store_id AND stores.user_id = auth.uid()));

DROP POLICY IF EXISTS "admins_manage_all_products" ON public.products;
CREATE POLICY "admins_manage_all_products" ON public.products FOR ALL
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- ── PRODUCT VARIANTS (NEW in v5) ──
DROP POLICY IF EXISTS "anyone_view_variants" ON public.product_variants;
CREATE POLICY "anyone_view_variants" ON public.product_variants FOR SELECT USING (true);

DROP POLICY IF EXISTS "sellers_manage_own_variants" ON public.product_variants;
CREATE POLICY "sellers_manage_own_variants" ON public.product_variants FOR ALL
  USING (EXISTS (SELECT 1 FROM products p JOIN stores s ON s.id = p.store_id WHERE p.id = product_variants.product_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM products p JOIN stores s ON s.id = p.store_id WHERE p.id = product_variants.product_id AND s.user_id = auth.uid()));

DROP POLICY IF EXISTS "admins_manage_all_variants" ON public.product_variants;
CREATE POLICY "admins_manage_all_variants" ON public.product_variants FOR ALL
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- ── CART (NEW in v5) ──
DROP POLICY IF EXISTS "users_manage_own_cart" ON public.cart;
CREATE POLICY "users_manage_own_cart" ON public.cart FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── CART ITEMS (NEW in v5) ──
DROP POLICY IF EXISTS "users_manage_own_cart_items" ON public.cart_items;
CREATE POLICY "users_manage_own_cart_items" ON public.cart_items FOR ALL
  USING (EXISTS (SELECT 1 FROM cart WHERE cart.id = cart_items.cart_id AND cart.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM cart WHERE cart.id = cart_items.cart_id AND cart.user_id = auth.uid()));

-- ── SHOP ORDERS (NEW in v5) ──
DROP POLICY IF EXISTS "users_manage_own_shop_orders" ON public.shop_orders;
CREATE POLICY "users_manage_own_shop_orders" ON public.shop_orders FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins_manage_all_shop_orders" ON public.shop_orders;
CREATE POLICY "admins_manage_all_shop_orders" ON public.shop_orders FOR ALL
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- ── SHOP ORDER ITEMS (NEW in v5) ──
DROP POLICY IF EXISTS "users_view_own_shop_order_items" ON public.shop_order_items;
CREATE POLICY "users_view_own_shop_order_items" ON public.shop_order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM shop_orders WHERE shop_orders.id = shop_order_items.order_id AND shop_orders.user_id = auth.uid()));

DROP POLICY IF EXISTS "sellers_view_their_order_items" ON public.shop_order_items;
CREATE POLICY "sellers_view_their_order_items" ON public.shop_order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM stores WHERE stores.id = shop_order_items.store_id AND stores.user_id = auth.uid()));

DROP POLICY IF EXISTS "system_insert_shop_order_items" ON public.shop_order_items;
CREATE POLICY "system_insert_shop_order_items" ON public.shop_order_items FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "admins_manage_all_shop_order_items" ON public.shop_order_items;
CREATE POLICY "admins_manage_all_shop_order_items" ON public.shop_order_items FOR ALL
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- ── ORDER STATUS HISTORY (NEW in v5) ──
DROP POLICY IF EXISTS "users_view_own_order_history" ON public.order_status_history;
CREATE POLICY "users_view_own_order_history" ON public.order_status_history FOR SELECT
  USING (EXISTS (SELECT 1 FROM shop_orders WHERE shop_orders.id = order_status_history.order_id AND shop_orders.user_id = auth.uid()));

DROP POLICY IF EXISTS "system_insert_order_history" ON public.order_status_history;
CREATE POLICY "system_insert_order_history" ON public.order_status_history FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "admins_manage_all_order_history" ON public.order_status_history;
CREATE POLICY "admins_manage_all_order_history" ON public.order_status_history FOR ALL
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- ── PAYMENTS (NEW in v5) ──
DROP POLICY IF EXISTS "users_view_own_payments" ON public.payments;
CREATE POLICY "users_view_own_payments" ON public.payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM shop_orders WHERE shop_orders.id = payments.order_id AND shop_orders.user_id = auth.uid()));

DROP POLICY IF EXISTS "system_insert_payments" ON public.payments;
CREATE POLICY "system_insert_payments" ON public.payments FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "admins_manage_all_payments" ON public.payments;
CREATE POLICY "admins_manage_all_payments" ON public.payments FOR ALL
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- ── HAMPERS (NEW in v5) ──
DROP POLICY IF EXISTS "anyone_view_active_hampers" ON public.hampers;
CREATE POLICY "anyone_view_active_hampers" ON public.hampers FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "admins_manage_all_hampers" ON public.hampers;
CREATE POLICY "admins_manage_all_hampers" ON public.hampers FOR ALL
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- ── HAMPER BUNDLE ITEMS (NEW in v5) ──
DROP POLICY IF EXISTS "anyone_view_hamper_bundle_items" ON public.hamper_bundle_items;
CREATE POLICY "anyone_view_hamper_bundle_items" ON public.hamper_bundle_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "admins_manage_hamper_bundle_items" ON public.hamper_bundle_items;
CREATE POLICY "admins_manage_hamper_bundle_items" ON public.hamper_bundle_items FOR ALL
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- ── HAMPER ORDERS (NEW in v5) ──
DROP POLICY IF EXISTS "users_manage_own_hamper_orders" ON public.hamper_orders;
CREATE POLICY "users_manage_own_hamper_orders" ON public.hamper_orders FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins_manage_all_hamper_orders" ON public.hamper_orders;
CREATE POLICY "admins_manage_all_hamper_orders" ON public.hamper_orders FOR ALL
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- ── HAMPER ORDER ITEMS (NEW in v5) ──
DROP POLICY IF EXISTS "users_view_own_hamper_order_items" ON public.hamper_order_items;
CREATE POLICY "users_view_own_hamper_order_items" ON public.hamper_order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM hamper_orders WHERE hamper_orders.id = hamper_order_items.order_id AND hamper_orders.user_id = auth.uid()));

DROP POLICY IF EXISTS "system_insert_hamper_order_items" ON public.hamper_order_items;
CREATE POLICY "system_insert_hamper_order_items" ON public.hamper_order_items FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "admins_manage_all_hamper_order_items" ON public.hamper_order_items;
CREATE POLICY "admins_manage_all_hamper_order_items" ON public.hamper_order_items FOR ALL
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- ── WHATSAPP TEMPLATES ──
DROP POLICY IF EXISTS "Anyone can view active templates" ON public.whatsapp_templates;
CREATE POLICY "Anyone can view active templates" ON public.whatsapp_templates FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage templates" ON public.whatsapp_templates;
CREATE POLICY "Admins can manage templates" ON public.whatsapp_templates FOR ALL
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- ── CALL LOGS ──
DROP POLICY IF EXISTS "Admins can manage call logs" ON public.call_logs;
CREATE POLICY "Admins can manage call logs" ON public.call_logs FOR ALL
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- ── PLATFORM SETTINGS ──
DROP POLICY IF EXISTS "Admins can manage settings" ON public.platform_settings;
CREATE POLICY "Admins can manage settings" ON public.platform_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- ── WIL APPLICATIONS ──
DROP POLICY IF EXISTS "students_insert_own_wil" ON public.wil_applications;
CREATE POLICY "students_insert_own_wil" ON public.wil_applications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "students_select_own_wil" ON public.wil_applications;
CREATE POLICY "students_select_own_wil" ON public.wil_applications FOR SELECT
  TO authenticated USING (auth.uid() = student_id OR has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "students_update_own_wil" ON public.wil_applications;
CREATE POLICY "students_update_own_wil" ON public.wil_applications FOR UPDATE
  TO authenticated USING (auth.uid() = student_id AND status = 'submitted')
  WITH CHECK (auth.uid() = student_id AND status = 'submitted');

DROP POLICY IF EXISTS "admins_all_wil_applications" ON public.wil_applications;
CREATE POLICY "admins_all_wil_applications" ON public.wil_applications FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- ── WIL DOCUMENTS ──
DROP POLICY IF EXISTS "students_insert_own_wil_docs" ON public.wil_documents;
CREATE POLICY "students_insert_own_wil_docs" ON public.wil_documents FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "students_select_own_wil_docs" ON public.wil_documents;
CREATE POLICY "students_select_own_wil_docs" ON public.wil_documents FOR SELECT
  TO authenticated USING (auth.uid() = student_id OR has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins_all_wil_documents" ON public.wil_documents;
CREATE POLICY "admins_all_wil_documents" ON public.wil_documents FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- ── WIL ADMIN NOTES ──
DROP POLICY IF EXISTS "admins_all_wil_notes" ON public.wil_admin_notes;
CREATE POLICY "admins_all_wil_notes" ON public.wil_admin_notes FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- ── WIL ASSIGNMENTS ──
DROP POLICY IF EXISTS "admins_all_wil_assignments" ON public.wil_assignments;
CREATE POLICY "admins_all_wil_assignments" ON public.wil_assignments FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- ─────────────────────────────────────────────────────
-- 11. TRIGGERS
-- ─────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_residences_updated_at ON public.residences;
CREATE TRIGGER update_residences_updated_at BEFORE UPDATE ON public.residences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_applications_updated_at ON public.applications;
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_stores_updated_at ON public.stores;
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_marketplace_listings_updated_at ON public.marketplace_listings;
CREATE TRIGGER update_marketplace_listings_updated_at BEFORE UPDATE ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_marketplace_orders_updated_at ON public.marketplace_orders;
CREATE TRIGGER update_marketplace_orders_updated_at BEFORE UPDATE ON public.marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_residence_portal_accounts_updated_at ON public.residence_portal_accounts;
CREATE TRIGGER update_residence_portal_accounts_updated_at BEFORE UPDATE ON public.residence_portal_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_wil_applications_updated_at ON public.wil_applications;
CREATE TRIGGER update_wil_applications_updated_at BEFORE UPDATE ON public.wil_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_shop_orders_updated_at ON public.shop_orders;
CREATE TRIGGER update_shop_orders_updated_at BEFORE UPDATE ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_hamper_orders_updated_at ON public.hamper_orders;
CREATE TRIGGER update_hamper_orders_updated_at BEFORE UPDATE ON public.hamper_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_hampers_updated_at ON public.hampers;
CREATE TRIGGER update_hampers_updated_at BEFORE UPDATE ON public.hampers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- New user trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Prevent deleting last admin
DROP TRIGGER IF EXISTS prevent_last_admin_delete ON public.user_roles;
CREATE TRIGGER prevent_last_admin_delete
  BEFORE DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_last_admin_deletion();

-- ─────────────────────────────────────────────────────
-- 12. EXPLICIT FK CONSTRAINTS (for PostgREST joins)
-- ─────────────────────────────────────────────────────

DO $$ BEGIN ALTER TABLE public.applications ADD CONSTRAINT fk_applications_user FOREIGN KEY (user_id) REFERENCES public.profiles(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.applications ADD CONSTRAINT fk_applications_residence FOREIGN KEY (residence_id) REFERENCES public.residences(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.documents ADD CONSTRAINT fk_documents_user FOREIGN KEY (user_id) REFERENCES public.profiles(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.notifications ADD CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES public.profiles(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.favorites ADD CONSTRAINT fk_favorites_user FOREIGN KEY (user_id) REFERENCES public.profiles(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.favorites ADD CONSTRAINT fk_favorites_residence FOREIGN KEY (residence_id) REFERENCES public.residences(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.residence_portal_accounts ADD CONSTRAINT fk_portal_accounts_residence FOREIGN KEY (residence_id) REFERENCES public.residences(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.application_documents ADD CONSTRAINT fk_app_docs_application FOREIGN KEY (application_id) REFERENCES public.applications(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.application_documents ADD CONSTRAINT fk_app_docs_residence FOREIGN KEY (residence_id) REFERENCES public.residences(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.application_messages ADD CONSTRAINT fk_app_messages_application FOREIGN KEY (application_id) REFERENCES public.applications(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.application_messages ADD CONSTRAINT fk_app_messages_residence FOREIGN KEY (residence_id) REFERENCES public.residences(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.application_activity_log ADD CONSTRAINT fk_activity_log_application FOREIGN KEY (application_id) REFERENCES public.applications(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.application_activity_log ADD CONSTRAINT fk_activity_log_residence FOREIGN KEY (residence_id) REFERENCES public.residences(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.referral_claims ADD CONSTRAINT fk_referral_claims_application FOREIGN KEY (application_id) REFERENCES public.applications(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.referral_claims ADD CONSTRAINT fk_referral_claims_residence FOREIGN KEY (residence_id) REFERENCES public.residences(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.residence_analytics ADD CONSTRAINT fk_residence_analytics_residence FOREIGN KEY (residence_id) REFERENCES public.residences(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.residence_analytics ADD CONSTRAINT fk_residence_analytics_user FOREIGN KEY (user_id) REFERENCES public.profiles(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.discount_orders ADD CONSTRAINT fk_discount_orders_user FOREIGN KEY (user_id) REFERENCES public.profiles(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.discount_orders ADD CONSTRAINT fk_discount_orders_discount FOREIGN KEY (discount_id) REFERENCES public.student_discounts(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.marketplace_listings ADD CONSTRAINT fk_marketplace_listings_user FOREIGN KEY (user_id) REFERENCES public.profiles(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.marketplace_listings ADD CONSTRAINT fk_marketplace_listings_store FOREIGN KEY (store_id) REFERENCES public.stores(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.marketplace_orders ADD CONSTRAINT fk_marketplace_orders_listing FOREIGN KEY (listing_id) REFERENCES public.marketplace_listings(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.marketplace_orders ADD CONSTRAINT fk_marketplace_orders_buyer FOREIGN KEY (buyer_id) REFERENCES public.profiles(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.marketplace_orders ADD CONSTRAINT fk_marketplace_orders_seller FOREIGN KEY (seller_id) REFERENCES public.profiles(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.call_logs ADD CONSTRAINT fk_call_logs_student FOREIGN KEY (student_id) REFERENCES public.profiles(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.cart ADD CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES public.profiles(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.cart_items ADD CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES public.cart(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.cart_items ADD CONSTRAINT fk_cart_items_product FOREIGN KEY (product_id) REFERENCES public.products(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.cart_items ADD CONSTRAINT fk_cart_items_variant FOREIGN KEY (variant_id) REFERENCES public.product_variants(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.products ADD CONSTRAINT fk_products_store FOREIGN KEY (store_id) REFERENCES public.stores(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.products ADD CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES public.product_categories(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.product_variants ADD CONSTRAINT fk_product_variants_product FOREIGN KEY (product_id) REFERENCES public.products(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_order_items ADD CONSTRAINT fk_shop_order_items_order FOREIGN KEY (order_id) REFERENCES public.shop_orders(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_order_items ADD CONSTRAINT fk_shop_order_items_product FOREIGN KEY (product_id) REFERENCES public.products(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_order_items ADD CONSTRAINT fk_shop_order_items_store FOREIGN KEY (store_id) REFERENCES public.stores(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.order_status_history ADD CONSTRAINT fk_order_status_history_order FOREIGN KEY (order_id) REFERENCES public.shop_orders(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.payments ADD CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES public.shop_orders(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.hamper_bundle_items ADD CONSTRAINT fk_hamper_bundle_items_hamper FOREIGN KEY (hamper_id) REFERENCES public.hampers(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.hamper_order_items ADD CONSTRAINT fk_hamper_order_items_order FOREIGN KEY (order_id) REFERENCES public.hamper_orders(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.hamper_order_items ADD CONSTRAINT fk_hamper_order_items_hamper FOREIGN KEY (hamper_id) REFERENCES public.hampers(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.hamper_orders ADD CONSTRAINT fk_hamper_orders_user FOREIGN KEY (user_id) REFERENCES public.profiles(id); EXCEPTION WHEN others THEN NULL; END $$;

-- ─────────────────────────────────────────────────────
-- 13. INDEXES (Performance)
-- ─────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_applications_user_id ON public.applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_residence_id ON public.applications(residence_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications(status);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_reviews_residence_id ON public.reviews(residence_id);
CREATE INDEX IF NOT EXISTS idx_residence_analytics_residence_id ON public.residence_analytics(residence_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_store_id ON public.marketplace_listings(store_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON public.marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_buyer_id ON public.marketplace_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_seller_id ON public.marketplace_orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_discount_orders_user_id ON public.discount_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_wil_applications_student_id ON public.wil_applications(student_id);
CREATE INDEX IF NOT EXISTS idx_wil_documents_application_id ON public.wil_documents(application_id);
CREATE INDEX IF NOT EXISTS idx_application_documents_application_id ON public.application_documents(application_id);
CREATE INDEX IF NOT EXISTS idx_application_messages_application_id ON public.application_messages(application_id);
CREATE INDEX IF NOT EXISTS idx_referral_claims_residence_id ON public.referral_claims(residence_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_student_id ON public.call_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_stores_user_id ON public.stores(user_id);
-- New v5 indexes
CREATE INDEX IF NOT EXISTS idx_products_store_id ON public.products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_user_id ON public.cart(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON public.cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_user_id ON public.shop_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_order_items_order_id ON public.shop_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_shop_order_items_store_id ON public.shop_order_items(store_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON public.order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_hampers_is_active ON public.hampers(is_active);
CREATE INDEX IF NOT EXISTS idx_hamper_orders_user_id ON public.hamper_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_hero_slides_location ON public.hero_slides(slide_location);
CREATE INDEX IF NOT EXISTS idx_residence_sections_slug ON public.residence_sections(slug);
CREATE INDEX IF NOT EXISTS idx_residences_section_category ON public.residences(section_category);

-- ─────────────────────────────────────────────────────
-- 14. STORAGE BUCKETS
-- ─────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('application-documents', 'application-documents', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-pictures', 'profile-pictures', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('admin-images', 'admin-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('marketplace', 'marketplace', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('store-assets', 'store-assets', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('wil-documents', 'wil-documents', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('hamper-images', 'hamper-images', true) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────
-- 15. STORAGE POLICIES
-- ─────────────────────────────────────────────────────

-- Profile pictures
DROP POLICY IF EXISTS "Users can upload their own profile picture" ON storage.objects;
CREATE POLICY "Users can upload their own profile picture" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update their own profile picture" ON storage.objects;
CREATE POLICY "Users can update their own profile picture" ON storage.objects
  FOR UPDATE USING (bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete their own profile picture" ON storage.objects;
CREATE POLICY "Users can delete their own profile picture" ON storage.objects
  FOR DELETE USING (bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Profile pictures are publicly accessible" ON storage.objects;
CREATE POLICY "Profile pictures are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'profile-pictures');

-- Documents bucket
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
CREATE POLICY "Users can upload their own documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
CREATE POLICY "Users can view their own documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin')));

DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
CREATE POLICY "Users can delete their own documents" ON storage.objects
  FOR DELETE USING (bucket_id = 'documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin')));

-- Admin images
DROP POLICY IF EXISTS "Admin images are publicly accessible" ON storage.objects;
CREATE POLICY "Admin images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'admin-images');

DROP POLICY IF EXISTS "Admins can upload admin images" ON storage.objects;
CREATE POLICY "Admins can upload admin images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'admin-images' AND has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete admin images" ON storage.objects;
CREATE POLICY "Admins can delete admin images" ON storage.objects
  FOR DELETE USING (bucket_id = 'admin-images' AND has_role(auth.uid(), 'admin'));

-- Marketplace
DROP POLICY IF EXISTS "Marketplace images are publicly accessible" ON storage.objects;
CREATE POLICY "Marketplace images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'marketplace');

DROP POLICY IF EXISTS "Users can upload marketplace images" ON storage.objects;
CREATE POLICY "Users can upload marketplace images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'marketplace' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete marketplace images" ON storage.objects;
CREATE POLICY "Users can delete marketplace images" ON storage.objects
  FOR DELETE USING (bucket_id = 'marketplace' AND auth.uid() IS NOT NULL);

-- Store assets
DROP POLICY IF EXISTS "Store assets are publicly accessible" ON storage.objects;
CREATE POLICY "Store assets are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'store-assets');

DROP POLICY IF EXISTS "Users can upload store assets" ON storage.objects;
CREATE POLICY "Users can upload store assets" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'store-assets' AND auth.uid() IS NOT NULL);

-- Application documents
DROP POLICY IF EXISTS "Users can upload application documents" ON storage.objects;
CREATE POLICY "Users can upload application documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'application-documents' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can view application documents" ON storage.objects;
CREATE POLICY "Users can view application documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'application-documents' AND auth.uid() IS NOT NULL);

-- WIL documents
DROP POLICY IF EXISTS "Students can upload WIL documents" ON storage.objects;
CREATE POLICY "Students can upload WIL documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'wil-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Students can view own WIL documents" ON storage.objects;
CREATE POLICY "Students can view own WIL documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'wil-documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin')));

DROP POLICY IF EXISTS "Students can delete own WIL documents" ON storage.objects;
CREATE POLICY "Students can delete own WIL documents" ON storage.objects
  FOR DELETE USING (bucket_id = 'wil-documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin')));

-- Product images (NEW in v5)
DROP POLICY IF EXISTS "Product images are publicly accessible" ON storage.objects;
CREATE POLICY "Product images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Users can upload product images" ON storage.objects;
CREATE POLICY "Users can upload product images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete product images" ON storage.objects;
CREATE POLICY "Users can delete product images" ON storage.objects
  FOR DELETE USING (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);

-- Hamper images (NEW in v5)
DROP POLICY IF EXISTS "Hamper images are publicly accessible" ON storage.objects;
CREATE POLICY "Hamper images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'hamper-images');

DROP POLICY IF EXISTS "Admins can upload hamper images" ON storage.objects;
CREATE POLICY "Admins can upload hamper images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'hamper-images' AND has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete hamper images" ON storage.objects;
CREATE POLICY "Admins can delete hamper images" ON storage.objects
  FOR DELETE USING (bucket_id = 'hamper-images' AND has_role(auth.uid(), 'admin'));

-- ─────────────────────────────────────────────────────
-- 16. REALTIME
-- ─────────────────────────────────────────────────────

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.applications; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.application_messages; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.application_documents; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.hero_slides; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.residences; EXCEPTION WHEN others THEN NULL; END $$;

-- ─────────────────────────────────────────────────────
-- 17. SEED DATA
-- ─────────────────────────────────────────────────────

-- Seed residence sections
INSERT INTO public.residence_sections (name, slug, subtitle, color, applies_to, display_order, is_active)
VALUES
  ('Flats', 'flats', 'Modern apartment-style living', 'bg-blue-500', 'both', 1, true),
  ('Communes', 'communes', 'Shared communal living spaces', 'bg-green-500', 'both', 2, true),
  ('Rentals', 'rentals', 'Standard rental accommodations', 'bg-orange-500', 'both', 3, true),
  ('Private Accommodations', 'private-accommodations', 'Premium private residences', 'bg-purple-500', 'both', 4, true)
ON CONFLICT (slug) DO NOTHING;

-- Seed dashboard hero slides (only if none exist for dashboard)
INSERT INTO public.hero_slides (title, description, image_url, cta_text, cta_link, display_order, is_active, slide_location)
SELECT * FROM (VALUES
  ('Find Your Perfect Res', 'Discover comfortable, affordable student accommodation near your campus', 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=1200&h=600&fit=crop', 'Browse Residences', '/findmyres', 0, true, 'dashboard'),
  ('Student Grocery Discounts', 'Save up to 30% on grocery hampers specially curated for students', 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&h=600&fit=crop', 'Get Discounts', '/marketplace?tab=deals', 1, true, 'dashboard')
) AS v(title, description, image_url, cta_text, cta_link, display_order, is_active, slide_location)
WHERE NOT EXISTS (SELECT 1 FROM public.hero_slides WHERE slide_location = 'dashboard');

-- Seed default product categories
INSERT INTO public.product_categories (name, slug, display_order)
VALUES
  ('Electronics', 'electronics', 1),
  ('Textbooks', 'textbooks', 2),
  ('Furniture', 'furniture', 3),
  ('Clothing', 'clothing', 4),
  ('Food & Snacks', 'food-snacks', 5),
  ('Stationery', 'stationery', 6),
  ('Services', 'services', 7)
ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────
-- 18. REFRESH SCHEMA CACHE
-- ─────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

-- =====================================================
-- END OF MASTER SQL v5.0
-- 47 tables | 9 functions | 9 storage buckets
-- All policies use has_role() to avoid recursion
-- Safe to rerun on external Supabase
-- =====================================================
