import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import MyResKonnectCommandCentre from "@/components/MyResKonnectCommandCentre";
import NativeSafeDashboard from "@/components/NativeSafeDashboard";
import { useAdminRedirect } from "@/hooks/useAdminRedirect";
import SafeRenderBoundary from "@/components/SafeRenderBoundary";
import { isNativeApp } from "@/lib/accountRouting";
import { Link, useLocation } from "react-router-dom";

const Dashboard = () => {
  const shouldBlock = useAdminRedirect();
  const location = useLocation();
  if (shouldBlock) return null;

  // Android is delivered as a separate WebView bundle. Never eagerly mount the
  // desktop dashboard shell, realtime subscriptions, maps or notifications on
  // its first authenticated frame. All features remain reachable from here.
  if (isNativeApp() && location.pathname !== "/dashboard/full") return <NativeSafeDashboard />;

  return (
    <DashboardLayout>
      <SEO
        title="My ResKonnect | Living • AI • Opportunity"
        description="Your connected ResKonnect command centre for Living, AI guidance, applications, opportunities, next-best actions and verified account updates."
      />
      <SafeRenderBoundary
        name="my-reskonnect-command-centre"
        fallback={
          <div className="mx-auto max-w-3xl px-4 py-16 text-center">
            <h1 className="text-3xl font-black">My ResKonnect is reconnecting</h1>
            <p className="mt-3 text-sm text-muted-foreground">Your account is signed in. A dashboard module could not render, but you can continue using ResKonnect while it recovers.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link className="rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground" to="/findmyres">Find My Res</Link>
              <Link className="rounded-full border px-5 py-3 text-sm font-bold" to="/opportunities">Opportunities</Link>
              <Link className="rounded-full border px-5 py-3 text-sm font-bold" to="/profile">Profile</Link>
            </div>
          </div>
        }
      >
        <MyResKonnectCommandCentre />
      </SafeRenderBoundary>
    </DashboardLayout>
  );
};

export default Dashboard;
