-- ============================================================================
-- REFINEMENT: REFERRAL PROGRAMME ISOLATION + RECRUITER FLOW ENHANCEMENT
-- ============================================================================

-- 1. Ensure recruiter_applications has program_key
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recruiter_applications' AND column_name = 'program_key') THEN
        ALTER TABLE public.recruiter_applications ADD COLUMN program_key text NOT NULL DEFAULT 'student_recruitment';
        CREATE INDEX idx_recruiter_apps_program_key ON public.recruiter_applications(program_key);
    END IF;

    ALTER TABLE public.recruiter_applications DROP CONSTRAINT IF EXISTS recruiter_applications_program_key_check;
    ALTER TABLE public.recruiter_applications ADD CONSTRAINT recruiter_applications_program_key_check CHECK (program_key IN ('signup_referral', 'marketplace_referral', 'student_recruitment'));
END $$;

-- 2. Enhanced submit_recruiter_application RPC
CREATE OR REPLACE FUNCTION public.submit_recruiter_application(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _app_id uuid;
  _user_id uuid;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO public.recruiter_applications (
    user_id,
    full_name,
    phone,
    whatsapp_number,
    city,
    province,
    institution,
    campus,
    recruitment_area,
    experience,
    motivation,
    social_media_link,
    program_key,
    status
  ) VALUES (
    _user_id,
    payload->>'full_name',
    payload->>'phone',
    payload->>'whatsapp_number',
    payload->>'city',
    payload->>'province',
    payload->>'institution',
    payload->>'campus',
    payload->>'recruitment_area',
    payload->>'experience',
    payload->>'motivation',
    payload->>'social_media_link',
    COALESCE(payload->>'program_key', 'student_recruitment'),
    'pending'
  )
  RETURNING id INTO _app_id;

  RETURN _app_id;
END $$;

-- 3. Enhanced admin_approve_recruiter_application RPC
CREATE OR REPLACE FUNCTION public.admin_approve_recruiter_application(_app_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _r public.recruiter_applications;
  _new_code text;
  _base_name text;
  _short_id text;
  _final_code text;
  _is_unique boolean := false;
  _counter int := 0;
BEGIN
  -- 1. Authorization check
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE = '42501';
  END IF;

  -- 2. Fetch application
  SELECT * INTO _r FROM public.recruiter_applications WHERE id = _app_id;
  IF _r.id IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  -- 3. Assign referral_agent role
  INSERT INTO public.user_roles(user_id, role)
  VALUES (_r.user_id, 'referral_agent'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 4. Upsert agent profile
  INSERT INTO public.referral_agents(
    user_id, program_key, status, badge_level,
    area, motivation, phone, whatsapp,
    institution, campus, city, province,
    approved_by, approved_at
  )
  VALUES (
    _r.user_id, _r.program_key, 'approved', 'verified',
    _r.recruitment_area, _r.motivation, _r.phone, _r.whatsapp_number,
    _r.institution, _r.campus, _r.city, _r.province,
    auth.uid(), now()
  )
  ON CONFLICT (user_id, program_key) DO UPDATE
    SET status = 'approved', updated_at = now();

  -- 5. Generate unique RKSR- code if not already present
  IF NOT EXISTS (SELECT 1 FROM public.referral_codes WHERE user_id = _r.user_id AND program_key = _r.program_key) THEN
    _base_name := UPPER(regexp_replace(COALESCE(SPLIT_PART(_r.full_name, ' ', 1), 'AGENT'), '[^a-zA-Z0-9]', '', 'g'));
    _short_id := UPPER(SUBSTRING(REPLACE(_r.user_id::text, '-', ''), 1, 4));

    _final_code := 'RKSR-' || _base_name || '-' || _short_id;

    -- Ensure uniqueness (handle unlikely collision)
    WHILE NOT _is_unique LOOP
      IF NOT EXISTS (SELECT 1 FROM public.referral_codes WHERE code = _final_code) THEN
        _is_unique := true;
      ELSE
        _counter := _counter + 1;
        _final_code := 'RKSR-' || _base_name || '-' || _short_id || _counter;
      END IF;
    END LOOP;

    INSERT INTO public.referral_codes(user_id, code, program_key, is_active)
    VALUES (_r.user_id, _final_code, _r.program_key, true);
  END IF;

  -- 6. Mark application approved
  UPDATE public.recruiter_applications
     SET status='approved', decided_at=now(), decided_by=auth.uid(), updated_at=now()
   WHERE id = _app_id;

  -- 7. Potential Notification Placeholder
  -- IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_notification') THEN
  --   PERFORM create_notification(_r.user_id, 'Recruiter Approved', 'Your recruiter application has been approved. Welcome to the team!', 'success', '/recruit/dashboard');
  -- END IF;

END $$;

-- 4. Audit & Clean Mixed-Up Data (Run once on deployment)
DO $$
BEGIN
    -- Ambiguous records default to signup_referral
    UPDATE public.referral_codes SET program_key = 'signup_referral'
    WHERE program_key = 'student_recruitment'
      AND code NOT ILIKE 'RKSR-%'
      AND user_id NOT IN (SELECT user_id FROM public.referral_agents WHERE program_key = 'student_recruitment');

    -- Ensure Marketplace codes are correct
    UPDATE public.referral_codes SET program_key = 'marketplace_referral'
    WHERE code ILIKE 'V-%' OR code ILIKE 'SHOP-%';

    -- Propagate to sessions
    UPDATE public.referral_sessions rs
    SET program_key = rc.program_key
    FROM public.referral_codes rc
    WHERE rs.code = rc.code AND rs.program_key <> rc.program_key;
END $$;

NOTIFY pgrst, 'reload schema';
