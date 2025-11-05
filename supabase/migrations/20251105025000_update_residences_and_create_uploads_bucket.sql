-- Add role and res_manager_id columns to residences table
ALTER TABLE public.residences
ADD COLUMN IF NOT EXISTS role app_role,
ADD COLUMN IF NOT EXISTS res_manager_id UUID REFERENCES auth.users(id);

-- Create the user-uploads bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-uploads', 'user-uploads', true)
ON CONFLICT (id) DO NOTHING;
