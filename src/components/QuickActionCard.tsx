import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickActionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  gradient: string;
  onClick: () => void;
}

/**
 * QuickActionCard component - A clickable card for navigating to key sections of the dashboard.
 *
 * @component
 * @param {QuickActionCardProps} props - Component props.
 * @param {LucideIcon} props.icon - The icon to display on the card.
 * @param {string} props.title - The title of the action.
 * @param {string} props.description - A brief description of the action.
 * @param {string} props.gradient - The CSS gradient class for the card's accent.
 * @param {() => void} props.onClick - The function to call when the card is clicked.
 * @returns {JSX.Element} The rendered quick action card.
 */
const QuickActionCard = ({ icon: Icon, title, description, gradient, onClick }: QuickActionCardProps) => {
  return (
    <Card 
      className="shadow-card hover:shadow-premium transition-smooth cursor-pointer group overflow-hidden"
      onClick={onClick}
    >
      <CardContent className="p-6 relative">
        {/* Gradient Accent */}
        <div className={cn("absolute top-0 right-0 w-32 h-32 opacity-10 group-hover:opacity-20 transition-opacity rounded-full blur-3xl", gradient)} />
        
        {/* Content */}
        <div className="relative flex items-start gap-4">
          <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform", gradient)}>
            <Icon className="w-7 h-7 text-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg mb-1 text-card-foreground group-hover:text-accent transition-colors">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0 group-hover:text-accent group-hover:translate-x-1 transition-all" />
        </div>
      </CardContent>
    </Card>
  );
};

export default QuickActionCard;
