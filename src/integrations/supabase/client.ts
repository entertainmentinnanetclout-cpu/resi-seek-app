// ResKonnect Supabase Client — HARD-PINNED to External Supabase.
//
// This project is externally hosted on Supabase project `mefjzkhobkltlbmhusdh`.
// Do NOT read VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY here — those
// are injected by Lovable Cloud and would silently repoint preview builds at
// the Lovable Cloud mirror, causing preview ≠ production data drift.
//
// All schema changes must ship as SQL packs under `docs/EXTERNAL_PARITY_*.sql`
// and be run manually against External Supabase.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://mefjzkhobkltlbmhusdh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lZmp6a2hvYmtsdGxibWh1c2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzMTE5ODYsImV4cCI6MjA3NTg4Nzk4Nn0.h9VlKqtA4QMidLh_FbIiNviZRzeLe4OsBs1omh3Jy6U";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

console.log("Supabase client initialized (External):", SUPABASE_URL);