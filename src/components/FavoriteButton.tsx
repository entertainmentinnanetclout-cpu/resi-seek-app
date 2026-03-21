import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  residenceId: string;
  variant?: "icon" | "button";
  className?: string;
}

const FavoriteButton = ({ residenceId, variant = "icon", className }: FavoriteButtonProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      checkFavorite();
    }
  }, [user, residenceId]);

  const checkFavorite = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("residence_id", residenceId)
      .single();
    
    setIsFavorite(!!data);
  };

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save favorites",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      if (isFavorite) {
        await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("residence_id", residenceId);
        
        setIsFavorite(false);
        toast({
          title: "Removed from favorites",
          description: "Residence removed from your wishlist",
        });
      } else {
        await supabase
          .from("favorites")
          .insert({ user_id: user.id, residence_id: residenceId });
        
        setIsFavorite(true);
        toast({
          title: "Added to favorites",
          description: "Residence saved to your wishlist",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not update favorites",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (variant === "button") {
    return (
      <Button
        variant={isFavorite ? "default" : "outline"}
        size="sm"
        onClick={toggleFavorite}
        disabled={isLoading}
        className={cn("gap-2", className)}
      >
        <Heart
          className={cn(
            "w-4 h-4 transition-all",
            isFavorite && "fill-current"
          )}
        />
        {isFavorite ? "Saved" : "Save"}
      </Button>
    );
  }

  return (
    <button
      onClick={toggleFavorite}
      disabled={isLoading}
      className={cn(
        "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300",
        "hover:scale-110 active:scale-95",
        isFavorite
          ? "bg-destructive/10 text-destructive"
          : "bg-background/80 text-muted-foreground hover:text-destructive",
        className
      )}
      aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart
        className={cn(
          "w-5 h-5 transition-all",
          isFavorite && "fill-current animate-pulse",
          isLoading && "opacity-50"
        )}
      />
    </button>
  );
};

export default FavoriteButton;
