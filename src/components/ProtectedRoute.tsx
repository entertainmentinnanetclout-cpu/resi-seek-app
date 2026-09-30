import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AuthLoadingRecovery from "@/components/AuthLoadingRecovery";

const TUMELO_DASHBOARD = "/partner/tumelo/os";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading, accessError, isTumeloPartner, staffRole, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isTumeloOnly = !!user && isTumeloPartner && !staffRole;
  useEffect(() => {
    if (!isLoading && !accessError && !user) {
      navigate("/auth", { replace: true });
      return;
    }
    if (!isLoading && !accessError && isTumeloOnly && location.pathname !== TUMELO_DASHBOARD) {
      navigate(TUMELO_DASHBOARD, { replace: true });
    }
  }, [user, isLoading, accessError, isTumeloOnly, location.pathname, navigate]);

  if (isLoading) return <AuthLoadingRecovery onRetry={refreshProfile} />;
  if (user && accessError) return <AuthLoadingRecovery message="We couldn't verify your ResKonnect account access." onRetry={refreshProfile} showRecoveryImmediately />;

  if (!user || (isTumeloOnly && location.pathname !== TUMELO_DASHBOARD)) {
    return null;
  }

  return <>{children}</>;
};
