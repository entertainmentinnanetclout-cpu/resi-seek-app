import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isNativeApp } from "@/lib/accountRouting";

/** Native routes use their own in-app navigation. Do not mount a second sticky
 * ResKonnect / Portals / Sign out header above the screen. */
export default function NativeAccountNavigation() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  // Preserve the saved home of residence administrators without a visible overlay.
  useEffect(() => {
    if (!isNativeApp() || !user) return;
    if (pathname === "/residence" || (pathname.startsWith("/residence/") && pathname !== "/residence/login")) {
      try { localStorage.setItem(`rk_native_home_${user.id}`, "/residence"); }
      catch { /* Storage is optional. */ }
    }
  }, [pathname, user?.id]);

  return null;
}
