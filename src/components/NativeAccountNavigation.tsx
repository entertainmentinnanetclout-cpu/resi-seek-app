import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isNativeApp } from "@/lib/accountRouting";
import { foregroundAlertsEnabled } from "@/lib/nativeNotifications";
import { startNativeAppLinks, stopNativeAppLinks } from "@/lib/nativeAppLinks";
import { startNativePush } from "@/lib/nativePush";
import NativeGuidedOnboarding from "@/components/native/NativeGuidedOnboarding";

/** Native account preference, verified-link bridge and student tour; no duplicate top navigation. */
export default function NativeAccountNavigation() {
  const { user, isStudent } = useAuth();
  const { pathname } = useLocation();
  const native = isNativeApp();

  useEffect(() => {
    if (!native) return;
    void startNativeAppLinks();
    return () => stopNativeAppLinks();
  }, [native]);

  useEffect(() => {
    if (!native || !user?.id || !foregroundAlertsEnabled(user.id)) return;
    // Never prompt during boot. Users opt in from Android alert settings; once
    // granted, normal launches re-register so an FCM token refresh cannot leave
    // a signed-in account silently disconnected from closed-app notifications.
    void startNativePush(user.id, false);
  }, [native, user?.id]);

  useEffect(() => {
    if (!native || !user) return;
    if (pathname === "/residence" || (pathname.startsWith("/residence/") && pathname !== "/residence/login")) {
      try { localStorage.setItem(`rk_native_home_${user.id}`, "/residence"); } catch { /* optional storage */ }
    }
  }, [native, pathname, user?.id]);

  const guideRoute = pathname === "/dashboard" || pathname === "/profile" || pathname === "/findmyres" || pathname === "/my-applications";
  return native && user && isStudent && guideRoute ? <NativeGuidedOnboarding /> : null;
}
