import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Variant = "full" | "limited" | "available" | "new" | "featured";

const STYLES: Record<Variant, string> = {
  full: "bg-destructive text-destructive-foreground animate-pulse",
  limited: "bg-orange-500 text-white",
  available: "bg-green-500 text-white",
  new: "bg-blue-500 text-white",
  featured: "bg-amber-500 text-amber-950",
};

const LABELS: Record<Variant, string> = {
  full: "FULL",
  limited: "LIMITED",
  available: "AVAILABLE",
  new: "NEW",
  featured: "FEATURED",
};

export function StatusBadge({
  variant,
  label,
  className,
}: {
  variant: Variant;
  label?: string;
  className?: string;
}) {
  return (
    <Badge className={cn(STYLES[variant], "font-bold text-[10px] tracking-wide", className)}>
      {label ?? LABELS[variant]}
    </Badge>
  );
}

export function residenceStatus(residence: any): Variant {
  const spots = residence?.available_spots ?? 0;
  if (spots === 0) return "full";
  if (residence?.is_featured) return "featured";
  if (spots <= 5) return "limited";
  return "available";
}
