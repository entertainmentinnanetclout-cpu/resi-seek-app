import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import GodModeMfaGate from '@/components/admin/GodModeMfaGate';
import { accountHome } from '@/lib/accountRouting';
import AuthLoadingRecovery from '@/components/AuthLoadingRecovery';

export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const access = useAuth();
  const { user, isLoading: authLoading, accessError, staffRole, isGodMode, adminDepartments, refreshProfile } = access;
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading || accessError) return;

    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }

    if (!isGodMode) {
      navigate(accountHome(access), { replace: true });
    }
  }, [user, authLoading, accessError, staffRole, isGodMode, adminDepartments, navigate]);

  if (authLoading) return <AuthLoadingRecovery message="Verifying administrator access…" onRetry={refreshProfile} />;
  if (user && accessError) return <AuthLoadingRecovery message="We couldn't verify administrator access." onRetry={refreshProfile} showRecoveryImmediately />;

  // Fail closed while redirects settle. No sticky `ready` state is retained
  // across identity/role changes.
  if (!user || !isGodMode || !staffRole) return null;

  return <GodModeMfaGate>{children}</GodModeMfaGate>;
};
