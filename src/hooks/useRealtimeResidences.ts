import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// A WebView can resume with a stale network connection. A request must never
// leave Find My Res on a permanent skeleton, even if the network never replies.
const RESIDENCE_REQUEST_TIMEOUT_MS = 12_000;

export const useRealtimeResidences = () => {
  const [residences, setResidences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let revision = 0;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let currentController: AbortController | undefined;

    const fetchResidences = async () => {
      const requestRevision = ++revision;
      currentController?.abort();
      const controller = new AbortController();
      currentController = controller;
      const timeout = window.setTimeout(() => controller.abort(), RESIDENCE_REQUEST_TIMEOUT_MS);

      try {
        if (active) {
          setLoading(true);
          setError(null);
        }
        const db = supabase as any;
        const [residenceResult, roomPricingResult] = await Promise.all([
          supabase.from('residences').select('*').abortSignal(controller.signal),
          db.from('residence_room_types').select('*').eq('is_active', true).abortSignal(controller.signal),
        ]);
        if (residenceResult.error) throw residenceResult.error;

        const pricingByResidence = new Map<string, any[]>();
        if (!roomPricingResult.error) {
          (roomPricingResult.data || []).forEach((room: any) => {
            const rows = pricingByResidence.get(room.residence_id) || [];
            rows.push(room);
            pricingByResidence.set(room.residence_id, rows);
          });
        }

        const merged = (residenceResult.data || []).map((residence: any) => ({
          ...residence,
          room_pricing: pricingByResidence.get(residence.id) || [],
        }));
        if (active && requestRevision === revision) setResidences(merged);
      } catch (err: unknown) {
        if (active && requestRevision === revision) {
          const message = controller.signal.aborted
            ? 'Accommodation search took too long. Check your connection and retry.'
            : err instanceof Error ? err.message : 'Accommodation listings are temporarily unavailable.';
          setError(message);
          console.error('[useRealtimeResidences] Could not load residences:', message);
        }
      } finally {
        window.clearTimeout(timeout);
        if (currentController === controller) currentController = undefined;
        if (active && requestRevision === revision) setLoading(false);
      }
    };

    void fetchResidences();
    // A large residence update can generate a burst of realtime events. Coalesce
    // these to one refresh, and abort the previous request if another starts.
    const scheduleRefresh = () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => { void fetchResidences(); }, 750);
    };
    const channel = supabase.channel('realtime-residences-v3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'residences' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'residence_room_types' }, scheduleRefresh)
      .subscribe();

    return () => {
      active = false;
      revision += 1;
      currentController?.abort();
      if (refreshTimer) window.clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, []);

  return { residences, loading, error };
};
