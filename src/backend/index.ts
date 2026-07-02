/**
 * Backend Abstraction Layer (BAL) — single entry point for all backend ops.
 *
 * All NEW code must import from `@/backend` instead of `@/integrations/supabase/client`.
 * Existing code that imports the supabase client directly is still supported during the
 * transition; it continues to work because both paths resolve to the active driver below.
 *
 * External Supabase is the production source of truth. Provider switching is
 * kept as a safety abstraction only; the UI must not drift back to Lovable data.
 *
 * Each driver exposes the same surface (db / auth / storage / functions) so swapping
 * providers does not require any change to UI, routes, hooks, or workflows.
 */
import { supabaseDriver } from "./drivers/supabase";
import type { BackendDriver } from "./types";

// Hard-lock External Supabase for preview, production and specialist dashboards.
const provider = "supabase";
const driver: BackendDriver = supabaseDriver;

export const backend = driver;
export const db = driver.db;
export const auth = driver.auth;
export const storage = driver.storage;
export const functions = driver.functions;

// Backwards-compat re-export so new code can do:
//   import { supabase } from "@/backend";
export const supabase = driver.client;

export const activeBackendProvider = provider;