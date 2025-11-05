import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  const { method, body } = req;

  if (method === 'POST' && body.action === 'uploadFile') {
    const { user_id, fileName, fileData } = body;

    if (!user_id || !fileName || !fileData)
      return res.status(400).json({ error: 'Missing upload data' });

    try {
      // Convert base64 to buffer
      const buffer = Buffer.from(fileData.split(',')[1], 'base64');

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('user-uploads')
        .upload(`${user_id}/${fileName}`, buffer, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Supabase upload error:', uploadError.message);
        return res.status(400).json({ error: uploadError.message });
      }

      // Get public URL
      const { data: urlData } = supabase
        .storage
        .from('user-uploads')
        .getPublicUrl(`${user_id}/${fileName}`);

      if (!urlData.publicUrl) {
         return res.status(500).json({ error: 'Could not retrieve public URL.' });
      }

      return res.status(200).json({ message: 'Upload successful', url: urlData.publicUrl });
    } catch (err) {
      console.error('Server upload error:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  res.setHeader('Allow', ['POST']);
  res.status(405).end(`Method ${method} Not Allowed`);
}
