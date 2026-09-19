import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isNativeApp } from "@/lib/accountRouting";
import NativeStudentGuide from "@/components/NativeStudentGuide";

// Keep native account context, but never mount the redundant top navigation strip.
export default function NativeAccountNavigation() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  useEffect(() => {
    if (!isNativeApp() || !user) return;
    if (pathname === "/residence" || (pathname.startsWith("/residence/") && pathname !== "/residence/login")) {
      try { localStorage.setItem(`rk_native_home_${user.id}`, "/residence"); } catch { /* optional storage */ }
    }
  }, [pathname, user?.id]);
  return isNativeApp() && user ? <NativeStudentGuide /> : null;
}
