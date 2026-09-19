import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import SafeRenderBoundary from "@/components/SafeRenderBoundary";
import { useAdminRedirect } from "@/hooks/useAdminRedirect";

// Keep the expensive command centre in its own chunk, but load it automatically
// on the dashboard route for both native and web. The temporary native link hub
// is no longer part of the authenticated landing flow.
const FullDashboard = lazy(() => import("@/components/FullDashboard"));

export default function Dashboard() {
  const shouldBlock = useAdminRedirect();
  if (shouldBlock) return null;

  return (
    <SafeRenderBoundary name="full-dashboard-entry" fallback={
      <main className="mx-auto max-w-2xl px-5 py-12 text-center">
        <h1 className="text-2xl font-black">My ResKonnect needs a moment</h1>
        <p className="mt-3 text-sm text-muted-foreground">Your session is still active. You can continue using ResKonnect while the dashboard recovers.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link className="rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground" to="/findmyres">Find My Res</Link>
          <Link className="rounded-full border px-4 py-3 text-sm font-bold" to="/profile">My profile</Link>
        </div>
      </main>
    }>
      <Suspense fallback={<div className="grid min-h-[60dvh] place-items-center p-6 text-sm text-muted-foreground" role="status">Opening My ResKonnect…</div>}>
        <FullDashboard />
      </Suspense>
    </SafeRenderBoundary>
  );
}
