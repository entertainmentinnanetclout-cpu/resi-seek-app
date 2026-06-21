
-- SYNC QUEUE
CREATE TABLE IF NOT EXISTS public.sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,
  entity_id uuid,
  op text NOT NULL CHECK (op IN ('insert','update','delete')),
  payload jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON public.sync_queue(status, created_at);
GRANT SELECT ON public.sync_queue TO authenticated;
GRANT ALL ON public.sync_queue TO service_role;
ALTER TABLE public.sync_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff read sync queue" ON public.sync_queue;
CREATE POLICY "Staff read sync queue" ON public.sync_queue
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- HEALTH STATUS
CREATE TABLE IF NOT EXISTS public.health_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'unknown',
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  last_success_at timestamptz,
  details jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.health_status TO authenticated;
GRANT ALL ON public.health_status TO service_role;
ALTER TABLE public.health_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff read health" ON public.health_status;
CREATE POLICY "Staff read health" ON public.health_status
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

DROP TRIGGER IF EXISTS trg_health_uat ON public.health_status;
CREATE TRIGGER trg_health_uat BEFORE UPDATE ON public.health_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.health_status(provider, status, details)
VALUES
  ('lovable_cloud','healthy','{"primary":true}'::jsonb),
  ('external_supabase','unknown','{"primary":false,"note":"billing suspended"}'::jsonb)
ON CONFLICT (provider) DO NOTHING;
