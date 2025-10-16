import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useFileUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadFile = async (file: File, bucket: string, path: string) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Get Supabase session for authenticated upload
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) throw new Error('User session not found.');

      // Construct the upload URL
      const uploadUrl = `${supabase.storage.url}/object/${bucket}/${path}`;

      // Create the request manually so we can track progress
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl);

      // Add authentication header
      xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
      xhr.setRequestHeader('Cache-Control', '3600');
      xhr.setRequestHeader('x-upsert', 'true');
      xhr.setRequestHeader('Content-Type', file.type || 'image/png');

      // Track upload progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
        }
      };

      // Wrap in a promise so we can await completion
      const uploadPromise = new Promise<string>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const { data } = supabase.storage.from(bucket).getPublicUrl(path);
            resolve(data.publicUrl);
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error during upload.'));
        xhr.send(file);
      });

      const publicUrl = await uploadPromise;
      return publicUrl;

    } catch (error: any) {
      toast.error(`Failed to upload file: ${error.message}`);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  return { isUploading, uploadProgress, uploadFile };
};
