import SEO from "@/components/SEO";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { Loader2, Chrome } from "lucide-react";

import { TUT_CAMPUSES } from "@/lib/campuses";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[a-z]/, "Must contain at least one lowercase letter")
  .regex(/[0-9]/, "Must contain at least one number");

const loginSchema = z.object({ email: z.string().email("Invalid email address"), password: z.string().min(1, "Password is required") });
const signupSchema = z.object({ 
  fullName: z.string().min(2, "Full name must be at least 2 characters"), 
  email: z.string().email("Invalid email address"), 
  password: passwordSchema, 
  confirmPassword: z.string(),
  studentNumber: z.string().min(5, "Student number is required"),
  campus: z.string().min(1, "Please select your campus"),
  phoneNumber: z.string().regex(/^(\+27|0)[6-8][0-9]{8}$/, "Invalid SA phone number (e.g., 0821234567)")
}).refine((data) => data.password === data.confirmPassword, { message: "Passwords don't match", path: ["confirmPassword"] });

const Auth = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isAdmin } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCampus, setSelectedCampus] = useState("");
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  const { staffRole } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      const timer = setTimeout(() => {
        if (staffRole) {
          // Staff roles get routed to their default hub
          const hubMap: Record<string, string> = {
            admin: "/admin",
            operations_lead: "/admin/operations",
            commerce_lead: "/admin/commerce",
            growth_lead: "/admin/media",
            system_operator: "/admin/system",
            support_agent: "/admin/operations",
          };
          navigate(hubMap[staffRole] || "/admin", { replace: true });
        } else {
          navigate(returnTo || "/dashboard", { replace: true });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [user, authLoading, staffRole, navigate, returnTo]);

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
          studentNumber: formData.get("studentNumber") as string,
          campus: selectedCampus,
          phoneNumber: formData.get("phoneNumber") as string
        }) 
      };
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
      } else {
        const signupData = validated as z.infer<typeof signupSchema>;
        const { error } = await supabase.auth.signUp({ 
          email: signupData.email, 
          password: signupData.password, 
          options: { 
            emailRedirectTo: `${window.location.origin}/auth`, 
            data: { 
              full_name: signupData.fullName,
              student_number: signupData.studentNumber,
              campus: signupData.campus,
              phone: signupData.phoneNumber
            } 
          } 
        });
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

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message || "Failed to sign in with Google.");
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
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name <span className="text-destructive">*</span></Label>
                  <Input id="fullName" name="fullName" required placeholder="John Doe" />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address <span className="text-destructive">*</span></Label>
                <Input id="email" name="email" type="email" autoComplete="email" required placeholder="john@student.ac.za" />
              </div>
              
              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="studentNumber">Student Number <span className="text-destructive">*</span></Label>
                    <Input id="studentNumber" name="studentNumber" required placeholder="e.g., 221234567" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="campus">Campus <span className="text-destructive">*</span></Label>
                    <Select value={selectedCampus} onValueChange={setSelectedCampus} required>
                      <SelectTrigger id="campus">
                        <SelectValue placeholder="Select your campus" />
                      </SelectTrigger>
                      <SelectContent>
                        {TUT_CAMPUSES.map((campus) => (
                          <SelectItem key={campus.value} value={campus.value}>
                            {campus.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Phone Number <span className="text-destructive">*</span></Label>
                    <Input id="phoneNumber" name="phoneNumber" required placeholder="e.g., 0821234567" />
                  </div>
                </>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="password">Password <span className="text-destructive">*</span></Label>
                <Input id="password" name="password" type="password" autoComplete={isLogin ? "current-password" : "new-password"} required placeholder="••••••••" />
              </div>

              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password <span className="text-destructive">*</span></Label>
                    <Input id="confirmPassword" name="confirmPassword" type="password" required placeholder="••••••••" />
                  </div>
                  <div className="flex items-start gap-3">
                    <Checkbox id="terms" required />
                    <Label htmlFor="terms" className="text-sm text-muted-foreground -mt-1">
                      I agree to the <a href="/terms" className="underline hover:text-primary">Terms</a> and <a href="/privacy" className="underline hover:text-primary">Privacy Policy</a>.
                    </Label>
                  </div>
                </>
              )}

              {isLogin && (<div className="flex items-center justify-between"><div className="flex items-center gap-2"><Checkbox id="remember" /><Label htmlFor="remember" className="text-sm">Remember me</Label></div><div className="text-sm"><a href="#" className="font-medium text-primary hover:text-primary/90">Forgot your password?</a></div></div>)}

              <div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isLoading ? "Please wait" : isLogin ? "Sign In" : "Create Account"}
                </Button>
              </div>

              {isLogin && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                    </div>
                  </div>
                  
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full flex items-center justify-center gap-2"
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                  >
                    <Chrome className="h-5 w-5" />
                    Sign in with Google
                  </Button>
                </>
              )}
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
