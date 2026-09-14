import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { accountHome, isNativeApp } from "@/lib/accountRouting";
import { toast } from "sonner";

export default function NativeAccountNavigation() {
  const auth = useAuth();
  const { pathname } = useLocation();
  useEffect(() => {
    if (!isNativeApp() || !auth.user) return;
    if (pathname === "/residence" || (pathname.startsWith("/residence/") && pathname !== "/residence/login")) {
      localStorage.setItem(`rk_native_home_${auth.user.id}`, "/residence");
    }
  }, [pathname, auth.user?.id]);
  if (!isNativeApp()) return null;
  return <nav aria-label="App account navigation" className="sticky top-0 z-[1400] flex items-center justify-between gap-3 border-b bg-background px-4 pb-3 pt-[max(.75rem,env(safe-area-inset-top))] text-sm">
    <Link to={auth.user ? accountHome(auth) : "/auth"}>ResKonnect</Link>
    <Link to="/portals">Portals</Link>
    {auth.user ? <button onClick={() => void auth.signOut().catch(() => toast.error("Could not sign out. Please retry when connected."))}>Sign out</button> : <Link to="/auth">Sign in</Link>}
  </nav>;
}
