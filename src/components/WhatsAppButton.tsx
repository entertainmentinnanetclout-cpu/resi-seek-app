import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RESKONNECT_WHATSAPP_FORMATTED } from "@/lib/constants";

interface WhatsAppButtonProps {
  phone?: string;
  residenceName: string;
  variant?: "icon" | "button" | "full";
  className?: string;
}

const WhatsAppButton = ({
  phone,
  residenceName,
  variant = "button",
  className,
}: WhatsAppButtonProps) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // SECURITY: Always use ResKonnect's official number for residence inquiries
    // This prevents landlord contact details from being exposed in the code
    const formattedPhone = RESKONNECT_WHATSAPP_FORMATTED;

    const message = encodeURIComponent(
      `Hi! I'm interested in ${residenceName} on ResKonnect. I'd like to learn more about availability and booking.`
    );

    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${message}`;
    window.open(whatsappUrl, "_blank");
  };

  if (variant === "icon") {
    return (
      <button
        onClick={handleClick}
        className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300",
          "bg-success/10 text-success hover:bg-success hover:text-success-foreground",
          "hover:scale-110 active:scale-95",
          className
        )}
        aria-label="Contact on WhatsApp"
      >
        <MessageCircle className="w-5 h-5" />
      </button>
    );
  }

  if (variant === "full") {
    return (
      <Button
        onClick={handleClick}
        className={cn(
          "bg-success hover:bg-success/90 text-success-foreground gap-2 w-full",
          className
        )}
      >
        <MessageCircle className="w-4 h-4" />
        Chat on WhatsApp
      </Button>
    );
  }

  return (
    <Button
      onClick={handleClick}
      variant="outline"
      size="sm"
      className={cn(
        "gap-2 border-success/50 text-success hover:bg-success hover:text-success-foreground",
        className
      )}
    >
      <MessageCircle className="w-4 h-4" />
      WhatsApp
    </Button>
  );
};

export default WhatsAppButton;
