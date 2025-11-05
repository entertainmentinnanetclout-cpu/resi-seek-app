-- Create policy to allow authenticated users to upload to the 'user-uploads' bucket
-- More specific policies for user-uploads bucket

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated uploads to user-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to view their own files in user-uploads" ON storage.objects;

-- Grant INSERT access to a user's own folder
CREATE POLICY "Allow authenticated uploads to user-uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'user-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Grant UPDATE access to a user's own files
CREATE POLICY "Allow users to update their own files in user-uploads"
ON storage.objects FOR UPDATE
TO authenticated
USING (auth.uid()::text = owner_id)
WITH CHECK (bucket_id = 'user-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Grant SELECT access to a user's own folder
CREATE POLICY "Allow users to view their own files in user-uploads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'user-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
