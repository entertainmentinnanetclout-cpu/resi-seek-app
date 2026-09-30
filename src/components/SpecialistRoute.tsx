import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, StaffRole } from "@/contexts/AuthContext";
import { toast } from "sonner";
import AuthLoadingRecovery from "@/components/AuthLoadingRecovery";

interface Props {
  children: React.ReactNode;
  allowedRoles: StaffRole[];
}

export const SpecialistRoute = ({ children, allowedRoles }: Props) => {
  const { user, isLoading, accessError, staffRole, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isLoading || accessError) return;
    if (!user) { navigate("/auth"); return; }
    if (!staffRole || !allowedRoles.includes(staffRole)) {
      toast.error("Access denied");
      navigate("/dashboard");
      return;
    }
    setReady(true);
  }, [user, isLoading, accessError, staffRole, navigate, allowedRoles]);

  if (isLoading) return <AuthLoadingRecovery message="Verifying specialist access…" onRetry={refreshProfile} />;
  if (user && accessError) return <AuthLoadingRecovery message="We couldn't verify specialist access." onRetry={refreshProfile} showRecoveryImmediately />;
  if (!ready || !user || !staffRole || !allowedRoles.includes(staffRole)) {
    return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Verifying access...</div>;
  }
  return <>{children}</>;
};
