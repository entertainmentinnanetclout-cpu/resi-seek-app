import { supabase } from "@/integrations/supabase/client";

export interface ResidencePortalAccount {
  residence_id: string;
  user_id: string | null;
  email: string;
  is_active: boolean;
}

const client = supabase as any;

/**
 * Resolve the residence portal account linked to an authenticated user.
 * Older/pre-provisioned accounts may exist by email before their first login;
 * in that case the user can safely self-claim the row through the existing RLS policy.
 */
export const resolveResidencePortalAccount = async (user: { id: string; email?: string | null }) => {
  const { data: existing, error: existingError } = await client
    .from("residence_portal_accounts")
    .select("residence_id, user_id, email, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing as ResidencePortalAccount;

  if (!user.email) return null;

  const { data: claimed, error: claimError } = await client
    .from("residence_portal_accounts")
    .update({ user_id: user.id, updated_at: new Date().toISOString() })
    .eq("email", user.email)
    .is("user_id", null)
    .select("residence_id, user_id, email, is_active")
    .maybeSingle();

  if (claimError) throw claimError;
  return (claimed as ResidencePortalAccount | null) || null;
};
