import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import GodModeMfaGate from "@/components/admin/GodModeMfaGate";
import { AdminDepartmentKey, DEPARTMENT_BY_KEY } from "@/lib/adminDepartments";
import { toast } from "sonner";
import AuthLoadingRecovery from "@/components/AuthLoadingRecovery";

export default function DepartmentRoute({
  department,
  children,
}: {
  department: AdminDepartmentKey;
  children: React.ReactNode;
}) {
  const { user, isLoading, accessError, isGodMode, adminDepartments, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const allowed = isGodMode || adminDepartments.includes(department);

  useEffect(() => {
    if (isLoading || accessError) return;
    if (!user) {
      navigate("/auth", { replace: true });
      return;
    }
    if (!allowed) {
      const fallback = adminDepartments[0];
      toast.error(`Access denied: ${DEPARTMENT_BY_KEY[department].label}`);
      navigate(fallback ? DEPARTMENT_BY_KEY[fallback].path : "/dashboard", { replace: true });
    }
  }, [adminDepartments, allowed, department, isLoading, accessError, navigate, user]);

  if (isLoading) return <AuthLoadingRecovery message="Verifying department access…" onRetry={refreshProfile} />;
  if (user && accessError) return <AuthLoadingRecovery message="We couldn't verify department access." onRetry={refreshProfile} showRecoveryImmediately />;
  if (!user || !allowed) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Verifying department access…</div>;
  }

  return isGodMode ? <GodModeMfaGate>{children}</GodModeMfaGate> : <>{children}</>;
}
