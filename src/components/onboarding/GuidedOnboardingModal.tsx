import React from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import GuidedOnboardingFlow from "./GuidedOnboardingFlow";

interface GuidedOnboardingModalProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const GuidedOnboardingModal: React.FC<GuidedOnboardingModalProps> = ({
  children,
  open,
  onOpenChange,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-2 sm:p-6">
        <GuidedOnboardingFlow />
      </DialogContent>
    </Dialog>
  );
};

export default GuidedOnboardingModal;