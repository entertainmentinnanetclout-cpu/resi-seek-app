import { supabase } from "@/integrations/supabase/client";

export interface ResidencePortalAccount {
  id: string;
  residence_id: string;
  user_id: string | null;
  email: string;
  is_active: boolean;
  portal_role: "owner" | "manager" | "admin";
}

const client = supabase as any;

/**
 * Existing accounts are resolved by their authenticated Auth user ID.
 * Legacy email-only invitations are claimed through a narrow security-definer
 * RPC which verifies the email against auth.users and changes only user_id.
 * The old unrestricted RLS update-by-email path is deliberately removed.
 */
export const resolveResidencePortalAccount = async (user: { id: string; email?: string | null }) => {
  const { data: existing, error: existingError } = await client
    .from("residence_portal_accounts")
    .select("id,residence_id,user_id,email,is_active,portal_role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing as ResidencePortalAccount;
  if (!user.email) return null;

  const { data: claimed, error: claimError } = await client
    .rpc("claim_residence_portal_account");
  if (claimError) throw claimError;
  return ((claimed || [])[0] as ResidencePortalAccount | undefined) || null;
};
