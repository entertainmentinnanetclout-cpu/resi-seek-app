# UI ↔ DB Touchpoint Matrix

Generated from a repo-wide scan of `.from()`, `.rpc()` and `.storage.from()` calls in `src/**` and `supabase/functions/**`.

## Tables referenced by frontend/edge (65)
admin_alerts · application_activity_log · application_messages · application_prep · applications · bursaries · call_logs · campus_news · cart · cart_items · delivery_zones · discount_codes · discount_orders · documents · eft_payments · events · favorites · filter_config · hamper_bundle_items · hamper_items · hamper_orders · hampers · health_status · hero_slides · landlord_applications · marketplace_banners · marketplace_listings · marketplace_orders · notifications · order_status_history · payment_action_logs · payment_proofs · payments · platform_revenue · platform_settings · product_categories · product_variants · products · profiles · push_subscriptions · referral_claims · referral_codes · referral_earnings · residence_analytics · residence_handover_export_v · residence_portal_accounts · residence_sections · residences · reviews · seller_earnings · seller_kyc_log · shop_order_items · shop_orders · store_reviews · stores · student_discounts · student_hamper_preferences · sync_queue · system_events · user_roles · webhook_events · whatsapp_templates · wil_admin_notes · wil_applications · wil_documents

## Missing on External before this pack (created by MASTER_GOD_SQL)
- admin_alerts
- system_events
- webhook_events
- discount_codes
- marketplace_banners
- payment_proofs (table backing the bucket)
- platform_revenue
- seller_earnings
- seller_kyc_log

## RPCs referenced
- has_role, get_user_staff_role, capture_referral, capture_referral_sale, validate_handover_pack
- (also used server-side: get_or_create_referral_code, validate_referral_code, enforce_marketplace_order_seller trigger)

## Storage buckets referenced
admin-images · payment-proofs · product-images · profile-pictures · seller-kyc · store-assets · wil-documents  
Plus indirectly: documents · marketplace · application-documents · hamper-images · landlord-documents

## Schema-repair items included in MASTER_GOD_SQL
- `residences`: accepts_university/tvet/private/nsfas, institution_tags[], slug
- `applications`: funding_type shim (mirrors funding_source if present)
- `filter_config`: legacy `name` NOT NULL relaxed
- `hero_slides`: safe default for `image_url`

## How to run
1. Open External Supabase SQL editor
2. Paste and run `docs/MASTER_GOD_SQL.sql`
3. Confirm the four verification queries at the bottom return sensible output
