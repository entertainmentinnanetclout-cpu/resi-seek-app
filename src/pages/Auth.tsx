import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const Auth = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    // TODO: Implement actual authentication with Lovable Cloud
    // For now, simulate authentication
    setTimeout(() => {
      setIsLoading(false);
      if (isLogin) {
        toast.success("Welcome back!");
        navigate("/dashboard");
      } else {
        toast.success("Account created! Please complete your profile.");
        navigate("/setup-profile");
      }
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Building2 className="w-10 h-10 text-white" />
            <span className="text-2xl font-bold text-white">ResKonnect</span>
          </div>
          <p className="text-white/90">Your student accommodation portal</p>
        </div>

        <Card className="shadow-hover">
          <CardHeader>
            <CardTitle>{isLogin ? "Welcome Back" : "Create Account"}</CardTitle>
            <CardDescription>
              {isLogin 
                ? "Sign in to access your dashboard" 
                : "Join ResKonnect to find your perfect residence"}
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                className="w-full" 
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
                className="text-primary font-medium hover:underline"
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
            className="text-white hover:bg-white/10"
          >
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
