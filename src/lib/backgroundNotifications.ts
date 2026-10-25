import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "@/lib/accountRouting";

const DEVICE_KEY = "rk_bg_notification_device_v1";
const RUNNER_LABEL = "org.reskonnect.background.notifications";
const NOTIFICATION_ID = 130010;

function runner(): any {
  return isNativeApp() ? (window as any).Capacitor?.Plugins?.BackgroundRunner : null;
}

function storedDeviceId() {
  try {
    const current = localStorage.getItem(DEVICE_KEY);
    if (current && /^[0-9a-f-]{36}$/i.test(current)) return current;
    const next = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, next);
    return next;
  } catch {
    return crypto.randomUUID();
  }
}

async function configureRunnerToken(token: string | null) {
  const background = runner();
  if (!background?.dispatchEvent) return false;
  try {
    await background.dispatchEvent({
      label: RUNNER_LABEL,
      event: "configureResKonnectNotifications",
      details: { token: token || "" },
    });
    return true;
  } catch (error) {
    console.warn("[background-notifications] runner configuration failed", error);
    return false;
  }
}

export async function enableBackgroundNotificationFallback(): Promise<boolean> {
  if (!isNativeApp()) return false;
  const background = runner();
  if (!background?.dispatchEvent) return false;
  const deviceId = storedDeviceId();
  const { data, error } = await (supabase as any).rpc("rk_issue_background_notification_token", {
    p_device_id: deviceId,
  });
  const token = typeof data === "string" ? data.trim().toLowerCase() : "";
  if (error || !/^[0-9a-f]{64}$/.test(token)) {
    console.warn("[background-notifications] token issue failed", error?.message || "invalid token");
    return false;
  }
  const configured = await configureRunnerToken(token);
  if (!configured) {
    await (supabase as any).rpc("rk_revoke_background_notification_token", { p_device_id: deviceId }).catch(() => undefined);
    return false;
  }
  return true;
}

export async function disableBackgroundNotificationFallback(): Promise<void> {
  if (!isNativeApp()) return;
  const deviceId = storedDeviceId();
  await Promise.allSettled([
    configureRunnerToken(null),
    (supabase as any).rpc("rk_revoke_background_notification_token", { p_device_id: deviceId }),
  ]);
}

export function listenForBackgroundNotificationAction() {
  const background = runner();
  if (!background?.addListener) return () => {};
  let active = true;
  let remove: (() => void) | null = null;
  void background.addListener("backgroundRunnerNotificationReceived", (event: any) => {
    if (!active || Number(event?.notificationId) !== NOTIFICATION_ID) return;
    window.location.assign("/dashboard/updates");
  }).then((handle: any) => {
    if (!active) void handle?.remove?.();
    else remove = () => { void handle?.remove?.(); };
  }).catch(() => undefined);
  return () => { active = false; remove?.(); };
}
