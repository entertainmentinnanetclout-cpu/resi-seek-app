import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "@/lib/accountRouting";
import { recordMobileRuntime } from "@/lib/runtimeTelemetry";

const TOKEN_KEY = "rk_native_push_token_v1";
const CHANNEL_ID = "reskonnect_updates";
const CANONICAL_HOST = "www.reskonnect.org";

type ListenerHandle = { remove?: () => Promise<void> | void };
let listenerHandles: ListenerHandle[] = [];
let listenerUserId: string | null = null;
let starting: Promise<boolean> | null = null;

function plugin(name: string): any {
  return isNativeApp() ? (window as any).Capacitor?.Plugins?.[name] : null;
}

function validToken(value: unknown): value is string {
  return typeof value === "string" && value.length >= 20 && value.length <= 4096;
}

function storedToken() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    return validToken(token) ? token : null;
  } catch {
    return null;
  }
}

function saveToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Token registration remains server-authoritative even if local storage fails.
  }
}

export function safeNativeNotificationRoute(value: unknown): string {
  if (typeof value !== "string" || value.length > 1800) return "/dashboard/updates";
  const trimmed = value.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.startsWith("/_") && !trimmed.startsWith("/api/")) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== CANONICAL_HOST) return "/dashboard/updates";
    const route = `${url.pathname || "/"}${url.search}${url.hash}`;
    return route.startsWith("/_") || route.startsWith("/api/") ? "/dashboard/updates" : route;
  } catch {
    return "/dashboard/updates";
  }
}

function navigateFromNotification(notification: any) {
  const data = notification?.data || notification?.notification?.data || {};
  const route = safeNativeNotificationRoute(data?.route || data?.url || "/dashboard/updates");
  window.history.pushState(window.history.state, "", route);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

async function removeOurListeners() {
  const handles = listenerHandles;
  listenerHandles = [];
  listenerUserId = null;
  await Promise.allSettled(handles.map((handle) => Promise.resolve(handle?.remove?.())));
}

async function ensureChannel() {
  const push = plugin("PushNotifications");
  const local = plugin("LocalNotifications");
  const channel = {
    id: CHANNEL_ID,
    name: "ResKonnect updates",
    description: "Account and application updates",
    importance: 3,
    visibility: 0,
    vibration: true,
  };
  await Promise.allSettled([
    Promise.resolve(push?.createChannel?.(channel)),
    Promise.resolve(local?.createChannel?.(channel)),
  ]);
}

async function registerTokenForSignedInUser(token: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return false;

  const previous = storedToken();
  if (previous && previous !== token) {
    await (supabase as any).rpc("rk_unregister_native_push_token", { p_token: previous }).catch(() => undefined);
  }

  const { data, error } = await (supabase as any).rpc("rk_register_native_push_token", {
    p_token: token,
    p_platform: "android",
  });
  if (error || data !== true) {
    console.warn("[native-push] Token registration rejected", error?.message || "unknown");
    return false;
  }
  saveToken(token);
  return true;
}

async function showPrivateForegroundNotice(notification: any) {
  const local = plugin("LocalNotifications");
  if (!local?.schedule || document.visibilityState !== "visible") return;
  const source = String(notification?.id || notification?.data?.notification_id || Date.now());
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
  const id = (hash >>> 1) || 1;
  try {
    await local.schedule({
      notifications: [{
        id,
        channelId: CHANNEL_ID,
        title: "ResKonnect update",
        body: "Tap to view your latest account update.",
        extra: {
          nativePush: true,
          route: safeNativeNotificationRoute(notification?.data?.route || notification?.data?.url),
        },
      }],
    });
  } catch (error) {
    console.warn("[native-push] Foreground alert unavailable", error);
  }
}

async function installListeners(userId: string) {
  const push = plugin("PushNotifications");
  const local = plugin("LocalNotifications");
  if (!push?.addListener) return false;

  if (listenerUserId && listenerUserId !== userId) await removeOurListeners();
  if (listenerUserId === userId && listenerHandles.length) return true;

  const handles = await Promise.all([
    push.addListener("registration", (event: any) => {
      if (!validToken(event?.value)) return;
      void registerTokenForSignedInUser(event.value).then((ok) => {
        if (ok) void recordMobileRuntime("native_push_registered" as any, "android.fcm");
      });
    }),
    push.addListener("registrationError", (event: any) => {
      console.warn("[native-push] FCM registration failed", event?.error || event);
      void recordMobileRuntime("native_push_error" as any, "android.fcm.registration");
    }),
    push.addListener("pushNotificationReceived", (notification: any) => {
      void showPrivateForegroundNotice(notification);
    }),
    push.addListener("pushNotificationActionPerformed", (event: any) => {
      navigateFromNotification(event?.notification || event);
    }),
  ]);

  if (local?.addListener) {
    const localHandle = await local.addListener("localNotificationActionPerformed", (event: any) => {
      if (event?.notification?.extra?.nativePush) navigateFromNotification(event.notification);
    });
    handles.push(localHandle);
  }

  listenerHandles = handles.filter(Boolean);
  listenerUserId = userId;
  return true;
}

/**
 * Registers this installed Android app with FCM. Permission prompts happen only
 * after an explicit user action; normal app boot silently re-registers an
 * already-authorized installation so refreshed FCM tokens are reclaimed by the
 * currently signed-in account.
 */
export function startNativePush(userId: string, requestPermission = false): Promise<boolean> {
  if (!isNativeApp() || !userId) return Promise.resolve(false);
  if (starting) return starting;
  starting = (async () => {
    const push = plugin("PushNotifications");
    if (!push?.checkPermissions || !push?.register) return false;
    try {
      let permission = await push.checkPermissions();
      if (permission?.receive !== "granted" && requestPermission) permission = await push.requestPermissions();
      if (permission?.receive !== "granted") return false;

      await ensureChannel();
      if (!await installListeners(userId)) return false;
      await push.register();
      return true;
    } catch (error) {
      console.warn("[native-push] Native push unavailable", error);
      void recordMobileRuntime("native_push_error" as any, "android.fcm.start");
      return false;
    } finally {
      starting = null;
    }
  })();
  return starting;
}

/** Remove this installation from the signed-in user's push targets before logout. */
export async function unregisterNativePushToken() {
  if (!isNativeApp()) return;
  const token = storedToken();
  try {
    if (token) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        await (supabase as any).rpc("rk_unregister_native_push_token", { p_token: token });
      }
    }
  } catch (error) {
    console.warn("[native-push] Token cleanup unavailable", error);
  } finally {
    saveToken(null);
    await removeOurListeners();
  }
}
