import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { z } from "zod";
import logo from "@/assets/ICON NO TEXT.png";

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required")
});

const signupSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: passwordSchema,
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const Auth = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    
    try {
      const data = {
        email: formData.get("email") as string,
        password: formData.get("password") as string,
        ...(isLogin ? {} : { 
          fullName: formData.get("fullName") as string,
          confirmPassword: formData.get("confirmPassword") as string 
        })
      };

      // Validate with zod
      const schema = isLogin ? loginSchema : signupSchema;
      const validated = schema.parse(data);

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: validated.email,
          password: validated.password,
        });

        if (error) {
          // Provide user-friendly error messages
          if (error.message.includes("Invalid login credentials")) {
            throw new Error("Invalid email or password. If you don't have an account, please sign up.");
          } else if (error.message.includes("Email not confirmed")) {
            throw new Error("Please verify your email address before logging in.");
          }
          throw error;
        }
        
        toast.success("Welcome back!");
        navigate("/dashboard");
      } else {
        const { error } = await supabase.auth.signUp({
          email: validated.email,
          password: validated.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              full_name: (validated as any).fullName,
            }
          },
        });

        if (error) {
          // Provide user-friendly signup error messages
          if (error.message.includes("already registered")) {
            throw new Error("This email is already registered. Please login instead.");
          }
          throw error;
        }
        
        toast.success("Account created successfully! You can now login.");
        setIsLogin(true); // Switch to login mode
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const message = error.issues[0].message;
        setError(message);
        toast.error(message);
      } else {
        const message = error.message || "An error occurred";
        setError(message);
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex justify-center mb-4">
            <img src={logo} alt="ResKonnect" className="h-20 w-auto" />
          </div>
          <p className="text-foreground text-lg">Your student accommodation portal</p>
        </div>

        <Card className="bg-surface shadow-md">
          <CardHeader>
            <CardTitle>{isLogin ? "Welcome Back" : "Create Account"}</CardTitle>
            <CardDescription>
              {isLogin 
                ? "Sign in to access your dashboard" 
                : "Join ResKonnect to find your perfect residence"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && <div className="bg-destructive text-destructive-foreground p-3 rounded-md mb-4">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <label htmlFor="fullName" className="text-sm font-medium mb-2 block">
                    Full Name
                  </label>
                  <Input 
                    id="fullName" 
                    name="fullName" 
                    required 
                    placeholder="John Doe" 
                  />
                </div>
              )}
              
              <div>
                <label htmlFor="email" className="text-sm font-medium mb-2 block">
                  Email Address
                </label>
                <Input 
                  id="email" 
                  name="email" 
                  type="email" 
                  required 
                  placeholder="john@student.ac.za" 
                />
              </div>

              <div>
                <label htmlFor="password" className="text-sm font-medium mb-2 block">
                  Password
                </label>
                <Input 
                  id="password" 
                  name="password" 
                  type="password" 
                  required 
                  placeholder="••••••••" 
                />
              </div>

              {!isLogin && (
                <>
                  <div>
                    <label htmlFor="confirmPassword" className="text-sm font-medium mb-2 block">
                      Confirm Password
                    </label>
                    <Input 
                      id="confirmPassword" 
                      name="confirmPassword" 
                      type="password" 
                      required 
                      placeholder="••••••••" 
                    />
                  </div>

                  <div className="flex items-start gap-2">
                    <Checkbox id="terms" required />
                    <label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed">
                      I agree to the terms and conditions and privacy policy
                    </label>
                  </div>
                </>
              )}

              {isLogin && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Checkbox id="remember" />
                    <label htmlFor="remember" className="text-muted-foreground">
                      Remember me
                    </label>
                  </div>
                  <button type="button" className="text-primary hover:underline">
                    Forgot password?
                  </button>
                </div>
              )}

              <Button 
                type="submit" 
                variant="default" 
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isLoading}
              >
                {isLoading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">
                {isLogin ? "Don't have an account?" : "Already have an account?"}
              </span>{" "}
              <button 
                onClick={() => setIsLogin(!isLogin)} 
                className="text-primary hover:underline font-semibold transition-colors duration-200"
              >
                {isLogin ? "Sign Up" : "Sign In"}
              </button>
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/")}
            className="text-foreground hover:bg-surface"
          >
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
