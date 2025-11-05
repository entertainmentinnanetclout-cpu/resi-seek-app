-- Create the user-documents bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-documents', 'user-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for the user-documents bucket
DROP POLICY IF EXISTS "Allow authenticated users to upload to user-documents" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload to user-documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'user-documents');

DROP POLICY IF EXISTS "Allow users to view their own documents" ON storage.objects;
CREATE POLICY "Allow users to view their own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (auth.uid()::text = (storage.foldername(name))[1]);
