import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    
    // Format phone number (remove spaces, add country code if needed)
    let formattedPhone = phone?.replace(/\s+/g, "") || "";
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "27" + formattedPhone.slice(1);
    }
    if (!formattedPhone.startsWith("+") && !formattedPhone.startsWith("27")) {
      formattedPhone = "27" + formattedPhone;
    }

    const message = encodeURIComponent(
      `Hi! I'm interested in ${residenceName} on ResKonnect. I'd like to learn more about availability and booking.`
    );

    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${message}`;
    window.open(whatsappUrl, "_blank");
  };

  if (!phone) return null;

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
