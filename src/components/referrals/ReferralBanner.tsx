import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readReferral, hideReferralBanner } from "@/lib/referrals/referralStorage";

export function ReferralBanner() {
  const [ref, setRef] = useState(() => readReferral());
  const [dismissed, setDismissed] = useState<boolean>(() => readReferral()?.bannerHidden ?? false);

  useEffect(() => {
    const onStorage = () => setRef(readReferral());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!ref?.code || dismissed) return null;

  return (
    <div className="relative rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 px-4 py-3 sm:px-6 sm:py-4 shadow-sm">
      <div className="flex items-start sm:items-center gap-3">
        <div className="rounded-full bg-primary/15 p-2 text-primary shrink-0">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm sm:text-base font-medium">
            Referral active — you were referred by{" "}
            <span className="font-semibold">{ref.agentName || "a ResKonnect Recruiter"}</span>.
          </p>
          <p className="text-xs text-muted-foreground">
            Code <span className="font-mono font-semibold">{ref.code}</span> is saved to your session. Keep browsing and submit your application.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Hide referral banner"
          onClick={() => { hideReferralBanner(); setDismissed(true); }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}