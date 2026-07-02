/**
 * External Supabase driver — stub adapter. Same surface as the Lovable driver so the
 * BAL can swap providers via `VITE_BACKEND_PROVIDER=supabase` without UI changes.
 *
 * When External Supabase is restored, set:
 *   VITE_EXTERNAL_SUPABASE_URL
 *   VITE_EXTERNAL_SUPABASE_ANON_KEY
 * and switch the provider env. If the vars are missing we fall back to the Lovable
 * client so the app still boots.
 */
// External Supabase driver — uses the hard-pinned External client from
// `src/integrations/supabase/client.ts`. Both drivers now resolve to the
// same External project so provider swaps are a no-op at runtime.
import { supabase as externalClient } from "@/integrations/supabase/client";
import type { BackendDriver } from "../types";

const client = externalClient;

export const supabaseDriver: BackendDriver = {
  name: "supabase",
  client: client as any,
  db: { from: client.from.bind(client), rpc: client.rpc.bind(client) as any },
  auth: client.auth,
  storage: client.storage,
  functions: client.functions,
};