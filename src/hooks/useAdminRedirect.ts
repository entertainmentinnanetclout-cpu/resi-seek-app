import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { accountHome } from "@/lib/accountRouting";

/**
 * Hard guard hook that redirects staff users to their admin hub.
 */
export const useAdminRedirect = () => {
  const access = useAuth();
  const { staffRole, isGodMode, isLoading, adminDepartments } = access;
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && staffRole) {
      navigate(accountHome(access), { replace: true });
    }
  }, [staffRole, isGodMode, isLoading, adminDepartments, navigate]);

  return !isLoading && !!staffRole;
};
