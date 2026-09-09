import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import GodModeMfaGate from '@/components/admin/GodModeMfaGate';

export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading: authLoading, staffRole, isGodMode } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }

    if (!isGodMode) {
      console.warn(`[AdminRoute] Access denied for role: ${staffRole}. Redirecting to specific dashboard.`);

      if (staffRole === 'tvet_lead') {
        navigate('/tvet-dashboard', { replace: true });
      } else if (staffRole === 'operations_lead' || staffRole === 'system_operator') {
        navigate('/dashboard', { replace: true });
      } else if (staffRole === 'commerce_lead') {
        navigate('/commerce', { replace: true });
      } else if (staffRole === 'growth_lead') {
        navigate('/media', { replace: true });
      } else {
        toast.error('Access denied: God Mode privileges required');
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, authLoading, staffRole, isGodMode, navigate]);

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
