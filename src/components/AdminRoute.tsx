import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading: authLoading } = useAuth();
  const [hasAdminRole, setHasAdminRole] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkRole = async () => {
      // Wait for auth to finish loading
      if (authLoading) return;
      
      if (!user) {
        console.log('AdminRoute: No user, redirecting to auth');
        navigate('/auth');
        return;
      }
      
      console.log('AdminRoute: Checking admin role for user:', user.id, user.email);
      
      try {
        const { data, error } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin'
        });
        
        console.log('AdminRoute: has_role result:', { data, error });
        
        if (error) {
          console.error('AdminRoute: Error checking role:', error);
          toast.error('Error verifying admin access');
          navigate('/dashboard');
          return;
        }
        
        setHasAdminRole(data || false);
        setLoading(false);
        
        if (!data) {
          console.log('AdminRoute: User is not admin, redirecting to dashboard');
          toast.error('Access denied: Admin privileges required');
          navigate('/dashboard');
        } else {
          console.log('AdminRoute: Admin access granted');
        }
      } catch (err) {
        console.error('AdminRoute: Exception checking role:', err);
        toast.error('Error verifying admin access');
        navigate('/dashboard');
      }
    };
    
    checkRole();
  }, [user, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Verifying access...</div>
      </div>
    );
  }
  
  return hasAdminRole ? <>{children}</> : null;
};
