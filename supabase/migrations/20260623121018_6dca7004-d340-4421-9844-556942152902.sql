
REVOKE SELECT ("contact_phone") ON TABLE public.residences FROM anon;
REVOKE SELECT ("contact_email") ON TABLE public.residences FROM authenticated;
REVOKE SELECT ("contact_phone") ON TABLE public.residences FROM authenticated;

CREATE OR REPLACE FUNCTION public.enforce_marketplace_order_seller()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _listing_owner uuid;
BEGIN
  SELECT user_id INTO _listing_owner FROM public.marketplace_listings WHERE id = NEW.listing_id;
  IF _listing_owner IS NULL THEN RAISE EXCEPTION 'Invalid listing_id'; END IF;
  IF NEW.seller_id IS DISTINCT FROM _listing_owner THEN
    RAISE EXCEPTION 'seller_id must match the listing owner';
  END IF;
  IF NEW.buyer_id = _listing_owner THEN
    RAISE EXCEPTION 'Buyer cannot purchase their own listing';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_marketplace_orders_seller_check ON public.marketplace_orders;
CREATE TRIGGER trg_marketplace_orders_seller_check
BEFORE INSERT OR UPDATE OF seller_id, listing_id, buyer_id
ON public.marketplace_orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_marketplace_order_seller();

DROP VIEW IF EXISTS public.marketplace_seller_profiles;
CREATE VIEW public.marketplace_seller_profiles
WITH (security_invoker = true) AS
SELECT id, full_name, profile_picture_url FROM public.profiles;
REVOKE ALL ON public.marketplace_seller_profiles FROM PUBLIC;
REVOKE ALL ON public.marketplace_seller_profiles FROM anon;
GRANT SELECT ON public.marketplace_seller_profiles TO authenticated;
GRANT ALL  ON public.marketplace_seller_profiles TO service_role;

DROP POLICY IF EXISTS "p_prl_sys" ON public.payment_rate_limits;
CREATE POLICY "p_prl_service_only" ON public.payment_rate_limits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "System insert activity" ON public.application_activity_log;
DROP POLICY IF EXISTS "p_al_sys_ins" ON public.application_activity_log;
CREATE POLICY "p_al_auth_ins" ON public.application_activity_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "system_insert_hamper_order_items" ON public.hamper_order_items;
DROP POLICY IF EXISTS "p_hoi_sys_ins" ON public.hamper_order_items;
CREATE POLICY "p_hoi_auth_ins" ON public.hamper_order_items
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "p_lad_ins" ON public.landlord_application_documents;
CREATE POLICY "p_lad_ins" ON public.landlord_application_documents
  FOR INSERT TO anon, authenticated
  WITH CHECK (application_id IS NOT NULL);

DROP POLICY IF EXISTS "p_la_ins" ON public.landlord_applications;
CREATE POLICY "p_la_ins" ON public.landlord_applications
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL AND phone IS NOT NULL AND char_length(email) > 3
  );

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "p_notif_sys_ins" ON public.notifications;
CREATE POLICY "p_notif_auth_ins" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "p_osh_sys_ins" ON public.order_status_history;
DROP POLICY IF EXISTS "system_insert_order_history" ON public.order_status_history;
CREATE POLICY "p_osh_auth_ins" ON public.order_status_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "p_pal_sys_ins" ON public.payment_action_logs;
DROP POLICY IF EXISTS "system_insert_payment_logs" ON public.payment_action_logs;
CREATE POLICY "p_pal_auth_ins" ON public.payment_action_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "system_insert_payments" ON public.payments;
DROP POLICY IF EXISTS "p_pay_sys_ins" ON public.payments;
CREATE POLICY "p_pay_auth_ins" ON public.payments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "System insert claims" ON public.referral_claims;
DROP POLICY IF EXISTS "p_rc_sys_ins" ON public.referral_claims;
CREATE POLICY "p_rc_auth_ins" ON public.referral_claims
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can track analytics" ON public.residence_analytics;
DROP POLICY IF EXISTS "p_ra_anyone_ins" ON public.residence_analytics;
CREATE POLICY "p_ra_anyone_ins" ON public.residence_analytics
  FOR INSERT TO anon, authenticated
  WITH CHECK (residence_id IS NOT NULL);

DROP POLICY IF EXISTS "p_soi_sys_ins" ON public.shop_order_items;
DROP POLICY IF EXISTS "system_insert_shop_order_items" ON public.shop_order_items;
CREATE POLICY "p_soi_auth_ins" ON public.shop_order_items
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
