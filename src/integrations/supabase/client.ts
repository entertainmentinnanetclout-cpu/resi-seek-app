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
// stranded after process suspension or connectivity changes. Bound every
// Supabase HTTP request without clearing the persisted auth session. Large
// Storage uploads get a longer ceiling, but are still prevented from hanging
// forever after a Wi-Fi/mobile-data handoff or suspended browser process.
let transportDegraded = false;

function emitTransportState(type: "rk-network-degraded" | "rk-network-recovered", detail: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try { window.dispatchEvent(new CustomEvent(type, { detail })); } catch {}
}

const resilientSupabaseFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  let timeoutMs = 0;
  if (url.startsWith(`${EXTERNAL_SUPABASE_URL}/rest/v1/`)) timeoutMs = 15_000;
  else if (url.startsWith(`${EXTERNAL_SUPABASE_URL}/auth/v1/`)) timeoutMs = 15_000;
  else if (url.startsWith(`${EXTERNAL_SUPABASE_URL}/functions/v1/`)) timeoutMs = 30_000;
  else if (url.startsWith(`${EXTERNAL_SUPABASE_URL}/storage/v1/`)) timeoutMs = 90_000;
  if (!timeoutMs) return fetch(input, init);

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    transportDegraded = true;
    emitTransportState("rk-network-degraded", { reason: "offline", url_family: url.includes("/storage/v1/") ? "storage" : "supabase" });
    throw new DOMException("The device is offline.", "NetworkError");
  }

  const controller = new AbortController();
  const originalSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const relayAbort = () => controller.abort();
  if (originalSignal?.aborted) controller.abort();
  else originalSignal?.addEventListener('abort', relayAbort, { once: true });
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    if (transportDegraded) {
      transportDegraded = false;
      emitTransportState("rk-network-recovered", { status: response.status });
    }
    return response;
  } catch (error) {
    transportDegraded = true;
    emitTransportState("rk-network-degraded", {
      reason: controller.signal.aborted ? "timeout_or_abort" : "transport_error",
      timeout_ms: timeoutMs,
      url_family: url.includes("/storage/v1/") ? "storage" : url.includes("/functions/v1/") ? "functions" : url.includes("/auth/v1/") ? "auth" : "rest",
    });
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
    originalSignal?.removeEventListener('abort', relayAbort);
  }
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
