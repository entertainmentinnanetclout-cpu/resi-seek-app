import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isNativeApp } from "@/lib/accountRouting";

// Account destinations are recorded without rendering a second navigation bar.
// Each authenticated portal supplies its own header and sign-out control.
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
