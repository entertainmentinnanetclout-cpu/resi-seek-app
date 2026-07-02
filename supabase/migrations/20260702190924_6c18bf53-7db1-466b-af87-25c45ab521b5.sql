
-- Phase 1: Audience columns on residences
ALTER TABLE public.residences
  ADD COLUMN IF NOT EXISTS accepts_university boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS accepts_tvet       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepts_private    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepts_nsfas      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS institution_tags   text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_residences_audience
  ON public.residences (accepts_university, accepts_tvet, accepts_private, accepts_nsfas);

CREATE INDEX IF NOT EXISTS idx_residences_institution_tags
  ON public.residences USING GIN (institution_tags);

-- Phase 4: Application prep table
CREATE TABLE IF NOT EXISTS public.application_prep (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution text NOT NULL,
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, institution)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_prep TO authenticated;
GRANT ALL ON public.application_prep TO service_role;

ALTER TABLE public.application_prep ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own prep read" ON public.application_prep;
DROP POLICY IF EXISTS "own prep write" ON public.application_prep;
DROP POLICY IF EXISTS "own prep all" ON public.application_prep;

CREATE POLICY "own prep all"
  ON public.application_prep FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_application_prep_updated_at ON public.application_prep;
CREATE TRIGGER trg_application_prep_updated_at
  BEFORE UPDATE ON public.application_prep
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Phase 3 + 5: Platform settings for marketplace pause + deadlines
INSERT INTO public.platform_settings (key, value)
VALUES
  ('marketplace_public_enabled', '{"enabled": false, "reason": "Focused on accommodation growth"}'::jsonb),
  ('application_deadlines', '{
    "tut_2026":       {"label": "TUT 2026 late applications", "closes": "2025-09-30", "url": "https://www.tut.ac.za/"},
    "nsfas_uni_2026": {"label": "NSFAS University 2026",       "closes": null,        "url": "https://www.nsfas.org.za/"},
    "nsfas_tvet_2026":{"label": "NSFAS TVET 2026 (Trimester 3)","closes": null,       "url": "https://www.nsfas.org.za/content/how-to-apply.html"}
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Backfill: existing residences accept university + nsfas by default
UPDATE public.residences
   SET accepts_nsfas = true
 WHERE accepts_nsfas = false
   AND (is_trusted = true OR is_tut_accredited = true);
