
-- =====================================================
-- RESKONNECT MASTER FK MIGRATION (IDEMPOTENT)
-- Adds all missing foreign key constraints
-- =====================================================

-- OPERATIONS: applications
DO $$ BEGIN ALTER TABLE public.applications ADD CONSTRAINT fk_applications_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.applications ADD CONSTRAINT fk_applications_residence FOREIGN KEY (residence_id) REFERENCES public.residences(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- OPERATIONS: documents
DO $$ BEGIN ALTER TABLE public.documents ADD CONSTRAINT fk_documents_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- OPERATIONS: favorites
DO $$ BEGIN ALTER TABLE public.favorites ADD CONSTRAINT fk_favorites_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.favorites ADD CONSTRAINT fk_favorites_residence FOREIGN KEY (residence_id) REFERENCES public.residences(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- OPERATIONS: reviews
DO $$ BEGIN ALTER TABLE public.reviews ADD CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.reviews ADD CONSTRAINT fk_reviews_residence FOREIGN KEY (residence_id) REFERENCES public.residences(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- OPERATIONS: notifications
DO $$ BEGIN ALTER TABLE public.notifications ADD CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- OPERATIONS: residence_portal_accounts
DO $$ BEGIN ALTER TABLE public.residence_portal_accounts ADD CONSTRAINT fk_portal_accounts_residence FOREIGN KEY (residence_id) REFERENCES public.residences(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- OPERATIONS: application_documents
DO $$ BEGIN ALTER TABLE public.application_documents ADD CONSTRAINT fk_app_docs_application FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.application_documents ADD CONSTRAINT fk_app_docs_residence FOREIGN KEY (residence_id) REFERENCES public.residences(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- OPERATIONS: application_messages
DO $$ BEGIN ALTER TABLE public.application_messages ADD CONSTRAINT fk_app_messages_application FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.application_messages ADD CONSTRAINT fk_app_messages_residence FOREIGN KEY (residence_id) REFERENCES public.residences(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- OPERATIONS: application_activity_log
DO $$ BEGIN ALTER TABLE public.application_activity_log ADD CONSTRAINT fk_activity_log_application FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.application_activity_log ADD CONSTRAINT fk_activity_log_residence FOREIGN KEY (residence_id) REFERENCES public.residences(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- OPERATIONS: referral_claims
DO $$ BEGIN ALTER TABLE public.referral_claims ADD CONSTRAINT fk_referral_claims_application FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.referral_claims ADD CONSTRAINT fk_referral_claims_residence FOREIGN KEY (residence_id) REFERENCES public.residences(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- OPERATIONS: residence_analytics
DO $$ BEGIN ALTER TABLE public.residence_analytics ADD CONSTRAINT fk_residence_analytics_residence FOREIGN KEY (residence_id) REFERENCES public.residences(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.residence_analytics ADD CONSTRAINT fk_residence_analytics_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- OPERATIONS: call_logs
DO $$ BEGIN ALTER TABLE public.call_logs ADD CONSTRAINT fk_call_logs_student FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- OPERATIONS: WIL
DO $$ BEGIN ALTER TABLE public.wil_applications ADD CONSTRAINT fk_wil_apps_student FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.wil_documents ADD CONSTRAINT fk_wil_docs_application FOREIGN KEY (application_id) REFERENCES public.wil_applications(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.wil_admin_notes ADD CONSTRAINT fk_wil_notes_application FOREIGN KEY (application_id) REFERENCES public.wil_applications(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.wil_assignments ADD CONSTRAINT fk_wil_assign_application FOREIGN KEY (application_id) REFERENCES public.wil_applications(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- COMMERCE: products
DO $$ BEGIN ALTER TABLE public.products ADD CONSTRAINT fk_products_store FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.products ADD CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES public.product_categories(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- COMMERCE: product_variants
DO $$ BEGIN ALTER TABLE public.product_variants ADD CONSTRAINT fk_product_variants_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- COMMERCE: cart
DO $$ BEGIN ALTER TABLE public.cart ADD CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- COMMERCE: cart_items
DO $$ BEGIN ALTER TABLE public.cart_items ADD CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES public.cart(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.cart_items ADD CONSTRAINT fk_cart_items_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.cart_items ADD CONSTRAINT fk_cart_items_variant FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- COMMERCE: shop_orders
DO $$ BEGIN ALTER TABLE public.shop_orders ADD CONSTRAINT fk_shop_orders_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- COMMERCE: shop_order_items
DO $$ BEGIN ALTER TABLE public.shop_order_items ADD CONSTRAINT fk_shop_order_items_order FOREIGN KEY (order_id) REFERENCES public.shop_orders(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_order_items ADD CONSTRAINT fk_shop_order_items_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_order_items ADD CONSTRAINT fk_shop_order_items_store FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- COMMERCE: order_status_history
DO $$ BEGIN ALTER TABLE public.order_status_history ADD CONSTRAINT fk_order_status_history_order FOREIGN KEY (order_id) REFERENCES public.shop_orders(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- COMMERCE: payments
DO $$ BEGIN ALTER TABLE public.payments ADD CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES public.shop_orders(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- COMMERCE: hamper_bundle_items
DO $$ BEGIN ALTER TABLE public.hamper_bundle_items ADD CONSTRAINT fk_hamper_bundle_items_hamper FOREIGN KEY (hamper_id) REFERENCES public.hampers(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- COMMERCE: hamper_orders
DO $$ BEGIN ALTER TABLE public.hamper_orders ADD CONSTRAINT fk_hamper_orders_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- COMMERCE: hamper_order_items
DO $$ BEGIN ALTER TABLE public.hamper_order_items ADD CONSTRAINT fk_hamper_order_items_order FOREIGN KEY (order_id) REFERENCES public.hamper_orders(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.hamper_order_items ADD CONSTRAINT fk_hamper_order_items_hamper FOREIGN KEY (hamper_id) REFERENCES public.hampers(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- COMMERCE: discount_orders
DO $$ BEGIN ALTER TABLE public.discount_orders ADD CONSTRAINT fk_discount_orders_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.discount_orders ADD CONSTRAINT fk_discount_orders_discount FOREIGN KEY (discount_id) REFERENCES public.student_discounts(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- COMMERCE: marketplace_listings
DO $$ BEGIN ALTER TABLE public.marketplace_listings ADD CONSTRAINT fk_marketplace_listings_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.marketplace_listings ADD CONSTRAINT fk_marketplace_listings_store FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- COMMERCE: marketplace_orders
DO $$ BEGIN ALTER TABLE public.marketplace_orders ADD CONSTRAINT fk_marketplace_orders_listing FOREIGN KEY (listing_id) REFERENCES public.marketplace_listings(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.marketplace_orders ADD CONSTRAINT fk_marketplace_orders_buyer FOREIGN KEY (buyer_id) REFERENCES public.profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.marketplace_orders ADD CONSTRAINT fk_marketplace_orders_seller FOREIGN KEY (seller_id) REFERENCES public.profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- COMMERCE: student_hamper_preferences
DO $$ BEGIN ALTER TABLE public.student_hamper_preferences ADD CONSTRAINT fk_hamper_prefs_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.student_hamper_preferences ADD CONSTRAINT fk_hamper_prefs_item FOREIGN KEY (item_id) REFERENCES public.hamper_items(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- INDEXES for performance
CREATE INDEX IF NOT EXISTS idx_applications_user ON public.applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_residence ON public.applications(residence_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications(status);
CREATE INDEX IF NOT EXISTS idx_documents_user ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_residence ON public.favorites(residence_id);
CREATE INDEX IF NOT EXISTS idx_products_store ON public.products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_cart_user ON public.cart(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON public.cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_user ON public.shop_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_user ON public.marketplace_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_store ON public.marketplace_listings(store_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_buyer ON public.marketplace_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_seller ON public.marketplace_orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_discount_orders_user ON public.discount_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_hamper_orders_user ON public.hamper_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_wil_apps_student ON public.wil_applications(student_id);
CREATE INDEX IF NOT EXISTS idx_residence_analytics_residence ON public.residence_analytics(residence_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_rpa_residence ON public.residence_portal_accounts(residence_id);

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
