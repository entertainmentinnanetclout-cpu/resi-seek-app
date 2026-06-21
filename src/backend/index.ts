/**
 * Backend Abstraction Layer (BAL) — single entry point for all backend ops.
 *
 * All NEW code must import from `@/backend` instead of `@/integrations/supabase/client`.
 * Existing code that imports the supabase client directly is still supported during the
 * transition; it continues to work because both paths resolve to the active driver below.
 *
 * The active driver is chosen at module load by `VITE_BACKEND_PROVIDER`:
 *   - "lovable"  (default) -> Lovable Cloud
 *   - "supabase"           -> External Supabase
 *
 * Each driver exposes the same surface (db / auth / storage / functions) so swapping
 * providers does not require any change to UI, routes, hooks, or workflows.
 */
import { lovableDriver } from "./drivers/lovable";
import { supabaseDriver } from "./drivers/supabase";
import type { BackendDriver } from "./types";

const provider = (import.meta.env.VITE_BACKEND_PROVIDER as string | undefined) ?? "lovable";

const driver: BackendDriver = provider === "supabase" ? supabaseDriver : lovableDriver;

export const backend = driver;
export const db = driver.db;
export const auth = driver.auth;
export const storage = driver.storage;
export const functions = driver.functions;

// Backwards-compat re-export so new code can do:
//   import { supabase } from "@/backend";
export const supabase = driver.client;

export const activeBackendProvider = provider;