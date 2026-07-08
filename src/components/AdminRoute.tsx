import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading: authLoading, staffRole, isGodMode } = useAuth();
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate('/auth');
      return;
    }

    // God Mode check for /admin routes
    if (!isGodMode) {
      console.warn(`[AdminRoute] Access denied for role: ${staffRole}. Redirecting to specific dashboard.`);

      // Role-specific safe redirects
      if (staffRole === 'tvet_lead') {
        navigate('/tvet-dashboard');
      } else if (staffRole === 'operations_lead' || staffRole === 'system_operator') {
        // Fallback for other leads until they have dedicated dashboards
        navigate('/dashboard');
      } else if (staffRole === 'commerce_lead') {
        navigate('/commerce');
      } else if (staffRole === 'growth_lead') {
        navigate('/media');
      } else {
        toast.error('Access denied: God Mode privileges required');
        navigate('/dashboard');
      }
      return;
    }

    setReady(true);
  }, [user, authLoading, staffRole, isGodMode, navigate]);

  if (authLoading || !ready) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Verifying access...</div>
      </div>
    );
  }

  return staffRole ? <>{children}</> : null;
};
