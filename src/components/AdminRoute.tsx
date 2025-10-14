import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [hasAdminRole, setHasAdminRole] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkRole = async () => {
      if (!user) {
        navigate('/auth');
        return;
      }
      
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });
      
      setHasAdminRole(data || false);
      setLoading(false);
      
      if (!data) {
        toast.error('Access denied: Admin privileges required');
        navigate('/dashboard');
      }
    };
    checkRole();
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Verifying access...</div>
      </div>
    );
  }
  
  return hasAdminRole ? <>{children}</> : null;
};
