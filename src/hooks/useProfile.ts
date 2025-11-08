import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'>;

/**
 * A hook for fetching and updating a user's profile.
 *
 * @param {string} userId - The ID of the user.
 * @returns {{profile: Profile | null, loading: boolean, updateProfile: (updatedFields: Partial<Profile>) => Promise<void>, refetch: () => Promise<void>}} The profile, loading state, and update/refetch functions.
 */
export const useProfile = (userId: string) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        throw error;
      }

      setProfile(data);
    } catch (error: any) {
      toast.error(`Failed to fetch profile: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = async (updatedFields: Partial<Profile>) => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updatedFields)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      setProfile(data);
      toast.success('Profile updated successfully!');
    } catch (error: any) {
      toast.error(`Failed to update profile: ${error.message}`);
    }
  };

  return { profile, loading, updateProfile, refetch: fetchProfile };
};