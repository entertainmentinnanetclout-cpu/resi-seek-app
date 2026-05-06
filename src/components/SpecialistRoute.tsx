import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, StaffRole } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  children: React.ReactNode;
  allowedRoles: StaffRole[];
}

export const SpecialistRoute = ({ children, allowedRoles }: Props) => {
  const { user, isLoading, staffRole } = useAuth();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { navigate("/auth"); return; }
    if (!staffRole || !allowedRoles.includes(staffRole)) {
      toast.error("Access denied");
      navigate("/dashboard");
      return;
    }
    setReady(true);
  }, [user, isLoading, staffRole, navigate, allowedRoles]);

  if (isLoading || !ready) {
    return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Verifying access...</div>;
  }
  return <>{children}</>;
};