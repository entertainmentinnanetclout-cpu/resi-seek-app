import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "@/lib/accountRouting";

export const STABILITY_RELEASE = "1.1.4";
export const STABILITY_VERSION_CODE = 7;
const PENDING_NATIVE_EVENT = "rk_native_pending_runtime_event_v1";
const GRAPHICS_SAFE_UNTIL = "rk_native_graphics_safe_mode_until_v1";
const LEGACY_JS_FAILURE = "rk_native_last_js_failure_v1";

type RuntimeEvent =
  | "renderer_gone"
  | "js_error"
  | "unhandled_rejection"
  | "ui_render_error"
  | "webgl_context_lost"
  | "memory_pressure"
  | "request_timeout"
  | "offline"
  | "reconnected";

const clean = (value: unknown, max = 240) =>
  String(value ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").slice(0, max);

function safeMetadata(input: Record<string, unknown> = {}) {
  const allowed = [
    "did_crash", "renderer_priority", "manufacturer", "model", "sdk_int",
    "webview_package", "webview_version", "safe_mode_until", "level",
    "surface", "resource", "online", "visibility", "memory_gb",
  ];
  const result: Record<string, string | number | boolean | null> = {};
  for (const key of allowed) {
    const value = input[key];
    if (typeof value === "string") result[key] = clean(value, 160);
    else if (typeof value === "number" || typeof value === "boolean" || value === null) result[key] = value as any;
  }
  return result;
}

function platformName() {
  if (isNativeApp()) return "android";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios_pwa";
  if (/Macintosh|Mac OS X/i.test(ua)) return "mac_web";
  if (/Windows/i.test(ua)) return "windows_web";
  return "web";
}

export async function reportRuntimeEvent(
  eventType: RuntimeEvent,
  message?: unknown,
  metadata: Record<string, unknown> = {},
) {
  try {
    const { error } = await (supabase as any).rpc("record_mobile_runtime_event", {
      p_event_type: eventType,
      p_platform: platformName(),
      p_release: STABILITY_RELEASE,
      p_version_code: isNativeApp() ? STABILITY_VERSION_CODE : null,
      p_stage: `${window.location.pathname}${window.location.search}`.slice(0, 240),
      p_message: clean(message, 500) || null,
      p_metadata: safeMetadata({
        ...metadata,
        online: navigator.onLine,
        visibility: document.visibilityState,
        memory_gb: Number((navigator as any).deviceMemory || 0) || null,
      }),
    });
    return !error;
  } catch {
    return false;
  }
}

export function isNativeGraphicsSafeMode() {
  if (!isNativeApp()) return false;
  try {
    const until = Number(localStorage.getItem(GRAPHICS_SAFE_UNTIL) || 0);
    if (!until || until <= Date.now()) {
      if (until) localStorage.removeItem(GRAPHICS_SAFE_UNTIL);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function flushStoredNativeEvent() {
  if (!isNativeApp()) return;
  try {
    const raw = localStorage.getItem(PENDING_NATIVE_EVENT);
    if (raw) {
      const parsed = JSON.parse(raw);
      const ok = await reportRuntimeEvent(
        "renderer_gone",
        parsed?.did_crash ? "Android WebView renderer crashed" : "Android WebView renderer was terminated",
        parsed || {},
      );
      if (ok) localStorage.removeItem(PENDING_NATIVE_EVENT);
    }

    const legacy = localStorage.getItem(LEGACY_JS_FAILURE);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      const kind: RuntimeEvent = parsed?.kind === "promise" ? "unhandled_rejection" : "js_error";
      const ok = await reportRuntimeEvent(kind, parsed?.message, { surface: parsed?.route || "native_boot" });
      if (ok) localStorage.removeItem(LEGACY_JS_FAILURE);
    }
  } catch {
    // Never allow diagnostics to block startup.
  }
}

let initialized = false;
export function initRuntimeDiagnostics() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  window.addEventListener("error", event => {
    void reportRuntimeEvent("js_error", event.message, { resource: event.filename || "window" });
  });
  window.addEventListener("unhandledrejection", event => {
    const reason = event.reason instanceof Error ? event.reason.message : clean(event.reason, 300);
    void reportRuntimeEvent("unhandled_rejection", reason);
  });
  window.addEventListener("offline", () => { void reportRuntimeEvent("offline", "Network unavailable"); });
  window.addEventListener("online", () => { void reportRuntimeEvent("reconnected", "Network restored"); });

  window.addEventListener("rk-native-runtime-event" as any, ((event: CustomEvent) => {
    if (!event.detail) return;
    void reportRuntimeEvent("renderer_gone", "Recovered Android WebView renderer", event.detail);
  }) as EventListener);

  window.addEventListener("rk-native-memory-pressure" as any, ((event: CustomEvent) => {
    void reportRuntimeEvent("memory_pressure", "Android memory pressure", { level: event.detail?.level });
  }) as EventListener);

  void flushStoredNativeEvent();
}
