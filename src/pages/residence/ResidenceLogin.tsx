import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthErrorMessage } from "@/lib/authErrors";
import SEO from "@/components/SEO";

const ResidenceLogin = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // If already logged in, check if they have residence portal access
  useEffect(() => {
    const checkExistingSession = async () => {
      if (user) {
        const { data: portalAccount } = await supabase
          .from('residence_portal_accounts')
          .select('residence_id, is_active')
          .eq('user_id', user.id)
          .single();

        if (portalAccount?.is_active) {
          navigate('/residence');
        }
      }
    };
    checkExistingSession();
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Sign in with email/password
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('Login failed');
      }

      // Check if user has residence portal access
      const { data: portalAccount, error: portalError } = await supabase
        .from('residence_portal_accounts')
        .select('residence_id, is_active')
        .eq('user_id', authData.user.id)
        .single();

      if (portalError || !portalAccount) {
        // Sign out since they don't have portal access
        await supabase.auth.signOut();
        toast.error('This account is not registered as a residence portal user');
        return;
      }

      if (!portalAccount.is_active) {
        await supabase.auth.signOut();
        toast.error('Your residence portal account has been deactivated');
        return;
      }

      toast.success('Welcome to the Residence Portal!');
      navigate('/residence');

    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(getAuthErrorMessage(error, 'Failed to login'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <SEO 
        title="Residence Portal Login | ResKonnect"
        description="Login to manage your residence applications on ResKonnect"
      />
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">Residence Portal</h1>
            <p className="text-muted-foreground">
              Manage your residence applications
            </p>
          </div>

          {/* Login Card */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle>Welcome back</CardTitle>
              <CardDescription>
                Sign in to access your residence dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="residence@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center text-sm text-muted-foreground">
            <p>
              Need access? Contact ResKonnect admin to set up your residence portal account.
            </p>
            <a href="/" className="text-primary hover:underline mt-2 inline-block">
              ← Back to ResKonnect
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

export default ResidenceLogin;
