-- Remove redundant synchronous public.profiles writes from every login.
-- Existing post-login identity-sync Edge Function separately maintains
-- profiles.last_login_at and other identity fields after access resolution.
-- Preserve metadata-change trigger and the on_auth_user_created trigger.
DO $$
DECLARE existing text;
BEGIN
  SELECT pg_get_triggerdef(t.oid,true) INTO existing
    FROM pg_trigger t
    WHERE t.tgrelid='auth.users'::regclass
      AND t.tgname='on_auth_user_identity_synced' AND NOT t.tgisinternal;
  IF existing IS NULL THEN
    RAISE EXCEPTION 'Auth identity trigger not found; refusing unexpected rewrite';
  END IF;
  IF existing NOT LIKE '%last_sign_in_at%' THEN
    RAISE NOTICE 'Auth profile sync already decoupled from login';
    RETURN;
  END IF;
  IF existing NOT LIKE '%AFTER UPDATE OF email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, last_sign_in_at%'
     OR existing NOT LIKE '%rk_sync_auth_identity_profile()%' THEN
    RAISE EXCEPTION 'Auth trigger changed unexpectedly; refusing unsafe rewrite';
  END IF;

  DROP TRIGGER on_auth_user_identity_synced ON auth.users;
  CREATE TRIGGER on_auth_user_identity_synced
    AFTER UPDATE OF email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data
    ON auth.users FOR EACH ROW
    EXECUTE FUNCTION public.rk_sync_auth_identity_profile();
END $$;

-- Reversal (use only after review):
-- DROP TRIGGER on_auth_user_identity_synced ON auth.users;
-- CREATE TRIGGER on_auth_user_identity_synced
-- AFTER UPDATE OF email, email_confirmed_at, raw_user_meta_data,
-- raw_app_meta_data, last_sign_in_at
-- ON auth.users FOR EACH ROW EXECUTE FUNCTION public.rk_sync_auth_identity_profile();
