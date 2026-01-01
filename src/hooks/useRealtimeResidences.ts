import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useRealtimeResidences = () => {
  const [residences, setResidences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResidences = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('[useRealtimeResidences] Fetching residences...');
        
        const { data, error: fetchError } = await supabase
          .from('residences')
          .select('*');
        
        if (fetchError) {
          console.error('[useRealtimeResidences] Fetch error:', fetchError);
          throw fetchError;
        }
        
        console.log(`[useRealtimeResidences] Fetched ${data?.length || 0} residences`);
        setResidences(data || []);
      } catch (err: any) {
        console.error('[useRealtimeResidences] Error:', err);
        setError(err.message);
        toast.error('Failed to load residences: ' + err.message);
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
          console.log('[useRealtimeResidences] Change received:', payload);
          fetchResidences();
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[useRealtimeResidences] Subscribed to realtime updates');
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('[useRealtimeResidences] Subscription error:', err);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { residences, loading, error };
};
