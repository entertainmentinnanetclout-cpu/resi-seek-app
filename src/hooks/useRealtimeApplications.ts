import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { type User } from '@supabase/supabase-js';
import { toast } from 'sonner';

export function useRealtimeApplications(user: User | null) {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const previousStatuses = useRef<Map<string, string>>(new Map());

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
        
        // Store initial statuses
        if (data) {
          data.forEach(app => {
            previousStatuses.current.set(app.id, app.status);
          });
        }
        
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
          event: 'UPDATE',
          schema: 'public',
          table: 'applications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Application status update received!', payload);
          const newApp = payload.new as any;
          const oldStatus = previousStatuses.current.get(newApp.id);
          
          // Show toast notification when status changes
          if (oldStatus && oldStatus !== newApp.status) {
            const statusLabels: Record<string, string> = {
              submitted: 'Pending',
              under_review: 'Under Review 🔍',
              documents_required: 'Documents Required 📄',
              approved: 'Approved ✅',
              rejected: 'Rejected ❌',
              waitlisted: 'Waitlisted ⏳',
              cancelled: 'Cancelled'
            };
            toast.info(`Application status updated to: ${statusLabels[newApp.status] || newApp.status}`, {
              description: 'Your residence application has been reviewed.',
              duration: 5000,
            });
          }
          
          // Update stored status
          previousStatuses.current.set(newApp.id, newApp.status);
          
          // Update state
          setApplications(prev => prev.map(app => 
            app.id === newApp.id ? { ...app, ...newApp } : app
          ));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'applications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newApp = payload.new as any;
          previousStatuses.current.set(newApp.id, newApp.status);
          setApplications(prev => [newApp, ...prev]);
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
