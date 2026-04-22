import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Package, Gift, Percent } from "lucide-react";
import ShareButton from "@/components/ShareButton";
import type { ShareableType } from "@/lib/share";

interface MarketplaceCardProps {
  type: ShareableType;
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  price?: number;
  compareAtPrice?: number;
  badge?: string;
  outOfStock?: boolean;
  ctaLabel?: string;
  onClick?: () => void;
  onCart?: () => void;
  shareText?: string;
}

const TYPE_ICON: Record<string, any> = {
  product: Package,
  hamper: Gift,
  deal: Percent,
  residence: Package,
  bursary: Package,
};

/**
 * Unified marketplace card — used for products, hampers and deals.
 * Gives every category equal visual weight + sharing/cart actions.
 */
const MarketplaceCard = ({
  type,
  id,
  title,
  subtitle,
  imageUrl,
  price,
  compareAtPrice,
  badge,
  outOfStock,
  ctaLabel = "Add to Cart",
  onClick,
  onCart,
  shareText,
}: MarketplaceCardProps) => {
  const Icon = TYPE_ICON[type] || Package;
  const hasDiscount = compareAtPrice && price && compareAtPrice > price;
  const discountPct = hasDiscount
    ? Math.round(((compareAtPrice! - price!) / compareAtPrice!) * 100)
    : 0;

  return (
    <Card className="overflow-hidden group hover:shadow-lg transition-all flex flex-col">
      <div
        className="aspect-square overflow-hidden bg-muted relative cursor-pointer"
        onClick={onClick}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/placeholder.svg";
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon className="w-10 h-10 text-muted-foreground" />
          </div>
        )}

        {hasDiscount && (
          <Badge className="absolute top-2 left-2 bg-destructive text-destructive-foreground">
            -{discountPct}%
          </Badge>
        )}
        {badge && !hasDiscount && (
          <Badge variant="secondary" className="absolute top-2 left-2">
            {badge}
          </Badge>
        )}
        {outOfStock && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
            <Badge variant="secondary">Out of Stock</Badge>
          </div>
        )}

        {/* Share button — top right */}
        <div
          className="absolute top-2 right-2"
          onClick={(e) => e.stopPropagation()}
        >
          <ShareButton
            variant="icon"
            title={title}
            text={shareText || subtitle || title}
            type={type}
            id={id}
            className="bg-background/80 backdrop-blur-sm hover:bg-background h-8 w-8"
          />
        </div>
      </div>

      <div className="p-3 flex flex-col flex-1">
        {subtitle && (
          <p className="text-xs text-muted-foreground truncate mb-1">{subtitle}</p>
        )}
        <h3
          className="font-medium text-sm line-clamp-2 flex-1 cursor-pointer hover:text-primary transition-colors"
          onClick={onClick}
        >
          {title}
        </h3>
        {price !== undefined && (
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg font-bold text-primary">
              R{Number(price).toFixed(2)}
            </span>
            {hasDiscount && (
              <span className="text-xs text-muted-foreground line-through">
                R{Number(compareAtPrice).toFixed(2)}
              </span>
            )}
          </div>
        )}
        {onCart && !outOfStock && (
          <Button
            size="sm"
            variant="default"
            className="mt-2 w-full gap-1.5 h-8"
            onClick={(e) => {
              e.stopPropagation();
              onCart();
            }}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            {ctaLabel}
          </Button>
        )}
      </div>
    </Card>
  );
};

export default MarketplaceCard;
