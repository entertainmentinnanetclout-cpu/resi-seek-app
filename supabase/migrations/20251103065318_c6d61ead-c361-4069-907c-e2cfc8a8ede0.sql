-- Create residences table for accommodation listings
CREATE TABLE IF NOT EXISTS public.residences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 1,
  amenities TEXT[] DEFAULT '{}',
  image_url TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  available_spots INTEGER NOT NULL DEFAULT 0,
  campus TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create applications table for residence applications
CREATE TABLE IF NOT EXISTS public.applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  residence_id UUID NOT NULL REFERENCES public.residences(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'submitted',
  application_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.residences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for residences (everyone can view)
CREATE POLICY "Anyone can view residences"
ON public.residences
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage residences"
ON public.residences
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for applications
CREATE POLICY "Users can view their own applications"
ON public.applications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own applications"
ON public.applications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all applications"
ON public.applications
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update applications"
ON public.applications
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add update trigger for residences
CREATE TRIGGER update_residences_updated_at
BEFORE UPDATE ON public.residences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add update trigger for applications
CREATE TRIGGER update_applications_updated_at
BEFORE UPDATE ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();