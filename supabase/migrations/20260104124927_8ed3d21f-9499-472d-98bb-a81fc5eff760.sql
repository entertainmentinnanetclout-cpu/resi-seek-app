-- Fix realtime for applications - set replica identity to FULL for UPDATE events to include old data
ALTER TABLE public.applications REPLICA IDENTITY FULL;

-- Also enable realtime and replica identity for residences (for trusted grid updates)
ALTER TABLE public.residences REPLICA IDENTITY FULL;