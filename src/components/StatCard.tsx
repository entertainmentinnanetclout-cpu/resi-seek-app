import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  gradient?: string;
  trend?: {
    value: string;
    positive: boolean;
  };
  className?: string;
}

const StatCard = ({ icon: Icon, value, label, gradient = "bg-gradient-primary", trend, className }: StatCardProps) => {
  return (
    <Card className={cn("shadow-card hover:shadow-hover transition-smooth overflow-hidden group", className)}>
      <CardContent className="p-6 relative">
        {/* Background Icon */}
        <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <Icon className="w-32 h-32 text-card-foreground" />
        </div>

        {/* Content */}
        <div className="relative">
          <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-4", gradient)}>
            <Icon className="w-7 h-7 text-foreground" />
          </div>
          
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <div className="text-4xl font-bold text-card-foreground">
                {value}
              </div>
              {trend && (
                <span className={cn(
                  "text-sm font-medium",
                  trend.positive ? "text-success" : "text-destructive"
                )}>
                  {trend.positive ? "↑" : "↓"} {trend.value}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground font-medium">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StatCard;
