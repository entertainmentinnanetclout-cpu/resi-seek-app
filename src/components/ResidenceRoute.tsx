import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ResidencePortalAccount {
  residence_id: string;
  email: string;
  is_active: boolean;
}

export const ResidenceRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading: authLoading } = useAuth();
  const [portalAccount, setPortalAccount] = useState<ResidencePortalAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkResidenceAccess = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        // Check if user has a residence portal account
        const { data, error: fetchError } = await supabase
          .from('residence_portal_accounts')
          .select('residence_id, email, is_active')
          .eq('user_id', user.id)
          .single();

        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
            // No account found
            setError('No residence portal account found for this user');
          } else {
            throw fetchError;
          }
        } else if (data && !data.is_active) {
          setError('Your residence portal account has been deactivated');
        } else {
          setPortalAccount(data);
        }
      } catch (err: any) {
        console.error('Error checking residence access:', err);
        setError('Failed to verify residence portal access');
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading) {
      checkResidenceAccess();
    }
  }, [user, authLoading]);

  // Show loading while checking auth or portal access
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Verifying portal access...</p>
        </div>
      </div>
    );
  }

  // Redirect to residence login if not authenticated
  if (!user) {
    return <Navigate to="/residence/login" replace />;
  }

  // Show error message if access denied
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md p-6">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
            <span className="text-2xl">🔒</span>
          </div>
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">{error}</p>
          <p className="text-sm text-muted-foreground">
            If you believe this is an error, please contact ResKonnect support.
          </p>
          <a 
            href="/residence/login" 
            className="inline-block mt-4 text-primary hover:underline"
          >
            Return to login
          </a>
        </div>
      </div>
    );
  }

  // User is authorized - render children
  return <>{children}</>;
};

export default ResidenceRoute;
