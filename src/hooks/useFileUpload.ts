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

      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });

      if (error) {
        throw error;
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return data.publicUrl;
    } catch (error: any) {
      toast.error(`Failed to upload file: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return { isUploading, uploadProgress, uploadFile };
};