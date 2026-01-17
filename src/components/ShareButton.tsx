import { useState } from "react";
import { Share2, Copy, Check, Facebook, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface ShareButtonProps {
  title: string;
  text: string;
  url?: string;
  imageUrl?: string;
  variant?: "icon" | "full" | "default";
  className?: string;
}

const ShareButton = ({
  title,
  text,
  url,
  imageUrl,
  variant = "default",
  className = "",
}: ShareButtonProps) => {
  const [copied, setCopied] = useState(false);
  
  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
  const fullText = `${title}\n\n${text}\n\n${shareUrl}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleWhatsAppShare = () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(fullText)}`;
    window.open(whatsappUrl, "_blank");
  };

  const handleFacebookShare = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(title)}`;
    window.open(facebookUrl, "_blank", "width=600,height=400");
  };

  const handleTwitterShare = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, "_blank", "width=600,height=400");
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or error
        console.log("Share cancelled");
      }
    } else {
      handleCopyLink();
    }
  };

  if (variant === "icon") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className={className}>
            <Share2 className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={handleWhatsAppShare} className="gap-2 cursor-pointer">
            <MessageCircle className="w-4 h-4 text-green-500" />
            WhatsApp
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleFacebookShare} className="gap-2 cursor-pointer">
            <Facebook className="w-4 h-4 text-blue-600" />
            Facebook
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleTwitterShare} className="gap-2 cursor-pointer">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            X (Twitter)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopyLink} className="gap-2 cursor-pointer">
            {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy Link"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (variant === "full") {
    return (
      <div className={`flex gap-2 ${className}`}>
        <Button
          variant="outline"
          size="sm"
          onClick={handleWhatsAppShare}
          className="gap-2 bg-green-500/10 hover:bg-green-500/20 text-green-600 border-green-500/30"
        >
          <MessageCircle className="w-4 h-4" />
          WhatsApp
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleFacebookShare}
          className="gap-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 border-blue-500/30"
        >
          <Facebook className="w-4 h-4" />
          Facebook
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopyLink}
          className="gap-2"
        >
          {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    );
  }

  // Default: single button with native share or dropdown
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleNativeShare}
      className={`gap-2 ${className}`}
    >
      <Share2 className="w-4 h-4" />
      Share
    </Button>
  );
};

export default ShareButton;
