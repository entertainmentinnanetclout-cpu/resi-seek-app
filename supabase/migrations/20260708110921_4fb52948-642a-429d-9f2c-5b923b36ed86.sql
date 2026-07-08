
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'tvet_lead'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'tvet_lead';
  END IF;
END $$;
