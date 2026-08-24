import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { resolveResidencePortalAccount } from "@/lib/residencePortal";

export const ResidenceRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const checkResidenceAccess = async () => {
      if (!user) {
        if (active) setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const account = await resolveResidencePortalAccount(user);
        if (!active) return;

        if (!account) {
          setAuthorized(false);
          setError("No residence portal access is linked to this account.");
          return;
        }

        if (!account.is_active) {
          setAuthorized(false);
          setError("This residence portal account is currently inactive.");
          return;
        }

        setAuthorized(true);
      } catch (err) {
        console.error("Error checking residence access:", err);
        if (active) {
          setAuthorized(false);
          setError("We could not verify your residence portal access. Please try again.");
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    if (!authLoading) void checkResidenceAccess();
    return () => { active = false; };
  }, [user, authLoading]);

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Opening your residence portal...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/residence/login" replace />;
  if (authorized) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-7 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <LockKeyhole className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-2xl font-bold">Residence portal unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{error}</p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <Button variant="outline" onClick={() => window.location.reload()}>Try again</Button>
          <Button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/residence/login"; }}>
            Sign in again
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ResidenceRoute;
