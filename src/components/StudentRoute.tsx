import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export const StudentRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading, staffRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth", { replace: true });
    } else if (!isLoading && staffRole) {
      // Redirect any staff user to their admin hub
      const hubMap: Record<string, string> = {
        admin: "/admin",
        operations_lead: "/admin/operations",
        commerce_lead: "/admin/commerce",
        growth_lead: "/admin/media",
        system_operator: "/admin/system",
        support_agent: "/admin/operations",
      };
      navigate(hubMap[staffRole] || "/admin", { replace: true });
    }
  }, [user, isLoading, staffRole, navigate]);

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

  if (!user || staffRole) {
    return null;
  }

  return <>{children}</>;
};
