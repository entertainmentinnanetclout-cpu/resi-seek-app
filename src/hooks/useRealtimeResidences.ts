import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * A custom hook to fetch residences from Supabase in real-time.
 * It handles loading states, error handling, and subscribes to database changes
 * to keep the data automatically synchronized.
 *
 * @returns {{
 *   residences: any[],
 *   loading: boolean,
 *   campusOptions: string[]
 * }} An object containing the list of residences, the loading state, and the unique campus options.
 */
export const useRealtimeResidences = () => {
  const [residences, setResidences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [campusOptions, setCampusOptions] = useState<string[]>([]);

  useEffect(() => {
    const fetchResidences = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('residences').select('*');
        if (error) throw error;
        setResidences(data || []);
        // Extract unique campuses from residences
        const uniqueCampuses = [...new Set(data?.map((r) => r.campus?.trim()))]
          .filter(Boolean)
          .sort();
        setCampusOptions(uniqueCampuses);

      } catch (error) {
        console.error('Error fetching residences:', error);
        toast.error('Failed to load residences.');
      } finally {
        setLoading(false);
      }
    };

    fetchResidences();

    const channel = supabase
      .channel('residences-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'residences'
        },
        (payload) => {
          console.log('Residence change detected:', payload);

          if (payload.eventType === 'INSERT') {
            setResidences(prev => [...prev, payload.new]);
          } else if (payload.eventType === 'UPDATE') {
            setResidences(prev => prev.map(r => r.id === payload.new.id ? payload.new : r));
          } else if (payload.eventType === 'DELETE') {
            setResidences(prev => prev.filter(r => r.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { residences, loading, campusOptions };
};
