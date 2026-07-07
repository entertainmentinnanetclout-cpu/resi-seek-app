-- ============================================================================
-- REFERRAL V2 + RECRUITMENT PROGRAMME + AUDIENCE BULK ADMIN
-- Idempotent SQL pack. Safe to re-run on External Supabase.
-- Run on External Supabase (production) database.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Enum extension: referral_agent role
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'referral_agent'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'referral_agent';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. Audience columns on residences (safe if already added)
-- ----------------------------------------------------------------------------
ALTER TABLE public.residences
  ADD COLUMN IF NOT EXISTS accepts_university boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS accepts_tvet       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepts_private    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS audience_tags      text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_residences_audience_tags
  ON public.residences USING gin (audience_tags);

-- Sync audience_tags <-> booleans
CREATE OR REPLACE FUNCTION public.sync_residence_audience_tags()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE _tags text[] := '{}';
BEGIN
  IF NEW.accepts_university THEN _tags := array_append(_tags, 'university'); END IF;
  IF NEW.accepts_tvet       THEN _tags := array_append(_tags, 'tvet_college'); END IF;
  IF NEW.accepts_private    THEN _tags := array_append(_tags, 'private'); END IF;
  NEW.audience_tags := _tags;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sync_residence_audience_tags_trg ON public.residences;
CREATE TRIGGER sync_residence_audience_tags_trg
BEFORE INSERT OR UPDATE OF accepts_university, accepts_tvet, accepts_private
ON public.residences
FOR EACH ROW EXECUTE FUNCTION public.sync_residence_audience_tags();

-- Backfill tags for existing rows once
UPDATE public.residences SET accepts_university = accepts_university WHERE audience_tags = '{}';

-- ----------------------------------------------------------------------------
-- 2. Recruiter applications
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recruiter_applications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name           text NOT NULL,
  email               text,
  phone               text,
  whatsapp_number     text,
  institution         text,
  campus              text,
  city                text,
  province            text,
  recruitment_area    text NOT NULL,
  experience          text,
  motivation          text NOT NULL,
  social_media_link   text,
  status              text NOT NULL DEFAULT 'pending',  -- pending|under_review|approved|rejected
  admin_notes         text,
  decided_at          timestamptz,
  decided_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.recruiter_applications TO authenticated;
GRANT ALL ON public.recruiter_applications TO service_role;

ALTER TABLE public.recruiter_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own recruiter application" ON public.recruiter_applications;
CREATE POLICY "own recruiter application" ON public.recruiter_applications
  FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "insert own recruiter application" ON public.recruiter_applications;
CREATE POLICY "insert own recruiter application" ON public.recruiter_applications
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admin manage recruiter applications" ON public.recruiter_applications;
CREATE POLICY "admin manage recruiter applications" ON public.recruiter_applications
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_recruiter_applications_user   ON public.recruiter_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_recruiter_applications_status ON public.recruiter_applications(status);

