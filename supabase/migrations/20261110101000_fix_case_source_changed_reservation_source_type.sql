-- P0 regression fix: 2027 reservation interest failing with:
-- ERROR: record "new" has no field "source_type".
-- The shared trigger runs on applications, reservations, viewings and enquiries.
-- Only public.residence_leads carries source_type.
--
-- DO NOT use an AND predicate containing NEW.source_type outside an explicit
-- table-specific branch: PL/pgSQL does not promise short-circuit evaluation.
-- No data changes, no trigger removal, no reservation guard/RLS changes.

CREATE OR REPLACE FUNCTION reskonnect_internal.case_source_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  kind text;
  source_id uuid;
BEGIN
  kind := CASE tg_table_name
    WHEN 'applications' THEN 'application'
    WHEN 'accommodation_reservations' THEN 'reservation'
    WHEN 'viewing_requests' THEN 'viewing'
    WHEN 'residence_leads' THEN 'enquiry'
  END;

  IF kind IS NULL THEN
    RETURN NEW;
  END IF;

  source_id := NEW.id;

  -- Only residence_leads records have a source_type field. Access it solely
  -- inside this branch, never inside a mixed boolean expression.
  IF tg_table_name = 'residence_leads' THEN
    IF NEW.source_type NOT IN ('manual', 'demand') THEN
      RETURN NEW;
    END IF;
  END IF;

  PERFORM reskonnect_internal.refresh_service_case(kind, source_id);
  RETURN NEW;
END;
$function$;
