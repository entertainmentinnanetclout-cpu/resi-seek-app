ALTER TABLE public.hero_slides ADD COLUMN slide_location text NOT NULL DEFAULT 'landing';

INSERT INTO public.hero_slides (title, description, image_url, cta_text, cta_link, display_order, is_active, slide_location) VALUES
  ('Find Your Perfect Res', 'Discover comfortable, affordable student accommodation near your campus', 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=1200&h=600&fit=crop', 'Browse Residences', '/findmyres', 0, true, 'dashboard'),
  ('Student Grocery Discounts', 'Save up to 30% on grocery hampers specially curated for students', 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&h=600&fit=crop', 'Get Discounts', '/marketplace?tab=deals', 1, true, 'dashboard');