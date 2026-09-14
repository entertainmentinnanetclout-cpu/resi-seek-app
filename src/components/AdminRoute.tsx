import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import GodModeMfaGate from '@/components/admin/GodModeMfaGate';
import { accountHome } from '@/lib/accountRouting';

export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const access = useAuth();
  const { user, isLoading: authLoading, staffRole, isGodMode, adminDepartments } = access;
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }

    if (!isGodMode) {
      navigate(accountHome(access), { replace: true });
    }
  }, [user, authLoading, staffRole, isGodMode, adminDepartments, navigate]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Verifying access...</div>
      </div>
    );
  }

  // Fail closed while redirects settle. No sticky `ready` state is retained
  // across identity/role changes.
  if (!user || !isGodMode || !staffRole) return null;

  return <GodModeMfaGate>{children}</GodModeMfaGate>;
};
