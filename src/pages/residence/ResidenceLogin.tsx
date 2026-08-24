import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthErrorMessage } from "@/lib/authErrors";
import { resolveResidencePortalAccount } from "@/lib/residencePortal";
import SEO from "@/components/SEO";
import { BRAND } from "@/constants/brand";

const ResidenceLogin = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(false);

  useEffect(() => {
    let active = true;

    const checkExistingSession = async () => {
      if (!user) return;
      setCheckingSession(true);
      try {
        const account = await resolveResidencePortalAccount(user);
        if (active && account?.is_active) navigate("/residence", { replace: true });
      } catch (err) {
        console.error("Residence portal session check failed:", err);
      } finally {
        if (active) setCheckingSession(false);
      }
    };

    void checkExistingSession();
    return () => { active = false; };
  }, [user, navigate]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      if (!data.user) throw new Error("Login failed");

      const portalAccount = await resolveResidencePortalAccount(data.user);
      if (!portalAccount) {
        await supabase.auth.signOut();
        toast.error("No residence portal access is linked to this email. Ask a ResKonnect administrator to add your residence.");
        return;
      }

      if (!portalAccount.is_active) {
        await supabase.auth.signOut();
        toast.error("This residence portal account is inactive. Please contact ResKonnect support.");
        return;
      }

      toast.success("Residence portal ready.");
      navigate("/residence", { replace: true });
    } catch (error: any) {
      console.error("Residence portal login error:", error);
      toast.error(getAuthErrorMessage(error, "Could not sign in to the residence portal"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <SEO title="Landlord Portal Login | ResKonnect" description="Sign in to review and manage applications for your ResKonnect accommodation listing." noIndex />
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/[0.045] p-4">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <Link to="/" aria-label="ResKonnect home" className="inline-flex justify-center">
              <img src={BRAND.logos.full} alt={BRAND.name} className="h-16 w-auto max-w-[260px] object-contain" />
            </Link>
            <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-primary">
              <ShieldCheck className="h-3.5 w-3.5" /> Landlord access
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight">Residence Portal</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Review applications, contact applicants and update decisions for your accommodation only.</p>
          </div>

          <Card className="border-primary/10 shadow-lg shadow-primary/5">
            <CardHeader>
              <CardTitle>Sign in</CardTitle>
              <CardDescription>Use the email connected to your residence portal account.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="residence-email">Email</Label>
                  <Input id="residence-email" type="email" autoComplete="email" placeholder="admin@yourresidence.co.za" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading || checkingSession} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="residence-password">Password</Label>
                  <div className="relative">
                    <Input id="residence-password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading || checkingSession} className="pr-11" />
                    <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground" aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" size="lg" className="w-full" disabled={isLoading || checkingSession}>
                  {(isLoading || checkingSession) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {checkingSession ? "Opening portal..." : isLoading ? "Signing in..." : "Open Residence Portal"}
                </Button>
              </form>

              <div className="mt-5 flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>Access is restricted to the residence linked to your account. Applications from other accommodations are not visible.</span>
              </div>
            </CardContent>
          </Card>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Need portal access or cannot sign in? Contact the ResKonnect administrator who manages your listing.</p>
            <Link to="/" className="mt-2 inline-block font-semibold text-primary hover:underline">Back to ResKonnect</Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default ResidenceLogin;
