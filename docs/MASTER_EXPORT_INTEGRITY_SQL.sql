-- ============================================================================
-- MASTER_EXPORT_INTEGRITY_SQL.sql
-- Single source of truth for handover-pack data integrity.
-- Idempotent. Rerunnable. Safe on production.
-- Run in External Supabase SQL Editor (project mefjzkhobkltlbmhusdh).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Validated handover export view
--    - Splits profiles.full_name into student_name / student_surname
--    - Reuses existing applications.funding_type (no new column)
--    - security_invoker = on  → RLS of underlying tables is honoured
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.residence_handover_export_v CASCADE;
CREATE VIEW public.residence_handover_export_v
WITH (security_invoker = on) AS
SELECT
  a.id                                                                  AS application_id,
  upper(substring(replace(a.id::text, '-', '') for 8))                  AS ref_code,
  a.residence_id,
  r.name                                                                AS residence_name,
  a.user_id,
  COALESCE(NULLIF(split_part(trim(p.full_name), ' ', 1), ''), NULL)     AS student_name,
  CASE
    WHEN p.full_name IS NULL OR trim(p.full_name) = '' THEN NULL
    WHEN position(' ' in trim(p.full_name)) = 0 THEN NULL
    ELSE trim(substring(trim(p.full_name) from position(' ' in trim(p.full_name)) + 1))
  END                                                                    AS student_surname,
  NULLIF(trim(p.student_number), '')                                     AS student_number,
  NULLIF(trim(a.funding_type), '')                                       AS funding_source,
  p.email,
  p.phone,
  p.campus,
  a.status,
  a.application_date,
  a.move_in_date,
  a.moved_in,
  a.created_at
FROM public.applications a
LEFT JOIN public.profiles p   ON p.id = a.user_id
LEFT JOIN public.residences r ON r.id = a.residence_id;

GRANT SELECT ON public.residence_handover_export_v TO authenticated;
GRANT SELECT ON public.residence_handover_export_v TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Validator function — admin-only. Returns jsonb { ok, totals, errors[] }.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_handover_pack(_residence_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _errors jsonb := '[]'::jsonb;
  _totals jsonb;
  _row    record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE = '42501';
  END IF;

  FOR _row IN
    SELECT v.application_id, v.student_name, v.student_surname,
           v.student_number, v.funding_source, v.user_id,
           v.residence_id, v.residence_name
    FROM public.residence_handover_export_v v
    WHERE _residence_id IS NULL OR v.residence_id = _residence_id
  LOOP
    IF _row.student_name IS NULL THEN
      _errors := _errors || jsonb_build_object('code','missing_name',
        'application_id', _row.application_id, 'reason','Student name is blank');
    END IF;
    IF _row.student_surname IS NULL THEN
      _errors := _errors || jsonb_build_object('code','missing_surname',
        'application_id', _row.application_id, 'reason','Student surname is blank');
    END IF;
    IF _row.student_number IS NULL THEN
      _errors := _errors || jsonb_build_object('code','missing_student_number',
        'application_id', _row.application_id, 'reason','Student number is blank');
    END IF;
    IF _row.funding_source IS NULL OR _row.funding_source = 'unknown' THEN
      _errors := _errors || jsonb_build_object('code','missing_funding',
        'application_id', _row.application_id, 'reason','Funding source missing/unknown');
    END IF;
    IF _row.residence_name IS NULL THEN
      _errors := _errors || jsonb_build_object('code','invalid_residence',
        'application_id', _row.application_id, 'reason','Residence no longer exists');
    END IF;
    IF _row.user_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = _row.user_id
    ) THEN
      _errors := _errors || jsonb_build_object('code','orphan_profile',
        'application_id', _row.application_id, 'reason','Application user has no profile');
    END IF;
  END LOOP;

  FOR _row IN
    SELECT student_number, residence_id, array_agg(application_id) AS app_ids
    FROM public.residence_handover_export_v
    WHERE student_number IS NOT NULL
      AND (_residence_id IS NULL OR residence_id = _residence_id)
    GROUP BY student_number, residence_id
    HAVING COUNT(*) > 1
  LOOP
    _errors := _errors || jsonb_build_object('code','duplicate_student_number',
      'application_id', _row.app_ids[1],
      'reason','Student number ' || _row.student_number ||
               ' appears on multiple applications: ' || array_to_string(_row.app_ids, ', '));
  END LOOP;

  FOR _row IN
    SELECT user_id, residence_id, array_agg(application_id) AS app_ids
    FROM public.residence_handover_export_v
    WHERE user_id IS NOT NULL
      AND (_residence_id IS NULL OR residence_id = _residence_id)
    GROUP BY user_id, residence_id
    HAVING COUNT(*) > 1
  LOOP
    _errors := _errors || jsonb_build_object('code','duplicate_application',
      'application_id', _row.app_ids[1],
      'reason','Same user, same residence, multiple applications: '
               || array_to_string(_row.app_ids, ', '));
  END LOOP;

  SELECT jsonb_build_object(
    'total_applications', COUNT(*),
    'total_students',     COUNT(DISTINCT user_id),
    'missing_names',      COUNT(*) FILTER (WHERE student_name IS NULL),
    'missing_surnames',   COUNT(*) FILTER (WHERE student_surname IS NULL),
    'missing_student_no', COUNT(*) FILTER (WHERE student_number IS NULL),
    'missing_funding',    COUNT(*) FILTER (WHERE funding_source IS NULL OR funding_source = 'unknown'),
    'invalid_residence',  COUNT(*) FILTER (WHERE residence_name IS NULL),
    'duplicates_found',   jsonb_array_length(_errors)
  )
  INTO _totals
  FROM public.residence_handover_export_v
  WHERE _residence_id IS NULL OR residence_id = _residence_id;

  RETURN jsonb_build_object(
    'ok',           jsonb_array_length(_errors) = 0,
    'residence_id', _residence_id,
    'totals',       _totals,
    'errors',       _errors,
    'generated_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_handover_pack(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_handover_pack(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_handover_pack(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Verification queries (read-only)
-- ---------------------------------------------------------------------------
-- SELECT COUNT(*) FROM public.residence_handover_export_v;
-- SELECT public.validate_handover_pack(NULL);
-- SELECT public.validate_handover_pack('<residence-uuid>');