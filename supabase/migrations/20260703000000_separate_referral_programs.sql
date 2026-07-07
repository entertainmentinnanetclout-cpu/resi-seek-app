-- ============================================================================
-- FIX REFERRAL PROGRAMME MIX-UP + ISOLATE STUDENT RECRUITMENT PROGRAMME
-- Idempotent SQL pack for External Supabase.
-- ============================================================================

-- 1. Add program_key column where needed
DO $$
BEGIN
    -- referral_codes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_codes' AND column_name = 'program_key') THEN
        ALTER TABLE public.referral_codes ADD COLUMN program_key text NOT NULL DEFAULT 'student_recruitment';
        CREATE INDEX idx_referral_codes_program_key ON public.referral_codes(program_key);
    END IF;

    -- referral_sessions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_sessions' AND column_name = 'program_key') THEN
        ALTER TABLE public.referral_sessions ADD COLUMN program_key text NOT NULL DEFAULT 'student_recruitment';
        CREATE INDEX idx_referral_sessions_program_key ON public.referral_sessions(program_key);
    END IF;

    -- application_referrals
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'application_referrals' AND column_name = 'program_key') THEN
        ALTER TABLE public.application_referrals ADD COLUMN program_key text NOT NULL DEFAULT 'student_recruitment';
        CREATE INDEX idx_application_referrals_program_key ON public.application_referrals(program_key);
    END IF;

    -- referral_agents
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_agents' AND column_name = 'program_key') THEN
        ALTER TABLE public.referral_agents ADD COLUMN program_key text NOT NULL DEFAULT 'student_recruitment';
        CREATE INDEX idx_referral_agents_program_key ON public.referral_agents(program_key);
    END IF;

    -- referral_earnings
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_earnings' AND column_name = 'program_key') THEN
        ALTER TABLE public.referral_earnings ADD COLUMN program_key text NOT NULL DEFAULT 'signup_referral';
        CREATE INDEX idx_referral_earnings_program_key ON public.referral_earnings(program_key);
    END IF;
END $$;

-- 2. Add check constraints for program_key
DO $$
BEGIN
    ALTER TABLE public.referral_codes DROP CONSTRAINT IF EXISTS referral_codes_program_key_check;
    ALTER TABLE public.referral_codes ADD CONSTRAINT referral_codes_program_key_check CHECK (program_key IN ('signup_referral', 'marketplace_referral', 'student_recruitment'));

    ALTER TABLE public.referral_sessions DROP CONSTRAINT IF EXISTS referral_sessions_program_key_check;
    ALTER TABLE public.referral_sessions ADD CONSTRAINT referral_sessions_program_key_check CHECK (program_key IN ('signup_referral', 'marketplace_referral', 'student_recruitment'));

    ALTER TABLE public.application_referrals DROP CONSTRAINT IF EXISTS application_referrals_program_key_check;
    ALTER TABLE public.application_referrals ADD CONSTRAINT application_referrals_program_key_check CHECK (program_key IN ('signup_referral', 'marketplace_referral', 'student_recruitment'));

    ALTER TABLE public.referral_agents DROP CONSTRAINT IF EXISTS referral_agents_program_key_check;
    ALTER TABLE public.referral_agents ADD CONSTRAINT referral_agents_program_key_check CHECK (program_key IN ('signup_referral', 'marketplace_referral', 'student_recruitment'));

    ALTER TABLE public.referral_earnings DROP CONSTRAINT IF EXISTS referral_earnings_program_key_check;
    ALTER TABLE public.referral_earnings ADD CONSTRAINT referral_earnings_program_key_check CHECK (program_key IN ('signup_referral', 'marketplace_referral', 'student_recruitment'));
END $$;

-- 3. Backfill Data Safely
-- Rows linked to accommodation applications remain student_recruitment (default)
-- Rows in referral_earnings (R10) should be signup_referral
UPDATE public.referral_earnings SET program_key = 'signup_referral' WHERE program_key = 'student_recruitment';

-- Marketplace identifying logic: if code starts with 'V-' or 'SHOP-'
UPDATE public.referral_codes SET program_key = 'marketplace_referral' WHERE code ILIKE 'V-%' OR code ILIKE 'SHOP-%';
UPDATE public.referral_sessions SET program_key = 'marketplace_referral' WHERE code ILIKE 'V-%' OR code ILIKE 'SHOP-%';

