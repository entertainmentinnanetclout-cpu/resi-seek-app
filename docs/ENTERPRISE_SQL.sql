-- ============================================================
-- ResKonnect Enterprise Backend v6.0
-- Enterprise intelligence layer: events, alerts, search, filters
-- FULLY IDEMPOTENT — safe to re-run
-- ============================================================

-- ============================================================
-- 1. SYSTEM EVENTS TABLE (Global Activity Tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.system_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  entity text,
  entity_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_events_type ON public.system_events(type);
CREATE INDEX IF NOT EXISTS idx_system_events_created_at ON public.system_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_events_entity ON public.system_events(entity, entity_id);

ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "admins_view_system_events" ON public.system_events;
  CREATE POLICY "admins_view_system_events" ON public.system_events
    FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "system_insert_events" ON public.system_events;
  CREATE POLICY "system_insert_events" ON public.system_events
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- ============================================================
-- 2. ADMIN ALERTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  severity text DEFAULT 'info',
  resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_alerts_resolved ON public.admin_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_severity ON public.admin_alerts(severity);

ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "admins_manage_alerts" ON public.admin_alerts;
  CREATE POLICY "admins_manage_alerts" ON public.admin_alerts
    FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- ============================================================
-- 3. FILTER CONFIG TABLE (Admin-controlled FindMyRes filters)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.filter_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  enabled boolean DEFAULT true,
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.filter_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "admins_manage_filter_config" ON public.filter_config;
  CREATE POLICY "admins_manage_filter_config" ON public.filter_config
    FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "anyone_view_filter_config" ON public.filter_config;
  CREATE POLICY "anyone_view_filter_config" ON public.filter_config
    FOR SELECT USING (true);
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Seed default filters
INSERT INTO public.filter_config (name, enabled, position) VALUES
  ('campus', true, 1),
  ('price_range', true, 2),
  ('distance', true, 3),
  ('room_type', true, 4),
  ('section_category', true, 5),
  ('nsfas', true, 6),
  ('availability', true, 7),
  ('amenities', true, 8)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 4. GLOBAL SEARCH INDEX
-- ============================================================
CREATE TABLE IF NOT EXISTS public.global_search (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,
  entity_id uuid NOT NULL,
  label text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_global_search_label
  ON public.global_search USING gin (to_tsvector('english', label));
CREATE INDEX IF NOT EXISTS idx_global_search_entity
  ON public.global_search(entity, entity_id);

ALTER TABLE public.global_search ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "admins_manage_global_search" ON public.global_search;
  CREATE POLICY "admins_manage_global_search" ON public.global_search
    FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "anyone_view_global_search" ON public.global_search;
  CREATE POLICY "anyone_view_global_search" ON public.global_search
    FOR SELECT USING (true);
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- ============================================================
-- 5. EVENT TRIGGERS
-- ============================================================

-- 5a. Application created → system_event
CREATE OR REPLACE FUNCTION public.log_application_event()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.system_events(type, entity, entity_id, metadata)
  VALUES (
    'NEW_APPLICATION',
    'applications',
    NEW.id,
    jsonb_build_object('user_id', NEW.user_id, 'residence_id', NEW.residence_id, 'status', NEW.status)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_application_event ON public.applications;
CREATE TRIGGER trg_application_event
  AFTER INSERT ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.log_application_event();

-- 5b. Shop order created → system_event
CREATE OR REPLACE FUNCTION public.log_order_event()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.system_events(type, entity, entity_id, metadata)
  VALUES (
    'NEW_ORDER',
    'shop_orders',
    NEW.id,
    jsonb_build_object('user_id', NEW.user_id, 'total', NEW.total_amount)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_order_event ON public.shop_orders;
CREATE TRIGGER trg_order_event
  AFTER INSERT ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_event();

-- 5c. Residence becomes FULL → system_event + admin_alert
CREATE OR REPLACE FUNCTION public.detect_full_residence()
RETURNS trigger AS $$
BEGIN
  IF NEW.available_spots = 0 AND (OLD.available_spots IS NULL OR OLD.available_spots > 0) THEN
    INSERT INTO public.system_events(type, entity, entity_id, metadata)
    VALUES ('RESIDENCE_FULL', 'residences', NEW.id, jsonb_build_object('name', NEW.name));

    INSERT INTO public.admin_alerts(title, description, severity)
    VALUES (
      NEW.name || ' is now FULL',
      'All available spots have been filled. Consider updating capacity or marking as unavailable.',
      'warning'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_residence_full ON public.residences;
CREATE TRIGGER trg_residence_full
  AFTER UPDATE ON public.residences
  FOR EACH ROW EXECUTE FUNCTION public.detect_full_residence();

-- ============================================================
-- 6. REALTIME ENABLEMENT
-- ============================================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.system_events;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_alerts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 7. SEED GLOBAL SEARCH WITH EXISTING RESIDENCES
-- ============================================================
INSERT INTO public.global_search (entity, entity_id, label, metadata)
SELECT
  'residence',
  r.id,
  r.name,
  jsonb_build_object('campus', r.campus, 'price', r.price)
FROM public.residences r
WHERE NOT EXISTS (
  SELECT 1 FROM public.global_search gs
  WHERE gs.entity = 'residence' AND gs.entity_id = r.id
);

-- ============================================================
-- DONE — Enterprise intelligence layer deployed
-- ============================================================
