
-- Phase 1A: Add all missing foreign key constraints
-- Idempotent: uses DO blocks with IF NOT EXISTS checks

DO $$ BEGIN
  -- products.store_id -> stores.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_store_id_fkey') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;
  END IF;
  -- products.category_id -> product_categories.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_category_id_fkey') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.product_categories(id) ON DELETE SET NULL;
  END IF;
  -- product_variants.product_id -> products.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_variants_product_id_fkey') THEN
    ALTER TABLE public.product_variants ADD CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
  -- cart_items.cart_id -> cart.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_cart_id_fkey') THEN
    ALTER TABLE public.cart_items ADD CONSTRAINT cart_items_cart_id_fkey FOREIGN KEY (cart_id) REFERENCES public.cart(id) ON DELETE CASCADE;
  END IF;
  -- cart_items.product_id -> products.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_product_id_fkey') THEN
    ALTER TABLE public.cart_items ADD CONSTRAINT cart_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
  -- cart_items.variant_id -> product_variants.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_variant_id_fkey') THEN
    ALTER TABLE public.cart_items ADD CONSTRAINT cart_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;
  END IF;
  -- shop_order_items.order_id -> shop_orders.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_order_items_order_id_fkey') THEN
    ALTER TABLE public.shop_order_items ADD CONSTRAINT shop_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.shop_orders(id) ON DELETE CASCADE;
  END IF;
  -- shop_order_items.product_id -> products.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_order_items_product_id_fkey') THEN
    ALTER TABLE public.shop_order_items ADD CONSTRAINT shop_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
  -- shop_order_items.variant_id -> product_variants.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_order_items_variant_id_fkey') THEN
    ALTER TABLE public.shop_order_items ADD CONSTRAINT shop_order_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;
  END IF;
  -- shop_order_items.store_id -> stores.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_order_items_store_id_fkey') THEN
    ALTER TABLE public.shop_order_items ADD CONSTRAINT shop_order_items_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;
  END IF;
  -- order_status_history.order_id -> shop_orders.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_status_history_order_id_fkey') THEN
    ALTER TABLE public.order_status_history ADD CONSTRAINT order_status_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.shop_orders(id) ON DELETE CASCADE;
  END IF;
  -- payments.order_id -> shop_orders.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_order_id_fkey') THEN
    ALTER TABLE public.payments ADD CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.shop_orders(id) ON DELETE CASCADE;
  END IF;
  -- hamper_bundle_items.hamper_id -> hampers.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hamper_bundle_items_hamper_id_fkey') THEN
    ALTER TABLE public.hamper_bundle_items ADD CONSTRAINT hamper_bundle_items_hamper_id_fkey FOREIGN KEY (hamper_id) REFERENCES public.hampers(id) ON DELETE CASCADE;
  END IF;
  -- hamper_order_items.order_id -> hamper_orders.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hamper_order_items_order_id_fkey') THEN
    ALTER TABLE public.hamper_order_items ADD CONSTRAINT hamper_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.hamper_orders(id) ON DELETE CASCADE;
  END IF;
  -- hamper_order_items.hamper_id -> hampers.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hamper_order_items_hamper_id_fkey') THEN
    ALTER TABLE public.hamper_order_items ADD CONSTRAINT hamper_order_items_hamper_id_fkey FOREIGN KEY (hamper_id) REFERENCES public.hampers(id) ON DELETE CASCADE;
  END IF;
  -- applications.residence_id -> residences.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'applications_residence_id_fkey') THEN
    ALTER TABLE public.applications ADD CONSTRAINT applications_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES public.residences(id) ON DELETE CASCADE;
  END IF;
  -- favorites.user_id -> profiles.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'favorites_user_id_fkey') THEN
    ALTER TABLE public.favorites ADD CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
  -- favorites.residence_id -> residences.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'favorites_residence_id_fkey') THEN
    ALTER TABLE public.favorites ADD CONSTRAINT favorites_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES public.residences(id) ON DELETE CASCADE;
  END IF;
  -- reviews.user_id -> profiles.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_user_id_fkey') THEN
    ALTER TABLE public.reviews ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
  -- reviews.residence_id -> residences.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_residence_id_fkey') THEN
    ALTER TABLE public.reviews ADD CONSTRAINT reviews_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES public.residences(id) ON DELETE CASCADE;
  END IF;
  -- residence_portal_accounts.residence_id -> residences.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'residence_portal_accounts_residence_id_fkey') THEN
    ALTER TABLE public.residence_portal_accounts ADD CONSTRAINT residence_portal_accounts_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES public.residences(id) ON DELETE CASCADE;
  END IF;
  -- application_documents.application_id -> applications.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'application_documents_application_id_fkey') THEN
    ALTER TABLE public.application_documents ADD CONSTRAINT application_documents_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;
  END IF;
  -- application_documents.residence_id -> residences.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'application_documents_residence_id_fkey') THEN
    ALTER TABLE public.application_documents ADD CONSTRAINT application_documents_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES public.residences(id) ON DELETE CASCADE;
  END IF;
  -- application_messages.application_id -> applications.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'application_messages_application_id_fkey') THEN
    ALTER TABLE public.application_messages ADD CONSTRAINT application_messages_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;
  END IF;
  -- application_messages.residence_id -> residences.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'application_messages_residence_id_fkey') THEN
    ALTER TABLE public.application_messages ADD CONSTRAINT application_messages_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES public.residences(id) ON DELETE CASCADE;
  END IF;
  -- application_activity_log.application_id -> applications.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'application_activity_log_application_id_fkey') THEN
    ALTER TABLE public.application_activity_log ADD CONSTRAINT application_activity_log_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;
  END IF;
  -- application_activity_log.residence_id -> residences.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'application_activity_log_residence_id_fkey') THEN
    ALTER TABLE public.application_activity_log ADD CONSTRAINT application_activity_log_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES public.residences(id) ON DELETE CASCADE;
  END IF;
  -- referral_claims.application_id -> applications.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referral_claims_application_id_fkey') THEN
    ALTER TABLE public.referral_claims ADD CONSTRAINT referral_claims_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;
  END IF;
  -- referral_claims.residence_id -> residences.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referral_claims_residence_id_fkey') THEN
    ALTER TABLE public.referral_claims ADD CONSTRAINT referral_claims_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES public.residences(id) ON DELETE CASCADE;
  END IF;
  -- residence_analytics.residence_id -> residences.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'residence_analytics_residence_id_fkey') THEN
    ALTER TABLE public.residence_analytics ADD CONSTRAINT residence_analytics_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES public.residences(id) ON DELETE CASCADE;
  END IF;
  -- residence_analytics.user_id -> profiles.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'residence_analytics_user_id_fkey') THEN
    ALTER TABLE public.residence_analytics ADD CONSTRAINT residence_analytics_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
  -- discount_orders.discount_id -> student_discounts.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discount_orders_discount_id_fkey') THEN
    ALTER TABLE public.discount_orders ADD CONSTRAINT discount_orders_discount_id_fkey FOREIGN KEY (discount_id) REFERENCES public.student_discounts(id) ON DELETE CASCADE;
  END IF;
  -- marketplace_listings.store_id -> stores.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_listings_store_id_fkey') THEN
    ALTER TABLE public.marketplace_listings ADD CONSTRAINT marketplace_listings_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE SET NULL;
  END IF;
  -- marketplace_orders.listing_id -> marketplace_listings.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_orders_listing_id_fkey') THEN
    ALTER TABLE public.marketplace_orders ADD CONSTRAINT marketplace_orders_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.marketplace_listings(id) ON DELETE CASCADE;
  END IF;
  -- call_logs.student_id -> profiles.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'call_logs_student_id_fkey') THEN
    ALTER TABLE public.call_logs ADD CONSTRAINT call_logs_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
  -- store_reviews.store_id -> stores.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'store_reviews_store_id_fkey') THEN
    ALTER TABLE public.store_reviews ADD CONSTRAINT store_reviews_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;
  END IF;
  -- product_categories.parent_id -> product_categories.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_categories_parent_id_fkey') THEN
    ALTER TABLE public.product_categories ADD CONSTRAINT product_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.product_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_products_store_id ON public.products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON public.cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_shop_order_items_order_id ON public.shop_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_applications_residence_id ON public.applications(residence_id);
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON public.applications(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_discount_orders_user_id ON public.discount_orders(user_id);
