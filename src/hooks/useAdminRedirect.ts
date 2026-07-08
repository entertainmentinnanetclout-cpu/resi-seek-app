import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Hard guard hook that redirects staff users to their admin hub.
 */
export const useAdminRedirect = () => {
  const { staffRole, isGodMode, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && staffRole) {
      if (isGodMode) {
        navigate("/admin", { replace: true });
        return;
      }

      if (staffRole === 'tvet_lead') {
        navigate("/tvet-dashboard", { replace: true });
        return;
      }

      // Default fallback for other staff roles to their specialized dashboards if they exist
      const hubMap: Record<string, string> = {
        commerce_lead: "/commerce",
        growth_lead: "/media",
      };
      navigate(hubMap[staffRole] || "/dashboard", { replace: true });
    }
  }, [staffRole, isGodMode, isLoading, navigate]);

  return !isLoading && !!staffRole;
};
