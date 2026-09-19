import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isNativeApp } from "@/lib/accountRouting";
import NativeGuidedOnboarding from "@/components/native/NativeGuidedOnboarding";

/** Native account preference and student tour; no duplicate top navigation. */
export default function NativeAccountNavigation() {
  const { user, isStudent } = useAuth();
  const { pathname } = useLocation();
  const native = isNativeApp();
  useEffect(() => {
    if (!native || !user) return;
    if (pathname === "/residence" || (pathname.startsWith("/residence/") && pathname !== "/residence/login")) {
      try { localStorage.setItem(`rk_native_home_${user.id}`, "/residence"); } catch { /* optional storage */ }
    }
  }, [native, pathname, user?.id]);
  return native && user && isStudent ? <NativeGuidedOnboarding /> : null;
}
