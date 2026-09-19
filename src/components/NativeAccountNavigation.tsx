import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isNativeApp } from "@/lib/accountRouting";

/**
 * Keep the selected native residence portal as the account's preferred home,
 * without rendering a second navigation bar over the actual app dashboard.
 * All account navigation and logout are provided by the relevant dashboard.
 */
export default function NativeAccountNavigation() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  useEffect(() => {
    if (!isNativeApp() || !user) return;
    if (pathname === "/residence" || (pathname.startsWith("/residence/") && pathname !== "/residence/login")) {
      try { localStorage.setItem(`rk_native_home_${user.id}`, "/residence"); } catch { /* optional storage */ }
    }
  }, [pathname, user?.id]);
  return null;
}
