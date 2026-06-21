-- =============================================================================
-- PHASE 1A — Consolidated SQL Pack (rerunnable + rollback)
-- ResKonnect Emergency Migration to Lovable Cloud
-- =============================================================================
-- This file is the master rerun script. It bundles:
--   * Pack 1  — Foundational (profiles, residences, applications, content)
--   * Pack 2  — Commerce (stores, products, marketplace, hampers, shop_orders, eft, delivery_zones)
--   * Pack 3  — Referrals, Push, WIL, Sync Queue, Health Status
--
-- All statements are idempotent (CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS, etc).
-- Run order:
--   1. supabase/migrations/20260620091407_*.sql  (Pack 1)
--   2. supabase/migrations/20260620091640_*.sql  (Pack 2)
--   3. The PACK 3 block below                    (sync_queue + health_status; rest already exist)
--
-- For full rollback (DESTRUCTIVE — drops everything) see the ROLLBACK section at the bottom.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PACK 3 — Sync Queue + Health Status (the only NEW tables for Lovable Cloud)
-- ---------------------------------------------------------------------------

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
GRANT ALL    ON public.sync_queue TO service_role;
ALTER TABLE public.sync_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff read sync queue" ON public.sync_queue;
CREATE POLICY "Staff read sync queue" ON public.sync_queue
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

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
GRANT ALL    ON public.health_status TO service_role;
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

-- =============================================================================
-- ROLLBACK (destructive — only run if you want to wipe Phase 1A tables)
-- =============================================================================
--
-- DROP TABLE IF EXISTS public.sync_queue CASCADE;
-- DROP TABLE IF EXISTS public.health_status CASCADE;
--
-- For full Pack-1/Pack-2 rollback see the individual migration files; they each
-- list the tables they create at the top. Run DROP TABLE ... CASCADE in reverse
-- creation order. Do not roll back unless you have an exported backup.
-- =============================================================================