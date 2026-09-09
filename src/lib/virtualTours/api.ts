import { externalFunctionUrl, supabase } from "@/integrations/supabase/client";

export type TourAccess = { allowed: boolean; admin?: boolean; plan?: "standard" | "premium" | "gold" | "internal"; entitlements?: string[] };

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export async function tourApi<T = any>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(externalFunctionUrl("virtual-tour-api"), {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error || `360 Studio request failed (${response.status})`) as Error & { status?: number; data?: unknown };
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data as T;
}

export async function uploadSignedAsset(input: { bucket: string; path: string; token: string; file: Blob; contentType?: string }) {
  const { error } = await supabase.storage.from(input.bucket).uploadToSignedUrl(input.path, input.token, input.file, {
    contentType: input.contentType || input.file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return input.path;
}

export async function publicTourSnapshot(publicToken: string) {
  const { data, error } = await (supabase as any).rpc("virtual_tour_public_snapshot", { p_public_token: publicToken });
  if (error) throw error;
  return data || {};
}

export async function recordTourEvent(input: { tourId: string; sceneId?: string | null; eventType: string; viewerSession: string; anonymousId?: string; metadata?: Record<string, unknown> }) {
  const { error } = await (supabase as any).rpc("record_virtual_tour_event", {
    p_tour_id: input.tourId,
    p_scene_id: input.sceneId || null,
    p_event_type: input.eventType,
    p_viewer_session: input.viewerSession,
    p_anonymous_id: input.anonymousId || null,
    p_metadata: input.metadata || {},
  });
  if (error) console.warn("[360 Studio] analytics event failed", error);
}
