-- ============================================================
-- EFT Payment System + Marketplace Upgrades
-- Run in external Supabase SQL Editor (mefjzkhobkltlbmhusdh)
-- Idempotent — safe to run multiple times
-- ============================================================

-- 1. EFT Payments table
CREATE TABLE IF NOT EXISTS eft_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  user_id uuid NOT NULL,
  payment_reference text UNIQUE NOT NULL,
  expected_amount numeric(10,2) NOT NULL,
  unique_cents integer NOT NULL DEFAULT 0,
  fingerprint text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  pop_image_url text,
  pop_file_hash text,
  pop_uploaded_at timestamptz,
  risk_score integer DEFAULT 0,
  device_info jsonb DEFAULT '{}',
  honeypot_triggered boolean DEFAULT false,
  admin_note text,
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE eft_payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "users_view_own_eft" ON eft_payments FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "users_insert_own_eft" ON eft_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "users_update_own_eft" ON eft_payments FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "admins_manage_eft" ON eft_payments FOR ALL
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_eft_payments_reference ON eft_payments(payment_reference);
CREATE INDEX IF NOT EXISTS idx_eft_payments_user ON eft_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_eft_payments_status ON eft_payments(status);
CREATE INDEX IF NOT EXISTS idx_eft_payments_order ON eft_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_eft_payments_fingerprint ON eft_payments(fingerprint);
CREATE INDEX IF NOT EXISTS idx_eft_payments_pop_hash ON eft_payments(pop_file_hash);

-- 2. Payment Action Logs (immutable audit trail)
CREATE TABLE IF NOT EXISTS payment_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eft_payment_id uuid,
  order_id uuid,
  actor_id uuid,
  actor_type text NOT NULL,
  action text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payment_action_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "admins_view_payment_logs" ON payment_action_logs FOR SELECT
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "system_insert_payment_logs" ON payment_action_logs FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_payment_logs_eft ON payment_action_logs(eft_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_order ON payment_action_logs(order_id);

-- 3. Rate Limits
CREATE TABLE IF NOT EXISTS payment_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  attempt_count integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payment_rate_limits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "users_manage_own_rate_limits" ON payment_rate_limits FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "admins_manage_rate_limits" ON payment_rate_limits FOR ALL
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Products: add is_landing_featured
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_landing_featured boolean DEFAULT false;

-- 5. Storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', true) ON CONFLICT DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "users_upload_pop" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anyone_view_pop" ON storage.objects FOR SELECT
    USING (bucket_id = 'payment-proofs');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

NOTIFY pgrst, 'reload schema';
