
CREATE TABLE public.residence_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  subtitle text,
  display_order integer DEFAULT 0,
  color text DEFAULT 'bg-blue-500',
  is_active boolean DEFAULT true,
  applies_to text DEFAULT 'both',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.residence_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active sections" ON public.residence_sections
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins manage sections" ON public.residence_sections
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.residence_sections (name, slug, subtitle, display_order, color) VALUES
  ('Flats', 'FLATS', 'Pretoria West, CBD, etc', 1, 'bg-blue-500'),
  ('Communes', 'COMMUNES', 'Pretoria West, etc', 2, 'bg-emerald-500'),
  ('Rentals', 'RENTALS', 'Sunnyside, Sosha, E1', 3, 'bg-purple-500'),
  ('Private Accommodations', 'PRIVATE', 'Premium private residences', 4, 'bg-amber-500');
