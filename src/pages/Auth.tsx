import SEO from "@/components/SEO";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { z } from "zod";
import logo from "@/assets/LIGHT THEME Login Page Icon.png";
import { Loader2 } from "lucide-react";

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[a-z]/, "Must contain at least one lowercase letter")
  .regex(/[0-9]/, "Must contain at least one number");

const loginSchema = z.object({ email: z.string().email("Invalid email address"), password: z.string().min(1, "Password is required") });
const signupSchema = z.object({ fullName: z.string().min(2, "Full name must be at least 2 characters"), email: z.string().email("Invalid email address"), password: passwordSchema, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, { message: "Passwords don't match", path: ["confirmPassword"] });

const Auth = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) navigate("/dashboard", { replace: true });
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    
    try {
      const data = { email: formData.get("email") as string, password: formData.get("password") as string, ...(!isLogin && { fullName: formData.get("fullName") as string, confirmPassword: formData.get("confirmPassword") as string }) };
      const schema = isLogin ? loginSchema : signupSchema;
      const validated = schema.parse(data);

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: validated.email, password: validated.password });
        if (error) {
            if (error.message.includes("Invalid login credentials")) throw new Error("Invalid email or password. Please try again or sign up.");
            if (error.message.includes("Email not confirmed")) throw new Error("Please verify your email address before logging in.");
            throw error;
        }
        toast.success("Welcome back!");
        navigate("/dashboard");
      } else {
        const { error } = await supabase.auth.signUp({ email: (validated as any).email, password: (validated as any).password, options: { emailRedirectTo: `${window.location.origin}/dashboard`, data: { full_name: (validated as any).fullName } } });
        if (error) {
            if (error.message.includes("already registered")) throw new Error("This email is already registered. Please login instead.");
            throw error;
        }
        toast.success("Account created! Please check your email to verify your account.");
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
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <SEO
        title="Login to Your Dashboard | ResKonnect"
        description="Access your student profile…"
      />
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <img src={logo} alt="ResKonnect" className="mx-auto h-16 w-auto" />
          <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">{isLogin ? "Sign in to your account" : "Create a new account"}</h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Or{" "}
            <button onClick={() => { setIsLogin(!isLogin); setError(null); }} className="font-medium text-primary hover:text-primary/90">
              {isLogin ? "start your journey" : "access your dashboard"}
            </button>
          </p>
        </div>

        <Card className="mt-8 mx-auto w-full max-w-md shadow-xl">
          <CardContent className="p-6 sm:p-8">
            {error && <div className="bg-destructive/10 border border-destructive/50 text-destructive p-3 rounded-md mb-4 text-sm">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-6">
              {!isLogin && (<div className="space-y-2"><Label htmlFor="fullName">Full Name</Label><Input id="fullName" name="fullName" required placeholder="John Doe" /></div>)}
              <div className="space-y-2"><Label htmlFor="email">Email Address</Label><Input id="email" name="email" type="email" autoComplete="email" required placeholder="john@student.ac.za" /></div>
              <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" autoComplete="current-password" required placeholder="••••••••" /></div>

              {!isLogin && (
                <>
                  <div className="space-y-2"><Label htmlFor="confirmPassword">Confirm Password</Label><Input id="confirmPassword" name="confirmPassword" type="password" required placeholder="••••••••" /></div>
                  <div className="flex items-start gap-3"><Checkbox id="terms" required /><Label htmlFor="terms" className="text-sm text-muted-foreground -mt-1">I agree to the <a href="#" className="underline hover:text-primary">Terms</a> and <a href="#" className="underline hover:text-primary">Privacy Policy</a>.</Label></div>
                </>
              )}

              {isLogin && (<div className="flex items-center justify-between"><div className="flex items-center gap-2"><Checkbox id="remember" /><Label htmlFor="remember" className="text-sm">Remember me</Label></div><div className="text-sm"><a href="#" className="font-medium text-primary hover:text-primary/90">Forgot your password?</a></div></div>)}

              <div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isLoading ? "Please wait" : isLogin ? "Sign In" : "Create Account"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="text-center mt-8">
          <Button variant="ghost" onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">Back to Home</Button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
