-- Add lifestyle preferences and roommate status to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS lifestyle_preferences JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS looking_for_roommate BOOLEAN DEFAULT false;

-- Create events table for campus events
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  campus TEXT,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT,
  image_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  interested_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Anyone can view events
CREATE POLICY "Anyone can view events" ON public.events
FOR SELECT USING (true);

-- Authenticated users can create events
CREATE POLICY "Authenticated users can create events" ON public.events
FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Users can update their own events
CREATE POLICY "Users can update their own events" ON public.events
FOR UPDATE USING (auth.uid() = created_by);

-- Users can delete their own events
CREATE POLICY "Users can delete their own events" ON public.events
FOR DELETE USING (auth.uid() = created_by);

-- Trigger for updated_at
CREATE TRIGGER update_events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();