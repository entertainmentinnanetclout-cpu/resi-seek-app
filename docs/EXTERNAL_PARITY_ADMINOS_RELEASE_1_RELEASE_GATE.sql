-- ResKonnect AdminOS Release 1 final production gate
-- Apply after EXTERNAL_PARITY_ADMINOS_RELEASE_1*.sql packs pass production validation.

update public.platform_settings
set value = jsonb_set(
              jsonb_set(value, '{release_status}', '"complete"'::jsonb, true),
              '{completed_at}', to_jsonb(now()), true
            ),
    updated_at = now()
where key = 'adminos_release_progress';

-- Expected release state:
-- Phase 0 of 11 = complete
-- Phase 1 of 11 = complete
-- Phase 2 of 11 = complete
-- Phase 3 of 11 = not_started
