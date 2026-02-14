import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export const FloatingCTA = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [shouldPulse, setShouldPulse] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldPulse(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  if (user) return null;

  return (
    <div className="fixed bottom-24 right-6 z-40">
      <Button
        onClick={() => navigate("/auth")}
        size="lg"
        className={cn(
          "rounded-full shadow-2xl h-14 px-6 text-lg gap-2 transition-transform hover:scale-105 active:scale-95",
          shouldPulse && "animate-pulse ring-4 ring-primary/30"
        )}
      >
        <UserPlus className="w-5 h-5" />
        <span>Create Your Account</span>
      </Button>
    </div>
  );
};
