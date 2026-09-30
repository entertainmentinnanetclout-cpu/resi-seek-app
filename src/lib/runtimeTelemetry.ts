import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "@/lib/accountRouting";

export type RuntimeEventType =
  | "webview_renderer_recovered"
  | "js_error"
  | "promise_rejection"
  | "offline_boot"
  | "reconnected";

export function runtimePlatform() {
  if (isNativeApp()) return "android";
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/iPad|iPhone|iPod/i.test(ua)) return "ios";
  if (/Mac/i.test(ua)) return "macos";
  if (/Windows/i.test(ua)) return "windows";
  return "web";
}

function safeMetadata(metadata: Record<string, unknown>) {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (/email|password|message|query|document|phone|name|token|content/i.test(key)) continue;
    if (typeof value === "string") filtered[key] = value.slice(0, 160);
    else if (typeof value === "number" || typeof value === "boolean" || value == null) filtered[key] = value;
  }
  return filtered;
}

export async function recordMobileRuntime(
  eventType: RuntimeEventType,
  stage: string,
  metadata: Record<string, unknown> = {},
) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await (supabase as any).from("mobile_runtime_events").insert({
      user_id: session?.user?.id || null,
      platform: runtimePlatform(),
      release: isNativeApp() ? "1.1.5" : "web",
      version_code: isNativeApp() ? 8 : null,
      event_type: eventType,
      stage: stage.slice(0, 80),
      message: null,
      metadata: {
        route: typeof window === "undefined" ? "/" : window.location.pathname.slice(0, 120),
        ...safeMetadata(metadata),
      },
    });
  } catch {
    // Diagnostics are best-effort and must never delay or destabilize the product.
  }
}
