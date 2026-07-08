
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS institution_type text;

CREATE OR REPLACE FUNCTION public.validate_application_institution_type()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.institution_type IS NOT NULL
     AND NEW.institution_type NOT IN ('university','tvet','private','other') THEN
    RAISE EXCEPTION 'invalid institution_type: %', NEW.institution_type;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS validate_application_institution_type_trg ON public.applications;
CREATE TRIGGER validate_application_institution_type_trg
BEFORE INSERT OR UPDATE OF institution_type ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.validate_application_institution_type();

UPDATE public.applications SET institution_type = 'university' WHERE institution_type IS NULL;
CREATE INDEX IF NOT EXISTS idx_applications_institution_type ON public.applications(institution_type);

CREATE OR REPLACE FUNCTION public.get_user_staff_role(_user_id uuid)
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'public' SET row_security TO 'off'
AS $$
  SELECT role::text FROM public.user_roles
  WHERE user_id = _user_id
    AND role::text IN ('admin','operations_lead','commerce_lead','growth_lead','system_operator','tvet_lead','support_agent')
  ORDER BY CASE role::text
    WHEN 'admin' THEN 1
    WHEN 'system_operator' THEN 2
    WHEN 'operations_lead' THEN 3
    WHEN 'commerce_lead' THEN 4
    WHEN 'growth_lead' THEN 5
    WHEN 'tvet_lead' THEN 6
    WHEN 'support_agent' THEN 7
  END
  LIMIT 1
$$;

DROP POLICY IF EXISTS "tvet_lead can read tvet applications" ON public.applications;
CREATE POLICY "tvet_lead can read tvet applications" ON public.applications
  FOR SELECT USING (
    institution_type = 'tvet' AND public.has_role(auth.uid(), 'tvet_lead'::app_role)
  );
