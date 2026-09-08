import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const TUMELO_DASHBOARD = "/partner/tumelo/os";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading, isTumeloPartner, staffRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isTumeloOnly = !!user && isTumeloPartner && !staffRole;

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || (isTumeloOnly && location.pathname !== TUMELO_DASHBOARD)) {
    return null;
  }

  return <>{children}</>;
};
