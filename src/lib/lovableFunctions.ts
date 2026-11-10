// Backwards-compatible Edge Function helper using the ONE production Supabase
// project for database, Auth and Edge Functions. Never forward a production
// user's JWT to an unrelated Supabase project.
import { supabase, EXTERNAL_SUPABASE_ANON_KEY, externalFunctionUrl } from "@/integrations/supabase/client";

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

    const res = await fetch(externalFunctionUrl(name), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EXTERNAL_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token ?? EXTERNAL_SUPABASE_ANON_KEY}`,
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