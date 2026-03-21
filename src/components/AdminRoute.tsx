import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading: authLoading, staffRole } = useAuth();
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate('/auth');
      return;
    }

    // Any staff role grants access to admin panel
    if (!staffRole) {
      toast.error('Access denied: Staff privileges required');
      navigate('/dashboard');
      return;
    }

    setReady(true);
  }, [user, authLoading, staffRole, navigate]);

  if (authLoading || !ready) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Verifying access...</div>
      </div>
    );
  }

  return staffRole ? <>{children}</> : null;
};
