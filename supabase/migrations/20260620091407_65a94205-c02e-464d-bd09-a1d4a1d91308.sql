-- ============================================================
-- RESKONNECT PHASE 1A — MIGRATION PACK 1/3 (storage stripped)
-- ============================================================

-- 1. ENUMS
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'student', 'residence_portal');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'residence_portal'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operations_lead'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'commerce_lead'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'growth_lead'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'system_operator'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support_agent'; EXCEPTION WHEN others THEN NULL; END $$;

-- 2. CORE TABLES
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

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, role)
);

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
  application_term TEXT DEFAULT 'standard',
  application_year INTEGER DEFAULT 2026,
  application_date TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

DO $$ BEGIN ALTER TABLE public.applications ADD COLUMN application_term TEXT DEFAULT 'standard'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.applications ADD COLUMN application_year INTEGER DEFAULT 2026; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

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

CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  residence_id UUID NOT NULL REFERENCES public.residences(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, residence_id)
);

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

CREATE TABLE IF NOT EXISTS public.residence_portal_accounts (
  residence_id UUID PRIMARY KEY REFERENCES public.residences(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

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

CREATE TABLE IF NOT EXISTS public.application_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  residence_id UUID NOT NULL REFERENCES public.residences(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL,
  sender_user_id UUID,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

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

CREATE TABLE IF NOT EXISTS public.residence_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  residence_id UUID NOT NULL REFERENCES public.residences(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type VARCHAR NOT NULL,
  session_id VARCHAR,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

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

-- 3. CONTENT TABLES
CREATE TABLE IF NOT EXISTS public.hero_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  cta_text TEXT,
  cta_link TEXT,
  display_order INTEGER DEFAULT 0 NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  slide_location TEXT NOT NULL DEFAULT 'landing',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

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

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB DEFAULT '{}'::jsonb NOT NULL,
  description TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

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

-- 4. ACCREDITATION
CREATE TABLE IF NOT EXISTS public.landlord_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  application_type TEXT NOT NULL DEFAULT 'accreditation',
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  business_name TEXT,
  residence_name TEXT,
  address TEXT,
  city TEXT,
  province TEXT,
  campus TEXT,
  capacity INTEGER,
  monthly_rent NUMERIC,
  amenities TEXT[],
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.landlord_application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.landlord_applications(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  original_filename TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  uploaded_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. FUNCTIONS
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public SET row_security = off AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_authorized_residence_user(target_residence_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public SET row_security = off AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.residence_portal_accounts rpa
    WHERE rpa.user_id = auth.uid() AND rpa.is_active = true AND rpa.residence_id = target_residence_id
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_residence_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public SET row_security = off AS $$
  SELECT residence_id FROM public.residence_portal_accounts
  WHERE user_id = auth.uid() AND is_active = true LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.generate_ref_code(app_id UUID)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT UPPER(SUBSTRING(REPLACE(app_id::text, '-', '') FROM 1 FOR 8))
$$;

CREATE OR REPLACE FUNCTION public.get_user_staff_role(_user_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public SET row_security = off AS $$
  SELECT role::text FROM public.user_roles
  WHERE user_id = _user_id
    AND role::text IN ('admin','operations_lead','commerce_lead','growth_lead','system_operator','support_agent')
  ORDER BY CASE role::text
    WHEN 'admin' THEN 1 WHEN 'system_operator' THEN 2 WHEN 'operations_lead' THEN 3
    WHEN 'commerce_lead' THEN 4 WHEN 'growth_lead' THEN 5 WHEN 'support_agent' THEN 6 END
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email TEXT;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student')
  ON CONFLICT (user_id, role) DO NOTHING;
  _email := LOWER(NEW.email);
  IF _email IN ('43v3r2a11@gmail.com','reskonnect@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.prevent_last_admin_deletion()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.role = 'admin' AND (SELECT COUNT(*) FROM user_roles WHERE role = 'admin') <= 1 THEN
    RAISE EXCEPTION 'Cannot delete the last admin role';
  END IF;
  RETURN OLD;
END; $$;

-- 6. TRIGGERS
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_residences_updated_at ON public.residences;
CREATE TRIGGER update_residences_updated_at BEFORE UPDATE ON public.residences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_applications_updated_at ON public.applications;
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_residence_portal_accounts_updated_at ON public.residence_portal_accounts;
CREATE TRIGGER update_residence_portal_accounts_updated_at BEFORE UPDATE ON public.residence_portal_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_landlord_applications_updated_at ON public.landlord_applications;
CREATE TRIGGER update_landlord_applications_updated_at BEFORE UPDATE ON public.landlord_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
DROP TRIGGER IF EXISTS prevent_last_admin_delete ON public.user_roles;
CREATE TRIGGER prevent_last_admin_delete BEFORE DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_last_admin_deletion();

-- 7. GRANTS
GRANT SELECT ON public.residences TO anon, authenticated;
GRANT SELECT ON public.residence_sections TO anon, authenticated;
GRANT SELECT ON public.hero_slides TO anon, authenticated;
GRANT SELECT ON public.campus_news TO anon, authenticated;
GRANT SELECT ON public.events TO anon, authenticated;
GRANT SELECT ON public.bursaries TO anon, authenticated;
GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT SELECT ON public.platform_settings TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_activity_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_claims TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favorites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.residence_portal_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.residences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.residence_sections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.residence_analytics TO authenticated;
GRANT INSERT ON public.residence_analytics TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hero_slides TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campus_news TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bursaries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landlord_applications TO authenticated;
GRANT INSERT ON public.landlord_applications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landlord_application_documents TO authenticated;
GRANT INSERT ON public.landlord_application_documents TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- 8. RLS
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
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landlord_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landlord_application_documents ENABLE ROW LEVEL SECURITY;

-- 9. POLICIES
DROP POLICY IF EXISTS p_prof_self_sel ON public.profiles;
CREATE POLICY p_prof_self_sel ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS p_prof_self_upd ON public.profiles;
CREATE POLICY p_prof_self_upd ON public.profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS p_prof_self_ins ON public.profiles;
CREATE POLICY p_prof_self_ins ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS p_prof_admin_sel ON public.profiles;
CREATE POLICY p_prof_admin_sel ON public.profiles FOR SELECT USING (has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS p_prof_roommate ON public.profiles;
CREATE POLICY p_prof_roommate ON public.profiles FOR SELECT USING (looking_for_roommate = true);

DROP POLICY IF EXISTS p_roles_self_sel ON public.user_roles;
CREATE POLICY p_roles_self_sel ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS p_roles_admin_sel ON public.user_roles;
CREATE POLICY p_roles_admin_sel ON public.user_roles FOR SELECT USING (has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS p_roles_admin_all ON public.user_roles;
CREATE POLICY p_roles_admin_all ON public.user_roles FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS p_res_public ON public.residences;
CREATE POLICY p_res_public ON public.residences FOR SELECT USING (true);
DROP POLICY IF EXISTS p_res_admin ON public.residences;
CREATE POLICY p_res_admin ON public.residences FOR ALL USING (has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS p_app_self_sel ON public.applications;
CREATE POLICY p_app_self_sel ON public.applications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS p_app_self_ins ON public.applications;
CREATE POLICY p_app_self_ins ON public.applications FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS p_app_admin_sel ON public.applications;
CREATE POLICY p_app_admin_sel ON public.applications FOR SELECT USING (has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS p_app_admin_upd ON public.applications;
CREATE POLICY p_app_admin_upd ON public.applications FOR UPDATE USING (has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS p_app_portal_sel ON public.applications;
CREATE POLICY p_app_portal_sel ON public.applications FOR SELECT USING (is_authorized_residence_user(residence_id));
DROP POLICY IF EXISTS p_app_portal_upd ON public.applications;
CREATE POLICY p_app_portal_upd ON public.applications FOR UPDATE USING (is_authorized_residence_user(residence_id));

DROP POLICY IF EXISTS p_doc_self_sel ON public.documents;
CREATE POLICY p_doc_self_sel ON public.documents FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS p_doc_self_ins ON public.documents;
CREATE POLICY p_doc_self_ins ON public.documents FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS p_doc_self_del ON public.documents;
CREATE POLICY p_doc_self_del ON public.documents FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS p_doc_admin_sel ON public.documents;
CREATE POLICY p_doc_admin_sel ON public.documents FOR SELECT USING (has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS p_notif_self_sel ON public.notifications;
CREATE POLICY p_notif_self_sel ON public.notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS p_notif_self_upd ON public.notifications;
CREATE POLICY p_notif_self_upd ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS p_notif_sys_ins ON public.notifications;
CREATE POLICY p_notif_sys_ins ON public.notifications FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS p_fav_self_sel ON public.favorites;
CREATE POLICY p_fav_self_sel ON public.favorites FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS p_fav_self_ins ON public.favorites;
CREATE POLICY p_fav_self_ins ON public.favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS p_fav_self_del ON public.favorites;
CREATE POLICY p_fav_self_del ON public.favorites FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS p_rev_pub_sel ON public.reviews;
CREATE POLICY p_rev_pub_sel ON public.reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS p_rev_auth_ins ON public.reviews;
CREATE POLICY p_rev_auth_ins ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS p_rev_self_upd ON public.reviews;
CREATE POLICY p_rev_self_upd ON public.reviews FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS p_rev_self_del ON public.reviews;
CREATE POLICY p_rev_self_del ON public.reviews FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS p_rpa_admin ON public.residence_portal_accounts;
CREATE POLICY p_rpa_admin ON public.residence_portal_accounts FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS p_rpa_self_sel ON public.residence_portal_accounts;
CREATE POLICY p_rpa_self_sel ON public.residence_portal_accounts FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS p_ad_self_sel ON public.application_documents;
CREATE POLICY p_ad_self_sel ON public.application_documents FOR SELECT
  USING (EXISTS (SELECT 1 FROM applications a WHERE a.id = application_documents.application_id AND a.user_id = auth.uid()));
DROP POLICY IF EXISTS p_ad_self_ins ON public.application_documents;
CREATE POLICY p_ad_self_ins ON public.application_documents FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM applications a WHERE a.id = application_documents.application_id AND a.user_id = auth.uid()));
DROP POLICY IF EXISTS p_ad_admin ON public.application_documents;
CREATE POLICY p_ad_admin ON public.application_documents FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS p_ad_portal_sel ON public.application_documents;
CREATE POLICY p_ad_portal_sel ON public.application_documents FOR SELECT USING (is_authorized_residence_user(residence_id));
DROP POLICY IF EXISTS p_ad_portal_upd ON public.application_documents;
CREATE POLICY p_ad_portal_upd ON public.application_documents FOR UPDATE USING (is_authorized_residence_user(residence_id));

DROP POLICY IF EXISTS p_am_self_sel ON public.application_messages;
CREATE POLICY p_am_self_sel ON public.application_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM applications a WHERE a.id = application_messages.application_id AND a.user_id = auth.uid()));
DROP POLICY IF EXISTS p_am_self_ins ON public.application_messages;
CREATE POLICY p_am_self_ins ON public.application_messages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM applications a WHERE a.id = application_messages.application_id AND a.user_id = auth.uid())
    AND sender_type = 'student' AND sender_user_id = auth.uid());
DROP POLICY IF EXISTS p_am_portal_sel ON public.application_messages;
CREATE POLICY p_am_portal_sel ON public.application_messages FOR SELECT USING (is_authorized_residence_user(residence_id));
DROP POLICY IF EXISTS p_am_portal_ins ON public.application_messages;
CREATE POLICY p_am_portal_ins ON public.application_messages FOR INSERT
  WITH CHECK (is_authorized_residence_user(residence_id) AND sender_type = 'residence' AND sender_user_id = auth.uid());
DROP POLICY IF EXISTS p_am_admin ON public.application_messages;
CREATE POLICY p_am_admin ON public.application_messages FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS p_al_sys_ins ON public.application_activity_log;
CREATE POLICY p_al_sys_ins ON public.application_activity_log FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS p_al_admin_sel ON public.application_activity_log;
CREATE POLICY p_al_admin_sel ON public.application_activity_log FOR SELECT USING (has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS p_al_portal_sel ON public.application_activity_log;
CREATE POLICY p_al_portal_sel ON public.application_activity_log FOR SELECT USING (is_authorized_residence_user(residence_id));

DROP POLICY IF EXISTS p_rc_sys_ins ON public.referral_claims;
CREATE POLICY p_rc_sys_ins ON public.referral_claims FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS p_rc_admin ON public.referral_claims;
CREATE POLICY p_rc_admin ON public.referral_claims FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS p_rc_portal_sel ON public.referral_claims;
CREATE POLICY p_rc_portal_sel ON public.referral_claims FOR SELECT USING (is_authorized_residence_user(residence_id));

DROP POLICY IF EXISTS p_ra_anyone_ins ON public.residence_analytics;
CREATE POLICY p_ra_anyone_ins ON public.residence_analytics FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS p_ra_admin_sel ON public.residence_analytics;
CREATE POLICY p_ra_admin_sel ON public.residence_analytics FOR SELECT USING (has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS p_rs_pub ON public.residence_sections;
CREATE POLICY p_rs_pub ON public.residence_sections FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS p_rs_admin ON public.residence_sections;
CREATE POLICY p_rs_admin ON public.residence_sections FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS p_hs_pub ON public.hero_slides;
CREATE POLICY p_hs_pub ON public.hero_slides FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS p_hs_admin ON public.hero_slides;
CREATE POLICY p_hs_admin ON public.hero_slides FOR ALL USING (has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS p_cn_pub ON public.campus_news;
CREATE POLICY p_cn_pub ON public.campus_news FOR SELECT USING (is_published = true);
DROP POLICY IF EXISTS p_cn_admin ON public.campus_news;
CREATE POLICY p_cn_admin ON public.campus_news FOR ALL USING (has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS p_ev_pub ON public.events;
CREATE POLICY p_ev_pub ON public.events FOR SELECT USING (true);
DROP POLICY IF EXISTS p_ev_admin ON public.events;
CREATE POLICY p_ev_admin ON public.events FOR ALL USING (has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS p_bu_pub ON public.bursaries;
CREATE POLICY p_bu_pub ON public.bursaries FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS p_bu_admin ON public.bursaries;
CREATE POLICY p_bu_admin ON public.bursaries FOR ALL USING (has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS p_ps_pub ON public.platform_settings;
CREATE POLICY p_ps_pub ON public.platform_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS p_ps_admin ON public.platform_settings;
CREATE POLICY p_ps_admin ON public.platform_settings FOR ALL USING (has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS p_wt_pub ON public.whatsapp_templates;
CREATE POLICY p_wt_pub ON public.whatsapp_templates FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS p_wt_admin ON public.whatsapp_templates;
CREATE POLICY p_wt_admin ON public.whatsapp_templates FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS p_cl_admin ON public.call_logs;
CREATE POLICY p_cl_admin ON public.call_logs FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS p_la_ins ON public.landlord_applications;
CREATE POLICY p_la_ins ON public.landlord_applications FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS p_la_owner_sel ON public.landlord_applications;
CREATE POLICY p_la_owner_sel ON public.landlord_applications FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS p_la_admin ON public.landlord_applications;
CREATE POLICY p_la_admin ON public.landlord_applications FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS p_lad_ins ON public.landlord_application_documents;
CREATE POLICY p_lad_ins ON public.landlord_application_documents FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS p_lad_owner_sel ON public.landlord_application_documents;
CREATE POLICY p_lad_owner_sel ON public.landlord_application_documents FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.landlord_applications la WHERE la.id = application_id AND (la.user_id = auth.uid() OR has_role(auth.uid(),'admin'))));
DROP POLICY IF EXISTS p_lad_admin ON public.landlord_application_documents;
CREATE POLICY p_lad_admin ON public.landlord_application_documents FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- 10. REALTIME
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.applications; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.application_messages; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.application_documents; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.hero_slides; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.residences; EXCEPTION WHEN others THEN NULL; END $$;

-- 11. INDEXES
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON public.applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_residence_id ON public.applications(residence_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_term_year ON public.applications(application_term, application_year);
CREATE INDEX IF NOT EXISTS idx_application_documents_application_id ON public.application_documents(application_id);
CREATE INDEX IF NOT EXISTS idx_application_messages_application_id ON public.application_messages(application_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_residences_section_category ON public.residences(section_category);
CREATE INDEX IF NOT EXISTS idx_hero_slides_location ON public.hero_slides(slide_location);
CREATE INDEX IF NOT EXISTS idx_landlord_applications_status ON public.landlord_applications(status);

-- 12. SEED
INSERT INTO public.residence_sections (name, slug, subtitle, color, applies_to, display_order, is_active) VALUES
  ('Flats','flats','Modern apartment-style living','bg-blue-500','both',1,true),
  ('Communes','communes','Shared communal living spaces','bg-green-500','both',2,true),
  ('Rentals','rentals','Standard rental accommodations','bg-orange-500','both',3,true),
  ('Private Accommodations','private-accommodations','Premium private residences','bg-purple-500','both',4,true)
ON CONFLICT (slug) DO NOTHING;

NOTIFY pgrst, 'reload schema';