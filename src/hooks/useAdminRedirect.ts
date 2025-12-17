import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Hard guard hook that redirects admin users to /admin.
 * Use this inside student-only pages as a belt-and-suspenders
 * measure in case the route wrapper fails.
 */
export const useAdminRedirect = () => {
  const { isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAdmin) {
      navigate("/admin", { replace: true });
    }
  }, [isAdmin, isLoading, navigate]);

  // Return true if we should block rendering (admin detected)
  return !isLoading && isAdmin;
};
