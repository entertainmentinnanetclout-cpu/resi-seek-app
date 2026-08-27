import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useRealtimeResidences = () => {
  const [residences, setResidences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const fetchResidences = async () => {
      try {
        setLoading(true);
        setError(null);
        const db = supabase as any;
        const [residenceResult, roomPricingResult] = await Promise.all([
          supabase.from('residences').select('*'),
          db.from('residence_room_types').select('*').eq('is_active', true),
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
        if (active) setResidences(merged);
      } catch (err: any) {
        console.error('[useRealtimeResidences] Error:', err);
        if (active) {
          setError(err.message);
          toast.error('Failed to load residences: ' + err.message);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchResidences();
    const channel = supabase.channel('realtime-residences-v3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'residences' }, () => void fetchResidences())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'residence_room_types' }, () => void fetchResidences())
      .subscribe();

    return () => { active = false; void supabase.removeChannel(channel); };
  }, []);

  return { residences, loading, error };
};
