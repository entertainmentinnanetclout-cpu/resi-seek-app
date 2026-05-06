import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Hard guard hook that redirects staff users to their admin hub.
 */
export const useAdminRedirect = () => {
  const { staffRole, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && staffRole) {
      const hubMap: Record<string, string> = {
        admin: "/admin",
        operations_lead: "/admin/operations",
        commerce_lead: "/commerce",
        growth_lead: "/media",
        system_operator: "/admin/system",
        support_agent: "/admin/operations",
      };
      navigate(hubMap[staffRole] || "/admin", { replace: true });
    }
  }, [staffRole, isLoading, navigate]);

  return !isLoading && !!staffRole;
};