-- ----------------------------------------------------------------------------
-- 3. Referral agents (approved recruiters)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_agents (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'approved', -- approved|suspended
  badge_level   text NOT NULL DEFAULT 'verified', -- starter|verified|top|elite
  area          text,
  motivation    text,
  phone         text,
  whatsapp      text,
  institution   text,
  campus        text,
  city          text,
  province      text,
  socials       jsonb NOT NULL DEFAULT '{}'::jsonb,
  approved_at   timestamptz NOT NULL DEFAULT now(),
  approved_by   uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.referral_agents TO authenticated;
GRANT ALL ON public.referral_agents TO service_role;

ALTER TABLE public.referral_agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own agent profile" ON public.referral_agents;
CREATE POLICY "own agent profile" ON public.referral_agents
  FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admin manage agents" ON public.referral_agents;
CREATE POLICY "admin manage agents" ON public.referral_agents
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ----------------------------------------------------------------------------
-- 4. Referral sessions (click tracking)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_sessions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                     text NOT NULL,
  referral_agent_user_id   uuid,
  anonymous_visitor_id     text,
  attached_user_id         uuid,
  landing_url              text,
  user_agent               text,
  expires_at               timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at               timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.referral_sessions TO authenticated;
GRANT ALL ON public.referral_sessions TO service_role;

ALTER TABLE public.referral_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "session visible to owner or agent or admin" ON public.referral_sessions;
CREATE POLICY "session visible to owner or agent or admin" ON public.referral_sessions
  FOR SELECT USING (
    attached_user_id = auth.uid()
    OR referral_agent_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE INDEX IF NOT EXISTS idx_referral_sessions_code   ON public.referral_sessions(code);
CREATE INDEX IF NOT EXISTS idx_referral_sessions_agent  ON public.referral_sessions(referral_agent_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_sessions_user   ON public.referral_sessions(attached_user_id);

-- ----------------------------------------------------------------------------
-- 5. Application referrals (link between an application and a referral)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.application_referrals (
  application_id           uuid PRIMARY KEY REFERENCES public.applications(id) ON DELETE CASCADE,
  referral_code            text NOT NULL,
  referral_agent_user_id   uuid,
  session_id               uuid,
  commission_amount        numeric NOT NULL DEFAULT 200,
  status                   text NOT NULL DEFAULT 'submitted', -- submitted|verified|approved|rejected|paid|cancelled
  verified_at              timestamptz,
  approved_at              timestamptz,
  paid_at                  timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.application_referrals TO authenticated;
GRANT ALL ON public.application_referrals TO service_role;

ALTER TABLE public.application_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_ref visible to owner, agent, admin" ON public.application_referrals;
CREATE POLICY "app_ref visible to owner, agent, admin" ON public.application_referrals
  FOR SELECT USING (
    referral_agent_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "admin manage app_ref" ON public.application_referrals;
CREATE POLICY "admin manage app_ref" ON public.application_referrals
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_application_referrals_agent   ON public.application_referrals(referral_agent_user_id);
CREATE INDEX IF NOT EXISTS idx_application_referrals_code    ON public.application_referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_application_referrals_status  ON public.application_referrals(status);

-- ----------------------------------------------------------------------------
-- 6. Helper: normalize referral code
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_referral_code(_code text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT UPPER(regexp_replace(COALESCE(_code,''), '\s+', '', 'g'))
$$;

-- ----------------------------------------------------------------------------
-- 7. Public: get referral display info by code
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_referral_public(_code text)
RETURNS TABLE(code text, agent_name text, is_active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _c text;
BEGIN
  _c := public.normalize_referral_code(_code);
  RETURN QUERY
    SELECT rc.code,
           COALESCE(p.full_name, 'A ResKonnect Recruiter') AS agent_name,
           COALESCE(rc.is_active, false) AS is_active
    FROM public.referral_codes rc
    LEFT JOIN public.profiles p ON p.id = rc.user_id
    WHERE rc.code = _c
    LIMIT 1;
END $$;

GRANT EXECUTE ON FUNCTION public.get_referral_public(text) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 8. Capture referral click (creates session)
-- ----------------------------------------------------------------------------
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
  _session_id uuid;
BEGIN
  _c := public.normalize_referral_code(_code);
  SELECT user_id INTO _agent_id FROM public.referral_codes WHERE code = _c AND is_active = true;
  IF _agent_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.referral_sessions(code, referral_agent_user_id, anonymous_visitor_id, landing_url, user_agent, attached_user_id)
  VALUES (_c, _agent_id, _visitor_id, _landing_url, _user_agent, auth.uid())
  RETURNING id INTO _session_id;

  RETURN _session_id;
END $$;

GRANT EXECUTE ON FUNCTION public.capture_referral_click(text, text, text, text) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 9. Attach a session to the current authenticated user
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.attach_referral_to_user(_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  UPDATE public.referral_sessions
     SET attached_user_id = auth.uid()
   WHERE id = _session_id
     AND (attached_user_id IS NULL OR attached_user_id = auth.uid());
END $$;

GRANT EXECUTE ON FUNCTION public.attach_referral_to_user(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 10. Capture application referral (called after application insert)
-- ----------------------------------------------------------------------------
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
  _app_user uuid;
BEGIN
  SELECT user_id INTO _app_user FROM public.applications WHERE id = _application_id;
  IF _app_user IS NULL THEN RETURN false; END IF;
  IF auth.uid() IS NULL OR auth.uid() <> _app_user THEN
    -- only the owner may attach a referral to their own application
    IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN false; END IF;
  END IF;

  _c := public.normalize_referral_code(_code);
  IF (_c IS NULL OR _c = '') AND _session_id IS NOT NULL THEN
    SELECT code, referral_agent_user_id INTO _c, _agent
    FROM public.referral_sessions WHERE id = _session_id;
  ELSE
    SELECT user_id INTO _agent FROM public.referral_codes WHERE code = _c AND is_active = true;
  END IF;

  IF _agent IS NULL OR _agent = _app_user THEN
    RETURN false;
  END IF;

  INSERT INTO public.application_referrals(application_id, referral_code, referral_agent_user_id, session_id)
  VALUES (_application_id, _c, _agent, _session_id)
  ON CONFLICT (application_id) DO NOTHING;

  RETURN true;
END $$;

GRANT EXECUTE ON FUNCTION public.capture_application_referral(uuid, text, uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 11. Submit recruiter application
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_recruiter_application(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  INSERT INTO public.recruiter_applications(
    user_id, full_name, email, phone, whatsapp_number, institution, campus, city, province,
    recruitment_area, experience, motivation, social_media_link, status
  ) VALUES (
    auth.uid(),
    COALESCE(payload->>'full_name',''),
    payload->>'email',
    payload->>'phone',
    payload->>'whatsapp_number',
    payload->>'institution',
    payload->>'campus',
    payload->>'city',
    payload->>'province',
    COALESCE(payload->>'recruitment_area',''),
    payload->>'experience',
    COALESCE(payload->>'motivation',''),
    payload->>'social_media_link',
    'pending'
  )
  RETURNING id INTO _id;
  RETURN _id;
END $$;

GRANT EXECUTE ON FUNCTION public.submit_recruiter_application(jsonb) TO authenticated;

-- ----------------------------------------------------------------------------
-- 12. Admin approve / reject recruiter
-- ----------------------------------------------------------------------------
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

  -- 2. Upsert agent profile
  INSERT INTO public.referral_agents(user_id, status, badge_level, area, motivation, phone, whatsapp, institution, campus, city, province, approved_by, approved_at)
  VALUES (_r.user_id, 'approved', 'verified', _r.recruitment_area, _r.motivation, _r.phone, _r.whatsapp_number, _r.institution, _r.campus, _r.city, _r.province, auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET status = 'approved', updated_at = now();

  -- 3. Ensure referral code
  IF NOT EXISTS (SELECT 1 FROM public.referral_codes WHERE user_id = _r.user_id) THEN
    _new_code := 'RK' || UPPER(SUBSTRING(REPLACE(_r.user_id::text, '-', '') FROM 1 FOR 6));
    INSERT INTO public.referral_codes(user_id, code, is_active) VALUES (_r.user_id, _new_code, true)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- 4. Mark application approved
  UPDATE public.recruiter_applications
     SET status='approved', decided_at=now(), decided_by=auth.uid(), updated_at=now()
   WHERE id = _app_id;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_approve_recruiter_application(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reject_recruiter_application(_app_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.recruiter_applications
     SET status='rejected', admin_notes=_reason, decided_at=now(), decided_by=auth.uid(), updated_at=now()
   WHERE id = _app_id;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_reject_recruiter_application(uuid, text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 13. Admin mark referral status
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_mark_referral_status(_application_id uuid, _status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE = '42501';
  END IF;
  IF _status NOT IN ('submitted','verified','approved','rejected','paid','cancelled') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  UPDATE public.application_referrals
     SET status = _status,
         verified_at = CASE WHEN _status='verified' THEN now() ELSE verified_at END,
         approved_at = CASE WHEN _status='approved' THEN now() ELSE approved_at END,
         paid_at     = CASE WHEN _status='paid'     THEN now() ELSE paid_at END,
         updated_at  = now()
   WHERE application_id = _application_id;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_mark_referral_status(uuid, text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 14. Admin bulk update residence audience
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_bulk_update_residence_audience(
  _residence_ids uuid[],
  _mode text,               -- 'add' | 'remove' | 'set'
  _audiences text[]         -- subset of {'university','tvet_college','private'}
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uni  boolean := 'university'   = ANY(_audiences);
  _tvet boolean := 'tvet_college' = ANY(_audiences);
  _priv boolean := 'private'      = ANY(_audiences);
  _cnt  integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE = '42501';
  END IF;
  IF _mode NOT IN ('add','remove','set') THEN
    RAISE EXCEPTION 'Invalid mode';
  END IF;

  IF _mode = 'set' THEN
    UPDATE public.residences
       SET accepts_university = _uni,
           accepts_tvet       = _tvet,
           accepts_private    = _priv
     WHERE id = ANY(_residence_ids);
  ELSIF _mode = 'add' THEN
    UPDATE public.residences
       SET accepts_university = accepts_university OR _uni,
           accepts_tvet       = accepts_tvet       OR _tvet,
           accepts_private    = accepts_private    OR _priv
     WHERE id = ANY(_residence_ids);
  ELSE -- remove
    UPDATE public.residences
       SET accepts_university = accepts_university AND NOT _uni,
           accepts_tvet       = accepts_tvet       AND NOT _tvet,
           accepts_private    = accepts_private    AND NOT _priv
     WHERE id = ANY(_residence_ids);
  END IF;

  GET DIAGNOSTICS _cnt = ROW_COUNT;
  RETURN _cnt;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_bulk_update_residence_audience(uuid[], text, text[]) TO authenticated;

-- ----------------------------------------------------------------------------
-- 15. Views
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.recruiter_dashboard_v AS
SELECT
  ra.user_id,
  ra.badge_level,
  ra.status,
  rc.code,
  (SELECT COUNT(*) FROM public.referral_sessions rs WHERE rs.referral_agent_user_id = ra.user_id) AS total_clicks,
  (SELECT COUNT(*) FROM public.referral_sessions rs WHERE rs.referral_agent_user_id = ra.user_id AND rs.attached_user_id IS NOT NULL) AS total_signups,
  (SELECT COUNT(*) FROM public.application_referrals ar WHERE ar.referral_agent_user_id = ra.user_id) AS total_applications,
  (SELECT COUNT(*) FROM public.application_referrals ar WHERE ar.referral_agent_user_id = ra.user_id AND ar.status = 'verified') AS verified_count,
  (SELECT COUNT(*) FROM public.application_referrals ar WHERE ar.referral_agent_user_id = ra.user_id AND ar.status = 'approved') AS approved_count,
  (SELECT COUNT(*) FROM public.application_referrals ar WHERE ar.referral_agent_user_id = ra.user_id AND ar.status = 'paid') AS paid_count,
  (SELECT COALESCE(SUM(commission_amount),0) FROM public.application_referrals ar WHERE ar.referral_agent_user_id = ra.user_id AND ar.status IN ('submitted','verified')) AS pending_commission,
  (SELECT COALESCE(SUM(commission_amount),0) FROM public.application_referrals ar WHERE ar.referral_agent_user_id = ra.user_id AND ar.status = 'approved') AS approved_commission,
  (SELECT COALESCE(SUM(commission_amount),0) FROM public.application_referrals ar WHERE ar.referral_agent_user_id = ra.user_id AND ar.status = 'paid') AS paid_commission
FROM public.referral_agents ra
LEFT JOIN public.referral_codes rc ON rc.user_id = ra.user_id;

GRANT SELECT ON public.recruiter_dashboard_v TO authenticated;

CREATE OR REPLACE VIEW public.recruiter_applicants_v AS
SELECT
  ar.application_id,
  ar.referral_agent_user_id,
  ar.referral_code,
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

GRANT SELECT ON public.recruiter_applicants_v TO authenticated;

CREATE OR REPLACE VIEW public.admin_referral_applications_v AS
SELECT
  ar.application_id,
  ar.referral_code,
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

GRANT SELECT ON public.admin_referral_applications_v TO authenticated;

-- ----------------------------------------------------------------------------
-- 16. Reload PostgREST cache
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- 17. Verification
-- ----------------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM public.recruiter_applications)  AS recruiter_apps,
  (SELECT COUNT(*) FROM public.referral_agents)          AS agents,
  (SELECT COUNT(*) FROM public.referral_sessions)        AS sessions,
  (SELECT COUNT(*) FROM public.application_referrals)    AS app_referrals,
  (SELECT COUNT(*) FROM public.residences WHERE accepts_university) AS uni_count,
  (SELECT COUNT(*) FROM public.residences WHERE accepts_tvet)       AS tvet_count,
  (SELECT COUNT(*) FROM public.residences WHERE accepts_private)    AS private_count;