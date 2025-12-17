-- Create hero_slides table for managing carousel slides
CREATE TABLE public.hero_slides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  cta_text TEXT,
  cta_link TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bursaries table for managing bursary listings
CREATE TABLE public.bursaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  amount TEXT,
  deadline DATE,
  fields_of_study TEXT[],
  requirements TEXT[],
  link TEXT,
  type TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create student_discounts table for managing discount listings
CREATE TABLE public.student_discounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  discount TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  how_to_claim TEXT,
  link TEXT,
  valid_until DATE,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create campus_news table for managing news articles
CREATE TABLE public.campus_news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  image_url TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  author TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create platform_settings table for global settings
CREATE TABLE public.platform_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on all tables
ALTER TABLE public.hero_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bursaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Public read access for active content
CREATE POLICY "Anyone can view active hero slides" ON public.hero_slides
  FOR SELECT USING (is_active = true);

CREATE POLICY "Anyone can view active bursaries" ON public.bursaries
  FOR SELECT USING (is_active = true);

CREATE POLICY "Anyone can view active discounts" ON public.student_discounts
  FOR SELECT USING (is_active = true);

CREATE POLICY "Anyone can view published news" ON public.campus_news
  FOR SELECT USING (is_published = true);

-- Admin full access policies
CREATE POLICY "Admins can manage hero slides" ON public.hero_slides
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage bursaries" ON public.bursaries
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage discounts" ON public.student_discounts
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage news" ON public.campus_news
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage settings" ON public.platform_settings
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Add updated_at triggers
CREATE TRIGGER update_hero_slides_updated_at
  BEFORE UPDATE ON public.hero_slides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bursaries_updated_at
  BEFORE UPDATE ON public.bursaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_student_discounts_updated_at
  BEFORE UPDATE ON public.student_discounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campus_news_updated_at
  BEFORE UPDATE ON public.campus_news
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create admin-images storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('admin-images', 'admin-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for admin-images bucket
CREATE POLICY "Admin images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'admin-images');

CREATE POLICY "Admins can upload admin images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'admin-images' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update admin images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'admin-images' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete admin images" ON storage.objects
  FOR DELETE USING (bucket_id = 'admin-images' AND has_role(auth.uid(), 'admin'));