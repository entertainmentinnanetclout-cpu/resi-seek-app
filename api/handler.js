import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  const { method, body, query } = req;

  if (method === 'POST' && body.action === 'updateProfile') {
    const { user_id, updates } = body;
    if (!user_id || !updates) return res.status(400).json({ error: 'Missing user_id or updates' });

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user_id)
        .select();

      if (error) return res.status(400).json({ error: error.message });

      return res.status(200).json({ message: 'Profile updated successfully', data });
    } catch (err) {
      console.error('Profile update error:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  if (method === 'GET' && query.action === 'getResidences') {
    const { role } = query;
    const validRole = role || 'student'; // fallback if role missing

    try {
      const { data, error } = await supabase
        .from('residences')
        .select('*, manager:res_manager_id(*)')
        .eq('role', validRole);

      if (error) return res.status(400).json({ error: error.message });

      return res.status(200).json(data || []);
    } catch (err) {
      console.error('Find My Res error:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  if (method === 'POST' && body.action === 'uploadFile') {
    const { user_id, fileName, fileData } = body;

    if (!user_id || !fileName || !fileData)
      return res.status(400).json({ error: 'Missing upload data' });

    try {
      const buffer = Buffer.from(fileData.split(',')[1], 'base64');
      const { data, error } = await supabase.storage
        .from('user-uploads') // existing bucket
        .upload(`${user_id}/${fileName}`, buffer, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) return res.status(400).json({ error: error.message });

      const { publicUrl, error: urlError } = supabase
        .storage
        .from('user-uploads')
        .getPublicUrl(`${user_id}/${fileName}`);

      if (urlError) return res.status(400).json({ error: urlError.message });

      return res.status(200).json({ message: 'Upload successful', url: publicUrl });
    } catch (err) {
      console.error('Upload error:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end(`Method ${method} Not Allowed`);
}
