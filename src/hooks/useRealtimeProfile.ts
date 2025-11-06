import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { type User } from '@supabase/supabase-js';

export function useRealtimeProfile(user: User | null) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (error) throw error;
        setProfile(data);
      } catch (err: any) {
        setError(err.message);
        console.error("Error fetching initial profile:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();

    const channel = supabase
      .channel(`realtime-profile-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Profile change received!', payload);
          setProfile(payload.new);
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to profile changes for user ${user.id}`);
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

  return { profile, loading, error };
}
