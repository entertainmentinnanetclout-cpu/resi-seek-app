-- Add DELETE policy for storage.objects in documents bucket
CREATE POLICY "Users can delete their own documents from storage"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' 
  AND (auth.uid()::text = (storage.foldername(name))[1])
);