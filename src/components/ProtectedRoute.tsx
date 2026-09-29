import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const TUMELO_DASHBOARD = "/partner/tumelo/os";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading, isTumeloPartner, staffRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isTumeloOnly = !!user && isTumeloPartner && !staffRole;
  const [showRecovery, setShowRecovery] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setShowRecovery(false);
      return;
    }
    // Never keep a returning Android user behind an unexplained infinite loader.
    const timer = window.setTimeout(() => setShowRecovery(true), 18_000);
    return () => window.clearTimeout(timer);
  }, [isLoading]);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth", { replace: true });
      return;
    }
    if (!isLoading && isTumeloOnly && location.pathname !== TUMELO_DASHBOARD) {
      navigate(TUMELO_DASHBOARD, { replace: true });
    }
  }, [user, isLoading, isTumeloOnly, location.pathname, navigate]);

  if (isLoading) {
    return (
      <div role="status" className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your ResKonnect account…</p>
          {showRecovery && (
            <div className="mt-6 space-y-3 rounded-2xl border bg-card p-5">
              <p className="text-sm text-muted-foreground">This is taking longer than expected. Your saved account has not been signed out.</p>
              <button type="button" className="w-full rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground" onClick={() => window.location.reload()}>
                Retry loading
              </button>
              <button type="button" className="w-full rounded-full border px-5 py-3 text-sm font-semibold" onClick={() => navigate("/auth", { replace: true })}>
                Open sign-in and account options
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!user || (isTumeloOnly && location.pathname !== TUMELO_DASHBOARD)) {
    return null;
  }

  return <>{children}</>;
};
