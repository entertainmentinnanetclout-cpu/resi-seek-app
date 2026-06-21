/**
 * Lovable Cloud driver — uses the auto-generated Supabase client which is already
 * configured for the Lovable Cloud project. This is the DEFAULT active backend.
 */
import { supabase as client } from "@/integrations/supabase/client";
import type { BackendDriver } from "../types";

export const lovableDriver: BackendDriver = {
  name: "lovable",
  client,
  db: { from: client.from.bind(client), rpc: client.rpc.bind(client) as any },
  auth: client.auth,
  storage: client.storage,
  functions: client.functions,
};