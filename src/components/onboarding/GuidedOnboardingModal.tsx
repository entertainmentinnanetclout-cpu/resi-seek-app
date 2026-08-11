import React from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import GuidedOnboardingFlow from "./GuidedOnboardingFlow";
import { BRAND } from "@/constants/brand";

interface GuidedOnboardingModalProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Immersive full-screen guided onboarding overlay.
 * Navy command backdrop + glass panel, not a small dialog card.
 */
export const GuidedOnboardingModal: React.FC<GuidedOnboardingModalProps> = ({
  children,
  open,
  onOpenChange,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent
        hideClose
        className="left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-none border-0 bg-brand-navy p-0 text-white"
      >
        <DialogTitle className="sr-only">Get started with {BRAND.name}</DialogTitle>
        <DialogDescription className="sr-only">
          Guided onboarding to route you to the right ResKonnect service.
        </DialogDescription>

        {/* Ambient background */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="rk-orb absolute -left-24 top-10 h-80 w-80 rounded-full bg-brand-blue/25 blur-[110px]" />
          <div className="rk-orb absolute -right-16 bottom-0 h-96 w-96 rounded-full bg-brand-gold/15 blur-[120px]" />
        </div>

        <div className="relative flex min-h-[100dvh] flex-col">
          <div
            className="flex items-center justify-between px-4 pb-2 sm:px-8"
            style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
          >
            <img src={BRAND.logos.full} alt={BRAND.name} className="h-10 w-auto object-contain" />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close"
              onClick={() => onOpenChange?.(false)}
              className="text-white/70 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 px-2 pb-10 sm:px-6">
            <div className="mx-auto w-full max-w-4xl rounded-3xl border border-white/10 bg-white/[0.06] p-2 shadow-2xl backdrop-blur-xl sm:p-4">
              <div className="rounded-2xl bg-background text-foreground">
                <GuidedOnboardingFlow />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GuidedOnboardingModal;
