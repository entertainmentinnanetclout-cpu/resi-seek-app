// Edge-function helper — invokes functions hosted on the Lovable-managed
// Supabase project, while forwarding the user's External Supabase session
// JWT so the function's `getUser()` call resolves against External.
//
// Why: `supabase.functions.invoke(...)` uses the pinned client URL (External),
// but our edge functions deploy to the Lovable Cloud project via
// `supabase/config.toml`. Calling them via the External URL 404s.

import { supabase } from "@/integrations/supabase/client";

// Lovable Cloud project (see supabase/config.toml `project_id`).
export const LOVABLE_FUNCTIONS_PROJECT_ID = "vmqqkebojldjsyxcewdb";
export const LOVABLE_FUNCTIONS_URL = `https://${LOVABLE_FUNCTIONS_PROJECT_ID}.supabase.co/functions/v1`;
// Lovable Cloud publishable anon key — required by the functions gateway.
export const LOVABLE_FUNCTIONS_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtcXFrZWJvamxkanN5eGNld2RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNjE3OTUsImV4cCI6MjA3NTgzNzc5NX0.5NvBH0YOpV0ePVJrOrFalImCTuMtozY4Ah2G_l0tH7o";

export interface InvokeResult<T = unknown> {
  data: T | null;
  error: { message: string; status?: number; version?: string; details?: unknown } | null;
  raw?: Response;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asNonEmptyString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const stringifySafe = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return asNonEmptyString(value);
  try {
    const text = JSON.stringify(value);
    return text && text !== "{}" ? text : null;
  } catch {
    return null;
  }
};

const extractErrorMessage = (payload: unknown, fallback: string): string => {
  if (!isRecord(payload)) return stringifySafe(payload) || fallback;

  const direct = asNonEmptyString(payload.error) || asNonEmptyString(payload.message);
  if (direct && direct !== "{}") return direct;

  const nestedError = payload.error;
  if (isRecord(nestedError)) {
    const nested =
      asNonEmptyString(nestedError.message) ||
      asNonEmptyString(nestedError.details) ||
      asNonEmptyString(nestedError.hint) ||
      asNonEmptyString(nestedError.code);
    if (nested) return nested;
  }

  const details = asNonEmptyString(payload.details) || asNonEmptyString(payload.hint) || asNonEmptyString(payload.code);
  return details || stringifySafe(payload) || fallback;
};

export async function invokeEdgeFunction<T = unknown>(
  name: string,
  body: Record<string, unknown> = {},
  opts: { rawText?: boolean } = {},
): Promise<InvokeResult<T>> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch(`${LOVABLE_FUNCTIONS_URL}/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: LOVABLE_FUNCTIONS_ANON_KEY,
        Authorization: `Bearer ${token ?? LOVABLE_FUNCTIONS_ANON_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (opts.rawText) {
      const text = await res.text();
      if (!res.ok) {
        return { data: null, error: { message: text || `HTTP ${res.status}`, status: res.status }, raw: res };
      }
      return { data: text as unknown as T, error: null, raw: res };
    }

    const text = await res.text();
    let json: unknown = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }

    const hasErrorPayload = isRecord(json) && json.error !== undefined;
    if (!res.ok || hasErrorPayload) {
      const fallback = `HTTP ${res.status}${res.statusText ? `: ${res.statusText}` : ""}`;
      return {
        data: null,
        error: {
          message: extractErrorMessage(json, fallback),
          status: res.status,
          version: isRecord(json) ? asNonEmptyString(json._version) || undefined : undefined,
          details: isRecord(json) ? json : text,
        },
        raw: res,
      };
    }
    return { data: json as T, error: null, raw: res };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : "Network error" } };
  }
}