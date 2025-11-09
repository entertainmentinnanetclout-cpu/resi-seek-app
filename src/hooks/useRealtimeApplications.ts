import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { type User } from '@supabase/supabase-js';

export function useRealtimeApplications(user: User | null) {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchApplications = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('applications')
          .select('*')
          .eq('user_id', user.id);

        if (error) throw error;
        setApplications(data || []);
      } catch (err: any) {
        setError(err.message);
        console.error("Error fetching initial applications:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();

    const channel = supabase
      .channel(`realtime-applications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'applications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Application change received!', payload);
          // Here you might want to refetch or update the applications list
          // For simplicity, we'll refetch all applications
          fetchApplications();
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to application changes for user ${user.id}`);
          setError(null);
        }
        if (status === 'CHANNEL_ERROR') {
          setError(`Subscription error: ${err?.message}`);
          console.error(`Subscription error for user ${user.id}:`, err);
        }
        if (status === 'TIMED_OUT') {
          setError('Subscription timed out.');
          console.error(`Subscription timed out for user ${user.id}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { applications, loading, error };
}
