import { Scale, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompareButtonProps {
  isSelected: boolean;
  disabled?: boolean;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}

const CompareButton = ({ isSelected, disabled, onClick, className }: CompareButtonProps) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300",
        "hover:scale-110 active:scale-95",
        isSelected
          ? "bg-primary text-primary-foreground"
          : "bg-background/80 text-muted-foreground hover:text-primary",
        disabled && !isSelected && "opacity-50 cursor-not-allowed hover:scale-100",
        className
      )}
      aria-label={isSelected ? "Remove from comparison" : "Add to comparison"}
    >
      {isSelected ? (
        <Check className="w-5 h-5" />
      ) : (
        <Scale className="w-5 h-5" />
      )}
    </button>
  );
};

export default CompareButton;
