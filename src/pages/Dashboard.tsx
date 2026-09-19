import { lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import NativeSafeDashboard from "@/components/NativeSafeDashboard";
import { useAdminRedirect } from "@/hooks/useAdminRedirect";
import { isNativeApp } from "@/lib/accountRouting";

const FullDashboard = lazy(() => import("@/components/FullDashboard"));

export default function Dashboard() {
  const shouldBlock = useAdminRedirect();
  const location = useLocation();
  if (shouldBlock) return null;

  // Do not even import the data-heavy dashboard chunk during native sign-in.
  // The full experience remains opt-in and all other authenticated pages work.
  if (isNativeApp() && new URLSearchParams(location.search).get("full") !== "1") {
    return <NativeSafeDashboard />;
  }
  return <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Opening My ResKonnect…</div>}><FullDashboard /></Suspense>;
}
