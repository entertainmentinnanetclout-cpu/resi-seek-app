import { lazy, Suspense, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
const ContactDetailsGate = lazy(() => import("@/components/ContactDetailsGate"));
import SafeRenderBoundary from "@/components/SafeRenderBoundary";
import { accountHome, isNativeApp } from "@/lib/accountRouting";

export const StudentRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading, staffRole, adminDepartments, isStudent, isRecruiter, isPendingRecruiter, isTumeloPartner } = useAuth();
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

  if (!user || isTumeloPartner || staffRole || (!isStudent && (isRecruiter || isPendingRecruiter))) return null;

  if (isNativeApp()) {
    return <SafeRenderBoundary name="native-student-route" fallback={<div className="p-6 text-sm">Your ResKonnect session is active. Reopen this page from the app navigation.</div>}>{children}</SafeRenderBoundary>;
  }

  return <SafeRenderBoundary name="student-contact-gate" fallback={<>{children}</>}><Suspense fallback={<>{children}</>}><ContactDetailsGate>{children}</ContactDetailsGate></Suspense></SafeRenderBoundary>;
};
