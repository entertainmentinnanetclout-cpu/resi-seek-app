import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Runtime-safe client used in Lovable preview where import.meta.env can be empty.
// Uses public (anon) credentials only.
const FALLBACK_SUPABASE_URL = "https://vmqqkebojldjsyxcewdb.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtcXFrZWJvamxkanN5eGNld2RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNjE3OTUsImV4cCI6MjA3NTgzNzc5NX0.5NvBH0YOpV0ePVJrOrFalImCTuMtozY4Ah2G_l0tH7o";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  FALLBACK_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
