-- Add storage policy for documents bucket with file type validation
DROP POLICY IF EXISTS "Restrict document uploads to allowed types" ON storage.objects;
CREATE POLICY "Restrict document uploads to allowed types"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' AND
  (storage.extension(name) IN ('pdf', 'docx', 'jpg', 'jpeg', 'png'))
);