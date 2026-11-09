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
let authServiceDegraded = false;

function emitTransportState(type: "rk-network-degraded" | "rk-network-recovered" | "rk-auth-service-degraded" | "rk-auth-service-recovered", detail: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try { window.dispatchEvent(new CustomEvent(type, { detail })); } catch {}
}

const resilientSupabaseFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  let timeoutMs = 0;
  if (url.startsWith(`${EXTERNAL_SUPABASE_URL}/rest/v1/`)) timeoutMs = 25_000;
  else if (url.startsWith(`${EXTERNAL_SUPABASE_URL}/auth/v1/`)) timeoutMs = 25_000;
  else if (url.startsWith(`${EXTERNAL_SUPABASE_URL}/functions/v1/`)) timeoutMs = 30_000;
  else if (url.startsWith(`${EXTERNAL_SUPABASE_URL}/storage/v1/`)) timeoutMs = 90_000;
  if (!timeoutMs) return fetch(input, init);
  const isAuthRequest = url.startsWith(`${EXTERNAL_SUPABASE_URL}/auth/v1/`);

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    transportDegraded = true;
    emitTransportState("rk-network-degraded", { reason: "offline", url_family: url.includes("/storage/v1/") ? "storage" : "supabase" });
    throw new DOMException("The device is offline.", "NetworkError");
  }

  const controller = new AbortController();
  const originalSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  let timedOut = false;
  // A caller switching pages or retrying a role check should not be treated
  // as a network outage. Preserve its cancellation reason for diagnostics.
  const relayAbort = () => controller.abort(
    originalSignal?.reason ?? new DOMException("The previous request was cancelled.", "AbortError")
  );
  if (originalSignal?.aborted) relayAbort();
  else originalSignal?.addEventListener("abort", relayAbort, { once: true });
  const timer = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException(
      "ResKonnect did not receive a response in time. Please retry your request.",
      "TimeoutError"
    ));
  }, timeoutMs);

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    // The backend can return a genuine HTTP response even when the user's
    // internet connection is fine. Label Auth 5xx as a server failure, not
    // a slow customer connection. Never automatically retry a password POST.
    if (isAuthRequest && [500, 502, 503, 504].includes(response.status)) {
      if (!authServiceDegraded) {
        authServiceDegraded = true;
        emitTransportState("rk-auth-service-degraded", { status: response.status, service: "auth" });
      }
    } else if (isAuthRequest && authServiceDegraded && response.status < 500) {
      authServiceDegraded = false;
      emitTransportState("rk-auth-service-recovered", { status: response.status, service: "auth" });
    }
    // A completed HTTP request is not a transport failure. In particular a
    // 503 from one feature should not broadcast global reconnect, which can
    // cause unrelated pages to refetch simultaneously while PostgREST is busy.
    // Each caller handles its own 5xx error; only confirmed transport failures
    // or timeouts set the global degraded state.
    if (transportDegraded && response.status < 500) {
      transportDegraded = false;
      emitTransportState("rk-network-recovered", { status: response.status });
    }
    return response;
  } catch (error) {
    // User-driven aborts (route change, superseded access check) are expected,
    // and must not leave a global "slow connection" warning stuck on-screen.
    if (originalSignal?.aborted && !timedOut) throw error;
    transportDegraded = true;
    emitTransportState("rk-network-degraded", {
      reason: timedOut ? "timeout" : "transport_error",
      timeout_ms: timeoutMs,
      url_family: url.includes("/storage/v1/") ? "storage" : url.includes("/functions/v1/") ? "functions" : url.includes("/auth/v1/") ? "auth" : "rest",
    });
    if (timedOut) throw new DOMException(
      "ResKonnect's live service timed out. Your session is saved; please retry.",
      "TimeoutError"
    );
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
    originalSignal?.removeEventListener("abort", relayAbort);
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
