
-- 1. payment_proofs + public bucket listing
DROP POLICY IF EXISTS "anyone_view_payment_proofs" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view marketplace images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view store assets" ON storage.objects;

CREATE POLICY "pp_owner_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "pp_admin_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(), 'admin'::app_role));

-- 2. documents duplicate unauthed
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;

-- 3. marketplace upload bypass
DROP POLICY IF EXISTS "Restrict marketplace uploads to images" ON storage.objects;
DROP POLICY IF EXISTS "Students can upload marketplace images" ON storage.objects;
CREATE POLICY "Students can upload marketplace images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'marketplace'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.has_role(auth.uid(), 'student'::app_role)
    AND storage.extension(name) = ANY (ARRAY['jpg','jpeg','png','gif','webp'])
  );

-- 4. store-assets scoped writes
DROP POLICY IF EXISTS "Authenticated users can upload store assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their store assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their store assets" ON storage.objects;

CREATE POLICY "store_assets_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'store-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "store_assets_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'store-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "store_assets_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'store-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 5. platform_settings public read
DROP POLICY IF EXISTS "p_ps_pub" ON public.platform_settings;
CREATE POLICY "platform_settings_auth_read" ON public.platform_settings
  FOR SELECT TO authenticated USING (true);

-- 6. profiles roommate exposure
DROP POLICY IF EXISTS "Public can view roommate seekers" ON public.profiles;
DROP POLICY IF EXISTS "p_prof_roommate" ON public.profiles;
CREATE POLICY "profiles_roommate_auth" ON public.profiles
  FOR SELECT TO authenticated
  USING (looking_for_roommate = true);

-- 7. referral_codes public lookup
DROP POLICY IF EXISTS "referral_codes_public_lookup" ON public.referral_codes;

CREATE OR REPLACE FUNCTION public.validate_referral_code(_code text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.referral_codes WHERE code = _code AND is_active = true)
$$;
REVOKE ALL ON FUNCTION public.validate_referral_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_referral_code(text) TO anon, authenticated;

-- 8. whatsapp_templates public read
DROP POLICY IF EXISTS "Anyone can view active templates" ON public.whatsapp_templates;
DROP POLICY IF EXISTS "p_wt_pub" ON public.whatsapp_templates;
CREATE POLICY "whatsapp_templates_auth_read" ON public.whatsapp_templates
  FOR SELECT TO authenticated USING (is_active = true);

-- 9. SECURITY DEFINER function EXECUTE grants
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_authorized_residence_user(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_residence_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_staff_role(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_handover_pack(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_or_create_referral_code() FROM anon;
REVOKE EXECUTE ON FUNCTION public.capture_referral(text, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.capture_referral_sale(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_ref_code(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_marketplace_order_seller() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_residence_slug() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_last_admin_deletion() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
