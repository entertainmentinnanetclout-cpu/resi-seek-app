import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useRealtimeResidences = () => {
  const [residences, setResidences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResidences = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.from('residences').select('*');
        if (error) throw error;
        setResidences(data || []);
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchResidences();

    const channel = supabase
      .channel('realtime-residences')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'residences' },
        (payload) => {
            console.log('Change received!', payload)
            fetchResidences();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { residences, loading };
};
