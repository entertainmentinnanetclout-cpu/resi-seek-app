import { lazy, Suspense } from "react";
import { useAdminRedirect } from "@/hooks/useAdminRedirect";

// Keep the full command centre behind a separate chunk so its dependencies do not
// execute during authentication or native app boot. Once signed in the complete
// dashboard is the default experience on Android and on the website alike.
const FullDashboard = lazy(() => import("@/components/FullDashboard"));

export default function Dashboard() {
  const shouldBlock = useAdminRedirect();
  if (shouldBlock) return null;
  return (
    <Suspense fallback={<div role="status" className="grid min-h-[55dvh] place-items-center p-6 text-sm text-muted-foreground">Opening your ResKonnect dashboard…</div>}>
      <FullDashboard />
    </Suspense>
  );
}
