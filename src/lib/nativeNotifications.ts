import { isNativeApp } from "@/lib/accountRouting";

const keyFor = (userId: string) => `rk_native_alerts_v1_${userId}`;
const nativePlugin = (name: string): any => isNativeApp() ? (window as any).Capacitor?.Plugins?.[name] : null;
const validId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);
function numericId(uuid: string) {
  let hash = 2166136261;
  for (let i = 0; i < uuid.length; i++) hash = Math.imul(hash ^ uuid.charCodeAt(i), 16777619);
  return (hash >>> 1) || 1;
}
export function foregroundAlertsEnabled(userId: string) {
  try { return isNativeApp() && localStorage.getItem(keyFor(userId)) === "1"; } catch { return false; }
}
export async function enableForegroundAlerts(userId: string): Promise<boolean> {
  const local = nativePlugin("LocalNotifications");
  if (!userId || !local) return false;
  try {
    const permission = await local.requestPermissions();
    if (permission.display !== "granted") return false;
    localStorage.setItem(keyFor(userId), "1");
    return true;
  } catch (error) { console.warn("Device notification permission unavailable", error); return false; }
}
export function disableForegroundAlerts(userId: string) {
  try { localStorage.removeItem(keyFor(userId)); } catch { /* storage optional */ }
}
/** Foreground-only Android OS alert. Background delivery requires the FCM transport and credentials. */
export async function nativeForegroundAlert(userId: string, noticeId: string) {
  if (!foregroundAlertsEnabled(userId) || !validId(noticeId) || document.visibilityState !== "visible") return;
  const local = nativePlugin("LocalNotifications");
  if (!local) return;
  try {
    const allowed = await local.checkPermissions();
    if (allowed.display !== "granted") return;
    await local.schedule({ notifications: [{ id: numericId(noticeId), title: "ResKonnect update", body: "Tap to read your new account message.", extra: { notificationId: noticeId, userId }, smallIcon: "ic_stat_icon_config_sample" }] });
  } catch (error) { console.warn("Foreground device alert could not display", error); }
}
export function listenForNativeNotificationAction(userId: string) {
  const local = nativePlugin("LocalNotifications");
  if (!local || !userId) return () => {};
  let active = true;
  let remove: (() => void) | null = null;
  void local.addListener("localNotificationActionPerformed", (event: any) => {
    const extra = event?.notification?.extra;
    if (active && extra?.userId === userId && typeof extra.notificationId === "string" && validId(extra.notificationId)) {
      window.location.assign(`/dashboard/updates?id=${encodeURIComponent(extra.notificationId)}`);
    }
  }).then((handle: any) => { if (!active) void handle?.remove?.(); else remove = () => { void handle?.remove?.(); }; }).catch(() => undefined);
  return () => { active = false; remove?.(); };
}
