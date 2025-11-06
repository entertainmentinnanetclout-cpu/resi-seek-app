-- Fix check constraint for student_number to allow more flexible formats
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS check_student_number_format;

-- Add more flexible constraint that allows null or any reasonable student number format
ALTER TABLE profiles 
ADD CONSTRAINT check_student_number_format 
CHECK (student_number IS NULL OR length(student_number) <= 20);

-- Fix storage policies for documents bucket to allow authenticated users to upload
DROP POLICY IF EXISTS "Users can upload documents" ON storage.objects;
CREATE POLICY "Users can upload documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Fix storage policies for documents bucket to allow users to update their documents
DROP POLICY IF EXISTS "Users can update documents" ON storage.objects;
CREATE POLICY "Users can update documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to view their own documents
DROP POLICY IF EXISTS "Users can view their documents" ON storage.objects;
CREATE POLICY "Users can view their documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);