-- 4. Normalization Helper (Ensure it exists for RPCs)
CREATE OR REPLACE FUNCTION public.normalize_referral_code(_code text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT UPPER(regexp_replace(COALESCE(_code,''), '\s+', '', 'g'))
$$;

-- 5. Updated RPCs to Enforce program_key

-- get_referral_public
CREATE OR REPLACE FUNCTION public.get_referral_public(_code text)
RETURNS TABLE(code text, agent_name text, is_active boolean, program_key text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _c text;
BEGIN
  _c := public.normalize_referral_code(_code);
  RETURN QUERY
    SELECT rc.code,
           COALESCE(p.full_name, 'A ResKonnect Agent') AS agent_name,
           COALESCE(rc.is_active, false) AS is_active,
           rc.program_key
    FROM public.referral_codes rc
    LEFT JOIN public.profiles p ON p.id = rc.user_id
    WHERE rc.code = _c
    LIMIT 1;
END $$;

-- capture_referral_click
CREATE OR REPLACE FUNCTION public.capture_referral_click(
  _code text,
  _visitor_id text DEFAULT NULL,
  _landing_url text DEFAULT NULL,
  _user_agent text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _c text;
  _agent_id uuid;
  _prog text;
  _session_id uuid;
BEGIN
  _c := public.normalize_referral_code(_code);
  SELECT user_id, program_key INTO _agent_id, _prog FROM public.referral_codes WHERE code = _c AND is_active = true;
  IF _agent_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.referral_sessions(code, referral_agent_user_id, anonymous_visitor_id, landing_url, user_agent, attached_user_id, program_key)
  VALUES (_c, _agent_id, _visitor_id, _landing_url, _user_agent, auth.uid(), _prog)
  RETURNING id INTO _session_id;

  RETURN _session_id;
END $$;

-- capture_application_referral
CREATE OR REPLACE FUNCTION public.capture_application_referral(
  _application_id uuid,
  _code text DEFAULT NULL,
  _session_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _c text;
  _agent uuid;
  _prog text;
  _app_user uuid;
BEGIN
  SELECT user_id INTO _app_user FROM public.applications WHERE id = _application_id;
  IF _app_user IS NULL THEN RETURN false; END IF;

  -- Validation logic: Check code or session
  _c := public.normalize_referral_code(_code);
  IF (_c IS NULL OR _c = '') AND _session_id IS NOT NULL THEN
    SELECT code, referral_agent_user_id, program_key INTO _c, _agent, _prog
    FROM public.referral_sessions WHERE id = _session_id;
  ELSE
    SELECT user_id, program_key INTO _agent, _prog FROM public.referral_codes WHERE code = _c AND is_active = true;
  END IF;

  -- STRICTION: Only allow student_recruitment to attach to applications
  IF _agent IS NULL OR _agent = _app_user OR _prog <> 'student_recruitment' THEN
    RETURN false;
  END IF;

  INSERT INTO public.application_referrals(application_id, referral_code, referral_agent_user_id, session_id, program_key)
  VALUES (_application_id, _c, _agent, _session_id, 'student_recruitment')
  ON CONFLICT (application_id) DO NOTHING;

  RETURN true;
END $$;

-- 6. Updated Views to Separate Programs

CREATE OR REPLACE VIEW public.recruiter_dashboard_v AS
SELECT
  ra.user_id,
  ra.badge_level,
  ra.status,
  ra.program_key,
  rc.code,
  (SELECT COUNT(*) FROM public.referral_sessions rs WHERE rs.referral_agent_user_id = ra.user_id AND rs.program_key = ra.program_key) AS total_clicks,
  (SELECT COUNT(*) FROM public.referral_sessions rs WHERE rs.referral_agent_user_id = ra.user_id AND rs.attached_user_id IS NOT NULL AND rs.program_key = ra.program_key) AS total_signups,
  (SELECT COUNT(*) FROM public.application_referrals ar WHERE ar.referral_agent_user_id = ra.user_id AND ar.program_key = ra.program_key) AS total_applications,
  (SELECT COUNT(*) FROM public.application_referrals ar WHERE ar.referral_agent_user_id = ra.user_id AND ar.status = 'verified' AND ar.program_key = ra.program_key) AS verified_count,
  (SELECT COUNT(*) FROM public.application_referrals ar WHERE ar.referral_agent_user_id = ra.user_id AND ar.status = 'approved' AND ar.program_key = ra.program_key) AS approved_count,
  (SELECT COUNT(*) FROM public.application_referrals ar WHERE ar.referral_agent_user_id = ra.user_id AND ar.status = 'paid' AND ar.program_key = ra.program_key) AS paid_count,
  (SELECT COALESCE(SUM(commission_amount),0) FROM public.application_referrals ar WHERE ar.referral_agent_user_id = ra.user_id AND ar.status IN ('submitted','verified') AND ar.program_key = ra.program_key) AS pending_commission,
  (SELECT COALESCE(SUM(commission_amount),0) FROM public.application_referrals ar WHERE ar.referral_agent_user_id = ra.user_id AND ar.status = 'approved' AND ar.program_key = ra.program_key) AS approved_commission,
  (SELECT COALESCE(SUM(commission_amount),0) FROM public.application_referrals ar WHERE ar.referral_agent_user_id = ra.user_id AND ar.status = 'paid' AND ar.program_key = ra.program_key) AS paid_commission
FROM public.referral_agents ra
LEFT JOIN public.referral_codes rc ON rc.user_id = ra.user_id AND rc.program_key = ra.program_key;

CREATE OR REPLACE VIEW public.recruiter_applicants_v AS
SELECT
  ar.application_id,
  ar.referral_agent_user_id,
  ar.referral_code,
  ar.program_key,
  ar.status AS referral_status,
  ar.commission_amount,
  ar.created_at AS referred_at,
  a.status AS application_status,
  a.created_at AS application_date,
  a.residence_id,
  r.name AS residence_name,
  p.full_name AS student_name,
  p.student_number
FROM public.application_referrals ar
JOIN public.applications a ON a.id = ar.application_id
LEFT JOIN public.residences r ON r.id = a.residence_id
LEFT JOIN public.profiles p ON p.id = a.user_id;

CREATE OR REPLACE VIEW public.admin_referral_applications_v AS
SELECT
  ar.application_id,
  ar.referral_code,
  ar.program_key,
  ar.referral_agent_user_id,
  ar.status AS referral_status,
  ar.commission_amount,
  ar.verified_at, ar.approved_at, ar.paid_at, ar.created_at AS referred_at,
  a.user_id AS student_user_id,
  a.status AS application_status,
  a.created_at AS application_date,
  r.name AS residence_name,
  ap.full_name AS agent_name,
  ap.email AS agent_email,
  sp.full_name AS student_name,
  sp.student_number
FROM public.application_referrals ar
JOIN public.applications a ON a.id = ar.application_id
LEFT JOIN public.residences r ON r.id = a.residence_id
LEFT JOIN public.profiles ap ON ap.id = ar.referral_agent_user_id
LEFT JOIN public.profiles sp ON sp.id = a.user_id;

-- 7. Ensure R10 signup views/functions only use signup_referral
CREATE OR REPLACE VIEW public.signup_referral_stats_v AS
SELECT
  rc.user_id,
  rc.code,
  (SELECT COUNT(*) FROM public.referral_sessions rs WHERE rs.code = rc.code AND rs.program_key = 'signup_referral') AS total_clicks,
  (SELECT COUNT(*) FROM public.referral_sessions rs WHERE rs.code = rc.code AND rs.attached_user_id IS NOT NULL AND rs.program_key = 'signup_referral') AS total_signups,
  (SELECT COALESCE(SUM(amount), 0) FROM public.referral_earnings re WHERE re.user_id = rc.user_id AND re.program_key = 'signup_referral') AS total_earned
FROM public.referral_codes rc
WHERE rc.program_key = 'signup_referral';

-- 8. Admin approval logic with correct program_key
CREATE OR REPLACE FUNCTION public.admin_approve_recruiter_application(_app_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _r public.recruiter_applications;
  _new_code text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _r FROM public.recruiter_applications WHERE id = _app_id;
  IF _r.id IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  -- 1. Ensure referral_agent role
  INSERT INTO public.user_roles(user_id, role)
  VALUES (_r.user_id, 'referral_agent'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 2. Upsert agent profile for student_recruitment
  INSERT INTO public.referral_agents(user_id, program_key, status, badge_level, area, motivation, phone, whatsapp, institution, campus, city, province, approved_by, approved_at)
  VALUES (_r.user_id, 'student_recruitment', 'approved', 'verified', _r.recruitment_area, _r.motivation, _r.phone, _r.whatsapp_number, _r.institution, _r.campus, _r.city, _r.province, auth.uid(), now())
  ON CONFLICT (user_id, program_key) DO UPDATE
    SET status = 'approved', updated_at = now();

  -- 3. Ensure student recruitment referral code
  IF NOT EXISTS (SELECT 1 FROM public.referral_codes WHERE user_id = _r.user_id AND program_key = 'student_recruitment') THEN
    _new_code := 'RKSR-' || UPPER(SUBSTRING(REPLACE(_r.full_name, ' ', '') FROM 1 FOR 4)) || '-' || UPPER(SUBSTRING(REPLACE(_r.user_id::text, '-', '') FROM 1 FOR 4));
    INSERT INTO public.referral_codes(user_id, code, program_key, is_active)
    VALUES (_r.user_id, _new_code, 'student_recruitment', true)
    ON CONFLICT (user_id, program_key) DO NOTHING;
  END IF;

  -- 4. Mark application approved
  UPDATE public.recruiter_applications
     SET status='approved', decided_at=now(), decided_by=auth.uid(), updated_at=now()
   WHERE id = _app_id;
END $$;

NOTIFY pgrst, 'reload schema';
