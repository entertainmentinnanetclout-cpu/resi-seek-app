import type { SupabaseClient } from "@supabase/supabase-js";

export interface BackendDriver {
  name: "lovable" | "supabase";
  client: SupabaseClient<any, any, any>;
  db: SupabaseClient<any, any, any>["from"] extends (...a: infer A) => infer R
    ? { from: (...a: A) => R; rpc: SupabaseClient["rpc"] }
    : never;
  auth: SupabaseClient["auth"];
  storage: SupabaseClient["storage"];
  functions: SupabaseClient["functions"];
}