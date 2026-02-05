// ResKonnect Supabase Client - External Backend
// Build: 2026-02-04-v4 - External Supabase Only
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// External Supabase project
// Priority: explicit external vars > VITE vars > hardcoded fallback
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL 
  || import.meta.env.EXTERNAL_SUPABASE_URL
  || "https://mefjzkhobkltlbmhusdh.supabase.co";

const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY 
  || import.meta.env.EXTERNAL_SUPABASE_ANON_KEY
  || import.meta.env.VITE_SUPABASE_ANON_KEY
  || ""; // Will need external anon key

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

console.log("Supabase client initialized:", SUPABASE_URL);