import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export const OnboardingModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Show if not seen before and user is NOT logged in
    const hasSeen = localStorage.getItem("seenFindMyResIntro");
    if (!hasSeen && !user) {
      setIsOpen(true);
    }
  }, [user]);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem("seenFindMyResIntro", "true");
  };

  const handleSignup = () => {
    handleClose();
    navigate("/auth");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">Welcome to FindMyRes</DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            Browse NSFAS & Private Accommodations With Ease
          </DialogDescription>
        </DialogHeader>
        <div className="py-6 flex justify-center">
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center animate-bounce">
            <span className="text-4xl">🏠</span>
          </div>
        </div>
        <DialogFooter className="sm:justify-center flex-col gap-2">
          <Button onClick={handleSignup} size="lg" className="w-full text-lg h-12">
            Create Your Account
          </Button>
          <Button variant="ghost" onClick={handleClose} className="w-full">
            Maybe Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
