
-- EFT Payments table
CREATE TABLE IF NOT EXISTS public.eft_payments (
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

ALTER TABLE public.eft_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_eft_payments" ON public.eft_payments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_eft_payments" ON public.eft_payments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_eft_payments" ON public.eft_payments
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admins_manage_eft_payments" ON public.eft_payments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_eft_payments_reference ON public.eft_payments(payment_reference);
CREATE INDEX IF NOT EXISTS idx_eft_payments_user ON public.eft_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_eft_payments_status ON public.eft_payments(status);
CREATE INDEX IF NOT EXISTS idx_eft_payments_order ON public.eft_payments(order_id);

-- Payment action logs (immutable audit trail)
CREATE TABLE IF NOT EXISTS public.payment_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eft_payment_id uuid,
  order_id uuid,
  actor_id uuid,
  actor_type text NOT NULL,
  action text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.payment_action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_view_payment_logs" ON public.payment_action_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "system_insert_payment_logs" ON public.payment_action_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_payment_logs_eft ON public.payment_action_logs(eft_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_order ON public.payment_action_logs(order_id);

-- Rate limits
CREATE TABLE IF NOT EXISTS public.payment_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  attempt_count integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.payment_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_rate_limits" ON public.payment_rate_limits
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admins_manage_rate_limits" ON public.payment_rate_limits
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Products: add is_landing_featured
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_landing_featured boolean DEFAULT false;

-- Storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', true) ON CONFLICT DO NOTHING;

CREATE POLICY "users_upload_payment_proofs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "anyone_view_payment_proofs" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'payment-proofs');
