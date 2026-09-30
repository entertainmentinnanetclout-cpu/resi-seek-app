// ResKonnect Supabase Client — HARD-PINNED to External Supabase.
// Do not read Lovable-injected VITE_SUPABASE_* variables: preview must use the
// same independently hosted Supabase project as the production app.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types.production.generated';

export const EXTERNAL_SUPABASE_PROJECT_ID = 'mefjzkhobkltlbmhusdh';
export const EXTERNAL_SUPABASE_URL = `https://${EXTERNAL_SUPABASE_PROJECT_ID}.supabase.co`;
export const EXTERNAL_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lZmp6a2hvYmtsdGxibWh1c2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzMTE5ODYsImV4cCI6MjA3NTg4Nzk4Nn0.h9VlKqtA4QMidLh_FbIiNviZRzeLe4OsBs1omh3Jy6U';

export const externalFunctionUrl = (name: string) => `${EXTERNAL_SUPABASE_URL}/functions/v1/${name}`;

// Mobile WebViews and installed browser apps can resume with HTTP requests
// stranded after process suspension or connectivity changes. Bound all
// latency-sensitive Supabase control-plane requests without clearing the
// persisted auth session. Storage uploads keep their own transfer lifecycle.
const resilientSupabaseFetch: typeof fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  let timeoutMs = 0;
  if (url.startsWith(`${EXTERNAL_SUPABASE_URL}/rest/v1/`)) timeoutMs = 15_000;
  else if (url.startsWith(`${EXTERNAL_SUPABASE_URL}/auth/v1/`)) timeoutMs = 15_000;
  else if (url.startsWith(`${EXTERNAL_SUPABASE_URL}/functions/v1/`)) timeoutMs = 30_000;
  if (!timeoutMs) return fetch(input, init);

  const controller = new AbortController();
  const originalSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const relayAbort = () => controller.abort();
  if (originalSignal?.aborted) controller.abort();
  else originalSignal?.addEventListener('abort', relayAbort, { once: true });
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    globalThis.clearTimeout(timer);
    originalSignal?.removeEventListener('abort', relayAbort);
  });
};

export const supabase = createClient<Database>(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  global: { fetch: resilientSupabaseFetch },
});

console.log('Supabase client initialized (External):', EXTERNAL_SUPABASE_URL);
