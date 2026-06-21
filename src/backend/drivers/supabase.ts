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
import { createClient } from "@supabase/supabase-js";
import { supabase as lovableClient } from "@/integrations/supabase/client";
import type { BackendDriver } from "../types";

const url = (import.meta.env.VITE_EXTERNAL_SUPABASE_URL as string | undefined) ?? "";
const key = (import.meta.env.VITE_EXTERNAL_SUPABASE_ANON_KEY as string | undefined) ?? "";

const client = url && key
  ? createClient(url, key, { auth: { storage: localStorage, persistSession: true, autoRefreshToken: true } })
  : lovableClient;

export const supabaseDriver: BackendDriver = {
  name: "supabase",
  client: client as any,
  db: { from: client.from.bind(client), rpc: client.rpc.bind(client) as any },
  auth: client.auth,
  storage: client.storage,
  functions: client.functions,
};