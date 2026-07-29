import SEO from "@/components/SEO";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { z } from "zod";
import { RESKONNECT_BRAND } from "@/constants/brand";
import { Loader2, Chrome, ArrowLeft } from "lucide-react";
import { savePendingRecruiter, readPendingRecruiter, clearPendingRecruiter } from "@/lib/referrals/referralStorage";

const loginSchema = z.object({ email: z.string().email("Invalid email address"), password: z.string().min(1, "Password is required") });
const signupSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  phoneNumber: z.string().regex(/^(\+27|0)[6-8][0-9]{8}$/, "Invalid SA phone number")
}).refine((data) => data.password === data.confirmPassword, { message: "Passwords don't match", path: ["confirmPassword"] });

export default function RecruiterAuth() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  useEffect(() => {
    if (!authLoading && user) {
      const timer = setTimeout(() => {
        // Redirection logic is handled by Auth.tsx and the global flow,
        // but we can provide an extra guard here if needed.
        if (readPendingRecruiter() || returnTo === "/recruit/apply") {
          navigate("/recruit/apply", { replace: true });
        } else {
          navigate("/recruit/dashboard", { replace: true });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [user, authLoading, navigate, returnTo]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);

    try {
      const data = {
        email: formData.get("email") as string,
        password: formData.get("password") as string,
        ...(!isLogin && {
          fullName: formData.get("fullName") as string,
          confirmPassword: formData.get("confirmPassword") as string,
          phoneNumber: formData.get("phoneNumber") as string
        })
      };
      const schema = isLogin ? loginSchema : signupSchema;
      const validated = schema.parse(data);

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: validated.email, password: validated.password });
        if (error) throw error;
        toast.success("Welcome back, Recruiter!");
      } else {
        const signupData = validated as z.infer<typeof signupSchema>;
        savePendingRecruiter();
        const { error } = await supabase.auth.signUp({
          email: signupData.email,
          password: signupData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/recruit/auth`,
            data: {
              full_name: signupData.fullName,
              phone: signupData.phoneNumber,
              is_recruiter_intent: true
            }
          }
        });
        if (error) throw error;
        toast.success("Account created! Check your email to verify.");
        setIsLogin(true);
      }
    } catch (error: any) {
      const message = error instanceof z.ZodError ? error.issues[0].message : error.message || "An unexpected error occurred.";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <SEO title="Recruiter Auth | ResKonnect" description="Sign in or join as a student recruiter." />
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <img src={RESKONNECT_BRAND.loginIcon} alt={RESKONNECT_BRAND.name} className="mx-auto h-16 w-auto mb-6 object-contain" />
        <h2 className="text-3xl font-extrabold">Recruit Students. Earn with ResKonnect.</h2>
        <p className="mt-2 text-muted-foreground">Create a recruiter account to refer students and track your placements.</p>
      </div>

      <Card className="mt-8 mx-auto w-full max-w-md shadow-xl border-t-4 border-t-primary">
        <CardContent className="p-8">
          {error && <div className="bg-destructive/10 border border-destructive/50 text-destructive p-3 rounded-md mb-6 text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="space-y-1">
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" name="fullName" required placeholder="Your full name" />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" name="email" type="email" required placeholder="you@example.com" />
            </div>
            {!isLogin && (
              <div className="space-y-1">
                <Label htmlFor="phoneNumber">Phone Number (SA)</Label>
                <Input id="phoneNumber" name="phoneNumber" required placeholder="0821234567" />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required placeholder="••••••••" />
            </div>
            {!isLogin && (
              <div className="space-y-1">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input id="confirmPassword" name="confirmPassword" type="password" required placeholder="••••••••" />
              </div>
            )}

            <Button type="submit" className="w-full h-11" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLogin ? "Sign in as Recruiter" : "Create Recruiter Account"}
            </Button>

            <div className="text-center">
              <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-sm text-primary hover:underline">
                {isLogin ? "Don't have a recruiter account? Sign up" : "Already have a recruiter account? Sign in"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="mt-8 text-center">
        <Button variant="ghost" onClick={() => navigate("/recruit")} className="text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Recruitment Programme
        </Button>
      </div>
    </div>
  );
}
