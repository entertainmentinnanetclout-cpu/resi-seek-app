-- Enable realtime for applications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.applications;

-- Enable realtime for profiles table
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- Enable realtime for events table
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;