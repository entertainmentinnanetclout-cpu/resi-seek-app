-- Fix profile-pictures storage bucket RLS policies
-- Ensure the bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop potentially conflicting policies
DROP POLICY IF EXISTS "Users can upload their own profile picture" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile picture" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile picture" ON storage.objects;

-- Create proper policies for profile pictures
CREATE POLICY "Authenticated users can upload profile pictures" 
ON storage.objects FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'profile-pictures' 
  AND (auth.uid()::text = (storage.foldername(name))[1])
);

CREATE POLICY "Users can update their own profile picture" 
ON storage.objects FOR UPDATE 
TO authenticated
USING (
  bucket_id = 'profile-pictures' 
  AND (auth.uid()::text = (storage.foldername(name))[1])
);

CREATE POLICY "Anyone can view profile pictures" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'profile-pictures');

CREATE POLICY "Users can delete their own profile picture" 
ON storage.objects FOR DELETE 
TO authenticated
USING (
  bucket_id = 'profile-pictures' 
  AND (auth.uid()::text = (storage.foldername(name))[1])
);