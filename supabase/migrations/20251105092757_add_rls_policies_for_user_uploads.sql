-- Create policy to allow authenticated users to upload to the 'user-uploads' bucket
CREATE POLICY "Allow authenticated uploads to user-uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'user-uploads');

-- Create policy to allow users to view their own files in the 'user-uploads' bucket
CREATE POLICY "Allow users to view their own files in user-uploads"
ON storage.objects FOR SELECT
TO authenticated
USING (auth.uid()::text = owner_id::text);
