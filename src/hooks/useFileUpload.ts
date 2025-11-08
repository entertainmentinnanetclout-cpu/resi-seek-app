import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * A hook for uploading files to Supabase storage.
 *
 * @returns {{isUploading: boolean, uploadProgress: number, uploadFile: (file: File, userId: string) => Promise<string | null>}} The upload state and function.
 */
export const useFileUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadFile = async (file: File, userId: string) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);

      const fileData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await fetch('/api/handler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'uploadFile',
          user_id: userId,
          fileName: file.name,
          fileData,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setUploadProgress(100);
        return result.url;
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast.error(`Failed to upload file: ${error.message}`);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  return { isUploading, uploadProgress, uploadFile };
};
