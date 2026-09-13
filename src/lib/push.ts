import { supabase, EXTERNAL_SUPABASE_ANON_KEY, externalFunctionUrl } from "@/integrations/supabase/client";

let VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string) || "";

export function isNativeShell() {
  return typeof window !== "undefined" && Boolean((window as any).Capacitor?.isNativePlatform?.());
}

async function getVapidKey(): Promise<string> {
  if (VAPID_PUBLIC_KEY) return VAPID_PUBLIC_KEY;
  try {
    const res = await fetch(externalFunctionUrl("vapid-public-key"), {
      headers: {
        apikey: EXTERNAL_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${EXTERNAL_SUPABASE_ANON_KEY}`,
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`VAPID key unavailable (${res.status})`);
    const json = await res.json().catch(() => ({}));
    VAPID_PUBLIC_KEY = typeof json.publicKey === "string" ? json.publicKey.trim() : "";
  } catch (error) {
    console.warn("[push] VAPID key unavailable:", error);
  }
  return VAPID_PUBLIC_KEY;
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (isNativeShell() || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration("/");
    if (existing) return existing;
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return await navigator.serviceWorker.ready;
  } catch (error) {
    console.warn("[push] Service worker unavailable:", error);
    return null;
  }
}

export async function subscribePush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.user?.id || !session.access_token) {
    console.warn("[push] Sign-in is required before notification registration");
    return false;
  }

  const key = await getVapidKey();
  if (!key) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const registration = await ensureServiceWorker();
  if (!registration) return false;

  try {
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
    }

    const payload: any = subscription.toJSON();
    const { error } = await supabase.functions.invoke("push-subscription", {
      body: {
        action: "upsert",
        endpoint: payload.endpoint,
        p256dh: payload.keys?.p256dh,
        auth: payload.keys?.auth,
        user_agent: navigator.userAgent,
      },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("[push] Subscription registration failed:", error);
    return false;
  }
}

export function isPushSupported() {
  return !isNativeShell()
    && typeof window !== "undefined"
    && "Notification" in window
    && typeof navigator !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window;
}

export function pushPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}
