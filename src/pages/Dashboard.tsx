import { lazy, Suspense } from "react";
import { useAdminRedirect } from "@/hooks/useAdminRedirect";

// Keep the substantial dashboard in a separate chunk so the auth transition stays responsive.
const FullDashboard = lazy(() => import("@/components/FullDashboard"));

export default function Dashboard() {
  const shouldBlock = useAdminRedirect();
  if (shouldBlock) return null;
  return (
    <Suspense fallback={<div role="status" className="min-h-[70dvh] bg-background p-6 text-sm text-muted-foreground">Opening your ResKonnect dashboard…</div>}>
      <FullDashboard />
    </Suspense>
  );
}
