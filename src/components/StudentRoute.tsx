import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import ContactDetailsGate from "@/components/ContactDetailsGate";
import AuthLoadingRecovery from "@/components/AuthLoadingRecovery";
import SafeRenderBoundary from "@/components/SafeRenderBoundary";
import { accountHome } from "@/lib/accountRouting";

export const StudentRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading, accessError, staffRole, adminDepartments, isStudent, isRecruiter, isPendingRecruiter, isTumeloPartner, refreshProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth", { replace: true });
    } else if (!isLoading && isTumeloPartner) {
      navigate("/partner/tumelo/os", { replace: true });
    } else if (!isLoading && staffRole) {
      navigate(accountHome({ staffRole, adminDepartments }), { replace: true });
    } else if (!isLoading && !isStudent && (isRecruiter || isPendingRecruiter)) {
      if (isRecruiter) navigate("/recruit/dashboard", { replace: true });
      else navigate("/recruit/apply", { replace: true });
    }
  }, [user, isLoading, staffRole, adminDepartments, isStudent, isRecruiter, isPendingRecruiter, isTumeloPartner, navigate]);

  if (isLoading) return <AuthLoadingRecovery message="Loading your ResKonnect dashboard…" onRetry={refreshProfile} />;
  if (user && accessError) return <AuthLoadingRecovery message="We couldn't verify your ResKonnect account access." onRetry={refreshProfile} showRecoveryImmediately />;

  if (!user || isTumeloPartner || staffRole || (!isStudent && (isRecruiter || isPendingRecruiter))) return null;

  return <SafeRenderBoundary name="student-contact-gate" fallback={<>{children}</>}><ContactDetailsGate>{children}</ContactDetailsGate></SafeRenderBoundary>;
};
