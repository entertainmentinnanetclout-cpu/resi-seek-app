import { Shield, ShieldCheck, ShieldAlert, Star } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TrustScoreProps {
  verificationLevel?: string;
  averageRating?: number;
  reviewCount?: number;
  variant?: "badge" | "full";
  className?: string;
}

const TrustScore = ({
  verificationLevel = "basic",
  averageRating,
  reviewCount,
  variant = "badge",
  className,
}: TrustScoreProps) => {
  const getVerificationConfig = () => {
    switch (verificationLevel) {
      case "trusted_partner":
        return {
          icon: ShieldCheck,
          label: "Trusted Partner",
          color: "text-primary",
          bg: "bg-primary/10",
          description: "Verified landlord with excellent track record",
        };
      case "premium":
        return {
          icon: ShieldCheck,
          label: "Premium",
          color: "text-success",
          bg: "bg-success/10",
          description: "Verified and inspected property",
        };
      case "verified":
        return {
          icon: Shield,
          label: "Verified",
          color: "text-secondary",
          bg: "bg-secondary/10",
          description: "Identity and ownership verified",
        };
      default:
        return {
          icon: ShieldAlert,
          label: "Basic",
          color: "text-muted-foreground",
          bg: "bg-muted",
          description: "Standard listing",
        };
    }
  };

  const config = getVerificationConfig();
  const Icon = config.icon;

  if (variant === "badge") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
              config.bg,
              config.color,
              className
            )}
          >
            <Icon className="w-3 h-3" />
            {config.label}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium",
              config.bg,
              config.color
            )}
          >
            <Icon className="w-4 h-4" />
            {config.label}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>

      {averageRating !== undefined && reviewCount !== undefined && reviewCount > 0 && (
        <div className="flex items-center gap-1 text-sm">
          <Star className="w-4 h-4 fill-warning text-warning" />
          <span className="font-medium">{averageRating.toFixed(1)}</span>
          <span className="text-muted-foreground">({reviewCount})</span>
        </div>
      )}
    </div>
  );
};

export default TrustScore;
