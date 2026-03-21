
CREATE OR REPLACE FUNCTION public.get_user_staff_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
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
