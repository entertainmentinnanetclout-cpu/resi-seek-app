import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// A WebView can resume with a stale network connection. A request must never
// leave Find My Res on a permanent skeleton, even if the network never replies.
const RESIDENCE_REQUEST_TIMEOUT_MS = 12_000;
const RESIDENCE_CACHE_KEY = 'rk_public_residences_cache_v2';
const RESIDENCE_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const useRealtimeResidences = () => {
  const [residences, setResidences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    let revision = 0;
    let refreshTimer: number | undefined;
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
        const [residenceResult, roomPricingResult, inventoryResult, readinessResult] = await Promise.all([
          db.from('residences').select('*').eq('is_visible', true).abortSignal(controller.signal),
          db.from('residence_room_types').select('*').eq('is_active', true).abortSignal(controller.signal),
          db.from('reskonnect_discovery_inventory_v').select('residence_id,visible_available_beds,visible_private_price,availability_source,room_type_count').abortSignal(controller.signal),
          db.from('reskonnect_marketplace_readiness_v').select('residence_id,readiness_score,marketplace_review_ready,has_photo_reference,has_verified_private_price,has_verified_location,readiness_gaps').abortSignal(controller.signal),
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

        const inventoryByResidence=new Map<string,any>();
        if(!inventoryResult.error)(inventoryResult.data||[]).forEach((entry:any)=>inventoryByResidence.set(entry.residence_id,entry));
        const readinessByResidence=new Map<string,any>();
        if(!readinessResult.error)(readinessResult.data||[]).forEach((entry:any)=>readinessByResidence.set(entry.residence_id,entry));
        const merged=(residenceResult.data||[]).map((residence:any)=>{
          const available=inventoryByResidence.get(residence.id);
          const price=Number(available?.visible_private_price||0);
          return {
            ...residence,
            room_pricing:(pricingByResidence.get(residence.id)||[]).filter((room:any)=>
              Number(room.academic_year||2027)===Number(residence.pricing_year||2027)),
            available_spots:available?.visible_available_beds??residence.available_spots,
            private_price:price>0?price:residence.private_price,
            price:price>0?price:residence.price,
            inventory_source:available?.availability_source||"listing_reported",
            listing_readiness:readinessByResidence.get(residence.id)||null,
            room_type_count:Number(available?.room_type_count||0)
          };
        });
        if (active && requestRevision === revision) {
          setResidences(merged);
          try {
            localStorage.setItem(RESIDENCE_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), rows: merged.slice(0, 500) }));
          } catch {}
        }
      } catch (err: unknown) {
        if (active && requestRevision === revision) {
          const message = controller.signal.aborted
            ? 'Accommodation search took too long. Check your connection and retry.'
            : err instanceof Error ? err.message : 'Accommodation listings are temporarily unavailable.';
          let recovered = false;
          try {
            const cached = JSON.parse(localStorage.getItem(RESIDENCE_CACHE_KEY) || "null");
            if (cached && Array.isArray(cached.rows) && Date.now() - Number(cached.savedAt || 0) <= RESIDENCE_CACHE_MAX_AGE_MS) {
              setResidences(cached.rows);
              setError('Showing recently cached accommodation while live data reconnects.');
              recovered = true;
            }
          } catch {}
          if (!recovered) setError(message);
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
    const onReconnect = () => scheduleRefresh();
    window.addEventListener("rk-reconnected", onReconnect);
    const channel = supabase.channel('realtime-residences-v3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'residences' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'residence_room_types' }, scheduleRefresh)
      .subscribe();

    return () => {
      active = false;
      revision += 1;
      currentController?.abort();
      if (refreshTimer) window.clearTimeout(refreshTimer);
      window.removeEventListener("rk-reconnected", onReconnect);
      void supabase.removeChannel(channel);
    };
  }, [refreshKey]);

  const refresh = () => setRefreshKey((value) => value + 1);
  return { residences, loading, error, refresh };
};
