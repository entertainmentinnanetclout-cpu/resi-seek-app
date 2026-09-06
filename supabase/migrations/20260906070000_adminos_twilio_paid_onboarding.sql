-- AdminOS Twilio paid-account onboarding metadata.
-- Keeps secrets server-side while making the exact production webhook contract visible to the admin setup UI.

update public.adminos_integration_connections
set
  secret_refs = jsonb_build_object(
    'account_sid_env', 'TWILIO_ACCOUNT_SID',
    'auth_token_env', 'TWILIO_AUTH_TOKEN',
    'from_env', 'TWILIO_WHATSAPP_FROM',
    'webhook_url_env', 'TWILIO_WHATSAPP_WEBHOOK_URL',
    'status_callback_env', 'TWILIO_WHATSAPP_STATUS_CALLBACK_URL'
  ),
  config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
    'production_webhook_url', 'https://mefjzkhobkltlbmhusdh.supabase.co/functions/v1/adminos-whatsapp-webhook',
    'status_callback_url', 'https://mefjzkhobkltlbmhusdh.supabase.co/functions/v1/adminos-whatsapp-webhook',
    'sender_registration', 'Twilio WhatsApp Self Sign-up / Messaging > Senders > WhatsApp Senders',
    'paid_account_required', true,
    'meta_business_verification_required_for_production', true
  ),
  updated_at = now()
where provider = 'twilio_whatsapp';

update public.adminos_integration_connections
set
  secret_refs = jsonb_build_object(
    'account_sid_env', 'TWILIO_ACCOUNT_SID',
    'auth_token_env', 'TWILIO_AUTH_TOKEN',
    'voice_from_env', 'TWILIO_VOICE_FROM',
    'webhook_url_env', 'TWILIO_VOICE_WEBHOOK_URL'
  ),
  config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
    'production_webhook_url', 'https://mefjzkhobkltlbmhusdh.supabase.co/functions/v1/adminos-voice-webhook',
    'paid_account_required', true,
    'south_africa_number_guidance', 'Use a Twilio South African local/mobile voice-capable number for domestic outbound calls; toll-free outbound is not supported.',
    'regulatory_bundle_may_be_required', true
  ),
  updated_at = now()
where provider = 'twilio_voice';
